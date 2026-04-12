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
    30.0f, // 이 높이 이하의 단차는 자동으로 올라감, 초과 시 벽으로 차단
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

FIntVector FHktTerrainSystem::CmToVoxel(int32 X, int32 Y, int32 Z, float VoxelSizeCm)
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

FIntVector FHktTerrainSystem::CmToVoxel(float X, float Y, float Z, float VoxelSizeCm)
{
    return FIntVector(
        FMath::FloorToInt(X / VoxelSizeCm),
        FMath::FloorToInt(Y / VoxelSizeCm),
        FMath::FloorToInt(Z / VoxelSizeCm));
}

FIntVector FHktTerrainSystem::VoxelToCm(int32 VX, int32 VY, int32 VZ, float VoxelSizeCm)
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

    // 단일 출처: Generator의 Config에서 모든 스트리밍 파라미터 획득
    const FHktTerrainGeneratorConfig& Cfg = Generator.GetConfig();
    const float VS            = Cfg.VoxelSizeCm;
    const int32 LoadRadiusXY  = Cfg.SimLoadRadiusXY;
    const int32 LoadRadiusZ   = Cfg.SimLoadRadiusZ;
    const int32 MaxLoaded     = Cfg.SimMaxChunksLoaded;
    const int32 MaxPerFrame   = Cfg.SimMaxChunkLoadsPerFrame;
    const int32 HeightMinZ    = Cfg.HeightMinZ;
    const int32 HeightMaxZ    = Cfg.HeightMaxZ;

    // 1. 엔티티를 청크 단위로 중복 제거하여 수집
    //    같은 청크에 있는 엔티티 N개가 동일한 75개 항목을 중복 삽입하지 않도록,
    //    엔티티의 청크 좌표를 먼저 TSet에 모은 뒤 한 번만 반경 확장한다.
    TSet<FIntVector> EntityChunks;
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        const FIntVector Pos = WorldState.GetPosition(Id);
        const FIntVector VoxelPos = CmToVoxel(Pos.X, Pos.Y, Pos.Z, VS);
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
                    static_cast<float>(Evt.Location.Z),
                    VS);
                EntityChunks.Add(FHktTerrainState::WorldToChunk(VoxelPos.X, VoxelPos.Y, VoxelPos.Z));
            }
        }
    }

    // 고유 청크 좌표에서만 반경 확장 (엔티티 200개 → 고유 청크 ~10개)
    // 월드 Z 경계 [HeightMinZ, HeightMaxZ] 클램프로 천장 밖 청크는 로드 대상에서 제외
    for (const FIntVector& ChunkCoord : EntityChunks)
    {
        for (int32 DX = -LoadRadiusXY; DX <= LoadRadiusXY; ++DX)
        {
            for (int32 DY = -LoadRadiusXY; DY <= LoadRadiusXY; ++DY)
            {
                for (int32 DZ = -LoadRadiusZ; DZ <= LoadRadiusZ; ++DZ)
                {
                    const int32 CZ = ChunkCoord.Z + DZ;
                    if (CZ < HeightMinZ || CZ > HeightMaxZ)
                        continue;  // 월드 경계 밖 — 시뮬레이션에서도 렌더와 동일하게 무시
                    RequiredChunks.Add(FIntVector(ChunkCoord.X + DX, ChunkCoord.Y + DY, CZ));
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
            if (TerrainState.GetLoadedChunkCount() >= MaxLoaded)
            {
                break;
            }
            if (LoadedThisFrame >= MaxPerFrame)
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
// 3.4–3.5 Movement/Physics 공통 헬퍼
// ============================================================================

// 현재 위치에서 아래로 스캔하여 서 있을 바닥 복셀 Z를 반환한다.
// GetSurfaceHeightAt(최상단 전용)과 달리 동굴·다층 지형에서 올바르게 동작한다.
// - 현재 복셀이 솔리드 안이면 위로 탈출 (MaxScanUp 복셀 한도)
// - 현재 복셀이 에어면 아래로 스캔하여 바닥 탐색 (MaxScanDown 복셀 한도)
// - 범위 내 바닥 없으면 StartVoxelZ 반환 (청크 미로드 보호)
//
// PhysicsSystem 이 소유한다 (Movement 는 지형을 전혀 쿼리하지 않는다).
/** 바닥 찾기 실패 시 반환하는 센티널 값. Phase 1 이 이 값을 보면 floor snap 을 건너뛴다. */
static constexpr int32 NoFloorSentinel = INT32_MIN;

static int32 FindFloorVoxelZ(const FHktTerrainState& Terrain,
                              int32 VoxelX, int32 VoxelY, int32 StartVoxelZ,
                              int32 MaxScanUp = 8, int32 MaxScanDown = 64)
{
    if (Terrain.IsSolid(VoxelX, VoxelY, StartVoxelZ))
    {
        // 솔리드 내부 → 위로 ���출
        for (int32 Z = StartVoxelZ + 1; Z <= StartVoxelZ + MaxScanUp; ++Z)
        {
            if (!Terrain.IsSolid(VoxelX, VoxelY, Z))
                return Z;
        }
        return StartVoxelZ;
    }

    // 에어 �� 아래로 ��닥 탐색
    for (int32 Z = StartVoxelZ - 1; Z >= StartVoxelZ - MaxScanDown; --Z)
    {
        if (Terrain.IsSolid(VoxelX, VoxelY, Z))
            return Z + 1;
    }

    // 바닥 없음 (청크 미로드, 스캔 범위 초과 등) — 센티널 반환.
    // 기존에는 StartVoxelZ 를 반환하여 VoxelToCm(StartVoxelZ) ≥ NewPZ 가 되어
    // 엔티티가 공중에서 허위 접지(IsGrounded=1) 되는 버그가 있었다.
    return NoFloorSentinel;
}

// ============================================================================
// 3.4 Gravity System — 환경력 누적
//
// 비접지(IsGrounded==0) 엔티티의 VelZ 를 매 프레임 Gravity 만큼 차감한다.
// 접지 엔티티는 PhysicsSystem Phase 1 이 VelZ=0 을 보장하므로 건드릴 필요 없음.
// 점프 발동 경로: bytecode/rule 이 VelZ 를 양수로 쓰고 IsGrounded=0 으로 설정하면
// 다음 프레임부터 이 시스템이 차감을 시작한다.
// ============================================================================

void FHktGravitySystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    float DeltaSeconds)
{
    const float Gravity = CVarJumpGravity.GetValueOnAnyThread();
    const float MaxFall = CVarJumpMaxFallSpeed.GetValueOnAnyThread();

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        // 접지 엔티티는 중력 비활성 — Physics 가 VelZ=0 을 보장함
        if (WorldState.GetProperty(Id, PropertyId::IsGrounded) != 0)
            return;

        float VZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::VelZ));
        VZ -= Gravity * DeltaSeconds;
        if (VZ < -MaxFall)
            VZ = -MaxFall;

        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, FMath::RoundToInt(VZ));
    });
}

