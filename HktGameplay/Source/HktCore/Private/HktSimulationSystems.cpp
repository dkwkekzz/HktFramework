// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSimulationSystems.h"
#include "HktCoreLog.h"
#include "HktCoreProperties.h"
#include "HktCollisionLayers.h"
#include "VM/HktVMProgram.h"
#include "VM/HktVMRuntime.h"
#include "VM/HktVMInterpreter.h"
#include "VM/HktVMWorldStateProxy.h"
#include "Terrain/HktTerrainState.h"
#include "Terrain/HktTerrainGenerator.h"
#include "Math/UnrealMathUtility.h"
#include "HAL/IConsoleManager.h"
#include "HktCoreEventLog.h"

// ============================================================================
// 콘솔 변수 (CVar) - 런타임 이동 조작감 튜닝용
// 사용법: 에디터 콘솔 창에서 "hkt.Move.AccelMultiplier 5.0" 등 입력
// ============================================================================

static TAutoConsoleVariable<float> CVarMoveAccelMultiplier(
    TEXT("hkt.Move.AccelMultiplier"),
    7.0f, // 기본적으로 기존 대비 3배 기민하게 가속/감속
    TEXT("Multiplier for movement acceleration/deceleration. Higher means snappier movement."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarMoveSlowingRadius(
    TEXT("hkt.Move.SlowingRadius"),
    150.0f, // 감속을 시작하는 반경 (기존 250 -> 150으로 줄여 더 늦게 감속 시작 = 더 빠른 도착)
    TEXT("Radius at which entities start to slow down when reaching target."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarMoveMinSpeed(
    TEXT("hkt.Move.MinSpeed"),
    50.0f, // 도착지 근처 멈칫거림을 방지하는 최소 보장 속도 (기존 30 -> 50)
    TEXT("Minimum speed enforced to prevent infinite arrival time (Zeno's paradox)."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarJumpGravity(
    TEXT("hkt.Jump.Gravity"),
    980.0f, // 표준 중력 9.8m/s² = 980cm/s²
    TEXT("Gravity applied to jumping entities (cm/s^2)."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarJumpMaxFallSpeed(
    TEXT("hkt.Jump.MaxFallSpeed"),
    2000.0f, // 최대 낙하 속도 제한
    TEXT("Maximum falling speed for jumping entities (cm/s)."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarTerrainMaxStepHeight(
    TEXT("hkt.Terrain.MaxStepHeight"),
    30.0f, // 2 복셀 × 15cm — 이 높이 이하의 단차는 자동으로 올라감
    TEXT("Maximum terrain step height an entity can walk over (cm). Steps above this block movement."),
    ECVF_Default);

static TAutoConsoleVariable<float> CVarPhysicsSoftPushRatio(
    TEXT("hkt.Physics.SoftPushRatio"),
    0.5f, // 프레임당 겹침의 10%만 보정 — 일반 이동 시 거의 안 밀림
    TEXT("Fraction of overlap resolved per frame (0.0=no push, 1.0=instant). Mass ratio also affects push distribution."),
    ECVF_Default);

static TAutoConsoleVariable<int32> CVarTerrainDebugEntity(
    TEXT("hkt.Debug.TerrainCollisionEntity"),
    -1,
    TEXT("지형 충돌 디버그 대상 엔티티 ID. -1=끄기, 0+=해당 엔티티의 충돌 상세 로그 수집"),
    ECVF_Default);


#if ENABLE_HKT_INSIGHTS
#include "HktCoreDataCollector.h"
#include "HktStoryTypes.h"

static FString VMStatusToString(EVMStatus Status)
{
    switch (Status)
    {
    case EVMStatus::Running:      return TEXT("Running");
    case EVMStatus::Ready:        return TEXT("Ready");
    case EVMStatus::Yielded:      return TEXT("Yielded");
    case EVMStatus::WaitingEvent: return TEXT("Blocked");
    case EVMStatus::Completed:    return TEXT("Completed");
    case EVMStatus::Failed:       return TEXT("Failed");
    default:                      return TEXT("Unknown");
    }
}

static const TCHAR* WaitEventTypeToString(EWaitEventType Type)
{
    switch (Type)
    {
    case EWaitEventType::Timer:     return TEXT("Timer");
    case EWaitEventType::Collision: return TEXT("Collision");
    case EWaitEventType::MoveEnd:   return TEXT("MoveEnd");
    case EWaitEventType::Grounded:  return TEXT("Grounded");
    default:                        return TEXT("None");
    }
}

static void CollectVMDetailInsights(FHktVMRuntimePool& Pool)
{
    if (!FHktCoreDataCollector::Get().IsCollectionEnabled(TEXT("VMDetail")))
    {
        return;
    }

    HKT_INSIGHT_CLEAR_CATEGORY(TEXT("VMDetail"));

    // Entity별 VM 집계용
    TMap<FHktEntityId, TArray<TPair<int32, FString>>> EntityVMs;  // EntityId → [(SlotIndex, EventTag)]

    Pool.ForEachActive([&](FHktVMHandle Handle, FHktVMRuntime& Runtime)
    {
        FHktEntityId SrcEntity = Runtime.Context ? Runtime.Context->SourceEntity : InvalidEntityId;
        FHktEntityId TgtEntity = Runtime.Context ? Runtime.Context->TargetEntity : InvalidEntityId;
        FString EventTag = Runtime.Program ? Runtime.Program->Tag.ToString() : TEXT("?");
        int32 CodeSize = Runtime.Program ? Runtime.Program->CodeSize() : 0;

        // Entity별 VM 집계
        EntityVMs.FindOrAdd(SrcEntity).Emplace(static_cast<int32>(Handle.Index), EventTag);

        // Last opcode
        FString OpName = TEXT("-");
        if (Runtime.Program && Runtime.PC > 0 && Runtime.Program->Code.Num() > 0)
        {
            int32 Idx = FMath::Min(Runtime.PC - 1, Runtime.Program->Code.Num() - 1);
            OpName = GetOpCodeName(Runtime.Program->Code[Idx].GetOpCode());
        }

        // VM 상세 행
        FString VMKey = FString::Printf(TEXT("VM_%d"), static_cast<int32>(Handle.Index));
        FString Detail = FString::Printf(
            TEXT("Status=%s | Event=%s | Src=%d | Tgt=%d | PC=%d | CodeSize=%d | CreationFrame=%d | PlayerUid=%lld")
            TEXT(" | WaitType=%s | WaitEntity=%d | WaitTime=%.2f | WaitFrames=%d")
            TEXT(" | R0=%d | R1=%d | R2=%d | R3=%d | R4=%d | R5=%d | R6=%d | R7=%d")
            TEXT(" | R8=%d | Self=%d | Target=%d | Spawned=%d | Hit=%d | Iter=%d | Flag=%d")
            TEXT(" | Op=%s"),
            *VMStatusToString(Runtime.Status), *EventTag, SrcEntity, TgtEntity,
            Runtime.PC, CodeSize, Runtime.CreationFrame, Runtime.PlayerUid,
            WaitEventTypeToString(Runtime.EventWait.Type), Runtime.EventWait.WatchedEntity,
            Runtime.EventWait.RemainingTime, Runtime.WaitFrames,
            Runtime.Registers[0], Runtime.Registers[1], Runtime.Registers[2], Runtime.Registers[3],
            Runtime.Registers[4], Runtime.Registers[5], Runtime.Registers[6], Runtime.Registers[7],
            Runtime.Registers[8], Runtime.Registers[Reg::Self], Runtime.Registers[Reg::Target],
            Runtime.Registers[Reg::Spawned], Runtime.Registers[Reg::Hit],
            Runtime.Registers[Reg::Iter], Runtime.Registers[Reg::Flag],
            *OpName);

        // Context 파라미터 추가
        if (Runtime.Context)
        {
            Detail += FString::Printf(
                TEXT(" | Param0=%d | Param1=%d | TargetPos=%d,%d,%d"),
                Runtime.Context->EventParam0, Runtime.Context->EventParam1,
                Runtime.Context->EventTargetPosX, Runtime.Context->EventTargetPosY,
                Runtime.Context->EventTargetPosZ);
        }

        HKT_INSIGHT_COLLECT(TEXT("VMDetail"), VMKey, Detail);
    });

    // Entity 요약 행
    for (auto& KV : EntityVMs)
    {
        FString Names;
        for (int32 i = 0; i < KV.Value.Num(); ++i)
        {
            if (i > 0) Names += TEXT(",");
            Names += KV.Value[i].Value;
        }
        FString EntityKey = FString::Printf(TEXT("E_%d"), KV.Key);
        HKT_INSIGHT_COLLECT(TEXT("VMDetail"), EntityKey,
            FString::Printf(TEXT("VMCount=%d | Names=%s"), KV.Value.Num(), *Names));
    }
}
#endif

// ============================================================================
// 1. Entity Arrange System
// ============================================================================

void FHktEntityArrangeSystem::Process(FHktWorldState& WorldState, const TArray<int64>& RemovedOwnerIds)
{
    if (RemovedOwnerIds.Num() == 0)
        return;

    ScratchRemoveList.Reset();

    for (int64 RemovedId : RemovedOwnerIds)
    {
        WorldState.ForEachEntityByOwner(RemovedId, [&](FHktEntityId Id, int32 /*Slot*/)
        {
            ScratchRemoveList.Add(Id);
        });
    }

    HKT_EVENT_LOG(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("EntityArrange: Removing %d entities for %d owners"),
            ScratchRemoveList.Num(), RemovedOwnerIds.Num()));
    for (FHktEntityId Id : ScratchRemoveList)
        WorldState.RemoveEntity(Id);
}

// ============================================================================
// 2. VM Build System
// ============================================================================

void FHktVMBuildSystem::Process(
    const TArray<FHktEvent>& Events,
    int32 CurrentFrame,
    FHktVMRuntimePool& Pool,
    TArray<FHktVMHandle>& OutActiveVMs,
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    const FString& InsightsSource)
{
    for (const FHktEvent& Event : Events)
    {
        const FHktVMProgram* Program = FHktVMProgramRegistry::Get().FindProgram(Event.EventTag);
        if (!Program)
        {
            HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Error, LogSource, FString::Printf(TEXT("VM Build: No program for %s — Story가 등록되지 않았습니다 (빌드 검증 실패 또는 미등록)"), *Event.EventTag.ToString()));
            continue;
        }

        // CancelOnDuplicate: 같은 EventTag + SourceEntity의 기존 VM 취소
        if (Program->bCancelOnDuplicate)
        {
            for (int32 i = OutActiveVMs.Num() - 1; i >= 0; --i)
            {
                FHktVMRuntime* Existing = Pool.Get(OutActiveVMs[i]);
                if (Existing && Existing->Program && Existing->Context
                    && Existing->Program->Tag == Event.EventTag
                    && Existing->Context->SourceEntity == Event.SourceEntity)
                {
                    Existing->Status = EVMStatus::Completed;
                    HKT_EVENT_LOG_TAG(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
                        FString::Printf(TEXT("VM cancelled (duplicate): %s Entity=%d"),
                            *Event.EventTag.ToString(), Event.SourceEntity),
                        Event.SourceEntity, Event.EventTag);
                }
            }
        }

        FHktVMHandle Handle = Pool.Allocate();
        if (!Handle.IsValid())
        {
            HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Warning, LogSource, TEXT("VM Build: Pool exhausted"));
            continue;
        }

        FHktVMRuntime* Runtime = Pool.Get(Handle);
        FHktVMContext* Context = Pool.GetContext(Handle);
        check(Runtime && Context);

        Context->WorldState = &WorldState;
        Context->VMProxy = &VMProxy;
        Context->SourceEntity = Event.SourceEntity;
        Context->TargetEntity = Event.TargetEntity;

        Runtime->Program = Program;
        Runtime->Context = Context;
        Runtime->PC = 0;
        Runtime->Status = EVMStatus::Ready;
        Runtime->CreationFrame = CurrentFrame;
        Runtime->WaitFrames = 0;
        Runtime->EventWait.Reset();
        Runtime->SpatialQuery.Reset();
        FMemory::Memzero(Runtime->Registers, sizeof(Runtime->Registers));

        Runtime->PlayerUid = Event.PlayerUid;
        Runtime->SetRegEntity(Reg::Self, Event.SourceEntity);
        Runtime->SetRegEntity(Reg::Target, Event.TargetEntity);

        // 이벤트 파라미터를 Context 로컬에 저장 (SourceEntity 없이도 LoadStore로 읽기 가능)
        Context->EventParam0 = Event.Param0;
        Context->EventParam1 = Event.Param1;
        Context->EventTargetPosX = FMath::RoundToInt(Event.Location.X);
        Context->EventTargetPosY = FMath::RoundToInt(Event.Location.Y);
        Context->EventTargetPosZ = FMath::RoundToInt(Event.Location.Z);

        // 이벤트 태그를 SourceEntity에 자동 부여
        if (WorldState.IsValidEntity(Event.SourceEntity))
        {
            VMProxy.AddTag(WorldState, Event.SourceEntity, Event.EventTag);
        }

        OutActiveVMs.Add(Handle);
        WorldState.ActiveEvents.Add(Event);

#if ENABLE_HKT_INSIGHTS
        Runtime->SourceEventId = Event.EventId;
        {
            FString VMKey = FString::Printf(TEXT("VM_%d"), static_cast<int32>(Handle.Index));
            HKT_INSIGHT_COLLECT(TEXT("VM"), VMKey,
                FString::Printf(TEXT("Created | Event=%s | Src=%d | Tgt=%d | CodeSize=%d | Source=%s"),
                    *Event.EventTag.ToString(), Event.SourceEntity, Event.TargetEntity,
                    Program->CodeSize(), *InsightsSource));

            FString IntentKey = FString::Printf(TEXT("Intent_%d"), Event.EventId);
            HKT_INSIGHT_COLLECT(TEXT("VM"), IntentKey,
                FString::Printf(TEXT("Processing | Tag=%s | Src=%d | Tgt=%d"),
                    *Event.EventTag.ToString(), Event.SourceEntity, Event.TargetEntity));
        }
#endif

        HKT_EVENT_LOG_TAG(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
            FString::Printf(TEXT("VM created: %s Src=%d Tgt=%d CodeSize=%d"),
                *Event.EventTag.ToString(), Event.SourceEntity, Event.TargetEntity,
                Program->CodeSize()),
            Event.SourceEntity, Event.EventTag);
    }
}

// ============================================================================
// 3. VM Process System
// ============================================================================

void FHktVMProcessSystem::Process(
    TArray<FHktVMHandle>& ActiveVMs,
    TArray<FHktVMHandle>& OutCompletedVMs,
    FHktVMRuntimePool& Pool,
    float DeltaSeconds,
    TArray<FHktPendingEvent>& PendingExternalEvents)
{
    ScratchEvents.Reset();
    Swap(ScratchEvents, PendingExternalEvents);

    Pool.ForEachActive([&](FHktVMHandle Handle, FHktVMRuntime& Runtime)
    {
        if (Runtime.Status == EVMStatus::WaitingEvent)
        {
            if (Runtime.EventWait.Type == EWaitEventType::Timer)
            {
                Runtime.EventWait.RemainingTime -= DeltaSeconds;
                if (Runtime.EventWait.RemainingTime <= 0.0f)
                {
                    Runtime.EventWait.Reset();
                    Runtime.Status = EVMStatus::Ready;
                }
            }
            else
            {
                for (int32 i = ScratchEvents.Num() - 1; i >= 0; --i)
                {
                    if (ScratchEvents[i].Type == Runtime.EventWait.Type &&
                        ScratchEvents[i].WatchedEntity == Runtime.EventWait.WatchedEntity)
                    {
                        if (ScratchEvents[i].Type == EWaitEventType::Collision)
                        {
                            Runtime.SetRegEntity(Reg::Hit, ScratchEvents[i].HitEntity);
                        }
                        Runtime.EventWait.Reset();
                        Runtime.Status = EVMStatus::Ready;
                        ScratchEvents.RemoveAtSwap(i);
                        break;
                    }
                }
            }
        }

        if (Runtime.Status == EVMStatus::Yielded)
        {
            if (Runtime.WaitFrames <= 0)
            {
                Runtime.Status = EVMStatus::Ready;
            }
            else
            {
                Runtime.WaitFrames--;
            }
        }
    });

    for (int32 i = ActiveVMs.Num() - 1; i >= 0; --i)
    {
        FHktVMHandle Handle = ActiveVMs[i];
        FHktVMRuntime* Runtime = Pool.Get(Handle);
        if (!Runtime)
        {
            ActiveVMs.RemoveAtSwap(i);
            continue;
        }

        if (!Runtime->IsRunnable())
        {
            // 외부에서 취소된 VM (VMBuildSystem 중복 이벤트 취소 등) 정리
            if (Runtime->IsTerminated())
            {
                OutCompletedVMs.Add(Handle);
                ActiveVMs.RemoveAtSwap(i);
            }
            continue;
        }

        Runtime->Status = EVMStatus::Running;
        EVMStatus Result = Interpreter->Execute(*Runtime);
        Runtime->Status = Result;

#if ENABLE_HKT_INSIGHTS
        {
            FString OpName;
            if (Runtime->Program && Runtime->PC > 0 && Runtime->Program->Code.Num() > 0)
            {
                int32 Idx = FMath::Min(Runtime->PC - 1, Runtime->Program->Code.Num() - 1);
                OpName = GetOpCodeName(Runtime->Program->Code[Idx].GetOpCode());
            }
            FString VMKey = FString::Printf(TEXT("VM_%d"), static_cast<int32>(Handle.Index));
            HKT_INSIGHT_COLLECT(TEXT("VM"), VMKey,
                FString::Printf(TEXT("%s | PC=%d | Op=%s | Src=%d"),
                    *VMStatusToString(Result), Runtime->PC, *OpName, Runtime->Context ? Runtime->Context->SourceEntity : -1));
        }
#endif

        if (Result == EVMStatus::Completed || Result == EVMStatus::Failed)
        {
            if (Result == EVMStatus::Failed)
            {
                HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Error, LogSource, FString::Printf(TEXT("VM FAILED: %s Src=%d PC=%d — client sent invalid intent"),
                    Runtime->Program ? *Runtime->Program->Tag.ToString() : TEXT("?"),
                    Runtime->Context ? Runtime->Context->SourceEntity : InvalidEntityId,
                    Runtime->PC));
            }
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM,
                Result == EVMStatus::Failed ? EHktLogLevel::Error : EHktLogLevel::Info,
                LogSource,
                FString::Printf(TEXT("VM %s: %s PC=%d"),
                    Result == EVMStatus::Completed ? TEXT("Completed") : TEXT("Failed"),
                    Runtime->Program ? *Runtime->Program->Tag.ToString() : TEXT("?"),
                    Runtime->PC),
                Runtime->Context ? Runtime->Context->SourceEntity : InvalidEntityId);
#if ENABLE_HKT_INSIGHTS
            {
                FString VMKey = FString::Printf(TEXT("VM_%d"), static_cast<int32>(Handle.Index));
                HKT_INSIGHT_COLLECT(TEXT("VM"), VMKey,
                    FString::Printf(TEXT("%s | PC=%d"),
                        Result == EVMStatus::Completed ? TEXT("Completed") : TEXT("Failed"), Runtime->PC));

                FString IntentKey = FString::Printf(TEXT("Intent_%d"), Runtime->SourceEventId);
                HKT_INSIGHT_COLLECT(TEXT("VM"), IntentKey,
                    FString::Printf(TEXT("%s"),
                        Result == EVMStatus::Completed ? TEXT("Completed") : TEXT("Failed")));
            }
#endif
            OutCompletedVMs.Add(Handle);
            ActiveVMs.RemoveAtSwap(i);
        }
    }

#if ENABLE_HKT_INSIGHTS
    CollectVMDetailInsights(Pool);
#endif
}

// ============================================================================
// 3.2 Terrain System
// ============================================================================

FIntVector FHktTerrainSystem::CmToVoxel(int32 X, int32 Y, int32 Z)
{
    // 음수 좌표를 올바르게 처리하기 위해 floor 연산 사용
    auto FloorDivF = [](float A, float B) -> int32
    {
        return FMath::FloorToInt(A / B);
    };
    return FIntVector(
        FloorDivF(static_cast<float>(X), VoxelSizeCm),
        FloorDivF(static_cast<float>(Y), VoxelSizeCm),
        FloorDivF(static_cast<float>(Z), VoxelSizeCm));
}

FIntVector FHktTerrainSystem::CmToVoxel(float X, float Y, float Z)
{
    return FIntVector(
        FMath::FloorToInt(X / VoxelSizeCm),
        FMath::FloorToInt(Y / VoxelSizeCm),
        FMath::FloorToInt(Z / VoxelSizeCm));
}

FIntVector FHktTerrainSystem::VoxelToCm(int32 VX, int32 VY, int32 VZ)
{
    // 복셀 중심 좌표 반환
    const float Half = VoxelSizeCm * 0.5f;
    return FIntVector(
        FMath::RoundToInt(VX * VoxelSizeCm + Half),
        FMath::RoundToInt(VY * VoxelSizeCm + Half),
        FMath::RoundToInt(VZ * VoxelSizeCm + Half));
}

void FHktTerrainSystem::Process(
    const FHktWorldState& WorldState,
    FHktTerrainState& TerrainState,
    const FHktTerrainGenerator& Generator,
    const TArray<FHktEvent>* PendingEvents)
{
    RequiredChunks.Reset();

    // 1. 엔티티를 청크 단위로 중복 제거하여 수집
    //    같은 청크에 있는 엔티티 N개가 동일한 75개 항목을 중복 삽입하지 않도록,
    //    엔티티의 청크 좌표를 먼저 TSet에 모은 뒤 한 번만 반경 확장한다.
    TSet<FIntVector> EntityChunks;
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        const FIntVector Pos = WorldState.GetPosition(Id);
        const FIntVector VoxelPos = CmToVoxel(Pos.X, Pos.Y, Pos.Z);
        EntityChunks.Add(FHktTerrainState::WorldToChunk(VoxelPos.X, VoxelPos.Y, VoxelPos.Z));
    });

    // 1b. 이번 프레임 이벤트의 Location도 사전 로드 대상에 포함
    //     (스폰 이벤트 등에서 GetTerrainHeight 쿼리 시 청크가 준비되도록)
    if (PendingEvents)
    {
        for (const FHktEvent& Evt : *PendingEvents)
        {
            if (!Evt.Location.IsNearlyZero())
            {
                const FIntVector VoxelPos = CmToVoxel(
                    static_cast<float>(Evt.Location.X),
                    static_cast<float>(Evt.Location.Y),
                    static_cast<float>(Evt.Location.Z));
                EntityChunks.Add(FHktTerrainState::WorldToChunk(VoxelPos.X, VoxelPos.Y, VoxelPos.Z));
            }
        }
    }

    // 고유 청크 좌표에서만 반경 확장 (엔티티 200개 → 고유 청크 ~10개)
    for (const FIntVector& ChunkCoord : EntityChunks)
    {
        for (int32 DX = -LoadRadiusXY; DX <= LoadRadiusXY; ++DX)
        {
            for (int32 DY = -LoadRadiusXY; DY <= LoadRadiusXY; ++DY)
            {
                for (int32 DZ = -LoadRadiusZ; DZ <= LoadRadiusZ; ++DZ)
                {
                    RequiredChunks.Add(FIntVector(ChunkCoord.X + DX, ChunkCoord.Y + DY, ChunkCoord.Z + DZ));
                }
            }
        }
    }

    // 2. 필요한 청크 로드 (프레임당 예산 제한으로 스파이크 방지)
    int32 LoadedThisFrame = 0;
    for (const FIntVector& Coord : RequiredChunks)
    {
        if (!TerrainState.IsChunkLoaded(Coord))
        {
            if (TerrainState.GetLoadedChunkCount() >= MaxChunksLoaded)
            {
                break;
            }
            if (LoadedThisFrame >= MaxChunkLoadsPerFrame)
            {
                break;  // 나머지는 다음 프레임에 로드
            }
            TerrainState.LoadChunk(Coord, Generator);
            ++LoadedThisFrame;
        }
    }

    // 3. 불필요한 청크 언로드 (필요 목록에 없는 로드된 청크)
    TArray<FIntVector> ToUnload;
    for (const auto& Pair : TerrainState.LoadedChunks)
    {
        if (!RequiredChunks.Contains(Pair.Key))
        {
            ToUnload.Add(Pair.Key);
        }
    }
    for (const FIntVector& Coord : ToUnload)
    {
        TerrainState.UnloadChunk(Coord);
    }
}

// ============================================================================
// 3.5 Movement System
// ============================================================================

// 현재 위치에서 아래로 스캔하여 서 있을 바닥 복셀 Z를 반환한다.
// GetSurfaceHeightAt(최상단 전용)과 달리 동굴·다층 지형에서 올바르게 동작한다.
// - 현재 복셀이 솔리드 안이면 위로 탈출 (MaxScanUp 복셀 한도)
// - 현재 복셀이 에어면 아래로 스캔하여 바닥 탐색 (MaxScanDown 복셀 한도)
// - 범위 내 바닥 없으면 StartVoxelZ 반환 (청크 미로드 보호)
static int32 FindFloorVoxelZ(const FHktTerrainState& Terrain,
                              int32 VoxelX, int32 VoxelY, int32 StartVoxelZ,
                              int32 MaxScanUp = 8, int32 MaxScanDown = 64)
{
    if (Terrain.IsSolid(VoxelX, VoxelY, StartVoxelZ))
    {
        // 솔리드 내부 → 위로 탈출
        for (int32 Z = StartVoxelZ + 1; Z <= StartVoxelZ + MaxScanUp; ++Z)
        {
            if (!Terrain.IsSolid(VoxelX, VoxelY, Z))
                return Z;
        }
        return StartVoxelZ;
    }

    // 에어 → 아래로 바닥 탐색
    for (int32 Z = StartVoxelZ - 1; Z >= StartVoxelZ - MaxScanDown; --Z)
    {
        if (Terrain.IsSolid(VoxelX, VoxelY, Z))
            return Z + 1;
    }

    return StartVoxelZ;  // 바닥 없음 (청크 미로드 등)
}

void FHktMovementSystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    TArray<FHktPendingEvent>& OutMoveEndEvents,
    const FHktTerrainState* TerrainState)
{
    OutMoveEndEvents.Reset();

    static constexpr float ArrivalThresholdSq = 16.0f;  // 4cm (도착 판정)

    // 콘솔 변수 조회 (엔티티를 순회하는 루프 진입 전 1회만 캐싱하여 퍼포먼스 확보)
    const float AccelMultiplier = CVarMoveAccelMultiplier.GetValueOnAnyThread();
    const float SlowingRadius = CVarMoveSlowingRadius.GetValueOnAnyThread();
    const float MinSpeed = CVarMoveMinSpeed.GetValueOnAnyThread();

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        if (WorldState.GetProperty(Id, PropertyId::IsMoving) == 0)
            return;

        const float CurX = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosX));
        const float CurY = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosY));
        const float CurZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosZ));

        // 솔리드 복셀 안에 파묻힌 엔티티는 이동 불가 — Physics에서 밀어낸다
        if (TerrainState)
        {
            const FIntVector CenterVoxel = FHktTerrainSystem::CmToVoxel(CurX, CurY, CurZ);
            if (TerrainState->IsSolid(CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z))
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Warning, LogSource,
                    FString::Printf(TEXT("Move skip — inside solid voxel V(%d,%d,%d) Pos(%.0f,%.0f,%.0f)"),
                        CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z, CurX, CurY, CurZ), Id);
                return;
            }
        }

        const float TgtX = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetX));
        const float TgtY = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetY));
        const float TgtZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetZ));

        const float Force = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveForce));
        const float Mass = static_cast<float>(FMath::Max(WorldState.GetProperty(Id, PropertyId::Mass), 1));

        // 현재 속도 읽기
        float VX = static_cast<float>(WorldState.GetProperty(Id, PropertyId::VelX));
        float VY = static_cast<float>(WorldState.GetProperty(Id, PropertyId::VelY));
        float VZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::VelZ));

        // 방향 계산
        const float DX = TgtX - CurX;
        const float DY = TgtY - CurY;
        const float DZ = TgtZ - CurZ;
        const float DistSq = DX * DX + DY * DY + DZ * DZ;

        // 회전(Yaw) 연산 및 미세 거리 각도 튐 방지
        if (DistSq > 1.0f) // 거리가 1cm 이상일 때만 방향을 갱신 (부동소수점 오차로 인한 떨림 방지)
        {
            const int32 YawDeg = FMath::RoundToInt(FMath::Atan2(DY, DX) * (180.0f / PI));
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::RotYaw, YawDeg);
        }

        // 도착 판정
        if (DistSq <= ArrivalThresholdSq)
        {
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                FString::Printf(TEXT("Arrived at target (%.0f,%.0f,%.0f) dist=%.1f"),
                    TgtX, TgtY, TgtZ, FMath::Sqrt(DistSq)), Id);

            VMProxy.SetPosition(WorldState, Id,
                FMath::RoundToInt(TgtX), FMath::RoundToInt(TgtY), FMath::RoundToInt(TgtZ));
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsMoving, 0);

            FHktPendingEvent Evt;
            Evt.Type = EWaitEventType::MoveEnd;
            Evt.WatchedEntity = Id;
            OutMoveEndEvents.Add(Evt);
            return;
        }

        const float Dist = FMath::Sqrt(DistSq);
        const float InvDist = 1.0f / Dist;
        const float DirX = DX * InvDist;
        const float DirY = DY * InvDist;
        const float DirZ = DZ * InvDist;

        // 1. 현재 속력(Speed) 계산 (방향과 속력을 분리)
        float CurSpeed = FMath::Sqrt(VX * VX + VY * VY + VZ * VZ);

        // 2. 목표 속력(Desired Speed) 계산: 반경 내에 들어오면 CVar 기반으로 감속
        float DesiredSpeed = MaxSpeed;
        if (Dist < SlowingRadius)
        {
            // 정수 반올림 함정에 빠지지 않도록 CVar 기반의 최소 보정 속도 강제
            DesiredSpeed = FMath::Max(MaxSpeed * (Dist / SlowingRadius), MinSpeed);
        }

        // 3. 속력 가감속 적용 (가속도에 CVar 배율 보정치 적용하여 더욱 기민한 움직임 보장)
        const float Accel = (Force / Mass) * AccelMultiplier;
        const float MaxSpeedChange = Accel * FixedDeltaSeconds;

        if (CurSpeed < DesiredSpeed)
        {
            CurSpeed = FMath::Min(CurSpeed + MaxSpeedChange, DesiredSpeed);
        }
        else if (CurSpeed > DesiredSpeed)
        {
            CurSpeed = FMath::Max(CurSpeed - MaxSpeedChange, DesiredSpeed);
        }

        // 이번 프레임에 이동할 실제 거리
        const float MoveStep = CurSpeed * FixedDeltaSeconds;

        // 4. 오버슈트 방지: 이번 프레임의 이동 거리가 남은 거리와 같거나 크면 즉시 스냅 처리
        if (MoveStep >= Dist)
        {
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                FString::Printf(TEXT("Overshoot snap to target (%.0f,%.0f,%.0f) step=%.1f dist=%.1f"),
                    TgtX, TgtY, TgtZ, MoveStep, Dist), Id);

            VMProxy.SetPosition(WorldState, Id,
                FMath::RoundToInt(TgtX), FMath::RoundToInt(TgtY), FMath::RoundToInt(TgtZ));
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, 0);
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsMoving, 0);

            FHktPendingEvent Evt;
            Evt.Type = EWaitEventType::MoveEnd;
            Evt.WatchedEntity = Id;
            OutMoveEndEvents.Add(Evt);
            return;
        }

        // 5. 직선 궤적으로 속도 벡터 재설정 (곡선 제거, 항상 타겟을 향함)
        VX = DirX * CurSpeed;
        VY = DirY * CurSpeed;
        VZ = DirZ * CurSpeed;

        float NewX = CurX + VX * FixedDeltaSeconds;
        float NewY = CurY + VY * FixedDeltaSeconds;
        float NewZ = CurZ + VZ * FixedDeltaSeconds;

        // 지형 벽 충돌: 이동 방향 전방 솔리드 복셀 → 축별 슬라이딩
        // IsGrounded 여부와 무관하게 모든 이동 엔티티에 적용
        if (TerrainState)
        {
            const float ColRadius = FMath::Max(
                static_cast<float>(WorldState.GetProperty(Id, PropertyId::CollisionRadius)), 30.0f);

            // 발 위 1복셀 높이에서 체크 (바닥 복셀이 아닌 몸통 복셀)
            const float BodyZ = CurZ + FHktTerrainSystem::VoxelSizeCm;

            // X축 차단: 이동 방향 전방 엔티티 가장자리의 복셀 검사
            {
                const float EdgeX = NewX + (VX >= 0.0f ? ColRadius : -ColRadius);
                const FIntVector V = FHktTerrainSystem::CmToVoxel(EdgeX, CurY, BodyZ);
                if (TerrainState->IsSolid(V.X, V.Y, V.Z))
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Wall slide X — blocked at V(%d,%d,%d) edge=%.0f"),
                            V.X, V.Y, V.Z, EdgeX), Id);
                    NewX = CurX;
                    VX = 0.0f;
                }
            }
            // Y축 차단 (X가 이미 보정된 NewX 사용 — 코너 슬라이딩 처리)
            {
                const float EdgeY = NewY + (VY >= 0.0f ? ColRadius : -ColRadius);
                const FIntVector V = FHktTerrainSystem::CmToVoxel(NewX, EdgeY, BodyZ);
                if (TerrainState->IsSolid(V.X, V.Y, V.Z))
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Wall slide Y — blocked at V(%d,%d,%d) edge=%.0f"),
                            V.X, V.Y, V.Z, EdgeY), Id);
                    NewY = CurY;
                    VY = 0.0f;
                }
            }
        }

        // 접지 엔티티: 바닥 스냅 + 계단 높이 체크
        if (TerrainState && WorldState.GetProperty(Id, PropertyId::IsGrounded) != 0)
        {
            // 현재 위치의 실제 바닥 높이 (동굴·다층 지원: 현재 Z 기준 아래 스캔)
            const FIntVector CurVoxelPos = FHktTerrainSystem::CmToVoxel(CurX, CurY, CurZ);
            const int32 CurSurfaceVoxelZ = FindFloorVoxelZ(*TerrainState, CurVoxelPos.X, CurVoxelPos.Y, CurVoxelPos.Z);
            const float CurSurfaceCmZ = static_cast<float>(FHktTerrainSystem::VoxelToCm(0, 0, CurSurfaceVoxelZ).Z);

            // 이동 목표 위치의 실제 바닥 높이 (동굴·다층 지원: 목표 Z 기준 아래 스캔)
            const FIntVector NewVoxelPos = FHktTerrainSystem::CmToVoxel(NewX, NewY, NewZ);
            const int32 NewSurfaceVoxelZ = FindFloorVoxelZ(*TerrainState, NewVoxelPos.X, NewVoxelPos.Y, NewVoxelPos.Z);
            const float NewSurfaceCmZ = static_cast<float>(FHktTerrainSystem::VoxelToCm(0, 0, NewSurfaceVoxelZ).Z);

            // 측면 충돌: 최대 계단 높이를 초과하면 XY 이동 차단
            const float MaxStepHeightCm = CVarTerrainMaxStepHeight.GetValueOnAnyThread();
            if (NewSurfaceCmZ > CurZ + MaxStepHeightCm)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Step too high — blocked. surfZ=%.0f curZ=%.0f step=%.0f max=%.0f"),
                        NewSurfaceCmZ, CurZ, NewSurfaceCmZ - CurZ, MaxStepHeightCm), Id);
                // 벽/절벽: XY 이동 취소, 현재 지면 유지
                NewX = CurX;
                NewY = CurY;
                VX = 0.0f;
                VY = 0.0f;
                NewZ = CurSurfaceCmZ;
                VZ = 0.0f;
            }
            else
            {
                // 지형 Z 스냅: 지면 위/아래 모두 현재 지표면 높이로 보정
                if (FMath::Abs(NewSurfaceCmZ - CurZ) > 1.0f)
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Floor snap Z: %.0f → %.0f (delta=%.1f)"),
                            CurZ, NewSurfaceCmZ, NewSurfaceCmZ - CurZ), Id);
                }
                NewZ = NewSurfaceCmZ;
                VZ = 0.0f;
            }
        }

        VMProxy.SetPosition(WorldState, Id,
            FMath::RoundToInt(NewX), FMath::RoundToInt(NewY), FMath::RoundToInt(NewZ));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, FMath::RoundToInt(VX));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, FMath::RoundToInt(VY));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, FMath::RoundToInt(VZ));
    });

    // 정지 상태 접지 엔티티 지면 스냅 (스폰 직후, 지형 변형 후 등)
    if (TerrainState)
    {
        WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
        {
            if (WorldState.GetProperty(Id, PropertyId::IsMoving) != 0)
                return;  // 이동 중인 엔티티는 위에서 이미 처리
            if (WorldState.GetProperty(Id, PropertyId::IsGrounded) == 0)
                return;  // 비접지 엔티티 (투사체 등) 스킵

            const int32 CurX = WorldState.GetProperty(Id, PropertyId::PosX);
            const int32 CurY = WorldState.GetProperty(Id, PropertyId::PosY);
            const int32 CurZ = WorldState.GetProperty(Id, PropertyId::PosZ);

            const FIntVector VoxelPos = FHktTerrainSystem::CmToVoxel(CurX, CurY, CurZ);
            const int32 SurfaceVoxelZ = FindFloorVoxelZ(*TerrainState, VoxelPos.X, VoxelPos.Y, VoxelPos.Z);
            const int32 SurfaceCmZ = FHktTerrainSystem::VoxelToCm(0, 0, SurfaceVoxelZ).Z;

            if (CurZ != SurfaceCmZ)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Static ground snap Z: %d → %d (delta=%d)"),
                        CurZ, SurfaceCmZ, SurfaceCmZ - CurZ), Id);
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::PosZ, SurfaceCmZ);
            }
        });
    }

    // 점프 중력 패스: JumpVelZ != 0인 엔티티에 중력 적용
    {
        const float Gravity = CVarJumpGravity.GetValueOnAnyThread();
        const float MaxFall = CVarJumpMaxFallSpeed.GetValueOnAnyThread();

        WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
        {
            const int32 RawJumpVelZ = WorldState.GetProperty(Id, PropertyId::JumpVelZ);
            if (RawJumpVelZ == 0)
                return;

            float JumpVZ = static_cast<float>(RawJumpVelZ);

            // 중력 적용
            JumpVZ -= Gravity * FixedDeltaSeconds;
            JumpVZ = FMath::Max(JumpVZ, -MaxFall);

            // 수직 위치 갱신
            const float CurZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosZ));
            float NewZ = CurZ + JumpVZ * FixedDeltaSeconds;

            // 천장 충돌: 상승 중 머리 위 솔리드 복셀 → 속도 0
            if (JumpVZ > 0.0f && TerrainState)
            {
                const int32 PX = WorldState.GetProperty(Id, PropertyId::PosX);
                const int32 PY = WorldState.GetProperty(Id, PropertyId::PosY);
                const FIntVector HeadVoxel = FHktTerrainSystem::CmToVoxel(
                    static_cast<float>(PX), static_cast<float>(PY), NewZ + FHktTerrainSystem::VoxelSizeCm);
                if (TerrainState->IsSolid(HeadVoxel.X, HeadVoxel.Y, HeadVoxel.Z))
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Ceiling hit — velZ=%.0f headV(%d,%d,%d)"),
                            JumpVZ, HeadVoxel.X, HeadVoxel.Y, HeadVoxel.Z), Id);
                    NewZ = CurZ;
                    JumpVZ = 0.0f;
                }
            }

            // 착지 판정 — 지형 데이터가 있을 때만 바닥 검사
            if (TerrainState)
            {
                const int32 CurPX = WorldState.GetProperty(Id, PropertyId::PosX);
                const int32 CurPY = WorldState.GetProperty(Id, PropertyId::PosY);
                const FIntVector VoxelPos = FHktTerrainSystem::CmToVoxel(CurPX, CurPY, FMath::RoundToInt(NewZ));
                const int32 SurfaceVoxelZ = FindFloorVoxelZ(*TerrainState, VoxelPos.X, VoxelPos.Y, VoxelPos.Z);
                const float SurfaceCmZ = static_cast<float>(FHktTerrainSystem::VoxelToCm(0, 0, SurfaceVoxelZ).Z);

                if (NewZ <= SurfaceCmZ)
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Landed — Z=%.0f surfZ=%.0f"), NewZ, SurfaceCmZ), Id);
                    // 착지
                    NewZ = SurfaceCmZ;
                    JumpVZ = 0.0f;
                    VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsGrounded, 1);

                    FHktPendingEvent Evt;
                    Evt.Type = EWaitEventType::Grounded;
                    Evt.WatchedEntity = Id;
                    OutMoveEndEvents.Add(Evt);
                }
            }

            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::PosZ, FMath::RoundToInt(NewZ));
            VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::JumpVelZ, FMath::RoundToInt(JumpVZ));
        });
    }
}


