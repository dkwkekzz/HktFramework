// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"
#include "HktEffectsPlan.h"
#include "HktPresentationChangeSet.h"
#include "HktPresentationState.h"

/**
 * FHktProjectionPipeline — Projection 등록 + 실행 오케스트레이터
 *
 * 처리 흐름:
 *  1. FHktWorldView → FHktPresentationChangeSet 변환
 *  2. 등록된 Projection을 순서대로 실행 (ViewModel 갱신 + Effects 기록)
 *  3. FHktEffectsPlan 반환 → 호출자가 EffectExecutor로 실행
 *
 * 등록 순서가 실행 순서. 선행 Projection이 State에 쓴 값을
 * 후행 Projection이 읽을 수 있으므로, 의존성 순서로 등록해야 함.
 *
 * 예:  LifecycleProjection (AddEntity) → SpawnProjection (VisualElement 읽기)
 *      PropertyProjection (ApplyDelta) → TransformProjection (Location 읽기)
 */
class HKTPRESENTATION_API FHktProjectionPipeline
{
public:
	FHktProjectionPipeline() = default;
	~FHktProjectionPipeline() = default;

	// 이동 가능, 복사 불가
	FHktProjectionPipeline(FHktProjectionPipeline&&) = default;
	FHktProjectionPipeline& operator=(FHktProjectionPipeline&&) = default;

	/** Projection 등록 (등록 순서 = 실행 순서) */
	void Register(TUniquePtr<IHktProjection> Projection);

	/**
	 * 증분 프레임 처리.
	 * State.BeginFrame → ChangeSet 변환 → Projection 순차 실행 → EffectsPlan 반환.
	 */
	const FHktEffectsPlan& ProcessFrame(
		const FHktWorldView& View,
		FHktPresentationState& State);

	/**
	 * 초기 동기화.
	 * WorldState의 전체 엔티티를 SpawnedEntities로 변환 후 동일 파이프라인 실행.
	 */
	const FHktEffectsPlan& ProcessInitialSync(
		const FHktWorldState& WS, int64 Frame,
		FHktPresentationState& State);

	/** 등록된 Projection 목록 (디버그/Insights 용) */
	int32 GetProjectionCount() const { return Projections.Num(); }
	const IHktProjection* GetProjection(int32 Index) const;

private:
	void RunProjections(const FHktPresentationChangeSet& Changes, FHktPresentationState& State, int64 Frame);

	TArray<TUniquePtr<IHktProjection>> Projections;
	FHktEffectsPlan CurrentPlan;

	/** ForInitialSync에서 SpawnedEntities 직렬화용 재사용 버퍼 */
	TArray<FHktEntityState> InitialSyncSpawnBuffer;
};