// ============================================================================
// 3.5 Movement System — 순수 운동학 (지형 질의 없음)
//
// 다음만 수행한다:
//   1. 힘/질량/속도 적분 → 기대 위치 계산
//   2. idle 엔티티 skip 최적화
//   3. MoveEnd/MoveTarget 목표 지향 로직
//   4. IsMoving/RotYaw 갱신, PreMovePositions 기록
//
// 다음은 절대 하지 않는다 (PhysicsSystem Phase 1 이 처리):
//   - 지형 벽 슬라이드, 계단 높이 검사, 천장 검사
//   - 지면 Z 스냅, IsGrounded 갱신, Grounded 이벤트 emit
//
// 중력은 GravitySystem 이 Movement 직전에 적용해 VelZ 를 세팅해둔다.
// ============================================================================

void FHktMovementSystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    TArray<FHktPendingEvent>& OutMoveEndEvents,
    TArray<FIntVector>& OutPreMovePositions,
    float DeltaSeconds)
{
    OutMoveEndEvents.Reset();
    // PreMovePositions 는 slot 인덱스로 접근한다. 슬롯이 빈 자리는 사용되지 않으므로 uninitialized 로 둔다.
    OutPreMovePositions.SetNumUninitialized(WorldState.SlotToEntity.Num());

    static constexpr float ArrivalThresholdSq = 16.0f;  // 4cm (도착 판정)
    static constexpr float DefaultMaxSpeed = 600.0f;     // PropertyId::MaxSpeed <= 0 일 때 fallback

    // 콘솔 변수 조회 (루프 진입 전 1회만 캐싱)
    const float AccelMultiplier = CVarMoveAccelMultiplier.GetValueOnAnyThread();
    const float SlowingRadius = CVarMoveSlowingRadius.GetValueOnAnyThread();
    const float MinSpeed = CVarMoveMinSpeed.GetValueOnAnyThread();

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 Slot)
    {
        // 1) 현재 위치 읽기 + PreMove 기록 (skip 대상도 기록 — Physics 가 slot 기반으로 접근)
        const int32 CurPX = WorldState.GetProperty(Id, PropertyId::PosX);
        const int32 CurPY = WorldState.GetProperty(Id, PropertyId::PosY);
        const int32 CurPZ = WorldState.GetProperty(Id, PropertyId::PosZ);
        OutPreMovePositions[Slot] = FIntVector(CurPX, CurPY, CurPZ);

        const int32 IsMoving   = WorldState.GetProperty(Id, PropertyId::IsMoving);
        const int32 IsGrounded = WorldState.GetProperty(Id, PropertyId::IsGrounded);
        const int32 MoveForce  = WorldState.GetProperty(Id, PropertyId::MoveForce);
        const int32 RawVX      = WorldState.GetProperty(Id, PropertyId::VelX);
        const int32 RawVY      = WorldState.GetProperty(Id, PropertyId::VelY);
        const int32 RawVZ      = WorldState.GetProperty(Id, PropertyId::VelZ);

        // 2) Skip 최적화: 완전 정지한 접지 엔티티는 dirty 쓰기 없이 빠져나간다.
        //    Gravity/Physics 는 여전히 이 엔티티에 대해 cheap check 만 수행.
        if (IsMoving == 0 && IsGrounded != 0
            && RawVX == 0 && RawVY == 0 && RawVZ == 0
            && MoveForce == 0)
        {
            return;
        }

        float CurX = static_cast<float>(CurPX);
        float CurY = static_cast<float>(CurPY);
        float CurZ = static_cast<float>(CurPZ);
        float VX = static_cast<float>(RawVX);
        float VY = static_cast<float>(RawVY);
        float VZ = static_cast<float>(RawVZ);  // Gravity 가 이미 갱신해둔 값 — Movement 는 건드리지 않음

        float NewX = CurX;
        float NewY = CurY;

        // 3) XY 목표 지향 적분 (IsMoving == 1)
        if (IsMoving != 0)
        {
            const float TgtX = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetX));
            const float TgtY = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetY));
            const float TgtZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::MoveTargetZ));

            const float DX = TgtX - CurX;
            const float DY = TgtY - CurY;
            const float DZ = TgtZ - CurZ;
            const float DistSq = DX * DX + DY * DY + DZ * DZ;

            // RotYaw 갱신 (미세 거리 각도 튐 방지)
            if (DistSq > 1.0f)
            {
                const int32 YawDeg = FMath::RoundToInt(FMath::Atan2(DY, DX) * (180.0f / PI));
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::RotYaw, YawDeg);
            }

            // 도착 판정 — 타겟에 완전 스냅하고 수평 속도 0
            if (DistSq <= ArrivalThresholdSq)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Arrived at target (%.0f,%.0f,%.0f) dist=%.1f"),
                        TgtX, TgtY, TgtZ, FMath::Sqrt(DistSq)), Id);

                VMProxy.SetPosition(WorldState, Id,
                    FMath::RoundToInt(TgtX), FMath::RoundToInt(TgtY), FMath::RoundToInt(TgtZ));
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, 0);
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, 0);
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsMoving, 0);
                // VelZ 는 건드리지 않음 — 공중 상태면 Gravity 가 계속 적분

                FHktPendingEvent Evt;
                Evt.Type = EWaitEventType::MoveEnd;
                Evt.WatchedEntity = Id;
                OutMoveEndEvents.Add(Evt);
                return;
            }

            // 수평 속력만 추출 (수직 속도는 Gravity 관리)
            float HSpeed = FMath::Sqrt(VX * VX + VY * VY);

            // 가속/감속 (MaxSpeed per-entity)
            const int32 RawMaxSpeed = WorldState.GetProperty(Id, PropertyId::MaxSpeed);
            const float MaxSpeedCm = RawMaxSpeed > 0 ? static_cast<float>(RawMaxSpeed) : DefaultMaxSpeed;

            const float HDist = FMath::Sqrt(DX * DX + DY * DY);

            float DesiredSpeed = MaxSpeedCm;
            if (HDist < SlowingRadius)
            {
                DesiredSpeed = FMath::Max(MaxSpeedCm * (HDist / SlowingRadius), MinSpeed);
            }

            const float Force = static_cast<float>(MoveForce);
            const float Mass = static_cast<float>(FMath::Max(WorldState.GetProperty(Id, PropertyId::Mass), 1));
            const float Accel = (Force / Mass) * AccelMultiplier;
            const float MaxSpeedChange = Accel * DeltaSeconds;

            if (HSpeed < DesiredSpeed)
                HSpeed = FMath::Min(HSpeed + MaxSpeedChange, DesiredSpeed);
            else if (HSpeed > DesiredSpeed)
                HSpeed = FMath::Max(HSpeed - MaxSpeedChange, DesiredSpeed);

            const float MoveStep = HSpeed * DeltaSeconds;

            // XY 오버슈트 방지 — 수평 거리로만 판정 (Z 낙하/점프와 독립)
            if (HDist > SMALL_NUMBER && MoveStep >= HDist)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Movement, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Overshoot snap XY to target (%.0f,%.0f) step=%.1f hdist=%.1f"),
                        TgtX, TgtY, MoveStep, HDist), Id);

                NewX = TgtX;
                NewY = TgtY;
                VX = 0.0f;
                VY = 0.0f;
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsMoving, 0);

                FHktPendingEvent Evt;
                Evt.Type = EWaitEventType::MoveEnd;
                Evt.WatchedEntity = Id;
                OutMoveEndEvents.Add(Evt);
                // 아래 Z 적분은 계속 수행 (낙하 중일 수 있음)
            }
            else if (HDist > SMALL_NUMBER)
            {
                // 직선 궤적으로 XY 속도 재설정 (방향은 타겟 방향)
                const float InvHDist = 1.0f / HDist;
                const float DirX = DX * InvHDist;
                const float DirY = DY * InvHDist;
                VX = DirX * HSpeed;
                VY = DirY * HSpeed;
                NewX = CurX + VX * DeltaSeconds;
                NewY = CurY + VY * DeltaSeconds;
            }
            // else: HDist 거의 0 — XY 는 그대로 두고 Z 만 적분
        }

        // 4) Z 적분 — VelZ 는 Gravity 가 세팅해 놓은 값. 접지 엔티티는 VelZ==0 이므로 변화 없음.
        const float NewZ = CurZ + VZ * DeltaSeconds;

        // 5) 기대 위치 쓰기 (Physics Phase 1 이 지형 제약 적용)
        VMProxy.SetPosition(WorldState, Id,
            FMath::RoundToInt(NewX), FMath::RoundToInt(NewY), FMath::RoundToInt(NewZ));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, FMath::RoundToInt(VX));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, FMath::RoundToInt(VY));
        // VelZ 는 Gravity 가 이미 기록했으므로 건드리지 않음
    });
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
    TArray<FHktPendingEvent>& OutGroundedEvents,
    const TArray<FIntVector>& PreMovePositions,
    const FHktTerrainState* TerrainState,
    float DeltaSeconds)
{
    OutPhysicsEvents.Reset();
    OutGroundedEvents.Reset();

    // ------------------------------------------------------------------------
    // Phase 1: 지형 제약 — 축별 wall-slide → step-height → 천장 → floor snap
    //          (구 MovementSystem 내 모든 지형 로직을 이곳으로 이관)
    // ------------------------------------------------------------------------
    if (TerrainState)
    {
        ResolveTerrainPhase1(WorldState, VMProxy, PreMovePositions, OutGroundedEvents, *TerrainState, DeltaSeconds);
    }

    // ------------------------------------------------------------------------
    // Phase 2: 엔티티 쌍 해결 — entity-id 오름차순으로 결정론적 순회
    // ------------------------------------------------------------------------
    RebuildGrid(WorldState);

    static constexpr float DefaultCollisionRadius = 50.0f;
    const float SoftPushRatio = CVarPhysicsSoftPushRatio.GetValueOnAnyThread();
    const float VS = TerrainState ? TerrainState->VoxelSizeCm : 15.0f;

    // 결정론: 각 셀의 entity 리스트를 id 오름차순으로 정렬
    for (auto& Pair : GridMap)
    {
        Pair.Value.Sort();
    }

    // 결정론: 외곽 루프를 entity id 오름차순 배열로 돌린다 (TMap 순회 순서에 의존하지 않음)
    SortedEntitiesScratch.Reset();
    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        const int32 Layer = WorldState.GetProperty(Id, PropertyId::CollisionLayer);
        if (Layer == 0)
            return;
        SortedEntitiesScratch.Add(Id);
    });
    SortedEntitiesScratch.Sort();  // entity id 오름차순

    TestedPairs.Reset();

    // 자기 셀 포함 9칸 (순서 고정 — 결정론)
    static constexpr int32 AdjacentOffsets[9][2] = {
        {0,0}, {1,0}, {-1,0}, {0,1}, {0,-1}, {1,1}, {1,-1}, {-1,1}, {-1,-1}
    };

    auto MakePairKey = [](FHktEntityId A, FHktEntityId B) -> uint64
    {
        return (static_cast<uint64>(FMath::Min(A, B)) << 32) | static_cast<uint64>(FMath::Max(A, B));
    };

    for (FHktEntityId A : SortedEntitiesScratch)
    {
        if (!WorldState.IsValidEntity(A))
            continue;

        const uint32 LayerA = static_cast<uint32>(WorldState.GetProperty(A, PropertyId::CollisionLayer));
        const uint32 MaskA  = static_cast<uint32>(WorldState.GetProperty(A, PropertyId::CollisionMask));

        FIntVector PA = WorldState.GetPosition(A);
        FVector PosA(static_cast<float>(PA.X), static_cast<float>(PA.Y), static_cast<float>(PA.Z));
        const float RadiusA = FMath::Max(
            static_cast<float>(WorldState.GetProperty(A, PropertyId::CollisionRadius)),
            DefaultCollisionRadius);

        const bool bProjectileA = (LayerA == EHktCollisionLayer::Projectile);
        const int32 OwnerA = WorldState.GetProperty(A, PropertyId::OwnerEntity);

        const FCellCoord ACell = WorldToCell(PosA);

        // 자기 셀 + 8 인접 셀 (고정 순서) 순회
        for (int32 OffIdx = 0; OffIdx < 9; ++OffIdx)
        {
            const FCellCoord NeighborCell{ ACell.X + AdjacentOffsets[OffIdx][0], ACell.Y + AdjacentOffsets[OffIdx][1] };
            const TArray<FHktEntityId>* NeighborEntities = GridMap.Find(NeighborCell);
            if (!NeighborEntities)
                continue;

            for (FHktEntityId B : *NeighborEntities)
            {
                if (B == A || !WorldState.IsValidEntity(B))
                    continue;

                // 쌍 중복 검사 (A<B 또는 A>B 어느 쪽이든 한 번만 처리)
                const uint64 PairKey = MakePairKey(A, B);
                bool bAlreadyTested = false;
                TestedPairs.Add(PairKey, &bAlreadyTested);
                if (bAlreadyTested)
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

                const float RadiusB = FMath::Max(
                    static_cast<float>(WorldState.GetProperty(B, PropertyId::CollisionRadius)),
                    DefaultCollisionRadius);
                const float CombinedRadius = RadiusA + RadiusB;

                const float DistSq = FVector::DistSquared(PosA, PosB);
                if (DistSq > CombinedRadius * CombinedRadius)
                    continue;

                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Collision E%d↔E%d dist=%.1f combined=%.1f"),
                        A, B, FMath::Sqrt(DistSq), CombinedRadius), A);

                FHktPhysicsEvent PhysEvent;
                PhysEvent.EntityA = A;
                PhysEvent.EntityB = B;
                PhysEvent.ContactPoint = (PosA + PosB) * 0.5f;
                OutPhysicsEvents.Add(PhysEvent);

                // 질량 가중 soft push — 투사체 쌍은 push 없음
                if (bProjectileA || bProjectileB)
                    continue;

                const float Dist = FMath::Sqrt(DistSq);
                if (Dist <= SMALL_NUMBER)
                    continue;

                const float Overlap = CombinedRadius - Dist;
                const float MassA = static_cast<float>(FMath::Max(WorldState.GetProperty(A, PropertyId::Mass), 1));
                const float MassB = static_cast<float>(FMath::Max(WorldState.GetProperty(B, PropertyId::Mass), 1));
                const float InvTotalMass = 1.0f / (MassA + MassB);
                const FVector Dir = (PosB - PosA) / Dist;

                FVector NewA = PosA - Dir * (Overlap * SoftPushRatio * MassB * InvTotalMass);
                FVector NewB = PosB + Dir * (Overlap * SoftPushRatio * MassA * InvTotalMass);

                // 지형 검증: push 결과가 솔리드 복셀이면 해당 엔티티의 push 취소
                if (TerrainState)
                {
                    const FIntVector VA = FHktTerrainSystem::CmToVoxel(
                        static_cast<float>(NewA.X), static_cast<float>(NewA.Y), static_cast<float>(NewA.Z), VS);
                    if (TerrainState->IsSolid(VA.X, VA.Y, VA.Z))
                    {
                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                            FString::Printf(TEXT("Push cancelled E%d — target voxel solid V(%d,%d,%d)"),
                                A, VA.X, VA.Y, VA.Z), A);
                        NewA = PosA;
                    }

                    const FIntVector VB = FHktTerrainSystem::CmToVoxel(
                        static_cast<float>(NewB.X), static_cast<float>(NewB.Y), static_cast<float>(NewB.Z), VS);
                    if (TerrainState->IsSolid(VB.X, VB.Y, VB.Z))
                    {
                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                            FString::Printf(TEXT("Push cancelled E%d — target voxel solid V(%d,%d,%d)"),
                                B, VB.X, VB.Y, VB.Z), B);
                        NewB = PosB;
                    }
                }

                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Soft push E%d↔E%d overlap=%.1f pushA=(%.1f,%.1f,%.1f) pushB=(%.1f,%.1f,%.1f)"),
                        A, B, Overlap,
                        NewA.X - PosA.X, NewA.Y - PosA.Y, NewA.Z - PosA.Z,
                        NewB.X - PosB.X, NewB.Y - PosB.Y, NewB.Z - PosB.Z), A);

                VMProxy.SetPosition(WorldState, A,
                    FMath::RoundToInt(NewA.X), FMath::RoundToInt(NewA.Y), FMath::RoundToInt(NewA.Z));
                VMProxy.SetPosition(WorldState, B,
                    FMath::RoundToInt(NewB.X), FMath::RoundToInt(NewB.Y), FMath::RoundToInt(NewB.Z));

                // Push 후 PosA 갱신 — 이후 쌍 검사에 보정된 위치 사용
                PosA = NewA;
            }
        }
    }

    // ------------------------------------------------------------------------
    // Phase 3: 지형 잔여 겹침 정리 (솔리드 보이저 center escape + edge push-out)
    // ------------------------------------------------------------------------
    if (TerrainState)
    {
        ResolveTerrainConstraints(WorldState, VMProxy, *TerrainState);
    }
}