// ============================================================================
// 4. Physics System
// ============================================================================

FHktPhysicsSystem::FCellCoord FHktPhysicsSystem::WorldToCell(const FVector& Pos)
{
    FCellCoord Coord;
    Coord.X = FMath::FloorToInt(Pos.X / CellSize);
    Coord.Y = FMath::FloorToInt(Pos.Y / CellSize);
    return Coord;
}

void FHktPhysicsSystem::RebuildGrid(const FHktWorldState& WorldState)
{
    GridMap.Reset();
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        const int32 Layer = WorldState.GetProperty(Id, PropertyId::CollisionLayer);
        const int32 Mask  = WorldState.GetProperty(Id, PropertyId::CollisionMask);

        // CollisionLayer와 Mask가 모두 0이면 충돌 불참 엔티티
        if (Layer == 0 && Mask == 0)
            return;

        // Layer가 설정되지 않은 엔티티는 충돌 소스가 될 수 없으므로 제외
        if (Layer == 0)
            return;

        FIntVector P = WorldState.GetPosition(Id);
        FVector Pos(static_cast<float>(P.X), static_cast<float>(P.Y), 0.f);
        FCellCoord Cell = WorldToCell(Pos);
        GridMap.FindOrAdd(Cell).Add(Id);
    });
}

void FHktPhysicsSystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    TArray<FHktPhysicsEvent>& OutPhysicsEvents,
    const FHktTerrainState* TerrainState)
{
    OutPhysicsEvents.Reset();
    RebuildGrid(WorldState);

    static constexpr float DefaultCollisionRadius = 50.0f;

    // CVar를 루프 진입 전 1회만 캐싱 (매 충돌 쌍마다 읽지 않도록)
    const float SoftPushRatio = CVarPhysicsSoftPushRatio.GetValueOnAnyThread();

    // 인접 셀 중복 검사 방지용 — 멤버 변수 재사용으로 매 프레임 할당 회피
    TestedPairs.Reset();

    // 인접 셀 오프셋 (자기 셀 포함 3x3 = 9칸)
    static constexpr int32 AdjacentOffsets[9][2] = {
        {0,0}, {1,0}, {-1,0}, {0,1}, {0,-1}, {1,1}, {1,-1}, {-1,1}, {-1,-1}
    };

    for (auto& CellPair : GridMap)
    {
        const FCellCoord& CellCoord = CellPair.Key;
        const TArray<FHktEntityId>& EntitiesInCell = CellPair.Value;

        // 같은 셀 내 엔티티 간 충돌 + 인접 셀 엔티티와의 충돌
        for (int32 i = 0; i < EntitiesInCell.Num(); ++i)
        {
            FHktEntityId A = EntitiesInCell[i];
            if (!WorldState.IsValidEntity(A))
                continue;

            const uint32 LayerA = static_cast<uint32>(WorldState.GetProperty(A, PropertyId::CollisionLayer));
            const uint32 MaskA  = static_cast<uint32>(WorldState.GetProperty(A, PropertyId::CollisionMask));

            FIntVector PA = WorldState.GetPosition(A);
            FVector PosA(static_cast<float>(PA.X), static_cast<float>(PA.Y), static_cast<float>(PA.Z));
            const float RadiusA = FMath::Max(static_cast<float>(WorldState.GetProperty(A, PropertyId::CollisionRadius)), DefaultCollisionRadius);

            const bool bProjectileA = (LayerA == EHktCollisionLayer::Projectile);
            const int32 OwnerA = WorldState.GetProperty(A, PropertyId::OwnerEntity);

            // 같은 셀 내 나머지 엔티티와 충돌 검사
            for (int32 j = i + 1; j < EntitiesInCell.Num(); ++j)
            {
                FHktEntityId B = EntitiesInCell[j];
                if (!WorldState.IsValidEntity(B))
                    continue;

                const uint32 LayerB = static_cast<uint32>(WorldState.GetProperty(B, PropertyId::CollisionLayer));
                const uint32 MaskB  = static_cast<uint32>(WorldState.GetProperty(B, PropertyId::CollisionMask));

                // Layer/Mask 필터: 양방향 동의 필요
                if (!(LayerA & MaskB) || !(LayerB & MaskA))
                    continue;

                const bool bProjectileB = (LayerB == EHktCollisionLayer::Projectile);
                const int32 OwnerB = WorldState.GetProperty(B, PropertyId::OwnerEntity);

                // 투사체 ↔ 시전자 충돌 방지
                if (bProjectileA && OwnerA == static_cast<int32>(B))
                    continue;
                if (bProjectileB && OwnerB == static_cast<int32>(A))
                    continue;

                FIntVector PB = WorldState.GetPosition(B);
                FVector PosB(static_cast<float>(PB.X), static_cast<float>(PB.Y), static_cast<float>(PB.Z));

                const float RadiusB = FMath::Max(static_cast<float>(WorldState.GetProperty(B, PropertyId::CollisionRadius)), DefaultCollisionRadius);
                const float CombinedRadius = RadiusA + RadiusB;

                const float DistSq = FVector::DistSquared(PosA, PosB);
                if (DistSq <= CombinedRadius * CombinedRadius)
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Collision E%d↔E%d dist=%.1f combined=%.1f"),
                            A, B, FMath::Sqrt(DistSq), CombinedRadius), A);

                    FHktPhysicsEvent PhysEvent;
                    PhysEvent.EntityA = A;
                    PhysEvent.EntityB = B;
                    PhysEvent.ContactPoint = (PosA + PosB) * 0.5f;
                    OutPhysicsEvents.Add(PhysEvent);

                    // Push-out 위치 보정 — 투사체 포함 쌍은 제외
                    // SoftPushRatio로 프레임당 보정량 조절, Mass 비율로 밀림 분배
                    if (!bProjectileA && !bProjectileB)
                    {
                        const float Dist = FMath::Sqrt(DistSq);
                        if (Dist > SMALL_NUMBER)
                        {
                            const float Overlap = CombinedRadius - Dist;
                            const float MassA = static_cast<float>(FMath::Max(WorldState.GetProperty(A, PropertyId::Mass), 1));
                            const float MassB = static_cast<float>(FMath::Max(WorldState.GetProperty(B, PropertyId::Mass), 1));
                            const float InvTotalMass = 1.0f / (MassA + MassB);
                            const FVector Dir = (PosB - PosA) / Dist;

                            // 무거운 쪽은 적게, 가벼운 쪽은 많이 밀림
                            const FVector NewA = PosA - Dir * (Overlap * SoftPushRatio * MassB * InvTotalMass);
                            const FVector NewB = PosB + Dir * (Overlap * SoftPushRatio * MassA * InvTotalMass);

                            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                                FString::Printf(TEXT("Soft push E%d↔E%d overlap=%.1f pushA=(%.1f,%.1f,%.1f) pushB=(%.1f,%.1f,%.1f)"),
                                    A, B, Overlap,
                                    NewA.X - PosA.X, NewA.Y - PosA.Y, NewA.Z - PosA.Z,
                                    NewB.X - PosB.X, NewB.Y - PosB.Y, NewB.Z - PosB.Z), A);

                            VMProxy.SetPosition(WorldState, A,
                                FMath::RoundToInt(NewA.X), FMath::RoundToInt(NewA.Y), FMath::RoundToInt(NewA.Z));
                            VMProxy.SetPosition(WorldState, B,
                                FMath::RoundToInt(NewB.X), FMath::RoundToInt(NewB.Y), FMath::RoundToInt(NewB.Z));

                            // Push-out 후 PosA 갱신 — 이후 충돌 검사에 보정된 위치 사용
                            PosA = NewA;
                        }
                    }
                }
            }

            // 인접 셀 엔티티와 충돌 검사 (자기 셀(0,0) 제외)
            for (int32 OffIdx = 1; OffIdx < 9; ++OffIdx)
            {
                FCellCoord NeighborCell;
                NeighborCell.X = CellCoord.X + AdjacentOffsets[OffIdx][0];
                NeighborCell.Y = CellCoord.Y + AdjacentOffsets[OffIdx][1];

                const TArray<FHktEntityId>* NeighborEntities = GridMap.Find(NeighborCell);
                if (!NeighborEntities)
                    continue;

                for (FHktEntityId B : *NeighborEntities)
                {
                    if (!WorldState.IsValidEntity(B))
                        continue;

                    // 엔티티 쌍 중복 검사 방지
                    uint64 PairKey = (static_cast<uint64>(FMath::Min(A, B)) << 32) | static_cast<uint64>(FMath::Max(A, B));
                    bool bAlreadyInSet = false;
                    TestedPairs.Add(PairKey, &bAlreadyInSet);
                    if (bAlreadyInSet)
                        continue;

                    const uint32 LayerB = static_cast<uint32>(WorldState.GetProperty(B, PropertyId::CollisionLayer));
                    const uint32 MaskB  = static_cast<uint32>(WorldState.GetProperty(B, PropertyId::CollisionMask));

                    if (!(LayerA & MaskB) || !(LayerB & MaskA))
                        continue;

                    const bool bProjectileB = (LayerB == EHktCollisionLayer::Projectile);
                    const int32 OwnerB = WorldState.GetProperty(B, PropertyId::OwnerEntity);

                    if (bProjectileA && OwnerA == static_cast<int32>(B))
                        continue;
                    if (bProjectileB && OwnerB == static_cast<int32>(A))
                        continue;

                    FIntVector PB = WorldState.GetPosition(B);
                    FVector PosB(static_cast<float>(PB.X), static_cast<float>(PB.Y), static_cast<float>(PB.Z));

                    const float RadiusB = FMath::Max(static_cast<float>(WorldState.GetProperty(B, PropertyId::CollisionRadius)), DefaultCollisionRadius);
                    const float CombinedRadius = RadiusA + RadiusB;

                    const float DistSq = FVector::DistSquared(PosA, PosB);
                    if (DistSq <= CombinedRadius * CombinedRadius)
                    {
                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                            FString::Printf(TEXT("Collision(adj) E%d↔E%d dist=%.1f combined=%.1f"),
                                A, B, FMath::Sqrt(DistSq), CombinedRadius), A);

                        FHktPhysicsEvent PhysEvent;
                        PhysEvent.EntityA = A;
                        PhysEvent.EntityB = B;
                        PhysEvent.ContactPoint = (PosA + PosB) * 0.5f;
                        OutPhysicsEvents.Add(PhysEvent);

                        if (!bProjectileA && !bProjectileB)
                        {
                            const float Dist = FMath::Sqrt(DistSq);
                            if (Dist > SMALL_NUMBER)
                            {
                                const float Overlap = CombinedRadius - Dist;
                                const float MassA = static_cast<float>(FMath::Max(WorldState.GetProperty(A, PropertyId::Mass), 1));
                                const float MassB = static_cast<float>(FMath::Max(WorldState.GetProperty(B, PropertyId::Mass), 1));
                                const float InvTotalMass = 1.0f / (MassA + MassB);
                                const FVector Dir = (PosB - PosA) / Dist;

                                FVector NewA = PosA - Dir * (Overlap * SoftPushRatio * MassB * InvTotalMass);
                                FVector NewB = PosB + Dir * (Overlap * SoftPushRatio * MassA * InvTotalMass);

                                // 지형 검증: push 결과가 솔리드 복셀이면 해당 축 push 취소
                                if (TerrainState)
                                {
                                    const FIntVector VA = FHktTerrainSystem::CmToVoxel(
                                        static_cast<float>(NewA.X), static_cast<float>(NewA.Y), static_cast<float>(NewA.Z));
                                    if (TerrainState->IsSolid(VA.X, VA.Y, VA.Z))
                                    {
                                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                                            FString::Printf(TEXT("Push cancelled E%d — target voxel solid V(%d,%d,%d)"),
                                                A, VA.X, VA.Y, VA.Z), A);
                                        NewA = PosA;
                                    }

                                    const FIntVector VB = FHktTerrainSystem::CmToVoxel(
                                        static_cast<float>(NewB.X), static_cast<float>(NewB.Y), static_cast<float>(NewB.Z));
                                    if (TerrainState->IsSolid(VB.X, VB.Y, VB.Z))
                                    {
                                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                                            FString::Printf(TEXT("Push cancelled E%d — target voxel solid V(%d,%d,%d)"),
                                                B, VB.X, VB.Y, VB.Z), B);
                                        NewB = PosB;
                                    }
                                }

                                VMProxy.SetPosition(WorldState, A,
                                    FMath::RoundToInt(NewA.X), FMath::RoundToInt(NewA.Y), FMath::RoundToInt(NewA.Z));
                                VMProxy.SetPosition(WorldState, B,
                                    FMath::RoundToInt(NewB.X), FMath::RoundToInt(NewB.Y), FMath::RoundToInt(NewB.Z));

                                // Push-out 후 PosA 갱신 — 이후 인접 셀 충돌 검사에 보정된 위치 사용
                                PosA = NewA;
                            }
                        }
                    }
                }
            }
        }
    }

    // 지형 충돌: 솔리드 복셀에 파묻힌 엔티티를 밀어냄
    if (TerrainState)
    {
        ProcessTerrainCollision(WorldState, VMProxy, *TerrainState);
    }
}

