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

	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	void DrawCollisionCapsules(UWorld* World, const FHktPresentationState& State);
	void DrawDetectionRange(UWorld* World, const FHktPresentationState& State);
	void DrawVoxelCells(UWorld* World, const FHktPresentationState& State);

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
