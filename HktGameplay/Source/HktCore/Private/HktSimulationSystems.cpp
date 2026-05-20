// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSimulationSystems.h"
#include "HktCoreLog.h"
#include "HktCoreProperties.h"
#include "HktCollisionLayers.h"
#include "HktSimulationLimits.h"
#include "HktSimulationTick.h"
#include "VM/HktVMProgram.h"
#include "VM/HktVMRuntime.h"
#include "VM/HktVMInterpreter.h"
#include "VM/HktVMWorldStateProxy.h"
#include "Terrain/HktTerrainState.h"
#include "Terrain/HktTerrainDataSource.h"
#include "HktStoryEventParams.h"
#include "HktCoreTags.h"
#include "Math/UnrealMathUtility.h"
#include "HAL/IConsoleManager.h"
#include "HktCoreEventLog.h"
#include "HktVMEventRecorder.h"

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

// ============================================================================
// 고정 시뮬레이션 틱 — Public 접근자(HktSimulationTick.h)의 단일 출처.
// 결정론을 위해 서버/클라가 동일 값을 사용해야 한다. 기본 30Hz.
// ============================================================================

static TAutoConsoleVariable<int32> CVarSimFramesPerSecond(
    TEXT("hkt.Sim.FramesPerSecond"),
    30, // 서버 부하/네트워크 비용을 고려한 기본 시뮬레이션 틱 (30Hz)
    TEXT("Fixed simulation tick rate (frames per second). 모든 시간 종속 변형의 단일 출처. "
         "런타임 변경 가능하나 서버/클라 동일 값 유지 필수 — 결정론."),
    ECVF_Default);

int32 HktGetSimFramesPerSecond()
{
    const int32 V = CVarSimFramesPerSecond.GetValueOnAnyThread();
    return V > 0 ? V : 30;  // CVar가 0/음수면 기본값으로 폴백
}

float HktGetSimInvFramesPerSecond()
{
    return 1.0f / static_cast<float>(HktGetSimFramesPerSecond());
}

float HktGetSimFixedDeltaSeconds()
{
    return HktGetSimInvFramesPerSecond();
}


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