// ============================================================================
// 4.1 Terrain Collision (PhysicsSystem 내부)
//
// 1단계: 엔티티 중심 복셀이 솔리드 → 위로 수직 탈출 (스폰 후 지형 생성 대응)
// 2단계: 가장자리 겹침 → AABB-Sphere push-out (이동/물리 잔여 겹침 보정)
// ============================================================================

void FHktPhysicsSystem::ProcessTerrainCollision(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    const FHktTerrainState& TerrainState)
{
    static constexpr float VoxelSize = FHktTerrainSystem::VoxelSizeCm;
    static constexpr float HalfVoxel = VoxelSize * 0.5f;
    static constexpr int32 MaxEscapeScanUp = 64;

#if ENABLE_HKT_INSIGHTS
    const int32 DebugEntityId = CVarTerrainDebugEntity.GetValueOnAnyThread();
#endif

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        const int32 Layer = WorldState.GetProperty(Id, PropertyId::CollisionLayer);
        if (Layer == 0)
            return;

        float PosX = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosX));
        float PosY = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosY));
        float PosZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosZ));

        const float Radius = FMath::Max(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::CollisionRadius)), 30.0f);

#if ENABLE_HKT_INSIGHTS
        const bool bDebugThis = (DebugEntityId >= 0 && Id == static_cast<FHktEntityId>(DebugEntityId));
