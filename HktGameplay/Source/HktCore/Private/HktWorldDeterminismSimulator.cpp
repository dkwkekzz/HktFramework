// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldDeterminismSimulator.h"
#include "VM/HktVMRuntime.h"
#include "VM/HktVMInterpreter.h"
#include "VM/HktVMContext.h"
#include "VM/HktVMProgram.h"
#include "HktCoreProperties.h"
#include "HktSimulationLimits.h"

#if ENABLE_HKT_INSIGHTS
#include "HktCoreDataCollector.h"
#include "HktCoreDefs.h"
#endif

FHktWorldDeterminismSimulator::FHktWorldDeterminismSimulator(EHktLogSource InLogSource)
    : LogSource(InLogSource)
    , SourceName(FString(GetLogSourceName(InLogSource)))
{
    WorldState.Initialize();
    VMProxy.Initialize(WorldState);

    // LogSource를 서브시스템에 전파
    WorldState.LogSource = LogSource;
    EntityArrangeSystem.LogSource = LogSource;
    VMBuildSystem.LogSource = LogSource;
    VMProcessSystem.LogSource = LogSource;
    GravitySystem.LogSource = LogSource;
    MovementSystem.LogSource = LogSource;
    PhysicsSystem.LogSource = LogSource;
    VMCleanupSystem.LogSource = LogSource;

    ActiveVMs.Reserve(HktLimits::MaxVMs);
    CompletedVMs.Reserve(HktLimits::MaxVMs);
    GeneratedPhysicsEvents.Reserve(HktLimits::MaxPhysicsEvents);
    PendingExternalEvents.Reserve(HktLimits::MaxPendingEvents);
    GeneratedMoveEndEvents.Reserve(HktLimits::MaxPendingEvents);
    GeneratedGroundedEvents.Reserve(HktLimits::MaxPendingEvents);
    FrameRemovedEntities.Reserve(256);
    DispatchedEvents.Reserve(16);
    FramePreMovePositions.Reserve(HktLimits::MaxEntities);
    EntityArrangeSystem.ScratchRemoveList.Reserve(HktLimits::MaxEntities);
    VMProcessSystem.ScratchEvents.Reserve(HktLimits::MaxPendingEvents);
    PhysicsSystem.SortedEntitiesScratch.Reserve(HktLimits::MaxEntities);

    PendingVoxelDeltas.Reserve(256);

    VMPool = MakeUnique<FHktVMRuntimePool>();
    Interpreter = MakeUnique<FHktVMInterpreter>();
    Interpreter->Initialize(&WorldState, &VMProxy, &TerrainState, &PendingVoxelDeltas);
    Interpreter->LogSource = LogSource;
    VMProcessSystem.Interpreter = Interpreter.Get();
}

FHktWorldDeterminismSimulator::~FHktWorldDeterminismSimulator() = default;

