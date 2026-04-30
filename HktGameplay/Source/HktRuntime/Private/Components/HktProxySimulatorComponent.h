// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktClientRuleInterfaces.h"
#include "HktCoreSimulator.h"

#include "HktProxySimulatorComponent.generated.h"

DECLARE_MULTICAST_DELEGATE(FOnHktProxySimulatorTimeout);

UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktProxySimulatorComponent : public UActorComponent, public IHktProxySimulator
{
	GENERATED_BODY()

public:
	UHktProxySimulatorComponent();

    /** 서버 신호(heartbeat/batch) 미수신이 HeartbeatTimeoutSec를 넘으면 브로드캐스트 (연결 끊김 판정) */
    FOnHktProxySimulatorTimeout OnTimeout;

    // === IHktProxySimulator ===
    virtual void RestoreState(const FHktWorldState& InState, int32 InGroupIndex) override;
    virtual const FHktWorldState& GetWorldState() const override;
    virtual bool IsInitialized() const override;
    virtual void AdvanceLocalFrame(float DeltaSeconds) override;
    virtual void EnqueueServerBatch(const FHktSimulationEvent& InBatch) override;
    virtual bool ConsumePendingDiff(FHktSimulationDiff& OutDiff) override;
    virtual void NotifyHeartbeat(int64 InServerFrame) override;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    /** 로컬 Batch 생성 (결정론적 시드) — 시간 종속 변형은 시뮬레이터가 FrameNumber 로 처리한다. */
    FHktSimulationEvent BuildLocalBatch(int64 Frame) const;

    /** 서버 Batch 큐 처리 — Diff 역적용으로 롤백(클라 빠름) / 빨리감기(클라 느림) */
    void ProcessPendingServerBatches();

    /** Diff를 PendingDiff에 누적 (Presentation 전달용) */
    void AccumulateDiff(FHktSimulationDiff& InDiff);

    /**
     * 로컬(클라) 시뮬레이터에 Subsystem-aware Provider 를 (재)주입.
     *
     * 호출 시점:
     *   1. RestoreState 직후 — Subsystem 의 effective Config 로 첫 Provider 등록.
     *   2. UHktTerrainSubsystem::OnEffectiveConfigChanged 콜백 — BakedAsset 로드/언로드 후
     *      Config 가 갱신되었을 때 정적 스냅샷 재바인딩.
     *
     * 서버 측 AHktGameMode::RebindTerrainProvider 의 클라 단일-그룹 버전 — RelevancyGraph 우회,
     * 컴포넌트 자체가 보유한 Simulator 에 직접 SetTerrainSource.
     */
    void RebindTerrainProvider();

    // --- 코어 시뮬레이터 ---
    TUniquePtr<IHktDeterminismSimulator> Simulator;
    bool bInitialized = false;

    // --- Diff 히스토리 (로컬 예측 프레임별 Diff, 역적용으로 롤백) ---
    TArray<FHktSimulationDiff> DiffHistory;

    // --- 서버로부터 수신된 미처리 Batch 큐 ---
    TArray<FHktSimulationEvent> PendingServerBatches;

    // --- 조정 후 생성된 Diff (PlayerController가 Tick에서 소비) ---
    FHktSimulationDiff PendingDiff;
    bool bHasPendingDiff = false;

    // --- 틱 카운터 ---
    float FrameAccumulator = 0.0f;
    int64 LocalFrame = 0;
    double LastServerSignalTimeSec = 0.0;
    bool bTimeoutNotified = false;

    static constexpr float FixedDeltaTime = 1.0f / 30.0f;

    // --- 그룹 인덱스 (결정론적 시드 생성용) ---
    int32 CachedGroupIndex = 0;

    // --- 연결 생존 판정 ---
    static constexpr double HeartbeatTimeoutSec = 10.0;

    /** UHktTerrainSubsystem::OnEffectiveConfigChanged 핸들 — EndPlay 에서 안전 해제. */
    FDelegateHandle TerrainConfigChangedHandle;
};