#endif

        // ── 1단계: 중심 복셀이 솔리드 → 수직 탈출 ──
        const FIntVector CenterVoxel = FHktTerrainSystem::CmToVoxel(PosX, PosY, PosZ);
        if (TerrainState.IsSolid(CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z))
        {
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Warning, LogSource,
                FString::Printf(TEXT("Terrain escape — inside solid V(%d,%d,%d) Pos(%.0f,%.0f,%.0f)"),
                    CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z, PosX, PosY, PosZ), Id);
#if ENABLE_HKT_INSIGHTS
            if (bDebugThis)
            {
                HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("Phase"), TEXT("1-CenterEscape"));
                HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("CenterSolid"), TEXT("YES"));
                HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("CenterVoxel"),
                    FString::Printf(TEXT("(%d,%d,%d)"), CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z));
            }
#endif
            for (int32 ScanZ = CenterVoxel.Z + 1;
                 ScanZ <= CenterVoxel.Z + MaxEscapeScanUp; ++ScanZ)
            {
                if (!TerrainState.IsSolid(CenterVoxel.X, CenterVoxel.Y, ScanZ))
                {
                    const int32 EscapeCmZ = FHktTerrainSystem::VoxelToCm(0, 0, ScanZ).Z;
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Terrain escape resolved — Z: %d → %d (scanned %d voxels)"),
                            FMath::RoundToInt(PosZ), EscapeCmZ, ScanZ - CenterVoxel.Z), Id);