static void CollectVMDetailInsights(FHktVMRuntimePool& Pool, const FString& SourceName)
{
    // Source별로 분리된 카테고리 사용 (Standalone에서 Server/Client 충돌 방지)
    const FString VMDetailCat = FString::Printf(TEXT("VMDetail.%s"), *SourceName);
    if (!FHktCoreDataCollector::Get().IsCollectionEnabled(VMDetailCat))
    {
        return;
    }

    HKT_INSIGHT_CLEAR_CATEGORY(VMDetailCat);

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
            TEXT(" | WaitType=%s | WaitEntity=%d | WaitRemainFrames=%d | WaitFrames=%d")
            TEXT(" | R0=%d | R1=%d | R2=%d | R3=%d | R4=%d | R5=%d | R6=%d | R7=%d")
            TEXT(" | R8=%d | Self=%d | Target=%d | Spawned=%d | Hit=%d | Iter=%d | Flag=%d")
            TEXT(" | Op=%s"),
            *VMStatusToString(Runtime.Status), *EventTag, SrcEntity, TgtEntity,
            Runtime.PC, CodeSize, Runtime.CreationFrame, Runtime.PlayerUid,
            WaitEventTypeToString(Runtime.EventWait.Type), Runtime.EventWait.WatchedEntity,
            Runtime.EventWait.RemainingFrames, Runtime.WaitFrames,
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

        HKT_INSIGHT_COLLECT(VMDetailCat, VMKey, Detail);
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
        HKT_INSIGHT_COLLECT(VMDetailCat, EntityKey,
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
        // 이벤트가 VMBuildSystem 에 진입하는 시점 — Created. WorldState.FrameNumber 는
        // ProcessBatch 가 이미 세팅해 두었으나 안전하게 CurrentFrame 인자를 사용.
        HKT_EVENT_LOG_TAG(HktLogTags::Core_VM, EHktLogLevel::Verbose, LogSource,
            FString::Printf(TEXT("Event CREATE: %s Src=%d Tgt=%d EventId=%d"),
                *Event.EventTag.ToString(), Event.SourceEntity, Event.TargetEntity, Event.EventId),
            Event.SourceEntity, Event.EventTag);
        HKT_VM_EVENT_RECORD_EVENT(Event, EHktVMEventPhase::Created, LogSource,
            static_cast<int64>(CurrentFrame), InsightsSource);

        const FHktVMProgram* Program = FHktVMProgramRegistry::Get().FindProgram(Event.EventTag);
        if (!Program)
        {
            HKT_EVENT_LOG(HktLogTags::Core_VM, EHktLogLevel::Error, LogSource, FString::Printf(TEXT("VM Build: No program for %s — Story가 등록되지 않았습니다 (빌드 검증 실패 또는 미등록)"), *Event.EventTag.ToString()));
            HKT_VM_EVENT_RECORD_EVENT(Event, EHktVMEventPhase::Discarded, LogSource,
                static_cast<int64>(CurrentFrame), TEXT("NoProgram"));
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
            HKT_VM_EVENT_RECORD_EVENT(Event, EHktVMEventPhase::Discarded, LogSource,
                static_cast<int64>(CurrentFrame), TEXT("PoolExhausted"));
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
        Context->EventParam2 = Event.Param2;
        Context->EventParam3 = Event.Param3;
        Context->EventTargetPosX = FMath::RoundToInt(Event.Location.X);
        Context->EventTargetPosY = FMath::RoundToInt(Event.Location.Y);
        Context->EventTargetPosZ = FMath::RoundToInt(Event.Location.Z);

        // 이벤트 태그를 SourceEntity에 자동 부여
        if (WorldState.IsValidEntity(Event.SourceEntity))
        {
            VMProxy.AddTag(WorldState, Event.SourceEntity, Event.EventTag);
        }

        OutActiveVMs.Add(Handle);
        // WorldState.ActiveVMSnapshots 는 프레임 말미 CaptureVMSnapshots 에서 일괄 생성.

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

        // 이벤트가 VM 으로 변환되어 살아있는 인스턴스에 흡수됨.
        HKT_VM_EVENT_RECORD_EVENT(Event, EHktVMEventPhase::Consumed, LogSource,
            static_cast<int64>(CurrentFrame),
            FString::Printf(TEXT("VM_%d"), static_cast<int32>(Handle.Index)));
    }
}

// ============================================================================
// 3. VM Process System
// ============================================================================

void FHktVMProcessSystem::Process(
    TArray<FHktVMHandle>& ActiveVMs,
    TArray<FHktVMHandle>& OutCompletedVMs,
    FHktVMRuntimePool& Pool,
    TArray<FHktPendingEvent>& PendingExternalEvents)
{
    ScratchEvents.Reset();
    Swap(ScratchEvents, PendingExternalEvents);

    // 진입 시 ScratchEvents 의 Created 일괄 기록은 의도적으로 하지 않는다.
    // 모든 PendingEvent 는 출처(Movement.MoveEnd / Physics.Grounded / Physics.Collision)
    // 단계에서 이미 RECORD_PENDING(Created) 가 한 번 찍혔으므로 여기서 또 찍으면 중복.

    Pool.ForEachActive([&](FHktVMHandle Handle, FHktVMRuntime& Runtime)
    {
        if (Runtime.Status == EVMStatus::WaitingEvent)
        {
            if (Runtime.EventWait.Type == EWaitEventType::Timer)
            {
                // hkt.Sim.FramesPerSecond 단위 정수 카운트 — DeltaSeconds 비종속.
                if (--Runtime.EventWait.RemainingFrames <= 0)
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

                        HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Verbose, LogSource,
                            FString::Printf(TEXT("PendingEvent CONSUME: type=%u watched=%d hit=%d"),
                                static_cast<uint32>(ScratchEvents[i].Type),
                                ScratchEvents[i].WatchedEntity,
                                ScratchEvents[i].HitEntity),
                            ScratchEvents[i].WatchedEntity);
                        HKT_VM_EVENT_RECORD_PENDING(ScratchEvents[i], EHktVMEventPhase::Consumed,
                            LogSource, -1,
                            FString::Printf(TEXT("VM_%d.Wake"), static_cast<int32>(Handle.Index)));

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
    CollectVMDetailInsights(Pool, FString(GetLogSourceName(LogSource)));

    // 매칭 실패로 사라지는 PendingEvent — Discarded.
    if (FHktVMEventRecorder::Get().IsActive())
    {
        for (const FHktPendingEvent& Leftover : ScratchEvents)
        {
            HKT_VM_EVENT_RECORD_PENDING(Leftover, EHktVMEventPhase::Discarded,
                LogSource, -1, TEXT("NoMatchingVM"));
        }
    }
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
    const IHktTerrainDataSource& Source,
    const TArray<FHktEvent>* PendingEvents)
{
    RequiredChunks.Reset();

    // 단일 출처: Source의 Config에서 모든 스트리밍 파라미터 획득
    const FHktTerrainGeneratorConfig& Cfg = Source.GetConfig();
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
    //    + 새로 로드된 청크의 spawner 메타 → 이번 프레임 dispatch 이벤트로 변환
    //    (Docs/Design-VoxelSpawner.md §7 Runtime Execution)
    EmittedSpawnerEvents.Reset();
    int32 LoadedThisFrame = 0;
    int32 SkippedInvalidSpawnerTags = 0;
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
            TerrainState.LoadChunk(Coord, Source);
            ++LoadedThisFrame;

            // I-0014: Placement / Spawner 이벤트는 서버 권위 시뮬레이터에서만 emit.
            // 클라(ProxySimulator) 가 미드조인 후 청크를 처음 로드해도 재발화 차단 —
            // 서버가 옛날에 만든 entity 는 WorldView replicate 로 이미 수신됨.
            // 청크 LoadChunk(위) 자체는 voxel 캐싱 목적이라 양쪽 모두 수행.
            int32 EmittedFromThisChunk = 0;
            if (bIsAuthoritative)
            {
                // 청크의 spawner 메타 enumerate — Source 가 미지원이면 no-op (default impl).
                // 명시 배치 spawner (보스/랜드마크/HktMapSpawnerAdapter) 가 본 경로로 발화.
                ScratchSpawnerViews.Reset();
                Source.GetChunkSpawners(Coord.X, Coord.Y, Coord.Z, ScratchSpawnerViews);
                for (const FHktTerrainSpawnerView& SView : ScratchSpawnerViews)
                {
                    if (!SView.StoryTag.IsValid())
                    {
                        // bake 검증 단계에서 거르도록 의도된 케이스 — 그러나 silent 하면 디버그가 어려움.
                        ++SkippedInvalidSpawnerTags;
                        continue;
                    }
                    EmittedSpawnerEvents.Add(HktEventBuilder::SpawnerFromView(SView));
                    ++EmittedFromThisChunk;
                }

                // I-0014 Phase B — voxel 평가 패스 (per-voxel template 활성화, read-only).
                // BakeRegion 이 `VoxelSpawnRules` weighted-pick 으로 산출한 baked attribution 을
                // 그대로 읽어 voxel 한 점마다 *참조 template StoryTag* 를 EventTag 로 dispatch.
                //
                // Phase A 의 chunk-level ChunkLoaded 호환 어댑터는 본 PR 에서 제거 — voxel
                // attribution 이 단일 진입점. 매핑 미정의 / 빈 카탈로그 자산은 spawn 없음.
                ScratchVoxelAttributions.Reset();
                Source.GetChunkVoxelAttribution(Coord.X, Coord.Y, Coord.Z, ScratchVoxelAttributions);

                for (const FHktVoxelAttributionView& AView : ScratchVoxelAttributions)
                {
                    if (!AView.StoryTag.IsValid())
                    {
                        // Provider 가 카탈로그 미정의 시 view 자체를 만들지 않으므로 본 분기는 드물지만 방어.
                        ++SkippedInvalidSpawnerTags;
                        continue;
                    }
                    EmittedSpawnerEvents.Add(HktEventBuilder::VoxelTemplateActivated(AView, VS));
                    ++EmittedFromThisChunk;
                }

                if (ScratchVoxelAttributions.Num() > 0)
                {
                    UE_LOG(LogHktCore, Verbose,
                        TEXT("[TerrainSystem] Chunk(%d,%d,%d) voxel attribution — emitted %d template(s)"),
                        Coord.X, Coord.Y, Coord.Z, ScratchVoxelAttributions.Num());
                }
            }

            if (EmittedFromThisChunk > 0)
            {
                UE_LOG(LogHktCore, Verbose,
                    TEXT("[TerrainSystem] Chunk(%d,%d,%d) loaded — emitted %d event(s) total"),
                    Coord.X, Coord.Y, Coord.Z, EmittedFromThisChunk);
            }
        }
    }

    if (SkippedInvalidSpawnerTags > 0)
    {
        UE_LOG(LogHktCore, Warning,
            TEXT("[TerrainSystem] %d spawner(s) skipped with invalid StoryTag this frame — bake 검증 누락 의심"),
            SkippedInvalidSpawnerTags);
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
    FHktVMWorldStateProxy& VMProxy)
{
    // CVar 단위는 cm/s² (튜닝 직관성). 고정 시뮬레이션 틱(hkt.Sim.FramesPerSecond)당 변화량으로 환산.
    const float Gravity = CVarJumpGravity.GetValueOnAnyThread();
    const float MaxFall = CVarJumpMaxFallSpeed.GetValueOnAnyThread();
    const float InvFramesPerSecond = HktGetSimInvFramesPerSecond();
    const float GravityPerFrame = Gravity * InvFramesPerSecond;

    WorldState.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        // 접지 엔티티는 중력 비활성 — Physics 가 VelZ=0 을 보장함
        if (WorldState.GetProperty(Id, PropertyId::IsGrounded) != 0)
            return;

        float VZ = static_cast<float>(WorldState.GetProperty(Id, PropertyId::VelZ));
        VZ -= GravityPerFrame;
        if (VZ < -MaxFall)
            VZ = -MaxFall;

        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelZ, FMath::RoundToInt(VZ));
    });
}

