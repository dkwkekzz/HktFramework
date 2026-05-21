// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldDeterminismSimulator.h"
#include "HktCoreLog.h"
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
#include "HktVMEventRecorder.h"
#include "HktCoreEventLog.h"

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

    // I-0014: 서버 권위 시뮬레이터만 Placement / Spawner 이벤트를 emit.
    // 클라 ProxySimulator 는 미드조인 시 placement 재발화를 막아야 한다 (중복 spawn 방지).
    TerrainSystem.bIsAuthoritative = (InLogSource == EHktLogSource::Server);

    ActiveVMs.Reserve(HktLimits::MaxVMs);
    CompletedVMs.Reserve(HktLimits::MaxVMs);
    GeneratedPhysicsEvents.Reserve(HktLimits::MaxPhysicsEvents);
    PendingExternalEvents.Reserve(HktLimits::MaxPendingEvents);
    GeneratedMoveEndEvents.Reserve(HktLimits::MaxPendingEvents);
    GeneratedGroundedEvents.Reserve(HktLimits::MaxPendingEvents);
    DispatchedEvents.Reserve(16);
    FramePreMovePositions.Reserve(HktLimits::MaxEntities);
    EntityArrangeSystem.ScratchRemoveList.Reserve(HktLimits::MaxEntities);
    VMProcessSystem.ScratchEvents.Reserve(HktLimits::MaxPendingEvents);

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

    // Terrain: 엔티티 위치 + 이벤트 Location 기반 청크 로드/언로드
    // + Terrain Spawner 통합 (Docs/Design-VoxelSpawner.md §7): 새로 로드된 청크의
    //   spawner 메타가 `TerrainSystem.EmittedSpawnerEvents` 로 흘러나온다.
    if (TerrainSource)
    {
        PendingVoxelDeltas.Reset();
        TerrainSystem.Process(WorldState, TerrainState, *TerrainSource, &Event.NewEvents);
    }

    // VMBuildSystem 입력: 외부 NewEvents + 본 프레임에 chunk-load 로 dispatch 된 spawner 이벤트.
    // EventId 는 SlotHash 기반 결정론 값을 부여 (Insights 만 사용; VM 동작 영향 없음).
    //
    // I-0027: server 권위 시뮬레이터에서 emit 된 event 사본을 CapturedSpawnerEvents 에 보관.
    // 호출자 (서버 rule) 가 AdvanceFrame 직후 GetEmittedSpawnerEvents() 로 가져가 batch.NewEvents
    // 에 putback → client 도 동일 event 받아 deterministic 하게 Birch_Spawn 등을 재실행한다.
    // 본 캡처는 매 ProcessBatch 진입 시 reset 되어 누적되지 않음.
    CapturedSpawnerEvents.Reset();
    if (TerrainSource && TerrainSystem.EmittedSpawnerEvents.Num() > 0)
    {
        CapturedSpawnerEvents = TerrainSystem.EmittedSpawnerEvents;  // 복사 — 아래 MoveTemp 직전에 보존
        TArray<FHktEvent> MergedEvents;
        MergedEvents.Reserve(Event.NewEvents.Num() + TerrainSystem.EmittedSpawnerEvents.Num());
        MergedEvents.Append(Event.NewEvents);
        MergedEvents.Append(MoveTemp(TerrainSystem.EmittedSpawnerEvents));
        VMBuildSystem.Process(MergedEvents, static_cast<int32>(Event.FrameNumber),
                              *VMPool, ActiveVMs, WorldState, VMProxy, SourceName);
    }
    else
    {
        VMBuildSystem.Process(Event.NewEvents, static_cast<int32>(Event.FrameNumber),
                              *VMPool, ActiveVMs, WorldState, VMProxy, SourceName);
    }

    // VM 실행 + DispatchEvent 수집 루프 (최대 4회 반복으로 무한 루프 방지)
    static constexpr int32 MaxDispatchRounds = 4;
    for (int32 Round = 0; Round < MaxDispatchRounds; ++Round)
    {
        VMProcessSystem.Process(ActiveVMs, CompletedVMs, *VMPool, PendingExternalEvents);

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
    if (!TerrainSource && Event.FrameNumber % 300 == 0)
    {
        UE_LOG(LogHktCore, Warning, TEXT("[HktSim] TerrainSource is NULL — Physics Phase1 (floor snap) 비활성. "
            "SetTerrainConfig() 호출 여부 + HktTerrain 모듈 로드 여부 확인 필요. LoadedChunks=%d"),
            TerrainState.LoadedChunks.Num());
    }
#endif

    GravitySystem.Process(WorldState, VMProxy);

    // ActiveMoverSlots 의 invariant 는 mark/prune 양쪽에서 swap-pop 으로 유지된다.
    // 별도 compaction 단계는 불필요.
    MovementSystem.Process(WorldState, VMProxy, GeneratedMoveEndEvents,
                           FramePreMovePositions);
    for (const FHktPendingEvent& ME : GeneratedMoveEndEvents)
    {
        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
            FString::Printf(TEXT("PendingEvent CREATE: MoveEnd watched=%d"), ME.WatchedEntity),
            ME.WatchedEntity);
        HKT_VM_EVENT_RECORD_PENDING(ME, EHktVMEventPhase::Created, LogSource,
            WorldState.FrameNumber, TEXT("MovementSystem.MoveEnd"));
        PendingExternalEvents.Add(ME);
    }

    PhysicsSystem.Process(WorldState, VMProxy,
                          GeneratedPhysicsEvents,
                          GeneratedGroundedEvents,
                          FramePreMovePositions,
                          TerrainSource ? &TerrainState : nullptr);

    for (const FHktPendingEvent& GE : GeneratedGroundedEvents)
    {
        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
            FString::Printf(TEXT("PendingEvent CREATE: Grounded watched=%d"), GE.WatchedEntity),
            GE.WatchedEntity);
        HKT_VM_EVENT_RECORD_PENDING(GE, EHktVMEventPhase::Created, LogSource,
            WorldState.FrameNumber, TEXT("PhysicsSystem.Grounded"));
        PendingExternalEvents.Add(GE);
    }

    for (const FHktPhysicsEvent& PE : GeneratedPhysicsEvents)
    {
        HKT_EVENT_LOG(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
            FString::Printf(TEXT("PhysicsEvent CREATE: A=%d B=%d Contact=(%.0f,%.0f,%.0f)"),
                PE.EntityA, PE.EntityB,
                PE.ContactPoint.X, PE.ContactPoint.Y, PE.ContactPoint.Z));
        HKT_VM_EVENT_RECORD_PHYSICS(PE, LogSource, WorldState.FrameNumber,
            TEXT("PhysicsSystem.Collision"));

        FHktPendingEvent PA;
        PA.Type = EWaitEventType::Collision;
        PA.WatchedEntity = PE.EntityA;
        PA.HitEntity = PE.EntityB;
        HKT_VM_EVENT_RECORD_PENDING(PA, EHktVMEventPhase::Created, LogSource,
            WorldState.FrameNumber, TEXT("Physics→Collision(A↔B)"));
        PendingExternalEvents.Add(PA);

        FHktPendingEvent PB;
        PB.Type = EWaitEventType::Collision;
        PB.WatchedEntity = PE.EntityB;
        PB.HitEntity = PE.EntityA;
        HKT_VM_EVENT_RECORD_PENDING(PB, EHktVMEventPhase::Created, LogSource,
            WorldState.FrameNumber, TEXT("Physics→Collision(B↔A)"));
        PendingExternalEvents.Add(PB);
    }

    // 물리/이동 이벤트를 같은 프레임 내에서 즉시 소비 — 1프레임 지연 제거
    if (PendingExternalEvents.Num() > 0)
    {
        VMProcessSystem.Process(ActiveVMs, CompletedVMs, *VMPool, PendingExternalEvents);
    }

    VMCleanupSystem.Process(CompletedVMs, *VMPool, WorldState, VMProxy);

    // Late-Join 복구용 스냅샷 캡처 (모든 VM 라이프사이클 처리 이후)
    CaptureVMSnapshots();
}