#if ENABLE_HKT_INSIGHTS
                    if (bDebugThis)
                    {
                        HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("EscapeZ"),
                            FString::Printf(TEXT("VoxelZ=%d → CmZ=%d"), ScanZ, EscapeCmZ));
                    }
#endif
                    VMProxy.SetPosition(WorldState, Id,
                        FMath::RoundToInt(PosX), FMath::RoundToInt(PosY), EscapeCmZ);
                    return;
                }
            }
            return;
        }

        // ── 2단계: 가장자리 겹침 → AABB-Sphere push-out ──
        const FIntVector MinVoxel = FHktTerrainSystem::CmToVoxel(
            PosX - Radius, PosY - Radius, PosZ);
        const FIntVector MaxVoxel = FHktTerrainSystem::CmToVoxel(
            PosX + Radius, PosY + Radius, PosZ + Radius);

        float PushX = 0.0f;
        float PushY = 0.0f;
        float PushZ = 0.0f;
        int32 PushCount = 0;

#if ENABLE_HKT_INSIGHTS
        int32 DebugSolidCount = 0;
        int32 DebugTotalChecked = 0;
#endif

        for (int32 VZ = MinVoxel.Z; VZ <= MaxVoxel.Z; ++VZ)
        {
            for (int32 VY = MinVoxel.Y; VY <= MaxVoxel.Y; ++VY)
            {
                for (int32 VX = MinVoxel.X; VX <= MaxVoxel.X; ++VX)
                {
#if ENABLE_HKT_INSIGHTS
                    if (bDebugThis) ++DebugTotalChecked;
#endif
                    if (!TerrainState.IsSolid(VX, VY, VZ))
                        continue;

#if ENABLE_HKT_INSIGHTS
                    if (bDebugThis) ++DebugSolidCount;
#endif

                    const FIntVector VoxelCm = FHktTerrainSystem::VoxelToCm(VX, VY, VZ);
                    const float VCX = static_cast<float>(VoxelCm.X);
                    const float VCY = static_cast<float>(VoxelCm.Y);
                    const float VCZ = static_cast<float>(VoxelCm.Z);

                    const float ClampX = FMath::Clamp(PosX, VCX - HalfVoxel, VCX + HalfVoxel);
                    const float ClampY = FMath::Clamp(PosY, VCY - HalfVoxel, VCY + HalfVoxel);
                    const float ClampZ = FMath::Clamp(PosZ, VCZ - HalfVoxel, VCZ + HalfVoxel);

                    const float DX = PosX - ClampX;
                    const float DY = PosY - ClampY;
                    const float DZ = PosZ - ClampZ;
                    const float DistSq = DX * DX + DY * DY + DZ * DZ;

                    if (DistSq < Radius * Radius && DistSq > SMALL_NUMBER)
                    {
                        const float Dist = FMath::Sqrt(DistSq);
                        const float Penetration = Radius - Dist;
                        const float InvDist = 1.0f / Dist;
                        PushX += DX * InvDist * Penetration;
                        PushY += DY * InvDist * Penetration;
                        PushZ += DZ * InvDist * Penetration;
                        ++PushCount;
                    }
                }
            }
        }

        if (PushCount > 0)
        {
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                FString::Printf(TEXT("Terrain edge push — count=%d push=(%.1f,%.1f,%.1f) Pos(%.0f,%.0f,%.0f)"),
                    PushCount, PushX, PushY, PushZ, PosX, PosY, PosZ), Id);
            VMProxy.SetPosition(WorldState, Id,
                FMath::RoundToInt(PosX + PushX),
                FMath::RoundToInt(PosY + PushY),
                FMath::RoundToInt(PosZ + PushZ));
        }

