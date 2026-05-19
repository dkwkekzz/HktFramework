// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * Hitbox 디버그 렌더러 — Intent: I-0020 (Docs/intents/I-0020.md).
 *
 * VM Op_FindInRadius/Ex 가 ring buffer 에 적재한 *실제 판정 자취* 를
 * DrawDebugSphere 로 그대로 표시. 시각화 출처는 VM op 의 출력이며,
 * VM 밖에서 공격자 위치·무기 반경으로 합성한 heuristic sphere 가 아니다
 * (I-0019 — 단일 판정 출처). 서버·클라 어느 측 VM 의 trace 든 결정론
 * 보증으로 같은 그림.
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
 * 범위:
 *   Tracer 는 프로세스 로컬 싱글톤. PIE / Listen Server 에선 같은 프로세스의
 *   서버·클라 양쪽 VM trace 가 함께 push 된다 (결정론으로 결과는 일치).
 *   Dedicated 분리 환경에선 각 프로세스가 자기 VM trace 만 그린다.
 *   빌드 가드 ENABLE_HKT_INSIGHTS 로 Shipping 에서는 코드 자체 제거.
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
