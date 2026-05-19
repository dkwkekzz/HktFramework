// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * Hitbox 디버그 렌더러.
 * Server VM 의 ForEachInRadius 가 ring buffer 에 적재한 hitbox trace 를
 * DrawDebugSphere 로 시각화. age (sim frame 기준) 에 따라 색상 fade-out.
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowHitbox        0=끄기, 1=sphere, 2=sphere+labels
 *   hkt.Debug.HitboxLifetime    fade-out 지속 sim frame 수 (default 30 → 30Hz tick 1초)
 */
class FHktHitboxDebugProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktHitboxDebugProcessor(ULocalPlayer* InLP);

	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