#if ENABLE_HKT_INSIGHTS
        if (bDebugThis)
        {
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("Phase"), TEXT("2-EdgePush"));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("CenterSolid"), TEXT("No"));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("CenterVoxel"),
                FString::Printf(TEXT("(%d,%d,%d)"), CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("EntityPos"),
                FString::Printf(TEXT("(%.1f, %.1f, %.1f)"), PosX, PosY, PosZ));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("CollisionRadius"),
                FString::Printf(TEXT("%.1f"), Radius));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("AABBRange"),
                FString::Printf(TEXT("(%d,%d,%d)→(%d,%d,%d)"),
                    MinVoxel.X, MinVoxel.Y, MinVoxel.Z, MaxVoxel.X, MaxVoxel.Y, MaxVoxel.Z));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("VoxelsChecked"),
                FString::Printf(TEXT("%d"), DebugTotalChecked));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("SolidVoxelsInAABB"),
                FString::Printf(TEXT("%d"), DebugSolidCount));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("PushCount"),
                FString::Printf(TEXT("%d"), PushCount));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("PushVector"),
                FString::Printf(TEXT("(%.2f, %.2f, %.2f)"), PushX, PushY, PushZ));
            HKT_INSIGHT_COLLECT(TEXT("Terrain.Sim"), TEXT("ChunkLoaded"),
                TerrainState.IsChunkLoaded(FHktTerrainState::WorldToChunk(CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z))
                    ? TEXT("Yes") : TEXT("NO — CHUNK NOT LOADED"));
        }
