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
// 4. Physics System — 셀 기반 통합 물리
//
// Step 1: Movement 결과인 기대 위치와 속도(작용한 힘)를 읽는다
// Step 2: 기대 위치 + 반경으로 차지하는 복셀 셀을 계산, CellMap 구축
// Step 3: 각 셀에 진입한 엔터티와 진입 속도를 기록
// Step 4: solid 셀 → AABB 최소겹침축 기반 push-out (solid = 무한 mass)
// Step 5: 엔터티 쌍 → CollisionLayer 매칭 시 구-구 mass 기반 반작용
// Step 6: 반작용 적용 + 속도 감쇄 + IsGrounded 갱신
// ============================================================================

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

    const float VS = TerrainState ? TerrainState->VoxelSizeCm : 15.0f;
    const int32 DebugEntityId = CVarTerrainDebugEntity.GetValueOnAnyThread();

    // ════════════════════════════════════════════════════════════════
    // Step 1: 엔터티 데이터 수집 — 기대 위치 + 작용한 힘(속도)
    // ════════════════════════════════════════════════════════════════

    struct FEntityData
    {
        FHktEntityId Id;
        int32 Slot;
        FVector ExpectedPos;    // Movement가 계산한 기대 위치
        FVector Velocity;       // ExpectedPos - PreMovePos = 작용한 힘 방향
        float Radius;           // CollisionRadius
        float Mass;
        uint32 Layer;
        uint32 Mask;
        int32 OwnerEntity;
        bool bProjectile;
    };

    TArray<FEntityData> Entities;
    TMap<FHktEntityId, int32> EntityLookup;  // Id → Entities 배열 인덱스

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 Slot)
    {
        if (Slot < 0 || Slot >= PreMovePositions.Num())
            return;

        const int32 Layer = WorldState.GetProperty(Id, PropertyId::CollisionLayer);
        if (Layer == 0)
            return;

        FEntityData ED;
        ED.Id = Id;
        ED.Slot = Slot;
        ED.ExpectedPos = FVector(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosX)),
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosY)),
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::PosZ)));
        const FIntVector& Pre = PreMovePositions[Slot];
        ED.Velocity = ED.ExpectedPos - FVector(
            static_cast<float>(Pre.X), static_cast<float>(Pre.Y), static_cast<float>(Pre.Z));
        ED.Radius = FMath::Max(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::CollisionRadius)), 30.0f);
        ED.Mass = FMath::Max(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::Mass)), 1.0f);
        ED.Layer = static_cast<uint32>(Layer);
        ED.Mask = static_cast<uint32>(WorldState.GetProperty(Id, PropertyId::CollisionMask));
        ED.OwnerEntity = WorldState.GetProperty(Id, PropertyId::OwnerEntity);
        ED.bProjectile = (ED.Layer == EHktCollisionLayer::Projectile);

        EntityLookup.Add(Id, Entities.Num());
        Entities.Add(ED);
    });

    if (Entities.Num() == 0)
        return;

    // ════════════════════════════════════════════════════════════════
    // Step 2: 셀맵 구축 — 기대 위치 + 반경으로 차지하는 복셀 셀 등록
    // ════════════════════════════════════════════════════════════════

    CellMap.Reset();

    for (int32 Idx = 0; Idx < Entities.Num(); ++Idx)
    {
        const FEntityData& ED = Entities[Idx];

        // 엔터티 바디 AABB: XY ± Radius, Z = [PosZ, PosZ + Radius]
        const FIntVector MinV = FHktTerrainSystem::CmToVoxel(
            ED.ExpectedPos.X - ED.Radius,
            ED.ExpectedPos.Y - ED.Radius,
            ED.ExpectedPos.Z,
            VS);
        const FIntVector MaxV = FHktTerrainSystem::CmToVoxel(
            ED.ExpectedPos.X + ED.Radius,
            ED.ExpectedPos.Y + ED.Radius,
            ED.ExpectedPos.Z + ED.Radius,
            VS);

        if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
        {
            UE_LOG(LogTemp, Warning,
                TEXT("[Physics Step2] E%d Pos=(%.0f,%.0f,%.0f) Vel=(%.1f,%.1f,%.1f) R=%.0f Mass=%.0f "
                     "Cells=(%d,%d,%d)->(%d,%d,%d)"),
                ED.Id, ED.ExpectedPos.X, ED.ExpectedPos.Y, ED.ExpectedPos.Z,
                ED.Velocity.X, ED.Velocity.Y, ED.Velocity.Z, ED.Radius, ED.Mass,
                MinV.X, MinV.Y, MinV.Z, MaxV.X, MaxV.Y, MaxV.Z);
        }

        FCellEntry Entry;
        Entry.EntityId = ED.Id;
        Entry.Velocity = ED.Velocity;

        for (int32 VZ = MinV.Z; VZ <= MaxV.Z; ++VZ)
            for (int32 VY = MinV.Y; VY <= MaxV.Y; ++VY)
                for (int32 VX = MinV.X; VX <= MaxV.X; ++VX)
                    CellMap.FindOrAdd(FIntVector(VX, VY, VZ)).Add(Entry);
    }

    // ════════════════════════════════════════════════════════════════
    // Step 3-5: 셀 순회 — solid 반작용 + 엔터티 간 충돌
    // ════════════════════════════════════════════════════════════════

    // 엔터티별 누적 반작용 벡터
    TArray<FVector> Reactions;
    Reactions.SetNumZeroed(Entities.Num());
    TestedPairs.Reset();

    // 결정론: 셀 키를 정렬하여 순회
    TArray<FIntVector> SortedCells;
    CellMap.GetKeys(SortedCells);
    SortedCells.Sort([](const FIntVector& A, const FIntVector& B)
    {
        if (A.X != B.X) return A.X < B.X;
        if (A.Y != B.Y) return A.Y < B.Y;
        return A.Z < B.Z;
    });

    for (const FIntVector& Cell : SortedCells)
    {
        const TArray<FCellEntry>& Entries = CellMap[Cell];

        // ── Step 3-4: solid 셀 검사 — 어떤 힘으로 들어왔는지 체크, AABB 겹침 해소 ──
        const bool bSolid = TerrainState && TerrainState->IsSolid(Cell.X, Cell.Y, Cell.Z);

        if (bSolid)
        {
            // 복셀 AABB (cm)
            const float VMinX = static_cast<float>(Cell.X) * VS;
            const float VMinY = static_cast<float>(Cell.Y) * VS;
            const float VMinZ = static_cast<float>(Cell.Z) * VS;
            const float VMaxX = VMinX + VS;
            const float VMaxY = VMinY + VS;
            const float VMaxZ = VMinZ + VS;
            const float VCX = (VMinX + VMaxX) * 0.5f;
            const float VCY = (VMinY + VMaxY) * 0.5f;
            const float VCZ = (VMinZ + VMaxZ) * 0.5f;

            for (const FCellEntry& CE : Entries)
            {
                const int32* IdxPtr = EntityLookup.Find(CE.EntityId);
                if (!IdxPtr) continue;
                const int32 EIdx = *IdxPtr;
                const FEntityData& ED = Entities[EIdx];

                // 현재 위치 (축적된 반작용 반영)
                const FVector EPos = ED.ExpectedPos + Reactions[EIdx];

                // 엔터티 바디 AABB: XY ± Radius, Z = [PosZ, PosZ + Radius]
                const float EMinX = EPos.X - ED.Radius;
                const float EMaxX = EPos.X + ED.Radius;
                const float EMinY = EPos.Y - ED.Radius;
                const float EMaxY = EPos.Y + ED.Radius;
                const float EMinZ = EPos.Z;
                const float EMaxZ = EPos.Z + ED.Radius;

                // AABB-AABB 겹침 계산
                const float OX = FMath::Min(EMaxX, VMaxX) - FMath::Max(EMinX, VMinX);
                const float OY = FMath::Min(EMaxY, VMaxY) - FMath::Max(EMinY, VMinY);
                const float OZ = FMath::Min(EMaxZ, VMaxZ) - FMath::Max(EMinZ, VMinZ);

                if (OX <= 0.0f || OY <= 0.0f || OZ <= 0.0f)
                    continue;

                // 최소 겹침 축으로 밀어내기 — solid는 무한 mass이므로 엔터티를 100% 밀어냄
                // Z축 우선: R >> VS 일 때 바닥 복셀의 OX/OY/OZ 가 모두 VS로 동률이 되므로
                // <= 로 Z를 우선 선택해야 바닥 접촉에서 안정적으로 위로 밀어낸다.
                const float ECZ = EPos.Z + ED.Radius * 0.5f;  // 바디 Z 중심
                float MinO = OX;
                FVector Push((EPos.X >= VCX) ? OX : -OX, 0.0f, 0.0f);

                if (OY < MinO)
                {
                    MinO = OY;
                    Push = FVector(0.0f, (EPos.Y >= VCY) ? OY : -OY, 0.0f);
                }
                if (OZ <= MinO)  // <= : Z축 우선 (바닥/천장 안정성)
                {
                    MinO = OZ;
                    Push = FVector(0.0f, 0.0f, (ECZ >= VCZ) ? OZ : -OZ);
                }

                Reactions[EIdx] += Push;

                if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
                {
                    UE_LOG(LogTemp, Warning,
                        TEXT("[Physics Step4] E%d SolidCell=(%d,%d,%d) Overlap=(%.1f,%.1f,%.1f) "
                             "MinAxis=%s Push=(%.1f,%.1f,%.1f) AccumReaction=(%.1f,%.1f,%.1f) "
                             "EntryVel=(%.1f,%.1f,%.1f)"),
                        ED.Id, Cell.X, Cell.Y, Cell.Z,
                        OX, OY, OZ,
                        MinO == OX ? TEXT("X") : (MinO == OY ? TEXT("Y") : TEXT("Z")),
                        Push.X, Push.Y, Push.Z,
                        Reactions[EIdx].X, Reactions[EIdx].Y, Reactions[EIdx].Z,
                        CE.Velocity.X, CE.Velocity.Y, CE.Velocity.Z);
                }
            }
        }

        // ── Step 5: 셀 안의 엔터티 쌍 충돌 — CollisionLayer 매칭 + mass 기반 반작용 ──
        for (int32 i = 0; i < Entries.Num(); ++i)
        {
            const int32* IdxA = EntityLookup.Find(Entries[i].EntityId);
            if (!IdxA) continue;

            for (int32 j = i + 1; j < Entries.Num(); ++j)
            {
                const int32* IdxB = EntityLookup.Find(Entries[j].EntityId);
                if (!IdxB) continue;

                const FEntityData& A = Entities[*IdxA];
                const FEntityData& B = Entities[*IdxB];

                // 쌍 중복 방지 (여러 셀에서 같은 쌍이 나올 수 있음)
                const FHktEntityId Lo = FMath::Min(A.Id, B.Id);
                const FHktEntityId Hi = FMath::Max(A.Id, B.Id);
                const uint64 PairKey = (static_cast<uint64>(Lo) << 32) | static_cast<uint64>(Hi);
                bool bAlready = false;
                TestedPairs.Add(PairKey, &bAlready);
                if (bAlready) continue;

                // CollisionLayer 양방향 동의
                if (!(A.Layer & B.Mask) || !(B.Layer & A.Mask))
                    continue;

                // 투사체 <-> 시전자 보호
                if (A.bProjectile && A.OwnerEntity == static_cast<int32>(B.Id)) continue;
                if (B.bProjectile && B.OwnerEntity == static_cast<int32>(A.Id)) continue;

                // 반작용 반영된 현재 위치로 구-구 충돌 검사
                const FVector PosA = A.ExpectedPos + Reactions[*IdxA];
                const FVector PosB = B.ExpectedPos + Reactions[*IdxB];
                const float CombR = A.Radius + B.Radius;
                const float DistSq = FVector::DistSquared(PosA, PosB);

                if (DistSq >= CombR * CombR)
                    continue;

                const float Dist = FMath::Sqrt(DistSq);
                if (Dist <= SMALL_NUMBER)
                    continue;

                const float Overlap = CombR - Dist;
                const FVector Dir = (PosB - PosA) / Dist;
                const float InvMass = 1.0f / (A.Mass + B.Mass);

                // mass 기반 반작용 (투사체는 밀리지 않음)
                const FVector PushA = Dir * (Overlap * B.Mass * InvMass);
                const FVector PushB = Dir * (Overlap * A.Mass * InvMass);
                if (!A.bProjectile)
                    Reactions[*IdxA] -= PushA;
                if (!B.bProjectile)
                    Reactions[*IdxB] += PushB;

                // 충돌 이벤트
                FHktPhysicsEvent PhysEvt;
                PhysEvt.EntityA = A.Id;
                PhysEvt.EntityB = B.Id;
                PhysEvt.ContactPoint = (PosA + PosB) * 0.5f;
                OutPhysicsEvents.Add(PhysEvt);

                if (DebugEntityId >= 0 &&
                    (A.Id == static_cast<FHktEntityId>(DebugEntityId) ||
                     B.Id == static_cast<FHktEntityId>(DebugEntityId)))
                {
                    UE_LOG(LogTemp, Warning,
                        TEXT("[Physics Step5] E%d<->E%d Dist=%.1f CombR=%.1f Overlap=%.1f "
                             "MassA=%.0f MassB=%.0f PushA=(%.1f,%.1f,%.1f) PushB=(%.1f,%.1f,%.1f)"),
                        A.Id, B.Id, Dist, CombR, Overlap, A.Mass, B.Mass,
                        -PushA.X, -PushA.Y, -PushA.Z,
                        PushB.X, PushB.Y, PushB.Z);
                }
            }
        }
    }

    // ════════════════════════════════════════════════════════════════
    // Step 6: 반작용 적용 + 속도 감쇄 + IsGrounded 갱신
    // ════════════════════════════════════════════════════════════════

    for (int32 Idx = 0; Idx < Entities.Num(); ++Idx)
    {
        const FEntityData& ED = Entities[Idx];
        const FVector& React = Reactions[Idx];
        const FVector FinalPos = ED.ExpectedPos + React;

        int32 FinalVelX = WorldState.GetProperty(ED.Id, PropertyId::VelX);
        int32 FinalVelY = WorldState.GetProperty(ED.Id, PropertyId::VelY);
        int32 FinalVelZ = WorldState.GetProperty(ED.Id, PropertyId::VelZ);

        // 반작용 방향과 속도가 반대이면 해당 축 속도 제거
        // (벽에 부딪혀 밀려났는데 속도가 벽 쪽이면 멈춤)
        if (FMath::Abs(React.X) > SMALL_NUMBER &&
            ((React.X > 0.0f && FinalVelX < 0) || (React.X < 0.0f && FinalVelX > 0)))
            FinalVelX = 0;
        if (FMath::Abs(React.Y) > SMALL_NUMBER &&
            ((React.Y > 0.0f && FinalVelY < 0) || (React.Y < 0.0f && FinalVelY > 0)))
            FinalVelY = 0;
        if (FMath::Abs(React.Z) > SMALL_NUMBER &&
            ((React.Z > 0.0f && FinalVelZ < 0) || (React.Z < 0.0f && FinalVelZ > 0)))
            FinalVelZ = 0;

        // 위치 적용 (dirty 최소화: 변경된 값만 쓰기)
        const int32 NewPX = FMath::RoundToInt(FinalPos.X);
        const int32 NewPY = FMath::RoundToInt(FinalPos.Y);
        const int32 NewPZ = FMath::RoundToInt(FinalPos.Z);
        if (NewPX != WorldState.GetProperty(ED.Id, PropertyId::PosX))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosX, NewPX);
        if (NewPY != WorldState.GetProperty(ED.Id, PropertyId::PosY))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosY, NewPY);
        if (NewPZ != WorldState.GetProperty(ED.Id, PropertyId::PosZ))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosZ, NewPZ);

        // 속도 적용 (dirty 최소화)
        if (FinalVelX != WorldState.GetProperty(ED.Id, PropertyId::VelX))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelX, FinalVelX);
        if (FinalVelY != WorldState.GetProperty(ED.Id, PropertyId::VelY))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelY, FinalVelY);
        if (FinalVelZ != WorldState.GetProperty(ED.Id, PropertyId::VelZ))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelZ, FinalVelZ);

        // IsGrounded 갱신: 발 바로 아래 복셀이 solid이면 접지
        if (TerrainState)
        {
            const FIntVector FeetVoxel = FHktTerrainSystem::CmToVoxel(
                FinalPos.X, FinalPos.Y, FinalPos.Z - 1.0f, VS);
            const bool bGroundBelow = TerrainState->IsSolid(FeetVoxel.X, FeetVoxel.Y, FeetVoxel.Z);
            const int32 PrevGrounded = WorldState.GetProperty(ED.Id, PropertyId::IsGrounded);

            if (bGroundBelow)
            {
                if (PrevGrounded == 0)
                {
                    VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::IsGrounded, 1);

                    FHktPendingEvent Evt;
                    Evt.Type = EWaitEventType::Grounded;
                    Evt.WatchedEntity = ED.Id;
                    OutGroundedEvents.Add(Evt);
                }
            }
            else
            {
                if (PrevGrounded != 0)
                    VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::IsGrounded, 0);
            }
        }

        // 디버그: 전 과정 최종 결과
        if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
        {
            const FIntVector FV = FHktTerrainSystem::CmToVoxel(
                FinalPos.X, FinalPos.Y, FinalPos.Z - 1.0f, VS);
            const bool bGnd = TerrainState ? TerrainState->IsSolid(FV.X, FV.Y, FV.Z) : false;
            UE_LOG(LogTemp, Warning,
                TEXT("[Physics Step6] E%d Final=(%d,%d,%d) Reaction=(%.1f,%.1f,%.1f) "
                     "Vel=(%d,%d,%d) Grounded=%s FeetVoxel=(%d,%d,%d)"),
                ED.Id, NewPX, NewPY, NewPZ,
                React.X, React.Y, React.Z,
                FinalVelX, FinalVelY, FinalVelZ,
                bGnd ? TEXT("Yes") : TEXT("No"),
                FV.X, FV.Y, FV.Z);
        }
    }
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