// ============================================================================
// 3.5 Movement System — 순수 운동학 (active-mover 추적 기반, 지형 질의 없음)
//
// 다음만 수행한다:
//   1. 힘/질량/속도 적분 → 기대 위치 계산
//   2. VMProxy.ActiveMoverSlots 만 순회 (운동 관련 프로퍼티가 한 번이라도 쓰인 슬롯)
//   3. 비활성 슬롯의 PreMovePositions 를 현재 Pos 로 일괄 prefill
//      (PhysicsSystem 의 Velocity = ExpectedPos - PreMovePos 불변식 유지)
//   4. 완전 정지(idle) 슬롯은 처리 후 ActiveMoverMask/Slots 에서 즉시 prune
//   5. MoveEnd 이벤트 emit, IsMoving/RotYaw 갱신
//
// 다음은 절대 하지 않는다 (PhysicsSystem Phase 1 이 처리):
//   - 지형 벽 슬라이드, 계단 높이 검사, 천장 검사
//   - 지면 Z 스냅, IsGrounded 갱신, Grounded 이벤트 emit
//
// 중력은 GravitySystem 이 Movement 직전에 적용해 VelZ 를 세팅해둔다.
//
// Invariant: `VMProxy.ActiveMoverMask[Slot]==1` ⇔ Slot ∈ ActiveMoverSlots (정확히 1회).
// unmark 시 반드시 swap-pop 으로 list 에서도 즉시 제거하여 다음 MarkActiveMover
// 호출이 중복 Add 하는 사태를 막는다.
// ============================================================================

void FHktMovementSystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    TArray<FHktPendingEvent>& OutMoveEndEvents,
    TArray<FIntVector>& OutPreMovePositions)
{
    OutMoveEndEvents.Reset();
    // PreMovePositions 는 slot 인덱스로 접근한다. 슬롯이 빈 자리는 사용되지 않으므로 uninitialized 로 둔다.
    OutPreMovePositions.SetNumUninitialized(WorldState.SlotToEntity.Num());

    // 콘솔 변수 조회 (루프 진입 전 1회만 캐싱) — FPS 포함
    const float InvFramesPerSecond = HktGetSimInvFramesPerSecond();
    const float AccelMultiplier = CVarMoveAccelMultiplier.GetValueOnAnyThread();
    const float SlowingRadius = CVarMoveSlowingRadius.GetValueOnAnyThread();
    const float MinSpeed = CVarMoveMinSpeed.GetValueOnAnyThread();

    // ── 비활성 슬롯의 PreMovePositions 를 현재 Pos 로 일괄 채움 ──
    // Physics 는 PreMovePositions[Slot] 을 모든 충돌 대상 엔티티에 대해 읽으므로,
    // 활성 mover 가 아닌 슬롯도 올바른 기준점을 갖고 있어야 한다.
    const int32 NumSlots = WorldState.SlotToEntity.Num();
    for (int32 Slot = 0; Slot < NumSlots; ++Slot)
    {
        if (WorldState.SlotToEntity[Slot] == InvalidEntityId) continue;
        OutPreMovePositions[Slot] = FIntVector(
            WorldState.Get(Slot, PropertyId::PosX),
            WorldState.Get(Slot, PropertyId::PosY),
            WorldState.Get(Slot, PropertyId::PosZ));
    }

    // ── 활성 mover 만 순회 ──
    TArray<int32>& Slots = VMProxy.ActiveMoverSlots;
    for (int32 SlotIdx = 0; SlotIdx < Slots.Num(); ++SlotIdx)
    {
        const int32 Slot = Slots[SlotIdx];

        // 방어: out-of-range 또는 외부에서 mask 가 깨진 stale entry — 안전하게 drop.
        if (Slot < 0 || Slot >= NumSlots ||
            Slot >= VMProxy.ActiveMoverMask.Num() || VMProxy.ActiveMoverMask[Slot] == 0)
        {
            Slots.RemoveAtSwap(SlotIdx, EAllowShrinking::No);
            --SlotIdx;
            continue;
        }

        const FHktEntityId Id = WorldState.SlotToEntity[Slot];
        if (Id == InvalidEntityId)
        {
            // 슬롯 해제 후 재사용 전 stale — mask 클리어 + list 에서도 제거.
            VMProxy.ActiveMoverMask[Slot] = 0;
            Slots.RemoveAtSwap(SlotIdx, EAllowShrinking::No);
            --SlotIdx;
            continue;
        }

        // 1) 현재 위치 (PreMovePositions 는 위에서 이미 채워짐)
        const int32 CurPX = WorldState.Get(Slot, PropertyId::PosX);
        const int32 CurPY = WorldState.Get(Slot, PropertyId::PosY);
        const int32 CurPZ = WorldState.Get(Slot, PropertyId::PosZ);

        const int32 IsMoving   = WorldState.Get(Slot, PropertyId::IsMoving);
        const int32 IsGrounded = WorldState.Get(Slot, PropertyId::IsGrounded);
        const int32 MoveForce  = WorldState.Get(Slot, PropertyId::MoveForce);
        const int32 RawVX      = WorldState.Get(Slot, PropertyId::VelX);
        const int32 RawVY      = WorldState.Get(Slot, PropertyId::VelY);
        const int32 RawVZ      = WorldState.Get(Slot, PropertyId::VelZ);

        // 2) Skip + Prune: 완전 정지한 접지 엔티티는 mask 클리어 + list 에서 swap-pop.
        // list 에서 즉시 제거하지 않으면, 동일 프레임 후속 시스템(Physics)이 다시
        // MarkActiveMover 를 호출했을 때 list 에 중복 entry 가 쌓인다.
        if (IsMoving == 0 && IsGrounded != 0
            && RawVX == 0 && RawVY == 0 && RawVZ == 0
            && MoveForce == 0)
        {
            VMProxy.ActiveMoverMask[Slot] = 0;
            Slots.RemoveAtSwap(SlotIdx, EAllowShrinking::No);
            --SlotIdx;
            continue;
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
            const float TgtX = static_cast<float>(WorldState.Get(Slot, PropertyId::MoveTargetX));
            const float TgtY = static_cast<float>(WorldState.Get(Slot, PropertyId::MoveTargetY));
            const float TgtZ = static_cast<float>(WorldState.Get(Slot, PropertyId::MoveTargetZ));

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
                continue;
            }

            // 수평 속력만 추출 (수직 속도는 Gravity 관리)
            float HSpeed = FMath::Sqrt(VX * VX + VY * VY);

            // 가속/감속 (MaxSpeed per-entity)
            const int32 RawMaxSpeed = WorldState.Get(Slot, PropertyId::MaxSpeed);
            const float MaxSpeedCm = RawMaxSpeed > 0 ? static_cast<float>(RawMaxSpeed) : DefaultMaxSpeed;

            const float HDist = FMath::Sqrt(DX * DX + DY * DY);

            float DesiredSpeed = MaxSpeedCm;
            if (HDist < SlowingRadius)
            {
                DesiredSpeed = FMath::Max(MaxSpeedCm * (HDist / SlowingRadius), MinSpeed);
            }

            const float Force = static_cast<float>(MoveForce);
            const float Mass = static_cast<float>(FMath::Max(WorldState.Get(Slot, PropertyId::Mass), 1));
            const float Accel = (Force / Mass) * AccelMultiplier;
            const float MaxSpeedChange = Accel * InvFramesPerSecond;

            if (HSpeed < DesiredSpeed)
                HSpeed = FMath::Min(HSpeed + MaxSpeedChange, DesiredSpeed);
            else if (HSpeed > DesiredSpeed)
                HSpeed = FMath::Max(HSpeed - MaxSpeedChange, DesiredSpeed);

            const float MoveStep = HSpeed * InvFramesPerSecond;

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
                NewX = CurX + VX * InvFramesPerSecond;
                NewY = CurY + VY * InvFramesPerSecond;
            }
            // else: HDist 거의 0 — XY 는 그대로 두고 Z 만 적분
        }

        // 4) Z 적분 — VelZ 는 Gravity 가 세팅해 놓은 값. 접지 엔티티는 VelZ==0 이므로 변화 없음.
        const float NewZ = CurZ + VZ * InvFramesPerSecond;

        // 5) 기대 위치 쓰기 (Physics Phase 1 이 지형 제약 적용)
        VMProxy.SetPosition(WorldState, Id,
            FMath::RoundToInt(NewX), FMath::RoundToInt(NewY), FMath::RoundToInt(NewZ));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelX, FMath::RoundToInt(VX));
        VMProxy.SetPropertyDirty(WorldState, Id, PropertyId::VelY, FMath::RoundToInt(VY));
        // VelZ 는 Gravity 가 이미 기록했으므로 건드리지 않음
    }
}


