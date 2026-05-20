// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * 충돌 디버그 렌더러.
 * 엔티티별 위치/캡슐/판정 영역/포함 복셀을 DrawDebug로 시각화.
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowCollision         0=끄기, 1=캡슐, 2=캡슐+판정 범위, 3=캡슐+판정 범위+복셀
 *   hkt.Debug.ShowCollisionLabels   0=끄기, 1=엔티티 ID/파라미터 표시
 *   hkt.Debug.ShowEntityPos         0=끄기, 1=모든 엔티티 위치에 sphere
 *   hkt.Debug.EntityPosSphereRadius sphere 반경 (cm)
 *   hkt.Debug.ShowCollisionPairs    0=끄기, 1=FHktPhysicsSystem 검출 충돌 페어 라인 + ContactPoint
 *   hkt.Debug.CollisionPairLifetime fade-out 지속 sim frame 수 (default 15)
 *   hkt.Debug.ShowSelectableHitbox  0=끄기, 1=IHktSelectable 액터의 실제 픽업 볼륨 overlay (주황)
 */
class FHktCollisionDebugProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktCollisionDebugProcessor(ULocalPlayer* InLP);

	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	void DrawEntityPositions(UWorld* World, const FHktPresentationState& State);
	void DrawCollisionCapsules(UWorld* World, const FHktPresentationState& State);
	void DrawDetectionRange(UWorld* World, const FHktPresentationState& State);
	void DrawVoxelCells(UWorld* World, const FHktPresentationState& State);
	void DrawCollisionPairs(UWorld* World, const FHktPresentationState& State);
	void DrawSelectableHitboxes(UWorld* World, const FHktPresentationState& State);

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
