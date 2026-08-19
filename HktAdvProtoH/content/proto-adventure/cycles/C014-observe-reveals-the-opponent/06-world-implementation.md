# C014 — World Implementation

> 세계에 더해진 것은 셋이다 — 행동 하나, 장부 하나, 투영 관문 하나.
> 피해 계산 파일(`rules/damage-calculate.ts` · `simulation/swing-strike.ts` ·
> `semantic/combat.ts`)은 **한 줄도 열지 않았다.** 살펴봄은 계산에 아무것도 더하지 않는다.

## IMPLEMENTED

    ActionKind.observe                  world/semantic/action.ts
        ACTION_DEFINITIONS.observe = { duration: 1.0, replaceable: false }
        ActionSpeed 를 적용하지 않는다 — 스킬 행동이 아니다 (03 BALANCE)

    World.Acquaintances                 world/semantic/acquaintance.ts (신설)
        AcquaintanceState { observerId, knownActorIds }
        isAcquainted · learnActor · forgetActor · concealedKeys
        CONCEALABLE_ATTRIBUTE_KEYS — 가려질 수 있는 항목 이름의 **단일 출처**
        UnacquaintedReason — 사유 코드 타입
        world/semantic/world-state.ts   WorldState.acquaintances 추가
        world/index.ts                  초기값 [] (아무도 아무것도 모른다)

    OBSERVE_RANGE = 5.0                 world/semantic/world-state.ts

    RULE-OBSERVE-BEGIN-001              world/rules/observe.ts
        evaluateObserveBegin(state, observerId, targetId)
        사유 6종: no-body · no-such-target · target-is-self · out-of-range ·
                  already-known · action-busy (판정 순서 = 03 Precondition 순서)
    RULE-OBSERVE-COMPLETE-001           world/rules/observe.ts
        ruleObserveComplete(state, actor) — 몸에서 관찰자를 되짚어 찾아 장부에 더한다
    RULE-OBSERVE-FORGET-001             world/rules/observe.ts
        evaluateForgetAcquaintance(state) · ruleObserveForget(state, observerId, targetId?)

    Action Request 경로                 world/actions/interactions.ts
        'observe' · 'forget-acquaintance' 두 항목.
        이 둘만 withActor 를 쓰지 않는다 — 앎은 몸의 것이 아니라 관찰자의 것이므로
        Rule 이 ObserverId 를 받아야 한다 (NOTES ①)

    명령 카탈로그                        world/semantic/command-catalog.ts
        'forget-acquaintance' 항목 하나. target 은 required: false 이고
        omittedMeaning 은 'all-known' — set-attribute 의 'self' 와 뜻이 다르므로 밝힌다

    계약 타입                            protocol/gameview.ts · protocol/actions.ts
        AttributesView.acquainted (필수) · concealed (필수) · unacquaintedReason (선택)
        combatStats · versusObserver · defenseShape 를 선택 필드로 (알 때만 실린다)
        ActionRequest 는 새 필드가 없다 — 봉투의 targetEntityId 를 그대로 쓴다

    식별자                               protocol/semantic-id.ts
        RULE_OBSERVE_BEGIN / COMPLETE / FORGET
        INTENT_OBSERVE · OBSERVE_KNOWLEDGE · UNSEEN_CAPABILITY ·
        UNSEEN_IS_OBSERVABLE · OBSERVE_FORGET

## REUSED

    RULE-ACTION-BEGIN-001               world/rules/action-begin.ts — 행동 시작 관문
    RULE-ACTION-PROGRESS-001            world/simulation/action-progress.ts — 진행과 완료
    RULE-HIT-001                        world/rules/attack.ts — **중단이 여기서 온다**
                                        (새 중단 규칙을 만들지 않았다)
    distance()                          world/semantic/position.ts — 새 거리 개념 없음
    World.DebugAuthority                world/semantic/world-state.ts — 되돌림의 관문
    World.Observers (Engine)            앎이 매달리는 열. 수명 규칙 무변경
    defenseShape · effectiveDefense · defenseMultiplier
                                        world/semantic/combat.ts — 파생 판정 무변경
    projectCommandCatalog               world/semantic/command-catalog.ts — 구조 무변경