// ============================================================================
// 4.1 Physics Phase 1 — 지형 제약 해결
//
// 처리 순서 (엔티티 한 개당):
//   1) 축별 wall-slide: PreMove → CurPos 변위를 X/Y 분해, 전방 body voxel 검사
//   2) Step-height: 목표 XY 의 surface 가 PreZ + MaxStepHeight 초과면 XY 취소
//   3) 천장: NewVZ > 0 이고 머리 위 solid → VelZ = 0
//   4) Floor snap: NewPZ <= SurfaceZ 면 NewPZ = SurfaceZ, VelZ = 0, IsGrounded = 1
//                  (transition 시 Grounded 이벤트 emit)
//                  그 외에는 IsGrounded = 0 (절벽 walked-off 포함)
//
// 정지 상태 접지 엔티티도 매 프레임 floor sample 1회 하여 지형 변형 대응.
// 변화 없으면 dirty 쓰기 없음 (skip 최적화).
// ============================================================================

void FHktPhysicsSystem::ResolveTerrainPhase1(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    const TArray<FIntVector>& PreMovePositions,
    TArray<FHktPendingEvent>& OutGroundedEvents,
    const FHktTerrainState& TerrainState,
    float /*DeltaSeconds*/)
{
    const float VS = TerrainState.VoxelSizeCm;
    const float MaxStepHeightCm = CVarTerrainMaxStepHeight.GetValueOnAnyThread();


#if ENABLE_HKT_INSIGHTS
    const int32 DebugPhase1Entity = CVarTerrainDebugEntity.GetValueOnAnyThread();
#endif

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 Slot)
    {
        // Collision layer 없는 엔티티는 지형 충돌 제외 (투사체/장비 등의 장식 엔티티도 제외)
        const int32 Layer = WorldState.GetProperty(Id, PropertyId::CollisionLayer);
        if (Layer == 0)
        {
#if ENABLE_HKT_INSIGHTS
            if (DebugPhase1Entity >= 0 && Id == static_cast<FHktEntityId>(DebugPhase1Entity))
            {
                UE_LOG(LogTemp, Warning, TEXT("[Phase1] E%d SKIPPED — CollisionLayer=0! 지형 충돌 비활성. "
                    "ClassTag 기반 GetDefaultCollisionLayer() 매핑 확인 필요"), Id);
            }
#endif
            return;
        }

        // PreMovePositions 인덱스 범위 체크 (스폰된 지 얼마 안 돼 인덱스가 뒤에 있을 수 있음)
        if (Slot < 0 || Slot >= PreMovePositions.Num())
            return;

        const FIntVector PreMove = PreMovePositions[Slot];

        int32 NewPX = WorldState.GetProperty(Id, PropertyId::PosX);
        int32 NewPY = WorldState.GetProperty(Id, PropertyId::PosY);
        int32 NewPZ = WorldState.GetProperty(Id, PropertyId::PosZ);

        int32 VelX = WorldState.GetProperty(Id, PropertyId::VelX);
        int32 VelY = WorldState.GetProperty(Id, PropertyId::VelY);
        int32 VelZ = WorldState.GetProperty(Id, PropertyId::VelZ);

        const float ColRadius = FMath::Max(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::CollisionRadius)), 30.0f);
        const float BodyZ = static_cast<float>(PreMove.Z) + VS;  // 몸통 복셀 Z (발 위 1복셀)

        // 1) 수평 wall-slide (per-axis) — PreMove 를 기준으로 변위 분해
        //    발(feet) 높이와 몸통(body) 높이 두 곳에서 검사한다.
        //    어느 한쪽이라도 solid 이면 해당 축 이동을 취소.
        //
        //    BugFix: EdgeX/Y 가 정확히 복셀 경계(k * VoxelSize)에 걸리면
        //    FloorToInt 가 다음(빈) 복셀을 반환하여 벽을 놓치는 문제 수정.
        //    0.1cm 내측 오프셋으로 올바른 복셀을 보장한다.
        static constexpr float VoxelBoundaryInset = 0.1f;

        const int32 DX = NewPX - PreMove.X;
        const int32 DY = NewPY - PreMove.Y;
        const float FeetZ = static_cast<float>(PreMove.Z);  // 발 높이

        if (DX != 0)
        {
            const float EdgeX = static_cast<float>(NewPX) +
                (DX > 0 ? (ColRadius - VoxelBoundaryInset) : -(ColRadius - VoxelBoundaryInset));
            const FIntVector VBody = FHktTerrainSystem::CmToVoxel(EdgeX, static_cast<float>(PreMove.Y), BodyZ, VS);
            const FIntVector VFeet = FHktTerrainSystem::CmToVoxel(EdgeX, static_cast<float>(PreMove.Y), FeetZ, VS);
            if (TerrainState.IsSolid(VBody.X, VBody.Y, VBody.Z) ||
                TerrainState.IsSolid(VFeet.X, VFeet.Y, VFeet.Z))
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Wall slide X — blocked body V(%d,%d,%d) feet V(%d,%d,%d)"),
                        VBody.X, VBody.Y, VBody.Z, VFeet.X, VFeet.Y, VFeet.Z), Id);
                NewPX = PreMove.X;
                VelX = 0;
            }
        }
        if (DY != 0)
        {
            const float EdgeY = static_cast<float>(NewPY) +
                (DY > 0 ? (ColRadius - VoxelBoundaryInset) : -(ColRadius - VoxelBoundaryInset));
            const FIntVector VBody = FHktTerrainSystem::CmToVoxel(static_cast<float>(NewPX), EdgeY, BodyZ, VS);
            const FIntVector VFeet = FHktTerrainSystem::CmToVoxel(static_cast<float>(NewPX), EdgeY, FeetZ, VS);
            if (TerrainState.IsSolid(VBody.X, VBody.Y, VBody.Z) ||
                TerrainState.IsSolid(VFeet.X, VFeet.Y, VFeet.Z))
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Wall slide Y — blocked body V(%d,%d,%d) feet V(%d,%d,%d)"),
                        VBody.X, VBody.Y, VBody.Z, VFeet.X, VFeet.Y, VFeet.Z), Id);
                NewPY = PreMove.Y;
                VelY = 0;
            }
        }

        // 2) Step-height: 이동 목표 지면이 PreZ + MaxStepHeight 초과면 XY 취소
        //    (엔티티가 실제로 XY 를 이동한 경우에만 검사)
        if ((NewPX != PreMove.X) || (NewPY != PreMove.Y))
        {
            const FIntVector NewVoxel = FHktTerrainSystem::CmToVoxel(
                static_cast<float>(NewPX), static_cast<float>(NewPY), static_cast<float>(NewPZ), VS);
            const int32 NewSurfaceVoxelZ = FindFloorVoxelZ(TerrainState, NewVoxel.X, NewVoxel.Y, NewVoxel.Z);

            // 바닥을 찾은 경우에만 step-height 검사 (NoFloorSentinel → 공중 이동 허용)
            if (NewSurfaceVoxelZ != NoFloorSentinel)
            {
                const int32 NewSurfaceCmZ = FHktTerrainSystem::VoxelToCm(0, 0, NewSurfaceVoxelZ, VS).Z;

                if (static_cast<float>(NewSurfaceCmZ) > static_cast<float>(PreMove.Z) + MaxStepHeightCm)
                {
                    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                        FString::Printf(TEXT("Step too high — revert XY. surfZ=%d preZ=%d step=%d max=%.0f"),
                            NewSurfaceCmZ, PreMove.Z, NewSurfaceCmZ - PreMove.Z, MaxStepHeightCm), Id);
                    NewPX = PreMove.X;
                    NewPY = PreMove.Y;
                    VelX = 0;
                    VelY = 0;
                }
            }
        }

        // 3) 천장: 상승 중(VelZ > 0)이고 머리 위 voxel 이 solid → VelZ 제거
        if (VelZ > 0)
        {
            const FIntVector HeadVoxel = FHktTerrainSystem::CmToVoxel(
                static_cast<float>(NewPX), static_cast<float>(NewPY), static_cast<float>(NewPZ) + VS, VS);
            if (TerrainState.IsSolid(HeadVoxel.X, HeadVoxel.Y, HeadVoxel.Z))
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Ceiling hit — velZ=%d headV(%d,%d,%d)"),
                        VelZ, HeadVoxel.X, HeadVoxel.Y, HeadVoxel.Z), Id);
                VelZ = 0;
            }
        }

        // 4) Floor snap = 지면에 의한 수직 push-out + IsGrounded 갱신
        const FIntVector FinalVoxel = FHktTerrainSystem::CmToVoxel(
            static_cast<float>(NewPX), static_cast<float>(NewPY), static_cast<float>(NewPZ), VS);
        const int32 SurfaceVoxelZ = FindFloorVoxelZ(TerrainState, FinalVoxel.X, FinalVoxel.Y, FinalVoxel.Z);

        const int32 PrevGrounded = WorldState.GetProperty(Id, PropertyId::IsGrounded);

        if (SurfaceVoxelZ == NoFloorSentinel)
        {
            // 바닥 없음 (청크 미로드 또는 스캔 범위 초과) — 접지 해제하여 중력 작동 보장
#if ENABLE_HKT_INSIGHTS
            if (DebugPhase1Entity >= 0 && Id == static_cast<FHktEntityId>(DebugPhase1Entity))
            {
                UE_LOG(LogTemp, Warning,
                    TEXT("[Phase1] E%d NO FLOOR — Voxel=(%d,%d,%d) Pos=(%d,%d,%d) → IsGrounded=0 (gravity enabled)"),
                    Id, FinalVoxel.X, FinalVoxel.Y, FinalVoxel.Z, NewPX, NewPY, NewPZ);
            }
#endif
            if (PrevGrounded != 0)
            {
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsGrounded, 0);
            }
        }
        else
        {
        const int32 SurfaceCmZ = FHktTerrainSystem::VoxelToCm(0, 0, SurfaceVoxelZ, VS).Z;

#if ENABLE_HKT_INSIGHTS
        if (DebugPhase1Entity >= 0 && Id == static_cast<FHktEntityId>(DebugPhase1Entity))
        {
            // 엔티티 아래 5복셀 솔리드 상태 덤프
            FString SolidColumn;
            for (int32 Dz = 2; Dz >= -5; --Dz)
            {
                const bool bS = TerrainState.IsSolid(FinalVoxel.X, FinalVoxel.Y, FinalVoxel.Z + Dz);
                SolidColumn += FString::Printf(TEXT("Z%+d=%s "), Dz, bS ? TEXT("S") : TEXT("_"));
            }

            UE_LOG(LogTemp, Warning,
                TEXT("[Phase1] E%d Layer=%d Pos=(%d,%d,%d) Voxel=(%d,%d,%d) FloorVZ=%d SurfCmZ=%d "
                     "Gap=%d Grounded=%d VelZ=%d Chunks=%d | %s"),
                Id, Layer, NewPX, NewPY, NewPZ,
                FinalVoxel.X, FinalVoxel.Y, FinalVoxel.Z,
                SurfaceVoxelZ, SurfaceCmZ,
                NewPZ - SurfaceCmZ, PrevGrounded, VelZ,
                TerrainState.LoadedChunks.Num(),
                *SolidColumn);
        }
#endif

        if (NewPZ <= SurfaceCmZ)
        {
            // 지면에 닿았음 — 위로 push, 수직 속도 제거
            if (NewPZ != SurfaceCmZ)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Floor snap Z: %d → %d (delta=%d)"),
                        NewPZ, SurfaceCmZ, SurfaceCmZ - NewPZ), Id);
                NewPZ = SurfaceCmZ;
            }
            if (VelZ != 0)
                VelZ = 0;
            if (PrevGrounded == 0)
            {
                HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Physics, EHktLogLevel::Verbose, LogSource,
                    FString::Printf(TEXT("Landed — Z=%d surfZ=%d"), NewPZ, SurfaceCmZ), Id);
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsGrounded, 1);

                FHktPendingEvent Evt;
                Evt.Type = EWaitEventType::Grounded;
                Evt.WatchedEntity = Id;
                OutGroundedEvents.Add(Evt);
            }
        }
        else
        {
            // 공중 — 접지 해제 (절벽 walked-off 포함)
            if (PrevGrounded != 0)
            {
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::IsGrounded, 0);
            }
        }
        } // end if SurfaceVoxelZ != NoFloorSentinel

        // 5) Dirty 최소화: 실제로 변경된 값만 다시 쓰기
        const int32 OldPX = WorldState.GetProperty(Id, PropertyId::PosX);
        const int32 OldPY = WorldState.GetProperty(Id, PropertyId::PosY);
        const int32 OldPZ = WorldState.GetProperty(Id, PropertyId::PosZ);
        if (NewPX != OldPX) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::PosX, NewPX);
        if (NewPY != OldPY) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::PosY, NewPY);
        if (NewPZ != OldPZ) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::PosZ, NewPZ);

        const int32 OldVX = WorldState.GetProperty(Id, PropertyId::VelX);
        const int32 OldVY = WorldState.GetProperty(Id, PropertyId::VelY);
        const int32 OldVZ = WorldState.GetProperty(Id, PropertyId::VelZ);
        if (VelX != OldVX) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, VelX);
        if (VelY != OldVY) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, VelY);
        if (VelZ != OldVZ) VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, VelZ);
    });
}