// ============================================================================
// 4. Physics System — 2-phase 충돌 해소
//
// Phase 1: Entity-Entity Collision
//   - CellMap 공간 해싱 broad phase (정렬된 셀 순회로 결정론 보장)
//   - 캡슐-캡슐 narrow phase + mass 기반 반작용
// Phase 2: Terrain Floor Snap
//   - 발 복셀 solid → 위로 스캔 → 표면 스냅
//   - 발 아래 solid → IsGrounded 갱신
// ============================================================================

void FHktPhysicsSystem::Process(
    FHktWorldState& WorldState,
    FHktVMWorldStateProxy& VMProxy,
    TArray<FHktPhysicsEvent>& OutPhysicsEvents,
    TArray<FHktPendingEvent>& OutGroundedEvents,
    const TArray<FIntVector>& PreMovePositions,
    const FHktTerrainState* TerrainState)
{
    OutPhysicsEvents.Reset();
    OutGroundedEvents.Reset();

    const float VS = TerrainState ? TerrainState->VoxelSizeCm : 15.0f;
    const int32 DebugEntityId = CVarTerrainDebugEntity.GetValueOnAnyThread();

    // ════════════════════════════════════════════════════════════════
    // 엔터티 데이터 수집 — 기대 위치 + 작용한 힘(속도)
    // ════════════════════════════════════════════════════════════════

    struct FEntityData
    {
        FHktEntityId Id;
        int32 Slot;
        FVector ExpectedPos;    // Movement가 계산한 기대 위치
        FVector Velocity;       // ExpectedPos - PreMovePos = 작용한 힘 방향
        float Radius;           // CollisionRadius (XY 반경)
        float HalfHeight;       // CollisionHalfHeight (캡슐 반높이, >= Radius)
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
        ED.HalfHeight = FMath::Max(
            static_cast<float>(WorldState.GetProperty(Id, PropertyId::CollisionHalfHeight)), ED.Radius);
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
    // Phase 1 준비: 셀맵 구축 — 기대 위치 + 반경으로 차지하는 복셀 셀 등록
    // ════════════════════════════════════════════════════════════════

    CellMap.Reset();

    for (int32 Idx = 0; Idx < Entities.Num(); ++Idx)
    {
        const FEntityData& ED = Entities[Idx];

        // 엔터티 캡슐 AABB: XY ± Radius, Z = [PosZ, PosZ + 2*HalfHeight]
        const FIntVector MinV = FHktTerrainSystem::CmToVoxel(
            static_cast<float>(ED.ExpectedPos.X) - ED.Radius,
            static_cast<float>(ED.ExpectedPos.Y) - ED.Radius,
            static_cast<float>(ED.ExpectedPos.Z),
            VS);
        const FIntVector MaxV = FHktTerrainSystem::CmToVoxel(
            static_cast<float>(ED.ExpectedPos.X) + ED.Radius,
            static_cast<float>(ED.ExpectedPos.Y) + ED.Radius,
            static_cast<float>(ED.ExpectedPos.Z) + 2.0f * ED.HalfHeight,
            VS);

        if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
        {
            UE_LOG(LogHktCore, Warning,
                TEXT("[Physics Step2] E%d Pos=(%.0f,%.0f,%.0f) Vel=(%.1f,%.1f,%.1f) R=%.0f HH=%.0f Mass=%.0f "
                     "Cells=(%d,%d,%d)->(%d,%d,%d)"),
                ED.Id, ED.ExpectedPos.X, ED.ExpectedPos.Y, ED.ExpectedPos.Z,
                ED.Velocity.X, ED.Velocity.Y, ED.Velocity.Z, ED.Radius, ED.HalfHeight, ED.Mass,
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
    // Phase 1: 셀 순회 — 엔터티 간 충돌
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

        // ── Phase 1: 엔터티 쌍 충돌 — CollisionLayer 매칭 + 캡슐-캡슐 mass 기반 반작용 ──
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

                // 반작용 반영된 현재 위치로 캡슐-캡슐 충돌 검사
                // 캡슐 중심축(수직 세그먼트): 하단 반구 중심 ~ 상단 반구 중심
                const FVector PosA = A.ExpectedPos + Reactions[*IdxA];
                const FVector PosB = B.ExpectedPos + Reactions[*IdxB];

                // 중심축 Z 범위: [PosZ + Radius, PosZ + 2*HalfHeight - Radius]
                const float SegABot = PosA.Z + A.Radius;
                const float SegATop = PosA.Z + 2.0f * A.HalfHeight - A.Radius;
                const float SegBBot = PosB.Z + B.Radius;
                const float SegBTop = PosB.Z + 2.0f * B.HalfHeight - B.Radius;

                // 수직 캡슐 간 최근접점: Z축 겹침 구간에서 최소 Z 거리 계산
                // Z 겹침이 있으면 Z 차이 = 0, 없으면 gap 거리
                float CloseZA, CloseZB;
                if (SegATop < SegBBot)
                {
                    // A가 B 아래에 있음
                    CloseZA = SegATop;
                    CloseZB = SegBBot;
                }
                else if (SegBTop < SegABot)
                {
                    // B가 A 아래에 있음
                    CloseZA = SegABot;
                    CloseZB = SegBTop;
                }
                else
                {
                    // Z 겹침 — 겹침 구간의 중점 사용 (Z 기여 = 0)
                    const float OverlapMid = (FMath::Max(SegABot, SegBBot) + FMath::Min(SegATop, SegBTop)) * 0.5f;
                    CloseZA = FMath::Clamp(OverlapMid, SegABot, SegATop);
                    CloseZB = FMath::Clamp(OverlapMid, SegBBot, SegBTop);
                }

                const FVector ClosestA(PosA.X, PosA.Y, CloseZA);
                const FVector ClosestB(PosB.X, PosB.Y, CloseZB);

                const float CombR = A.Radius + B.Radius;
                const float DistSq = FVector::DistSquared(ClosestA, ClosestB);

                if (DistSq >= CombR * CombR)
                    continue;

                const float Dist = FMath::Sqrt(DistSq);
                if (Dist <= SMALL_NUMBER)
                {
                    // 완전 겹침 — 결정론적 X축 방향으로 분리
                    const FVector FallbackDir(1.0f, 0.0f, 0.0f);
                    const float InvMass = 1.0f / (A.Mass + B.Mass);
                    if (!A.bProjectile)
                        Reactions[*IdxA] -= FallbackDir * (CombR * B.Mass * InvMass);
                    if (!B.bProjectile)
                        Reactions[*IdxB] += FallbackDir * (CombR * A.Mass * InvMass);

                    FHktPhysicsEvent PhysEvt;
                    PhysEvt.EntityA = A.Id;
                    PhysEvt.EntityB = B.Id;
                    PhysEvt.ContactPoint = PosA;
                    OutPhysicsEvents.Add(PhysEvt);
                    continue;
                }

                const float Overlap = CombR - Dist;
                const FVector Dir = (ClosestB - ClosestA) / Dist;
                const float InvMass = 1.0f / (A.Mass + B.Mass);

                // mass 기반 반작용 (투사체는 밀리지 않음)
                const FVector PushA = Dir * (Overlap * B.Mass * InvMass);
                const FVector PushB = Dir * (Overlap * A.Mass * InvMass);
                if (!A.bProjectile)
                    Reactions[*IdxA] -= PushA;
                if (!B.bProjectile)
                    Reactions[*IdxB] += PushB;

                // 충돌 이벤트 — 접촉점 = 최근접점 중간
                FHktPhysicsEvent PhysEvt;
                PhysEvt.EntityA = A.Id;
                PhysEvt.EntityB = B.Id;
                PhysEvt.ContactPoint = (ClosestA + ClosestB) * 0.5f;
                OutPhysicsEvents.Add(PhysEvt);

                if (DebugEntityId >= 0 &&
                    (A.Id == static_cast<FHktEntityId>(DebugEntityId) ||
                     B.Id == static_cast<FHktEntityId>(DebugEntityId)))
                {
                    UE_LOG(LogHktCore, Warning,
                        TEXT("[Physics Step5 Capsule] E%d(R=%.0f HH=%.0f)<->E%d(R=%.0f HH=%.0f) Dist=%.1f CombR=%.1f Overlap=%.1f "
                             "MassA=%.0f MassB=%.0f PushA=(%.1f,%.1f,%.1f) PushB=(%.1f,%.1f,%.1f)"),
                        A.Id, A.Radius, A.HalfHeight, B.Id, B.Radius, B.HalfHeight,
                        Dist, CombR, Overlap, A.Mass, B.Mass,
                        -PushA.X, -PushA.Y, -PushA.Z,
                        PushB.X, PushB.Y, PushB.Z);
                }
            }
        }
    }

    // ════════════════════════════════════════════════════════════════
    // Phase 2: Terrain Floor Snap — 바닥 계산 + 반작용 적용 + IsGrounded
    // ════════════════════════════════════════════════════════════════

    static constexpr int32 MaxTerrainScanUp = 32;
    static constexpr int32 MaxTerrainScanDown = 64;

    for (int32 Idx = 0; Idx < Entities.Num(); ++Idx)
    {
        const FEntityData& ED = Entities[Idx];
        const FVector& React = Reactions[Idx];
        FVector FinalPos = ED.ExpectedPos + React;
        bool bTerrainSnapped = false;
        bool bGroundBelow = false;

        // 바닥 계산: 발 복셀 → solid면 위로 탈출, air면 아래로 지면 탐색
        if (TerrainState)
        {
            const int32 FootVX = FMath::FloorToInt(FinalPos.X / VS);
            const int32 FootVY = FMath::FloorToInt(FinalPos.Y / VS);
            const int32 FootVZ = FMath::FloorToInt(FinalPos.Z / VS);

            if (TerrainState->IsSolid(FootVX, FootVY, FootVZ))
            {
                // 매몰 — 하이트맵으로 정확한 표면 높이를 O(1) 조회
                const int32 SurfaceVZ = TerrainState->GetSurfaceHeightAt(FootVX, FootVY);
                if (SurfaceVZ > 0)
                {
                    FinalPos.Z = static_cast<float>(SurfaceVZ) * VS;
                }
                else
                {
                    // 하이트맵 캐시 미스 — 위로 스캔 폴백
                    int32 ScanVZ = FootVZ + 1;
                    const int32 ScanLimit = FootVZ + MaxTerrainScanUp;
                    while (ScanVZ <= ScanLimit && TerrainState->IsSolid(FootVX, FootVY, ScanVZ))
                        ++ScanVZ;
                    FinalPos.Z = static_cast<float>(ScanVZ) * VS;
                }
                bTerrainSnapped = true;
                bGroundBelow = true;
            }
            else
            {
                // 공중 — 아래로 스캔하여 가장 가까운 지면 찾기
                int32 ScanVZ = FootVZ - 1;
                const int32 ScanFloor = FootVZ - MaxTerrainScanDown;
                while (ScanVZ >= ScanFloor && !TerrainState->IsSolid(FootVX, FootVY, ScanVZ))
                    --ScanVZ;

                if (ScanVZ >= ScanFloor && TerrainState->IsSolid(FootVX, FootVY, ScanVZ))
                {
                    // solid 복셀의 윗면이 지면
                    const float GroundZ = static_cast<float>(ScanVZ + 1) * VS;
                    const float Gap = FinalPos.Z - GroundZ;

                    if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
                    {
                        UE_LOG(LogHktCore, Warning,
                            TEXT("[Physics Floor] E%d FootVZ=%d ScanHit=%d GroundZ=%.0f Gap=%.1f VS=%.1f"),
                            ED.Id, FootVZ, ScanVZ, GroundZ, Gap, VS);
                    }

                    if (Gap <= VS)
                    {
                        // 1복셀 이내 — 바닥에 스냅
                        FinalPos.Z = GroundZ;
                        bTerrainSnapped = true;
                        bGroundBelow = true;
                    }
                    else
                    {
                        // 먼 거리 — 낙하 중 (중력이 내려줄 것)
                        bGroundBelow = false;
                    }
                }
                else
                {
                    if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
                    {
                        UE_LOG(LogHktCore, Warning,
                            TEXT("[Physics Floor] E%d FootVZ=%d — 아래에 지면 없음 (스캔 %d까지)"),
                            ED.Id, FootVZ, ScanFloor);
                    }
                    // 아래에 지면 없음
                    bGroundBelow = false;
                }
            }
        }
        else
        {
            // Terrain 없음 — Z=0 을 바닥으로 사용
            if (FinalPos.Z < 0.0f)
            {
                FinalPos.Z = 0.0f;
                bTerrainSnapped = true;
                bGroundBelow = true;
            }
            else
            {
                bGroundBelow = (FinalPos.Z <= 1.0f);
            }
        }

        // Z < 0 절대 방어 — 어떤 경우에도 바닥 아래로 내려갈 수 없음
        if (FinalPos.Z < 0.0f)
        {
            UE_LOG(LogHktCore, Error,
                TEXT("[Physics] E%d Z<0 감지! Pos=(%.1f,%.1f,%.1f) Expected=(%.1f,%.1f,%.1f) "
                     "React=(%.1f,%.1f,%.1f) Terrain=%s → Z=0 클램프"),
                ED.Id, FinalPos.X, FinalPos.Y, FinalPos.Z,
                ED.ExpectedPos.X, ED.ExpectedPos.Y, ED.ExpectedPos.Z,
                React.X, React.Y, React.Z,
                TerrainState ? TEXT("Y") : TEXT("N"));
            FinalPos.Z = 0.0f;
            bTerrainSnapped = true;
            bGroundBelow = true;
        }

        int32 FinalVelX = WorldState.GetProperty(ED.Id, PropertyId::VelX);
        int32 FinalVelY = WorldState.GetProperty(ED.Id, PropertyId::VelY);
        int32 FinalVelZ = WorldState.GetProperty(ED.Id, PropertyId::VelZ);

        if (bTerrainSnapped && FinalVelZ < 0)
            FinalVelZ = 0;

        // Entity-entity 반작용 속도 감쇄
        if (FMath::Abs(React.X) > SMALL_NUMBER &&
            ((React.X > 0.0f && FinalVelX < 0) || (React.X < 0.0f && FinalVelX > 0)))
            FinalVelX = 0;
        if (FMath::Abs(React.Y) > SMALL_NUMBER &&
            ((React.Y > 0.0f && FinalVelY < 0) || (React.Y < 0.0f && FinalVelY > 0)))
            FinalVelY = 0;
        if (FMath::Abs(React.Z) > SMALL_NUMBER &&
            ((React.Z > 0.0f && FinalVelZ < 0) || (React.Z < 0.0f && FinalVelZ > 0)))
            FinalVelZ = 0;

        const int32 NewPX = FMath::RoundToInt(FinalPos.X);
        const int32 NewPY = FMath::RoundToInt(FinalPos.Y);
        const int32 NewPZ = FMath::RoundToInt(FinalPos.Z);
        if (NewPX != WorldState.GetProperty(ED.Id, PropertyId::PosX))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosX, NewPX);
        if (NewPY != WorldState.GetProperty(ED.Id, PropertyId::PosY))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosY, NewPY);
        if (NewPZ != WorldState.GetProperty(ED.Id, PropertyId::PosZ))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::PosZ, NewPZ);

        if (FinalVelX != WorldState.GetProperty(ED.Id, PropertyId::VelX))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelX, FinalVelX);
        if (FinalVelY != WorldState.GetProperty(ED.Id, PropertyId::VelY))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelY, FinalVelY);
        if (FinalVelZ != WorldState.GetProperty(ED.Id, PropertyId::VelZ))
            VMProxy.SetPropertyDirty(WorldState, ED.Id, PropertyId::VelZ, FinalVelZ);

        if (TerrainState)
        {
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

        if (DebugEntityId >= 0 && ED.Id == static_cast<FHktEntityId>(DebugEntityId))
        {
            UE_LOG(LogHktCore, Warning,
                TEXT("[Physics] E%d Final=(%d,%d,%d) React=(%.1f,%.1f,%.1f) "
                     "Vel=(%d,%d,%d) Grounded=%s Snap=%s"),
                ED.Id, NewPX, NewPY, NewPZ,
                React.X, React.Y, React.Z,
                FinalVelX, FinalVelY, FinalVelZ,
                bGroundBelow ? TEXT("Y") : TEXT("N"),
                bTerrainSnapped ? TEXT("Y") : TEXT("N"));
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