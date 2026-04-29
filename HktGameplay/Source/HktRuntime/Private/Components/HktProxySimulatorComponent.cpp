#include "HktProxySimulatorComponent.h"
#include "HktRuntimeLog.h"
#include "HktCoreEventLog.h"
#include "HktRuntimeCommon.h"
#include "HktCoreDataCollector.h"
#include "HktTerrainSubsystem.h"
#include "HktTerrainProvider.h"
#include "Settings/HktRuntimeGlobalSetting.h"

UHktProxySimulatorComponent::UHktProxySimulatorComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UHktProxySimulatorComponent::BeginPlay()
{
    Super::BeginPlay();
    LastServerSignalTimeSec = FPlatformTime::Seconds();
    bTimeoutNotified = false;

    // DedicatedServer의 원격 PC에는 ProxySimulator가 불필요하다.
    // 로컬 컨트롤러인 경우에만 Simulator를 생성하여 메모리 낭비를 막는다.
    // (Standalone / Client / ListenServer 호스트 PC는 IsLocalController() == true)
    APlayerController* OwnerPC = Cast<APlayerController>(GetOwner());
    if (OwnerPC && !OwnerPC->IsLocalController())
    {
        return;
    }

    Simulator = CreateDeterminismSimulator(EHktLogSource::Client);
}

void UHktProxySimulatorComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (TerrainConfigChangedHandle.IsValid())
    {
        if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
        {
            Sub->OnEffectiveConfigChanged.Remove(TerrainConfigChangedHandle);
        }
        TerrainConfigChangedHandle.Reset();
    }

    if (Simulator)
    {
        // 지형 소스 해제 — Subsystem 무효화 이전에 Provider weak ref dangling 차단.
        Simulator->SetTerrainSource(nullptr);
    }

    Simulator.Reset();
    Super::EndPlay(EndPlayReason);
}

// ============================================================================
// 매 틱: 고정 타임스텝 로컬 시뮬레이션 → 서버 Batch 조정
// ============================================================================

void UHktProxySimulatorComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bInitialized) return;

    // 서버 Batch 없을 때만 고정 타임스텝 로컬 예측 실행
    FrameAccumulator += DeltaTime;
    while (FrameAccumulator >= FixedDeltaTime)
    {
        FrameAccumulator -= FixedDeltaTime;

        // 서버 Batch가 있으면 로컬 예측 건너뛰고 바로 조정 처리
        if (PendingServerBatches.Num() > 0)
        {
            ProcessPendingServerBatches();
        }
        else
        {
            AdvanceLocalFrame(FixedDeltaTime);
        }
    }

    const double NowSec = FPlatformTime::Seconds();
    if ((NowSec - LastServerSignalTimeSec) > HeartbeatTimeoutSec)
    {
        if (!bTimeoutNotified)
        {
            bTimeoutNotified = true;
            OnTimeout.Broadcast();
            HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Warning, EHktLogSource::Client,
                FString::Printf(TEXT("Proxy timeout: no server signal for %.2f sec"), HeartbeatTimeoutSec));
        }
    }
    else if (bTimeoutNotified)
    {
        bTimeoutNotified = false;
    }

#if ENABLE_HKT_INSIGHTS
    {
        const FString Cat = TEXT("Runtime.ProxySimulator");
        HKT_INSIGHT_COLLECT(Cat, TEXT("Initialized"), bInitialized ? TEXT("Yes") : TEXT("No"));
        HKT_INSIGHT_COLLECT(Cat, TEXT("LocalFrame"), FString::Printf(TEXT("%lld"), LocalFrame));
        HKT_INSIGHT_COLLECT(Cat, TEXT("DiffHistory"), FString::FromInt(DiffHistory.Num()));
        HKT_INSIGHT_COLLECT(Cat, TEXT("PendingBatches"), FString::FromInt(PendingServerBatches.Num()));
        if (bInitialized)
        {
            const FHktWorldState& WS = Simulator->GetWorldState();
            HKT_INSIGHT_COLLECT(Cat, TEXT("Entities"), FString::FromInt(WS.GetEntityCount()));
        }
    }
#endif
}

void UHktProxySimulatorComponent::AccumulateDiff(FHktSimulationDiff& InDiff)
{
    PendingDiff.FrameNumber = InDiff.FrameNumber;
    PendingDiff.SpawnedEntities.Append(MoveTemp(InDiff.SpawnedEntities));
    PendingDiff.RemovedEntities.Append(MoveTemp(InDiff.RemovedEntities));
    PendingDiff.PropertyDeltas.Append(MoveTemp(InDiff.PropertyDeltas));
    PendingDiff.TagDeltas.Append(MoveTemp(InDiff.TagDeltas));
    PendingDiff.OwnerDeltas.Append(MoveTemp(InDiff.OwnerDeltas));
    PendingDiff.VFXEvents.Append(MoveTemp(InDiff.VFXEvents));
    PendingDiff.AnimEvents.Append(MoveTemp(InDiff.AnimEvents));
    bHasPendingDiff = true;
}