## AFFECTED UPDATED

    world/simulation/action-progress.ts
        완료 효과 분기에 observe 한 줄. mine 옆에 나란히 선다
    world/projection/observer-view.ts
        존재마다 acquainted / concealed / unacquaintedReason 를 싣고,
        겨루는 힘 셋을 조건부로 싣는다. interactions 에 observe(존재마다) ·
        forget-acquaintance 를 더하고, commands 가용성에 되돌림을 잇는다

    기존 검증의 갱신 — **세계를 약하게 만들지 않고 검증을 새 경계로 옮겼다**
        world/tests/drive.ts            observeFully() 공용 헬퍼 추가
        world/tests/combat.spec.ts      C007 R2 의 "세계는 어떤 속성도 숨기지 않는다" 를
                                        새 경계로 다시 썼다 — 지우지 않았다.
                                        하나였던 테스트가 둘이 된다:
                                        ① 살펴보기 전에도 몸에서 읽히는 속성은 하나도
                                           가려지지 않는다 (가려짐 사실이 그 자리를 대신한다)
                                        ② 살펴본 뒤에는 그 셋도 예외 없이 실린다
        world/tests/damage.spec.ts      남의 combatStats 를 읽는 자리 앞에 observeFully
        world/tests/damage-type.spec.ts 같음 (4곳)
        world/tests/penetration.spec.ts 같음 (4곳)
        → 값은 한 개도 바꾸지 않았다. **관찰한 뒤 같은 값이 나온다** 가 확인된 것이다

    바꾸지 않은 것 (그것이 이 Cycle 의 주장이다)
        rules/damage-calculate.ts · rules/strike-damage.ts · rules/guard.ts ·
        simulation/swing-strike.ts · semantic/combat.ts · semantic/character-catalog.ts ·
        rules/npc-decide 경로 · rules/observer-body.ts

## PROJECTION

    attributes.acquainted               isAcquainted(state.acquaintances, …)
    attributes.concealed                concealedKeys(acquainted)
    attributes.unacquaintedReason       'not-observed' (가려진 것이 있을 때만)
    attributes.combatStats              acquainted 일 때만 — 값은 C010·C012·C013 그대로
    attributes.versusObserver           acquainted 일 때만 — 세계가 계산한 관계
    attributes.defenseShape             acquainted 일 때만 — 세계가 계산한 판정
    interactions.observe                존재마다 하나 (targetEntityId + available + reason)
    interactions.forget-acquaintance    하나 (DebugAuthority 가 available 을 정한다)
    commands[forget-acquaintance]       세계가 싣는 요청 목록

    투영하지 않은 것 — OBSERVE_RANGE · observe.duration · 다른 관찰자의 장부.
    04 OBSERVABLE PROJECTION NOTE 가 정한 그대로다.

## TESTS

    world/tests/observe.spec.ts         33 tests — 신설

        INTENT-UNSEEN-CAPABILITY-001
            처음 마주한 존재는 세 자리가 비어 있다
            몸과 움직임에서 읽히는 것은 그대로 (이름·종류·자리·행동·생명·기력·템포·배율·막기·몸)
            자기 몸은 아무것도 가려지지 않는다
            타격 경위는 가려지지 않지만 그것이 앎이 되지는 않는다
        INTENT-UNSEEN-IS-OBSERVABLE-001
            가려진 항목의 이름과 사유(not-observed)를 세계가 밝힌다
            그 목록이 세계의 단일 출처와 같다
            살펴보는 일이 존재마다 실리고 자기 몸에도 사유와 함께 실린다
            너무 멀면 out-of-range · 5.0 안이면 available
        RULE-OBSERVE-BEGIN-001
            시작된다 / 사거리 밖·자기 몸·없는 존재·행동 중 4종 거절
            대상에게 아무 일도 하지 않는다 (생명·기력·행동 무변화)
        RULE-OBSERVE-COMPLETE-001
            마치면 세 자리가 열리고 C012·C013 의 값이 그대로 나온다
            마치기 전에는 열리지 않는다
            이미 아는 존재는 already-known
            **값을 베끼지 않는다** — 뒤에 상대의 방어를 90→10 으로 바꾸면 10 이 보인다
            한 존재를 알아도 다른 존재는 모른다
        중단
            다가와 때리는 자율 존재에게 맞으면 생명이 줄고 앎이 남지 않는다
        INTENT-OBSERVE-KNOWLEDGE-001
            내가 안다고 둘째 관찰자가 알게 되지 않는다
            다른 관찰자의 몸도 살펴봐야 열린다
            떠나고 다시 들어와도 알던 것은 남는다
        RULE-OBSERVE-FORGET-001
            하나 되돌림 / 전부 되돌림 / not-known / debug-closed
            되돌림이 세계가 싣는 요청 목록에 있고 C009 항목도 그대로다
        DC-WORLD-PLAYER-UNFIXED-PATH
            모르는 상대에게도 세 스킬과 막기가 그대로 가용하다
            내 스킬 profile(rawDamage 26)은 상대를 몰라도 실린다
        03 BALANCE
            1.0 은 기본 스킬(0.6)보다 길고 채굴(1.2)보다 짧다
            5.0 은 사거리(2.0)보다 멀고 인지(9.0)보다 가깝다
            최대 거리에서 시작하면 붙기 전에 끝난다 (1.0 < 1.2) — 실제로 알아낸다

    실행 결과
        world 전체 16 파일 300 tests 통과 (`npx vitest run content/proto-adventure/world`)
        `npm run boundary:check` 경계 위반 0
        `npm run catalog:check` 3원소 정합

