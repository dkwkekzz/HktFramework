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

    /** 서버 응답 없이 MaxHistoryFrames 초과 시 브로드캐스트 (연결 끊김 판정) */
    FOnHktProxySimulatorTimeout OnTimeout;

    // === IHktProxySimulator ===
    virtual void RestoreState(const FHktWorldState& InState, int32 InGroupIndex) override;
    virtual const FHktWorldState& GetWorldState() const override;
    virtual bool IsInitialized() const override;
    virtual void AdvanceLocalFrame(float DeltaSeconds) override;
    virtual void EnqueueServerBatch(const FHktSimulationEvent& InBatch) override;
    virtual bool ConsumePendingDiff(FHktSimulationDiff& OutDiff) override;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    /** 로컬 Batch 생성 (결정론적 시드) */
    FHktSimulationEvent BuildLocalBatch(int64 Frame, float DeltaSeconds) const;

    /** 서버 Batch 큐 처리 — Diff 역적용으로 롤백(클라 빠름) / 빨리감기(클라 느림) */
    void ProcessPendingServerBatches();

    /** Diff를 PendingDiff에 누적 (Presentation 전달용) */
    void AccumulateDiff(FHktSimulationDiff& InDiff);

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
    int32 FramesSinceLastServerBatch = 0;

    static constexpr float FixedDeltaTime = 1.0f / 30.0f;

    // --- 그룹 인덱스 (결정론적 시드 생성용) ---
    int32 CachedGroupIndex = 0;

    // --- 히스토리 보호: 서버 미확인 최대 프레임 수 ---
    static constexpr int32 MaxHistoryFrames = 300; // 10초 @ 30Hz

    // --- 백그라운드 복귀 시 과도한 로컬 예측 프레임 방지 ---
    static constexpr int32 MaxLocalCatchupFrames = 10;
};
