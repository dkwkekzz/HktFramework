// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * 충돌 디버그 렌더러.
 * 엔티티별 CollisionRadius 구체와 Spatial Grid 셀을 DrawDebug로 시각화.
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowCollision       0=끄기, 1=구체, 2=구체+그리드
 *   hkt.Debug.ShowCollisionLabels 0=끄기, 1=엔티티 ID 표시
 */
class FHktCollisionDebugRenderer : public IHktPresentationRenderer
{
public:
	explicit FHktCollisionDebugRenderer(ULocalPlayer* InLP);

	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	void DrawCollisionSpheres(UWorld* World, const FHktPresentationState& State);
	void DrawSpatialGrid(UWorld* World, const FHktPresentationState& State);

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