void UHktProxySimulatorComponent::AdvanceLocalFrame(float DeltaSeconds)
{
    LocalFrame++;

    FHktSimulationEvent LocalBatch = BuildLocalBatch(LocalFrame, DeltaSeconds);
    FHktSimulationDiff Diff = Simulator->AdvanceFrame(LocalBatch);

    // 실제 변경이 있는 Diff만 히스토리에 기록 (역적용 롤백용)
    const bool bHasChanges = Diff.SpawnedEntities.Num() > 0
        || Diff.RemovedEntities.Num() > 0
        || Diff.PropertyDeltas.Num() > 0
        || Diff.TagDeltas.Num() > 0
        || Diff.OwnerDeltas.Num() > 0
        || Diff.VFXEvents.Num() > 0
        || Diff.AnimEvents.Num() > 0;
    if (!bHasChanges)
    {
        return;
    }

    DiffHistory.Add(Diff);

    // PendingDiff에 누적 (PlayerController Tick에서 소비 → WorldViewUpdated 전달)
    AccumulateDiff(Diff);

    // 연결 상태 판정은 heartbeat/서버 신호 시각 기반으로 TickComponent에서 처리한다.
}

FHktSimulationEvent UHktProxySimulatorComponent::BuildLocalBatch(
    int64 Frame, float DeltaSeconds) const
{
    FHktSimulationEvent Batch;
    Batch.FrameNumber = Frame;
    Batch.DeltaSeconds = DeltaSeconds;
    Batch.RandomSeed = HktRuntimeCommon::HashCombineHelper(Frame, CachedGroupIndex);
    return Batch;
}

// ============================================================================
// 서버 Batch 큐 적재 (수신 즉시 처리하지 않음)
// ============================================================================

void UHktProxySimulatorComponent::EnqueueServerBatch(const FHktSimulationEvent& InBatch)
{
    LastServerSignalTimeSec = FPlatformTime::Seconds();
    bTimeoutNotified = false;

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("EnqueueServerBatch Frame=%lld Events=%d"),
            InBatch.FrameNumber, InBatch.NewEvents.Num()));
    PendingServerBatches.Add(InBatch);
}

bool UHktProxySimulatorComponent::ConsumePendingDiff(FHktSimulationDiff& OutDiff)
{
    if (!bHasPendingDiff) return false;
    OutDiff = MoveTemp(PendingDiff);
    bHasPendingDiff = false;
    return true;
}

// ============================================================================
// 서버 Batch 조정 — Diff 역적용으로 롤백(클라 빠름) / 빨리감기(클라 느림)
// ============================================================================

void UHktProxySimulatorComponent::ProcessPendingServerBatches()
{
    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("ProcessServerBatches: %d batches, rollback %d diffs"),
            PendingServerBatches.Num(), DiffHistory.Num()));

    // 프레임 번호 기준 오름차순 정렬
    PendingServerBatches.Sort([](const FHktSimulationEvent& A, const FHktSimulationEvent& B)
    {
        return A.FrameNumber < B.FrameNumber;
    });

    // 롤백으로 이전 예측이 무효화되므로 PendingDiff 초기화
    PendingDiff = FHktSimulationDiff();
    bHasPendingDiff = false;

    for (const FHktSimulationEvent& ServerBatch : PendingServerBatches)
    {
        const int64 ServerFrame = ServerBatch.FrameNumber;

        // --- 1. Diff 역적용으로 ServerFrame 직전까지 롤백 ---
        while (DiffHistory.Num() > 0)
        {
            const FHktSimulationDiff& TopDiff = DiffHistory.Last();
            if (TopDiff.FrameNumber < ServerFrame) break;
            Simulator->UndoDiff(TopDiff);
            DiffHistory.Pop();
        }

        // --- 2. 클라가 느린 경우: 빈 Batch로 빨리감기 (Diff 누적) ---
        int64 CurrentFrame = Simulator->GetWorldState().FrameNumber;
        for (int64 F = CurrentFrame + 1; F < ServerFrame; ++F)
        {
            FHktSimulationEvent GapBatch = BuildLocalBatch(F, FixedDeltaTime);
            FHktSimulationDiff GapDiff = Simulator->AdvanceFrame(GapBatch);
            AccumulateDiff(GapDiff);
        }

        // --- 3. 서버 권위 Batch로 해당 프레임 실행 (Diff 누적) ---
        FHktSimulationDiff ServerDiff = Simulator->AdvanceFrame(ServerBatch);
        AccumulateDiff(ServerDiff);

        // --- 4. 기록 초기화 & LocalFrame을 서버 프레임으로 보정 ---
        //     이후 틱에서 ServerFrame+1부터 다시 로컬 예측 시작
        DiffHistory.Empty();
        LocalFrame = ServerFrame;
    }

    PendingServerBatches.Reset();
    LastServerSignalTimeSec = FPlatformTime::Seconds();
    bTimeoutNotified = false;
}