void FHktWorldDeterminismSimulator::CaptureVMSnapshots()
{
    WorldState.ActiveVMSnapshots.Reset();
    for (FHktVMHandle Handle : ActiveVMs)
    {
        const FHktVMRuntime* Runtime = VMPool->Get(Handle);
        if (!Runtime || Runtime->IsTerminated() || Runtime->Program == nullptr || Runtime->Context == nullptr)
        {
            continue;
        }

        FHktVMSnapshot Snap;
        Snap.EventTag = Runtime->Program->Tag;
        Snap.PC = Runtime->PC;
        FMemory::Memcpy(Snap.Registers, Runtime->Registers, sizeof(Snap.Registers));
        Snap.Status = static_cast<uint8>(Runtime->Status);
        Snap.WaitFrames = Runtime->WaitFrames;
        Snap.WaitType = static_cast<uint8>(Runtime->EventWait.Type);
        Snap.WaitWatchedEntity = Runtime->EventWait.WatchedEntity;
        Snap.WaitRemainingFrames = Runtime->EventWait.RemainingFrames;
        Snap.PlayerUid = Runtime->PlayerUid;
        Snap.CreationFrame = Runtime->CreationFrame;

        const FHktVMContext* Ctx = Runtime->Context;
        Snap.SourceEntity = Ctx->SourceEntity;
        Snap.TargetEntity = Ctx->TargetEntity;
        Snap.EventParam0 = Ctx->EventParam0;
        Snap.EventParam1 = Ctx->EventParam1;
        Snap.EventParam2 = Ctx->EventParam2;
        Snap.EventParam3 = Ctx->EventParam3;
        Snap.EventTargetPosX = Ctx->EventTargetPosX;
        Snap.EventTargetPosY = Ctx->EventTargetPosY;
        Snap.EventTargetPosZ = Ctx->EventTargetPosZ;

        Snap.PendingDispatchedEvents = Runtime->PendingDispatchedEvents;

        WorldState.ActiveVMSnapshots.Add(MoveTemp(Snap));
    }
}

