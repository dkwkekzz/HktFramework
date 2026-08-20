# C017 — World Implementation

> 세계에 더해진 상태는 하나다. 새 계산도 새 상수도 새 난수도 없다.
> 나머지는 전부 **자리 옮김**이다 — 존재마다 흩어져 있던 판정 둘이 고른 하나로 모이고,
> 그 자리에 고르기가 들어선다.

## IMPLEMENTED

    World.TargetSelections                world/semantic/target-selection.ts
        TargetSelectionState              { observerId, targetEntityId }
        selectedEntityId · selectTarget · clearTarget · findSelection
        TargetSelectFailureReason · TargetDirectedFailureReason
        world/semantic/world-state.ts     WorldState.targetSelections 로 실린다

    RULE-TARGET-SELECT-001                world/rules/target.ts
        evaluateTargetSelect              Observable 과 Rule 이 공유하는 판정
        isAddressableEntity               "그 관찰자의 관찰에 실리는가" — 투영이 entities 로
                                          싣는 집합(actors + deposits)과 같은 것을 본다
    RULE-TARGET-CLEAR-001                 world/rules/target.ts
    RULE-TARGET-CLEAR-STALE-001           world/simulation/target-clear-stale.ts
                                          Tick 순서 배열의 **마지막** (world/index.ts)

    RULE_TARGET_SELECT · RULE_TARGET_CLEAR · RULE_TARGET_CLEAR_STALE
                                          protocol/semantic-id.ts

    CurrentTargetView                     protocol/gameview.ts
        GameViewSnapshot.currentTarget    Id 하나. 늘 실린다 (없으면 entityId 가 없다)

    interaction: select-target            world/actions/interactions.ts
        withActor 를 쓰지 않는다 — 고르는 것은 몸이 아니라 보는 이의 의도다
        (INTENT-TARGET-PER-OBSERVER-001). 살펴봄·되돌림과 같은 자리다
    interaction: clear-target             world/actions/interactions.ts

## REUSED

    AcquaintanceState 의 모양               world/semantic/acquaintance.ts
        관찰자별 장부 · Id 만 담는다 · 없음을 저장하지 않는다 — 셋 다 그대로 가져왔다.
        새 구조를 발명하지 않았다
    Observer 장부 · actorOfObserver         world/semantic/world-state.ts
    RULE-ACTION-BEGIN-001                   world/rules/action-begin.ts (무변경)
    RULE-OBSERVE-COMPLETE-001               world/rules/observe.ts (무변경)
    RULE-MINE-COMPLETE-001                  world/rules/mine.ts (무변경)
    RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001 · 피해·흔들림·통찰 규칙 전부 (무변경)
    InteractionView.available / reason      protocol/gameview.ts — 계약의 모양 무변경

## CHANGED

    RULE-OBSERVE-BEGIN-001                world/rules/observe.ts
        evaluateObserveBegin(state, observerId)     ← targetId 인자가 사라졌다
        ADDED   no-target-selected · target-kind-mismatch
        REMOVED no-such-target · target-is-self     (고르기 관문이 앞서 막는다)
        거리 · 남은 자리(C016) · 행동 관문은 한 줄도 바뀌지 않았다

    RULE-MINE-001                         world/rules/mine.ts
        evaluateMineTargeted(state, actor, observerId)   ← 새 겉면
        evaluateMinePreconditions(actor, deposit)        ← C001 판정 그대로 남아 있다
        ADDED   no-target-selected · target-kind-mismatch
        REMOVED unknown-deposit
        도구 · 거리 · 남은 양 · 행동 관문 무변경

    withActor                             world/actions/interactions.ts
        핸들러에 observerId 를 함께 넘긴다. 주체 해석 규칙 자체는 무변경 —
        몸이 필요한 행동이 그 몸을 얻는 방법은 그대로다

## AFFECTED UPDATED

    world/index.ts
        targetSelections: []              세계는 아무도 아무것도 고르지 않은 채 시작한다
        SYSTEMS 배열 마지막에 ruleTargetClearStale
                                          이 Tick 의 모든 변화가 끝난 뒤에 훑어야
                                          그 Tick 에 사라진 존재까지 본다

    world/tests/drive.ts
        selectTarget() 헬퍼 추가
        observeFully() 가 먼저 고른다      — 살펴봄이 고른 것을 대상으로 삼기 때문이다

    무변경으로 확인한 것 (코드를 열어 대조했고 한 줄도 고치지 않았다)
        world/simulation/npc-decide.ts    자율 존재는 지목 장부를 읽지 않는다
        world/rules/skill.ts · attack.ts · strike-damage.ts · critical-strike.ts
                                          공격 경로는 지목을 지나지 않는다
        world/rules/attribute-set.ts      밖에서 들어오는 손은 자기 대상을 따로 지목한다
        world/rules/observer-body.ts      몸의 수명 무변경 — 고른 것은 관찰자에게 매달린다

## PROJECTION

    world/projection/observer-view.ts

        entities 무변경                    고른 존재에 아무 표시도 붙지 않는다.
                                          "골라졌다" 는 대상에 대한 사실이 아니다
        interactions.select-target        **존재마다** — Actor 마다 하나 · Deposit 마다 하나.
                                          C014 의 observe 가 있던 자리를 그대로 물려받았고,
                                          자기 몸에도 실린다 (available 거짓 · target-is-self)
        interactions.observe              존재마다 → **하나**. targetEntityId 가 없다
        interactions.mine                 광맥마다 → **하나**. targetEntityId 가 없다
        interactions.clear-target         하나 · 언제나 available
        currentTarget                     Id 하나. 값은 여기에 베끼지 않는다 —
                                          View 가 그 Id 로 entities 를 짚는다

    항목 수는 늘지 않았다. 존재 N + 광맥 M 인 세계에서
        이전   observe N개 + mine M개
        이후   select-target (N+M)개 + observe 1 + mine 1 + clear-target 1