void FHktWorldDeterminismSimulator::ProcessBatch(const FHktSimulationEvent& Event)
{
    WorldState.FrameNumber = Event.FrameNumber;
    WorldState.RandomSeed = Event.RandomSeed;
    VMProxy.ResetDirtyIndices(WorldState);

    EntityArrangeSystem.Process(WorldState, Event.RemovedOwnerIds);
    FrameRemovedEntities = EntityArrangeSystem.ScratchRemoveList;

    // Terrain: 엔티티 위치 + 이벤트 Location 기반 청크 로드/언로드
    if (TerrainGenerator)
    {
        PendingVoxelDeltas.Reset();
        TerrainSystem.Process(WorldState, TerrainState, *TerrainGenerator, &Event.NewEvents);
    }

    VMBuildSystem.Process(Event.NewEvents, static_cast<int32>(Event.FrameNumber),
                          *VMPool, ActiveVMs, WorldState, VMProxy, SourceName);

    // VM 실행 + DispatchEvent 수집 루프 (최대 4회 반복으로 무한 루프 방지)
    static constexpr int32 MaxDispatchRounds = 4;
    for (int32 Round = 0; Round < MaxDispatchRounds; ++Round)
    {
        VMProcessSystem.Process(ActiveVMs, CompletedVMs, *VMPool,
                                Event.DeltaSeconds, PendingExternalEvents);

        // 모든 VM에서 PendingDispatchedEvents를 수집
        DispatchedEvents.Reset();
        VMPool->ForEachActive([&](FHktVMHandle Handle, FHktVMRuntime& Runtime)
        {
            if (Runtime.PendingDispatchedEvents.Num() > 0)
            {
                DispatchedEvents.Append(Runtime.PendingDispatchedEvents);
                Runtime.PendingDispatchedEvents.Reset();
            }
        });
        // 완료된 VM에서도 수집
        for (FHktVMHandle Handle : CompletedVMs)
        {
            FHktVMRuntime* Runtime = VMPool->Get(Handle);
            if (Runtime && Runtime->PendingDispatchedEvents.Num() > 0)
            {
                DispatchedEvents.Append(Runtime->PendingDispatchedEvents);
                Runtime->PendingDispatchedEvents.Reset();
            }
        }

        if (DispatchedEvents.Num() == 0)
            break;

        // 디스패치된 이벤트를 새로운 VM으로 빌드
        VMBuildSystem.Process(DispatchedEvents, static_cast<int32>(Event.FrameNumber),
                              *VMPool, ActiveVMs, WorldState, VMProxy, SourceName);
    }

    // Gravity → Movement → Physics 순서: 중력이 VelZ 를 세팅, Movement 는 순수 적분,
    // Physics Phase 1 이 지형 제약(벽/계단/천장/지면)을 해결한다.
#if ENABLE_HKT_INSIGHTS
    if (!TerrainGenerator && Event.FrameNumber % 300 == 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("[HktSim] TerrainGenerator is NULL — Physics Phase1 (floor snap) 비활성. "
            "SetTerrainConfig() 호출 여부 확인 필요. LoadedChunks=%d"),
            TerrainState.LoadedChunks.Num());
    }
#endif

    GravitySystem.Process(WorldState, VMProxy, FixedDeltaSeconds);

    MovementSystem.Process(WorldState, VMProxy, GeneratedMoveEndEvents,
                           FramePreMovePositions, FixedDeltaSeconds);
    for (const FHktPendingEvent& ME : GeneratedMoveEndEvents)
    {
        PendingExternalEvents.Add(ME);
    }

    PhysicsSystem.Process(WorldState, VMProxy,
                          GeneratedPhysicsEvents,
                          GeneratedGroundedEvents,
                          FramePreMovePositions,
                          TerrainGenerator ? &TerrainState : nullptr,
                          FixedDeltaSeconds);

    for (const FHktPendingEvent& GE : GeneratedGroundedEvents)
    {
        PendingExternalEvents.Add(GE);
    }

    for (const FHktPhysicsEvent& PE : GeneratedPhysicsEvents)
    {
        FHktPendingEvent PA;
        PA.Type = EWaitEventType::Collision;
        PA.WatchedEntity = PE.EntityA;
        PA.HitEntity = PE.EntityB;
        PendingExternalEvents.Add(PA);

        FHktPendingEvent PB;
        PB.Type = EWaitEventType::Collision;
        PB.WatchedEntity = PE.EntityB;
        PB.HitEntity = PE.EntityA;
        PendingExternalEvents.Add(PB);
    }

    // 물리/이동 이벤트를 같은 프레임 내에서 즉시 소비 — 1프레임 지연 제거
    if (PendingExternalEvents.Num() > 0)
    {
        VMProcessSystem.Process(ActiveVMs, CompletedVMs, *VMPool,
                                Event.DeltaSeconds, PendingExternalEvents);
    }

    VMCleanupSystem.Process(CompletedVMs, *VMPool, WorldState, VMProxy);
}