## NOTES

    ① 왜 observe / forget 만 withActor 를 쓰지 않는가
       기존 interaction 은 모두 `withActor` 로 요청을 몸에 붙인다. 그런데 앎은 몸의
       속성이 아니라 **관찰자의 것**이다 (INTENT-OBSERVE-KNOWLEDGE-001). 몸으로 좁히면
       어느 관찰자의 앎인지가 사라진다 — 한 몸을 두 사람이 번갈아 조종하는 세계에서
       그 구분이 곧 이 Cycle 의 의미다. 그래서 이 둘만 ObserverId 를 그대로 받는다.

    ② 완료 시점에 관찰자를 되짚어 찾는다
       `ruleObserveComplete` 는 `state.observers` 에서 `actorId === actor.id` 인 항목을
       찾는다. 행동은 몸에 붙어 있고 앎은 관찰자에 붙기 때문이다. 조종자가 없는 몸이
       이 자리에 오면 `no-observer` 로 끝난다 — 자율 존재는 살펴봄을 요청하지 않으므로
       실제로 오지 않지만, 와도 앎이 갈 곳이 없다는 것이 옳다.

    ③ 중단을 위한 코드가 한 줄도 없다
       살펴봄의 중단은 `RULE-HIT-001` 이 이미 만든다 — 피격은 하던 행동을 hit 으로
       갈아 버리고, 갈린 행동은 `RULE-ACTION-PROGRESS-001` 의 완료 효과 자리에
       도달하지 못한다. 03 이 "중단은 새 규칙이 아니다" 라고 적은 것이 코드에서
       그대로 성립했다 — 새 상태도 새 판정도 필요하지 않았다.

    ④ 가려짐을 투영에서 처리한 이유
       앎 자체는 World State 이지만 **가리는 일**은 투영의 몫이다. 세계의 사실
       (Actor 의 능력치)은 그대로 있고, 관찰 결과에 실릴 때 관문을 지난다.
       그래서 자율 존재의 판단(RULE-NPC-DECIDE-001)은 한 줄도 바뀌지 않았다 —
       그들은 관찰 계약이 아니라 세계 상태를 직접 읽으므로 관문 밖이다.
       세계 규칙에 플레이어/자율 존재의 비대칭이 생기지 않았다.

    ⑤ concealed 를 코드가 아니라 데이터로 둔 이유
       `CONCEALABLE_ATTRIBUTE_KEYS` 하나만 고치면 가리는 항목이 늘거나 줄고,
       관찰 계약이 그 목록을 실어 보내므로 View 는 고치지 않는다
       (DC-WORLD-OWNS-THE-SURFACE-LIST). 검증도 그 단일 출처와 대조한다 —
       테스트에 이름 셋을 다시 적으면 두 곳이 어긋날 수 있다.

    ⑥ GAP 없음
       03 의 ADDED / CHANGED 가 모두 코드에 있고, 임의로 만든 State 나 Rule 은 없다.
       `engine/` 은 한 줄도 열지 않았다.