// ============================================================================
// InitialState 수신 (그룹 진입 시)
// ============================================================================

void UHktProxySimulatorComponent::RestoreState(const FHktWorldState& InState, int32 InGroupIndex)
{
    if (!Simulator)
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Error, EHktLogSource::Client,
            TEXT("RestoreState: Simulator is null (non-local controller?)"));
        return;
    }

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RestoreState Frame=%lld Entities=%d GroupIndex=%d"),
            InState.FrameNumber, InState.GetEntityCount(), InGroupIndex));
    Simulator->RestoreWorldState(InState);

    // 클라이언트 시뮬레이터에도 지형 wiring — 서버와 동일한 물리 바닥 탐색.
    //
    // 순서 (서버 GameMode 와 동일 패턴):
    //   1) Sub->SetFallbackConfig(SettingsCfg) — BakedAsset 부재 시 effective Config 출처 주입
    //   2) OnEffectiveConfigChanged 1회 등록 (재진입 방지)
    //   3) RebindTerrainProvider — 클라 Simulator 에 Subsystem-aware Provider 직접 주입
    //
    // SetTerrainConfig 는 baseline 으로 항상 호출 — RebindTerrainProvider 가 SetTerrainSource 로
    // 덮어쓰지만, Subsystem 부재 환경(테스트/스탠드얼론 등) 에서도 VoxelSize 가 보장된다.
    const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
    if (Settings)
    {
        const FHktTerrainGeneratorConfig SettingsCfg = Settings->ToTerrainConfig();
        Simulator->SetTerrainConfig(SettingsCfg);

        if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
        {
            Sub->SetFallbackConfig(SettingsCfg);

            if (!TerrainConfigChangedHandle.IsValid())
            {
                TerrainConfigChangedHandle = Sub->OnEffectiveConfigChanged.AddWeakLambda(
                    this,
                    [this](const FHktTerrainGeneratorConfig& /*NewConfig*/)
                    {
                        RebindTerrainProvider();
                    });
            }

            RebindTerrainProvider();
        }
    }

    CachedGroupIndex = InGroupIndex;
    LocalFrame = InState.FrameNumber;
    DiffHistory.Empty();
    PendingServerBatches.Empty();
    bHasPendingDiff = false;
    FrameAccumulator = 0.0f;
    LastServerSignalTimeSec = FPlatformTime::Seconds();
    bTimeoutNotified = false;

    bInitialized = true;
}

void UHktProxySimulatorComponent::NotifyHeartbeat(int64 InServerFrame)
{
    LastServerSignalTimeSec = FPlatformTime::Seconds();
    bTimeoutNotified = false;
}

const FHktWorldState& UHktProxySimulatorComponent::GetWorldState() const
{
    check(Simulator.IsValid());
    return Simulator->GetWorldState();
}

bool UHktProxySimulatorComponent::IsInitialized() const
{
    return bInitialized;
}

void UHktProxySimulatorComponent::RebindTerrainProvider()
{
    if (!Simulator) { return; }

    UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
    if (!Sub)
    {
        // Subsystem 부재 — RestoreState 가 이미 SetTerrainConfig 로 baseline 을 주입했으므로
        // Provider 등록 없이 기본 Generator 경로 유지.
        return;
    }

    const FHktTerrainGeneratorConfig EffectiveCfg = Sub->GetEffectiveConfig();

    // Provider 의 Config 는 본 함수 호출 시점의 정적 스냅샷.
    // Subsystem 무효화 시 Provider 내부 weakptr 이 빈 청크(zero-init)로 폴백.
    Simulator->SetTerrainSource(MakeUnique<FHktTerrainProvider>(Sub, EffectiveCfg));

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("[ProxySim] Terrain Provider 재바인딩 — VoxelSizeCm=%.1f"),
            EffectiveCfg.VoxelSizeCm));
}