FHktSimulationDiff FHktWorldDeterminismSimulator::AdvanceFrame(const FHktSimulationEvent& InEvent)
{
    for (const FHktEntityState& ES : InEvent.NewEntityStates)
    {
        WorldState.ImportEntityState(ES);
    }

    FHktEntityId PrevNext = WorldState.NextEntityId;

    // 제거 대상 엔티티 상태를 ProcessBatch 전에 캡처 (UndoDiff 복원용)
    TArray<FHktEntityState> PreRemoveStates;
    for (int64 OwnerId : InEvent.RemovedOwnerIds)
    {
        WorldState.ForEachEntityByOwner(OwnerId, [&](FHktEntityId Id, int32)
        {
            PreRemoveStates.Add(WorldState.ExtractEntityState(Id));
        });
    }

    ProcessBatch(InEvent);

    FHktSimulationDiff Diff;
    Diff.FrameNumber = InEvent.FrameNumber;
    Diff.PrevNextEntityId = PrevNext;
    Diff.RemovedEntities = MoveTemp(FrameRemovedEntities);
    Diff.RemovedEntityStates = MoveTemp(PreRemoveStates);

    for (FHktEntityId Id = PrevNext; Id < WorldState.NextEntityId; ++Id)
        if (WorldState.IsValidEntity(Id))
            Diff.SpawnedEntities.Add(WorldState.ExtractEntityState(Id));

    VMProxy.ForEachDirtyEntity(WorldState, [&](FHktEntityId Id, int32 Slot, uint64 Mask)
    {
        if (Id >= PrevNext) return;
        uint64 M = Mask;
        while (M)
        {
            uint16 PropId = static_cast<uint16>(FMath::CountTrailingZeros64(M));
            int32 NewVal = WorldState.Get(Slot, PropId);
            int32 OldVal = VMProxy.GetPreFrameValue(Slot, PropId);
            Diff.PropertyDeltas.Add({ Id, PropId, NewVal, OldVal });
            M &= M - 1;
        }
    });
    VMProxy.ForEachTagDirtyEntity(WorldState, [&](FHktEntityId Id, int32 Slot)
    {
        if (Id >= PrevNext) return;
        FHktTagDelta Delta;
        Delta.EntityId = Id;
        Delta.Tags = WorldState.GetTagsBySlot(Slot);
        Delta.OldTags = VMProxy.GetPreFrameTags(Slot);
        Diff.TagDeltas.Add(MoveTemp(Delta));
    });
    VMProxy.ForEachOwnerDirtyEntity(WorldState, [&](FHktEntityId Id, int32 Slot)
    {
        if (Id >= PrevNext) return;
        FHktOwnerDelta Delta;
        Delta.EntityId = Id;
        Delta.NewOwnerUid = WorldState.OwnerUids[Slot];
        Delta.OldOwnerUid = VMProxy.GetPreFrameOwnerUid(Slot);
        Diff.OwnerDeltas.Add(Delta);
    });

    Diff.VFXEvents = MoveTemp(VMProxy.PendingVFXEvents);
    Diff.AnimEvents = MoveTemp(VMProxy.PendingAnimEvents);
    Diff.VoxelDeltas = MoveTemp(PendingVoxelDeltas);

#if ENABLE_HKT_INSIGHTS
    if (!SourceName.IsEmpty())
    {
        // 카테고리: "WorldState.{SourceName}" (예: "WorldState.Server", "WorldState.Client")
        const FString WsCat = FString::Printf(TEXT("WorldState.%s"), *SourceName);
        HKT_INSIGHT_CLEAR_CATEGORY(WsCat);

        // 프레임 메타 정보
        HKT_INSIGHT_COLLECT(WsCat, TEXT("_Frame"),
            FString::Printf(TEXT("%lld"), WorldState.FrameNumber));
        HKT_INSIGHT_COLLECT(WsCat, TEXT("_EntityCount"),
            FString::FromInt(WorldState.GetEntityCount()));

        // 엔티티별 속성 요약
        WorldState.ForEachEntity([&](FHktEntityId Id, int32 Slot)
        {
            FString PropSummary;

            // 엔티티 디버그 정보
            const FHktWorldState::FHktEntityDebugInfo* DebugInfo = WorldState.GetEntityDebugInfo(Id);
            if (DebugInfo)
            {
                if (!DebugInfo->DebugName.IsEmpty())
                {
                    PropSummary += FString::Printf(TEXT("DebugName=%s"), *DebugInfo->DebugName);
                }
                if (!DebugInfo->ClassTag.IsEmpty())
                {
                    PropSummary += FString::Printf(TEXT(" | ClassTag=%s"), *DebugInfo->ClassTag);
                }
                if (!DebugInfo->StoryTag.IsEmpty())
                {
                    PropSummary += FString::Printf(TEXT(" | StoryTag=%s"), *DebugInfo->StoryTag);
                }
                if (DebugInfo->CreationFrame > 0)
                {
                    PropSummary += FString::Printf(TEXT(" | CreationFrame=%lld"), DebugInfo->CreationFrame);
                }
            }

            // Archetype 정보
            EHktArchetype ArchType = WorldState.EntityArchetypes[Slot];
            if (ArchType != EHktArchetype::None)
            {
                const FHktArchetypeMetadata* Meta = FHktArchetypeRegistry::Get().Find(ArchType);
                if (Meta)
                {
                    PropSummary += FString::Printf(TEXT(" | Archetype=%s"), Meta->Name);
                }
            }

            const FGameplayTagContainer& SlotTags = WorldState.GetTagsBySlot(Slot);
            PropSummary += FString::Printf(TEXT(" | Tags=%s"), *SlotTags.ToStringSimple());
            PropSummary += FString::Printf(TEXT(" | Owner=%lld"), WorldState.GetOwnerUid(Id));
            for (uint16 PropId = 0; PropId < PropertyId::MaxCount(); ++PropId)
            {
                const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
                if (!PropName) continue;
                int32 Val = WorldState.Get(Slot, PropId);
                if (Val == 0) continue;
                PropSummary += FString::Printf(TEXT(" | %s=%d"), PropName, Val);
            }

            FString EntityKey = FString::Printf(TEXT("E_%d"), Id);
            HKT_INSIGHT_COLLECT(WsCat, EntityKey, PropSummary);
        });
    }
#endif

    return Diff;
}

