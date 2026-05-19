// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * Hitbox 디버그 렌더러 — Intent: I-0020 (Docs/intents/I-0020.md).
 *
 * Server VM 의 Op_FindInRadius/Ex 가 ring buffer 에 적재한 판정 자취를
 * 클라 화면에 그대로 표시. 클라는 어떤 판정도 추측하지 않고 서버 사실만
 * 표시 (I-0019 의 서버 권위 보증).
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowHitbox     0 = 끄기 (VM 측 push 도 즉시 중단 → zero-cost)
 *                            1 = sphere 만
 *                            2 = sphere + 라벨 (StoryTag/source/radius/hits/age)
 *   hkt.Debug.HitboxLifetime fade-out 지속 sim frame 수 (default 30 → 30Hz tick 1초)
 *
 * 표시 규약:
 *   빨강  HitCount > 0   반경 내 후보 검출됨 (broad-phase 명중)
 *   노랑  HitCount == 0  반경 내 후보 없음 (빈 스윙 / 빗나감)
 *   alpha sim frame 기준 age 가 HitboxLifetime 에 가까울수록 32 까지 선형 감쇠
 *
 * 진단 흐름:
 *   "공격이 닿지 않는다" 제보 → 1 로 켜고, 노란 sphere 만 보이면 판정 자체가
 *   빈 스윙, 빨간 sphere 인데도 피해 미적용이면 판정 이후의 SetProperty /
 *   EmitEvent 가 원인.
 *
 * 본 시각화의 단일 출처는 서버 VM 이 실제로 수행한 판정이다. 빌드 가드
 * ENABLE_HKT_INSIGHTS 로 Shipping 에서는 코드 자체 제거.
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