#endif
    });
}

// ============================================================================
// 5. VM Cleanup System
// ============================================================================

void FHktVMCleanupSystem::Process(TArray<FHktVMHandle>& CompletedVMs, FHktVMRuntimePool& Pool, FHktWorldState& WorldState, FHktVMWorldStateProxy& VMProxy)
{
    for (FHktVMHandle Handle : CompletedVMs)
    {
        FHktVMRuntime* Runtime = Pool.Get(Handle);
        if (Runtime)
        {
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
                FString::Printf(TEXT("VM finalized: %s"),
                    Runtime->Program ? *Runtime->Program->Tag.ToString() : TEXT("unknown")),
                Runtime->Context ? Runtime->Context->SourceEntity : InvalidEntityId);

            if (Runtime->Program && Runtime->Context)
            {
                FGameplayTag Tag = Runtime->Program->Tag;
                FHktEntityId Source = Runtime->Context->SourceEntity;
                WorldState.ActiveEvents.RemoveAll([&](const FHktEvent& E)
                {
                    return E.SourceEntity == Source && E.EventTag == Tag;
                });

                // 이벤트 태그 + 자식 태그를 SourceEntity에서 일괄 제거
                if (WorldState.IsValidEntity(Source))
                {
                    int32 Slot = WorldState.GetSlot(Source);
                    const FGameplayTagContainer& CurrentTags = WorldState.GetTagsBySlot(Slot);
                    TArray<FGameplayTag> TagsToRemove;
                    for (const FGameplayTag& T : CurrentTags)
                    {
                        if (T.MatchesTag(Tag))
                        {
                            TagsToRemove.Add(T);
                        }
                    }
                    for (const FGameplayTag& T : TagsToRemove)
                    {
                        VMProxy.RemoveTag(WorldState, Source, T);
                    }
                }
            }

            if (Runtime->Context)
            {
                Runtime->Context->Reset();
            }
        }
        Pool.Free(Handle);
    }
    CompletedVMs.Reset();
}