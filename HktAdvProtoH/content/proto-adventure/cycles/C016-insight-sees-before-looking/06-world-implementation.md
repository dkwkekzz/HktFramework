# C016 — World Implementation

> 세계에 더해진 것은 성질 하나(`Actor.Insight`)와 문턱 표 하나, 그리고 이미 있던
> 가려짐 함수의 인자 하나다. 새 Rule 파일도, 새 행동도, 새 사유 코드도, 새 상태 전이도
> 없다. C014 가 관문을 한 자리에 세워 두었기 때문에 이 층은 그 관문 안에서 닫혔다.

## IMPLEMENTED

    Actor.Insight                      world/semantic/actor.ts
        0~100 의 수. 모든 존재가 지닌다. 겨루는 값들과 나란히 두되 주석으로
        "어떤 계산에도 들어가지 않는다" 를 못박았다 — 읽히는 곳은 관문 하나뿐이다

    CharacterDefinition.insight        world/semantic/character-catalog.ts
        `combat` 안에 두지 않았다. 겨루는 힘이 아니라 아는 힘이고, 가려지는 목록
        (CONCEALABLE_ATTRIBUTE_KEYS)에 들어가지 않기 때문이다.
        perceptionRange("몸이 무엇을 알아채는가") 옆에 둔다 — 나란한 종류의 값이다.
        세 등록(rabbit-swordsman · wanderer · DEFAULT)이 모두 0 이다

    INSIGHT_REVEAL_THRESHOLDS          world/semantic/acquaintance.ts
        defenseShape 30 · versusObserver 60 · combatStats 90.
        **CONCEALABLE_ATTRIBUTE_KEYS 바로 아래**에 두었다 (03 WORLD STATE) —
        목록과 문턱이 떨어져 있으면 자리를 늘릴 때 한쪽만 고쳐질 수 있다

    RULE-INSIGHT-REVEAL-001            world/semantic/acquaintance.ts
        `concealedKeys(acquainted, observerInsight)` 와 `isSeatOpen(key, …)`.
        상태를 바꾸지 않는 판정이므로 rules/ 가 아니라 semantic/ 에 둔다 —
        C014 가 `concealedKeys` 를 둔 그 자리에 인자 하나가 늘었을 뿐이다.
        `observerInsight` 의 기본값은 0 이다: 통찰을 모르는 호출자에게는
        C014 와 완전히 같은 함수로 보인다

    Actor.Insight 의 조작 경로          world/semantic/combat.ts · world/rules/attribute-set.ts
        MUTABLE_ATTRIBUTES 에 `{ id: 'insight', min: 0, max: 100 }` ·
        applyNumeric 에 case 하나. 다른 값을 끌고 오지 않는다

## REUSED

    World.Acquaintances                world/semantic/acquaintance.ts — 모양 그대로
    RULE-OBSERVE-COMPLETE-001          world/rules/observe.ts — 한 줄도 바뀌지 않았다
    RULE-OBSERVE-FORGET-001            world/rules/observe.ts — 한 줄도 바뀌지 않았다
    CONCEALABLE_ATTRIBUTE_KEYS         셋 그대로. 늘리지도 줄이지도 않았다
    RULE-ATTRIBUTE-SET-001 의 관문      DebugAuthority · 범위 검사 · 사유 코드 그대로
    RULE-DAMAGE-CALCULATE-001 · RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001 ·
    RULE-STRIKE-DAMAGE-001 · RULE-NPC-DECIDE-001
                                       **한 글자도 열지 않았다** — 통찰은 계산 밖이다

## AFFECTED UPDATED

    RULE-OBSERVE-BEGIN-001             world/rules/observe.ts
        Precondition 5 만 바뀌었다. `isAcquainted(...)` 하나를 보던 자리가
        `concealedKeys(acquainted, self.insight).length === 0` 이 되었다 —
        통찰과 문턱을 여기서 다시 비교하지 않는다. 판정은 한 곳에만 있다.
        사유 코드는 `already-known` 그대로

    spawnActor                         world/semantic/spawn.ts
        `insight: def.insight` 한 줄. 미등록 종류도 DEFAULT_CHARACTER 로 0 을 받는다

    world/tests/combat.spec.ts · world/tests/command.spec.ts
        투영 속성 목록과 바꿀 수 있는 성질 목록을 하드코딩한 검증 4건에
        `insight` 를 더했다. 의미 변경이 아니라 **목록이 늘어난 사실의 반영**이다
        (C013·C015 가 같은 자리를 고친 것과 같다)

## PROJECTION

    attributes.insight                 모든 존재에 언제나 실린다 (가려지지 않는다)
    attributes.concealed               concealedKeys(learned, self.insight) — 부분 목록이 된다
    attributes.acquainted              concealed.length === 0 — 뜻이 "가려진 자리가 없다" 로
    attributes.defenseShape            seatOpen('defenseShape') 일 때만
    attributes.versusObserver          seatOpen('versusObserver') 일 때만
    attributes.combatStats             seatOpen('combatStats') 일 때만
    hud self.insight                   내 통찰 한 줄 (self.combat.* 와 나란히)

    투영에서 **세 자리를 하나의 조건에서 떼어냈다.** C014 판은 `acquainted ? {세 자리} : {}`
    한 덩어리였고, 그것이 그대로 남았다면 통찰 60 인 관찰자에게 세 자리가 함께 왔을 것이다.
    지금은 자리마다 `seatOpen(key)` 을 묻는다.

    투영하지 않은 것 — 문턱 값 · 자리가 열린 경로(살펴봄인가 통찰인가) ·
    다른 관찰자의 통찰이 무엇을 열었는가. 04 OBSERVABLE PROJECTION NOTE 그대로다.

