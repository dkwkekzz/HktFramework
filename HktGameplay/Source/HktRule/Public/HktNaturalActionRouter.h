// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

struct FHktEvent;

// ============================================================================
// HktNaturalActionRouter — Action.Natural.* → Event.Natural.* 1:1 echo 라우터.
//
// Implementation-Plan §3 (PR-1) 의 핵심 산출물. "최소 모델": 라우터는 판정 0,
// 거리/도구/region 검사는 spawner story 본문 (HktStoryVM bytecode) 으로 미룬다.
//
// 매핑 정책 (안티 패턴 §3.4):
//   - 1 Action → 정확히 1 Event. 매핑 테이블에 복수 Event 매핑 금지.
//   - Target 종류 분기 (예: Harvest Berry vs Harvest Herb) 는 spawner story 가
//     수신 후 `LoadStore(PropertyId::Param0..3)` 로 자체 처리한다.
//   - 매핑 못 찾은 Action → OutEvent.EventTag = invalid (호출자가 silent skip).
//
// 호출자: HktServerRule::OnReceived_RuntimeEvent (서버) — Intent 수신 직후
// Echo 통과시킨 후 PendingGroupIntents 큐에 enqueue.
// ============================================================================

namespace HktNaturalActionRouter
{
    /**
     * Intent (Action.Natural.<Verb>) 를 1:1 매핑된 Event (Event.Natural.<Verbed>) 로 변환한다.
     *
     * @param OutEvent  변환 결과. 매핑 실패 시 EventTag 가 invalid 상태로 채워진다.
     *                  성공 시 SourceEntity / TargetEntity / Location / PlayerUid / Param0~3 가
     *                  Intent 로부터 그대로 복사된다 — 서버는 판정 0, 클라 hint 그대로 통과.
     * @param Intent    수신된 인텐트. EventTag 는 Action.Natural.* 여야 한다.
     *
     * @note Param0~3 의 의미는 수신 spawner story 본문이 자체 정의한다
     *       (TerrainSpawner.design.md §4-d / 05-interactions.md §3 Param0~3 컨벤션).
     */
    HKTRULE_API void RouteAction(FHktEvent& OutEvent, const FHktEvent& Intent);

    /** 라우터가 인식하는 Action 태그인지 검사. 디버그/테스트용. */
    HKTRULE_API bool IsKnownAction(const FGameplayTag& ActionTag);

    /** 단일 Action → Event 매핑을 조회. 미인식 시 invalid tag 반환. 디버그/테스트용. */
    HKTRULE_API FGameplayTag LookupEventForAction(const FGameplayTag& ActionTag);
}