// ============================================================================
// 4.2 Physics Phase 3 — Terrain Residual Overlap Cleanup (구 ProcessTerrainCollision)
//
// Phase 1 이 축별 wall-slide 로 대부분의 지형 침투를 막지만, Phase 2 의
// 엔티티 push-out 이 예외적으로 솔리드 복셀 안으로 밀어넣을 수 있다.
// 이 단계가 마지막 안전망으로 남은 겹침을 해소한다.
//
// 1단계: 엔티티 중심 복셀이 솔리드 → 위로 수직 탈출 (스폰 후 지형 생성 대응)
// 2단계: 가장자리 겹침 → AABB-Sphere push-out (잔여 겹침 보정)
// ============================================================================

void FHktPhysicsSystem::ResolveTerrainConstraints(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    const FHktTerrainState& TerrainState)
{
    // 단일 출처: TerrainState에서 VoxelSize 획득
    const float VoxelSize = TerrainState.VoxelSizeCm;
    const float HalfVoxel = VoxelSize * 0.5f;
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
        const FIntVector CenterVoxel = FHktTerrainSystem::CmToVoxel(PosX, PosY, PosZ, VoxelSize);
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
                    const int32 EscapeCmZ = FHktTerrainSystem::VoxelToCm(0, 0, ScanZ, VoxelSize).Z;
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
            PosX - Radius, PosY - Radius, PosZ, VoxelSize);
        const FIntVector MaxVoxel = FHktTerrainSystem::CmToVoxel(
            PosX + Radius, PosY + Radius, PosZ + Radius, VoxelSize);

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

                    const FIntVector VoxelCm = FHktTerrainSystem::VoxelToCm(VX, VY, VZ, VoxelSize);
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

            // 밀어낸 방향의 속도를 제거하여 다음 프레임에서 즉시 재진입하는 것을 방지.
            // Phase 1 wall-slide 가 다음 프레임에서 이동을 잡지만, 이 사이의 1프레임 진동을 없앤다.
            const int32 CurVX = WorldState.GetProperty(Id, PropertyId::VelX);
            const int32 CurVY = WorldState.GetProperty(Id, PropertyId::VelY);
            const int32 CurVZ = WorldState.GetProperty(Id, PropertyId::VelZ);
            // Push 방향과 속도 방향이 반대이면(속도가 벽을 향하면) 해당 성분 제거
            if ((PushX > 0.0f && CurVX < 0) || (PushX < 0.0f && CurVX > 0))
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, 0);
            if ((PushY > 0.0f && CurVY < 0) || (PushY < 0.0f && CurVY > 0))
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, 0);
            if ((PushZ > 0.0f && CurVZ < 0) || (PushZ < 0.0f && CurVZ > 0))
                VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, 0);
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