## TESTS

    world/tests/insight.spec.ts        27 tests — 신설

        INTENT-INSIGHT-001
            모든 존재가 통찰을 지니고 아무도 기르지 않았으므로 0 이다
            내 통찰이 hud 자리에 실리고, 바꾸면 그 자리에서 바로 읽힌다
            통찰은 가려지지 않는다 — 셋이 다 가려진 존재의 통찰 45 가 그대로 보인다
            통찰 100 으로 친 한 방이 통찰 0 과 **완전히 같다** (경위까지 같고
            경위 어디에도 insight 라는 이름이 없다)
        INTENT-INSIGHT-OPENS-001
            0 → 셋 다 가려짐 · 30 → 형태만 열림 · 60 → 관계까지 · 90 → 전부
            문턱 바로 아래(29 · 59 · 89)에서는 열리지 않는다
            내리면 다시 가려진다 (90 → 30 → 0)
            문턱은 대상을 읽지 않는다 (한쪽 방어를 100000 으로 해도 열리는 자리가 같다)
            자기 몸은 통찰과 무관하게 전부 열려 있다
            열린 값은 베낀 것이 아니다 (뒤에 방어를 30→10 으로 바꾸면 10 이 보인다)
            보는 이마다 다르다 (내 몸만 60 으로 올리면 둘째 관찰자는 여전히 셋 다 가려짐)
        INTENT-INSIGHT-NOT-A-GATE-001
            통찰 0 으로 살펴본 결과가 통찰 90 인 몸이 보는 것과 **값까지 같다**
            통찰 0 으로도 세 스킬과 막기가 그대로 가용하다
        RULE-OBSERVE-BEGIN-001 (CHANGED)
            통찰 60 인 상대는 여전히 살펴볼 수 있다
            통찰 90 이면 처음부터 거절되고 사유는 already-known 그대로다
            일부만 열린 상대를 살펴보면 남은 자리가 열린다
            거리 관문은 그대로다 (통찰이 높아도 멀면 out-of-range)
        INTENT-OBSERVE-FORGET-001 (CHANGED)
            통찰 60 에서 살펴본 뒤 되돌리면 `[combatStats]` 만 남는다 — 셋이 아니다
            통찰 0 이면 되돌림이 C014 와 똑같이 셋을 다시 가린다
        RULE-ATTRIBUTE-SET-001 (CHANGED)
            세계가 통찰의 범위를 밝힌다 · 101 과 -1 은 거절된다
        03 BALANCE
            가려질 수 있는 자리마다 문턱이 정확히 하나씩 있다 (두 목록이 정확히 일치)
            차례가 형태 → 관계 → 값이다
            세 문턱이 모두 바꿀 수 있는 범위 안에 있다

    실행 결과
        world 전체 18 파일 365 tests 통과 (`npx vitest run content/proto-adventure/world`)
        `npm run boundary:check` 경계 위반 0
        `npm run catalog:check` 3원소 정합

## NOTES

    ① 판정이 semantic/ 에 있는 이유
       `rules/` 는 "Precondition → Transition → Result" 를 지닌 상태 전이의 자리다.
       RULE-INSIGHT-REVEAL-001 은 Transition 이 없다 — 세계의 사실을 바꾸지 않고
       "지금 이 사람에게 무엇이 보이는가" 를 답할 뿐이다. C014 가 가려짐을 투영에서
       처리한 것과 같은 판단이며 (C014 06 NOTES ④), 그 덕분에 자율 존재의 판단
       (RULE-NPC-DECIDE-001)이 이번에도 한 줄도 바뀌지 않았다.
       Rule 번호를 붙인 것은 03 이 그것을 판정으로 이름 붙였기 때문이고,
       코드에서는 두 함수(`concealedKeys` · `isSeatOpen`)가 그 이름을 나눠 가진다.

    ② 되돌림이 정말로 한 줄도 바뀌지 않았다
       03 이 예측한 그대로다. `ruleObserveForget` 은 장부만 지우고, 통찰은 장부에
       남지 않으므로 되돌린 뒤 남는 자리가 저절로 통찰의 몫이 된다.
       검증 두 개가 이것을 실측한다 — 통찰 60 에서 `[combatStats]` 가 남고,
       통찰 0 에서는 셋이 모두 돌아온다.

    ③ `acquainted` 의 뜻을 바꾼 대가
       이제 `acquainted` 는 장부가 아니라 "가려진 자리가 없다" 다. 그래서 세계 어디에도
       "이 사람이 저 존재를 살펴봤는가" 를 관찰에서 읽는 길이 없다 —
       04 가 그것을 싣지 않기로 했기 때문이다 (열린 경로를 싣지 않는다).
       이 선택의 비용은 되돌림 확인이 화면에서 한 단계 간접적이 된다는 것이고,
       값은 View 가 두 앎을 다르게 그릴 여지가 아예 없다는 것이다.
       투영 안에서는 두 사실이 여전히 갈라져 있다 (`learned` 와 `acquainted`).

    ④ 기본값 0 이 지키는 것
       모든 종류가 0 으로 시작하므로 통찰을 올리기 전의 세계는 C015 와 같다.
       기존 337 tests 중 값을 고친 것은 목록 4건뿐이고, 능력치·피해·관통·흔들림
       검증은 한 줄도 손대지 않았다 — 그것이 이 Cycle 의 Regression 증거다.

    ⑤ GAP 없음
       03 의 ADDED / CHANGED 가 모두 코드에 있고, 임의로 만든 State 나 Rule 은 없다.
       `engine/` 은 한 줄도 열지 않았다.