## TESTS

    world/tests/target.spec.ts (ADDED — 26 cases)
        RULE-TARGET-SELECT-001            고른다 · 광맥도 고른다 · 새로 고르면 대신한다 ·
                                          다시 골라도 유지 · 자기 몸 거절 · 없는 Id 거절 ·
                                          **행동이 아니다** (살펴보는 중에도 고를 수 있고
                                          하던 행동이 끊기지 않는다)
        INTENT-TARGET-PER-OBSERVER-001    둘이 서로 다른 상대를 고른 채 선다 ·
                                          골라진 쪽의 관찰에 그 사실이 없다 ·
                                          **대상이 달라지지 않는다** (생명·기력·행동·가려짐) ·
                                          세계가 대신 다가가지 않는다
        INTENT-TARGET-PERSISTS-001        멀어져도 유지되고 사유만 갱신된다 ·
                                          쓰러진 대상도 고른 채로 남는다
        RULE-TARGET-CLEAR-001             푼다 · 없어도 성공 · 언제나 가용
        RULE-TARGET-CLEAR-STALE-001       사라지면 비운다 · 그대로면 안 비운다 ·
                                          도는 세계에서 저절로 풀리지 않는다
        INTENT-TARGET-DIRECTS-THE-ACT-001 안 골랐으면 둘 다 거절 · **요청이 실은 대상은
                                          무시된다** · 종류가 맞지 않으면 그 사유 ·
                                          시작한 뒤 다른 것을 골라도 진행 중인 행동은 그대로
        INTENT-TARGET-OBSERVE-001         고르기가 존재마다 · 살펴봄·채집은 하나씩 ·
                                          고른 자리는 사본이 아니다

    REGRESSION (기존 검증을 새 경로로 다시 통과시켰다 — 판정 자체는 그대로다)
        observe.spec.ts    35 cases  살펴봄 전부 + 새 사유 3건(no-target-selected ·
                                     target-kind-mismatch · 고르기 관문으로 옮겨간 둘)
        insight.spec.ts    27 cases  통찰 문턱·거절 사유 그대로
        mine.spec.ts · action.spec.ts · move.spec.ts · world-tick.spec.ts ·
        observer.spec.ts · observer-mark.spec.ts · attack.spec.ts · command.spec.ts
                                     대상을 고르는 한 걸음이 앞에 붙었을 뿐 기대값 무변경.
                                     observer.spec 의 "가용성도 내 몸 기준이다" 는 오히려
                                     세졌다 — 둘이 **같은 것을 고른 채로** 가용성이 갈린다

    world 393 passed (이전 365 + 신규 26 + 살펴봄 계약 2)
    npm run boundary:check   경계 위반 0
    tsc                      world · protocol · engine · app 오류 0
                             (view/tests 픽스처는 currentTarget 을 아직 싣지 않는다 —
                              Stage 7 의 몫이다)

## NOTES

    ① 왜 `ruleTargetSelect` 가 관찰자 장부를 다시 보는가
       Engine 의 dispatch 가 이미 모르는 관찰자를 막는다 (world-kernel/dispatch.ts) —
       그래서 `unknown-observer` 는 요청 경로로는 도달하지 않는다. 그럼에도 남긴 이유는
       Rule 이 자기 Precondition 을 스스로 지녀야 하기 때문이다. `ruleObserveComplete` 가
       "이 자리에 오는 일은 없지만" 하고 `no-observer` 를 지니는 것과 같은 판단이다.

    ② `evaluateMinePreconditions` 를 그대로 남긴 이유
       C001 이 세운 판정(도구·거리·남은 양)은 이 Cycle 이 건드리지 않는 것이다.
       그 함수를 그대로 두고 앞에 `evaluateMineTargeted` 를 얹었다 — 대상을 어디서
       얻는가만 바뀌었다는 것이 코드의 모양으로도 보여야 한다.

    ③ 진행 중인 행동의 대상
       `beginAction` 이 고른 것의 Id 를 `CurrentAction` 에 적는 순간부터, 그 행동은
       자기 대상을 지닌다. 지목을 바꿔도 진행 중인 살펴봄·채집은 원래 대상을 끝까지
       가지며, 검증이 그것을 확인한다 (광맥이 줄고 지목은 다른 곳을 가리킨다).
       진행 중인 행동이 지목을 따라다니면 그것이 자동 추적이다.

    ④ 검증되지 않는 것 하나 — 솔직하게
       `RULE-TARGET-CLEAR-STALE-001` 은 **플레이로 도달하지 않는다.** 존재가 세계에서
       사라지는 경로가 0건이기 때문이다 (Actor 는 쓰러져도 남고, Deposit 은 바닥나도
       남으며, 관찰자가 떠나도 몸은 자리에 남는다). 요청으로도 Tick 으로도 그 사건을
       만들 수 없으므로 검증은 World State 를 직접 만들어 규칙을 부르는 방식이다.
       이것은 플레이 검증이 아니며 Stage 8 이 그 사실을 그대로 적는다.

    ⑤ 기반은 한 줄도 편집하지 않았다
       `engine/` 무변경. `npm run boundary:check` 통과. Stage 5 의 Human 결정대로
       컨텐츠 경계 안에서 닫았다 (01 PREREQUISITE).
