// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * 충돌 디버그 렌더러.
 * 엔티티별 캡슐 충돌 범위, 판정 영역, 포함 복셀을 DrawDebug로 시각화.
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowCollision       0=끄기, 1=캡슐, 2=캡슐+판정 범위, 3=캡슐+판정 범위+복셀
 *   hkt.Debug.ShowCollisionLabels 0=끄기, 1=엔티티 ID/파라미터 표시
 */
class FHktCollisionDebugProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktCollisionDebugProcessor(ULocalPlayer* InLP);

	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	/** Mode 1: 엔티티별 캡슐 충돌 범위 시각화 */
	void DrawCollisionCapsules(UWorld* World, const FHktPresentationState& State);

	/** Mode 2: 각 엔티티의 최대 판정 도달 범위 (자신 + 최대 상대 반경) */
	void DrawDetectionRange(UWorld* World, const FHktPresentationState& State);

	/** Mode 3: 캡슐 AABB에 포함되는 복셀 셀 시각화 */
	void DrawVoxelCells(UWorld* World, const FHktPresentationState& State);

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