FHktPlayerState FHktWorldDeterminismSimulator::ExportPlayerState(int64 OwnerUid) const
{
    FHktPlayerState Out;
    Out.PlayerUid = OwnerUid;

    WorldState.ForEachEntityByOwner(OwnerUid, [&](FHktEntityId Id, int32 /*Slot*/)
    {
        Out.OwnedEntities.Add(WorldState.ExtractEntityState(Id));
    });

    for (const FHktEvent& E : WorldState.ActiveEvents)
        if (WorldState.IsValidEntity(E.SourceEntity))
            if (WorldState.GetOwnerUid(E.SourceEntity) == OwnerUid)
                Out.ActiveEvents.Add(E);

    return Out;
}

void FHktWorldDeterminismSimulator::RestoreWorldState(const FHktWorldState& InState)
{
    const EHktLogSource SavedLogSource = WorldState.LogSource;
    WorldState.CopyFrom(InState);
    WorldState.LogSource = SavedLogSource;
}

void FHktWorldDeterminismSimulator::UndoDiff(const FHktSimulationDiff& Diff)
{
    WorldState.UndoDiff(Diff);
}

void FHktWorldDeterminismSimulator::SetTerrainConfig(const FHktTerrainGeneratorConfig& Config)
{
    // Interpreter의 TerrainState/PendingVoxelDeltas 포인터는 생성자에서 이미 전달됨.
    // Generator만 생성하면 ProcessBatch의 if(TerrainGenerator) 가드가 지형 파이프라인을 활성화.
    TerrainGenerator = MakeUnique<FHktTerrainGenerator>(Config);

    // 첫 LoadChunk 호출 전에도 TerrainState가 조회될 수 있으므로 VoxelSize를 즉시 전파
    TerrainState.VoxelSizeCm = Config.VoxelSizeCm;
}

// ============================================================================
// Factory
// ============================================================================

TUniquePtr<IHktDeterminismSimulator> CreateDeterminismSimulator(EHktLogSource InLogSource)
{
    return MakeUnique<FHktWorldDeterminismSimulator>(InLogSource);
}