void FHktWorldDeterminismSimulator::RehydrateVMPool()
{
    VMPool->Reset();
    ActiveVMs.Reset();
    CompletedVMs.Reset();

    const FHktVMProgramRegistry& Registry = FHktVMProgramRegistry::Get();

    for (const FHktVMSnapshot& Snap : WorldState.ActiveVMSnapshots)
    {
        const FHktVMProgram* Program = Registry.FindProgram(Snap.EventTag);
        if (!Program)
        {
            HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Warning, LogSource,
                FString::Printf(TEXT("VM Rehydrate: Program not found for %s — 스냅샷 폐기"),
                    *Snap.EventTag.ToString()));
            continue;
        }

        FHktVMHandle Handle = VMPool->Allocate();
        if (!Handle.IsValid())
        {
            HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Warning, LogSource,
                TEXT("VM Rehydrate: Pool exhausted — 남은 스냅샷 폐기"));
            break;
        }

        FHktVMRuntime* Runtime = VMPool->Get(Handle);
        FHktVMContext* Context = VMPool->GetContext(Handle);
        check(Runtime && Context);

        // Context 포인터 재배선 (스냅샷에 없던 런타임 포인터들)
        Context->WorldState = &WorldState;
        Context->VMProxy = &VMProxy;
        Context->SourceEntity = Snap.SourceEntity;
        Context->TargetEntity = Snap.TargetEntity;
        Context->EventParam0 = Snap.EventParam0;
        Context->EventParam1 = Snap.EventParam1;
        Context->EventParam2 = Snap.EventParam2;
        Context->EventParam3 = Snap.EventParam3;
        Context->EventTargetPosX = Snap.EventTargetPosX;
        Context->EventTargetPosY = Snap.EventTargetPosY;
        Context->EventTargetPosZ = Snap.EventTargetPosZ;

        Runtime->Program = Program;
        Runtime->Context = Context;
        Runtime->PC = Snap.PC;
        FMemory::Memcpy(Runtime->Registers, Snap.Registers, sizeof(Runtime->Registers));
        Runtime->Status = static_cast<EVMStatus>(Snap.Status);
        Runtime->PlayerUid = Snap.PlayerUid;
        Runtime->CreationFrame = Snap.CreationFrame;
        Runtime->WaitFrames = Snap.WaitFrames;
        Runtime->EventWait.Type = static_cast<EWaitEventType>(Snap.WaitType);
        Runtime->EventWait.WatchedEntity = Snap.WaitWatchedEntity;
        Runtime->EventWait.RemainingFrames = Snap.WaitRemainingFrames;
        Runtime->PendingDispatchedEvents = Snap.PendingDispatchedEvents;
        Runtime->SpatialQuery.Reset();

        ActiveVMs.Add(Handle);

        HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
            FString::Printf(TEXT("VM rehydrated: %s PC=%d Status=%u Wait=%u Watched=%d"),
                *Snap.EventTag.ToString(), Snap.PC, Snap.Status, Snap.WaitType, Snap.WaitWatchedEntity));
    }
}

FHktSimulationDiff FHktWorldDeterminismSimulator::AdvanceFrame(const FHktSimulationEvent& InEvent)
{
    const int32 SlotCountBeforeImport = WorldState.SlotToEntity.Num();
    for (const FHktEntityState& ES : InEvent.NewEntityStates)
    {
        WorldState.ImportEntityState(ES);
    }
    // 외부 import 는 VMProxy 를 거치지 않으므로 active-mover 추적 hook 이 발동되지 않는다.
    // 새로 할당된 슬롯을 보수적으로 mark — MovementSystem 이 idle 이면 즉시 prune 한다.
    for (int32 S = SlotCountBeforeImport; S < WorldState.SlotToEntity.Num(); ++S)
    {
        if (WorldState.SlotToEntity[S] != InvalidEntityId)
            VMProxy.MarkActiveMover(S);
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
    Diff.RemovedEntities = MoveTemp(PreRemoveStates);

    // VM(Op_DestroyEntity) 경로에서 발생한 제거를 owner 기반 제거와 동일 채널로 통합.
    if (VMProxy.PendingDestroys.Num() > 0)
    {
        Diff.RemovedEntities.Append(MoveTemp(VMProxy.PendingDestroys));
    }

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
            // SetDirty는 값 변경 여부와 무관하게 쓰기 시 dirty 비트를 세팅하므로,
            // 실제 값이 변하지 않은 항목은 델타에서 제외한다 (불필요한 네트워크/로그 노이즈 방지).
            if (NewVal != OldVal)
            {
                Diff.PropertyDeltas.Add({ Id, PropId, NewVal, OldVal });
            }
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

    // DB 영속 경계에서는 "재진입 시 처음부터 재실행"을 위해 FHktEvent 형태로 내보낸다.
    // (세션 내 VM 런타임 상태는 서버 재시작을 넘어서는 의미가 없으므로 전달하지 않는다.)
    for (const FHktVMSnapshot& S : WorldState.ActiveVMSnapshots)
    {
        if (!WorldState.IsValidEntity(S.SourceEntity)) continue;
        if (WorldState.GetOwnerUid(S.SourceEntity) != OwnerUid) continue;

        FHktEvent E;
        E.EventTag = S.EventTag;
        E.SourceEntity = S.SourceEntity;
        E.TargetEntity = S.TargetEntity;
        E.Location = FVector(
            static_cast<double>(S.EventTargetPosX),
            static_cast<double>(S.EventTargetPosY),
            static_cast<double>(S.EventTargetPosZ));
        E.PlayerUid = S.PlayerUid;
        E.Param0 = S.EventParam0;
        E.Param1 = S.EventParam1;
        Out.ActiveEvents.Add(E);
    }

    return Out;
}

void FHktWorldDeterminismSimulator::RestoreWorldState(const FHktWorldState& InState)
{
    const EHktLogSource SavedLogSource = WorldState.LogSource;
    WorldState.CopyFrom(InState);
    WorldState.LogSource = SavedLogSource;

    // 복원된 WorldState 의 ActiveVMSnapshots 에서 VMPool 재수화.
    // 이를 통해 WaitingEvent 중이던 VM 이 Late-Join 클라에서도 올바르게 재개된다.
    RehydrateVMPool();

    // MovementSystem 의 active-mover 인덱스는 VMProxy 에 누적된 캐시. 롤백/복원 시
    // WorldState 와의 일관성을 잃을 수 있으므로 전체 재구성.
    VMProxy.RebuildActiveMovers(WorldState);
}

void FHktWorldDeterminismSimulator::UndoDiff(const FHktSimulationDiff& Diff)
{
    WorldState.UndoDiff(Diff);

    // 롤백 후 active-mover 인덱스 재구성 — UndoDiff 는 VMProxy 를 거치지 않고
    // 속성을 되돌리므로 캐시가 stale 해진다. (rollback 빈도는 낮아 풀스캔 비용 허용.)
    VMProxy.RebuildActiveMovers(WorldState);
}

void FHktWorldDeterminismSimulator::SetTerrainConfig(const FHktTerrainGeneratorConfig& Config)
{
    // Interpreter의 TerrainState/PendingVoxelDeltas 포인터는 생성자에서 이미 전달됨.
    // 데이터 소스만 생성하면 ProcessBatch의 if(TerrainSource) 가드가 지형 파이프라인을 활성화.
    // 구체 구현(FHktTerrainGenerator)은 HktTerrain 모듈이 StartupModule 시점에
    // HktTerrain::RegisterDataSourceFactory 로 등록한다 — HktCore 는 구현체를 알지 못한다.
    TerrainSource = HktTerrain::CreateDataSource(Config);

    if (!TerrainSource)
    {
        UE_LOG(LogHktCore, Warning,
            TEXT("[HktSim] HktTerrain::CreateDataSource 가 nullptr 반환 — HktTerrain 모듈이 로드되지 않았거나 "
                 "StartupModule 에서 팩토리 등록이 실패함. 지형 파이프라인 비활성."));
    }

    // 첫 LoadChunk 호출 전에도 TerrainState가 조회될 수 있으므로 VoxelSize를 즉시 전파
    TerrainState.VoxelSizeCm = Config.VoxelSizeCm;
}

void FHktWorldDeterminismSimulator::SetTerrainSource(TUniquePtr<IHktTerrainDataSource> InSource)
{
    // 외부 (HktTerrain 의 FHktTerrainProvider 등) 가 만든 데이터 소스를 직접 주입.
    // SetTerrainConfig 의 팩토리 경로를 우회하여, Subsystem-aware Provider 같은
    // 컨텍스트가 필요한 구현체를 시뮬레이터에 보유시킨다. nullptr 이면 지형 비활성.
    TerrainSource = MoveTemp(InSource);

    if (TerrainSource)
    {
        // 새 소스의 Config 도 즉시 반영 — VoxelSize 등 시뮬레이션 파이프라인 의존 값.
        const FHktTerrainGeneratorConfig& Cfg = TerrainSource->GetConfig();
        TerrainState.VoxelSizeCm = Cfg.VoxelSizeCm;
    }
}

// ============================================================================
// Factory
// ============================================================================

TUniquePtr<IHktDeterminismSimulator> CreateDeterminismSimulator(EHktLogSource InLogSource)
{
    return MakeUnique<FHktWorldDeterminismSimulator>(InLogSource);
}
