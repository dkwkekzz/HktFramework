# C024 — World Implementation

입력은 `03-world-semantic.md` 하나다. 코드가 그 이름과 의미를 그대로 따른다.

## IMPLEMENTED

    world/semantic/combat.ts
        SkillDefinition.swingArc · swingReach · swingTipRadius   (ADDED)
            시간 축 둘(swingBegin · swingEnd) 옆에 공간 축 셋이 선다.
            C019 가 만든 자리에 나란히 놓았다 — 같은 종류의 값이기 때문이다

        DEFAULT_SWING_ARC · DEFAULT_SWING_REACH · DEFAULT_SWING_TIP_RADIUS   (ADDED)
            150° · 1.3 · 0.7 — 지금까지 세계가 쓰던 값 그대로다.
            기본 기술과 오라 기술이 이것을 쓴다

        skillShape(kind) → SkillShape                          RULE-SKILL-SHAPE-001
            정의가 지닌 셋을 그대로 돌려준다. **기술 이름을 묻는 분기가 없다**

        engagementReachViolations(range) → SkillKind[]          RULE-ENGAGEMENT-REACHES-001
            `Reach − Tip ≤ range ≤ Reach + Tip` 을 어긴 기술들을 돌려준다.
            빈 배열이 Holds 다. 값이 바뀔 때 깨지는 것이 목적이므로 판정이 아니라
            **어긴 것을 짚어 내는** 형태로 두었다

    world/semantic/collision.ts
        actionCollider() 가 모양을 `skillShape()` 에서 읽는다   RULE-ACTION-COLLIDER-001 (CHANGED)
            기반 솔버(`arcSweepCollider`)로 넘기는 값의 출처만 바뀌었다.
            호출 형태도 구간 정합도 그대로다

## 폐지한 것

    SWING_ARC              전역 상수 — 기술이 무엇이든 150°
    SWING_BLADE_RADIUS     전역 상수 — 기술이 무엇이든 0.7
    swingReach(attackRange) 파생 함수 — 닿는 길이를 **몸**에서 끌어왔다.
                           이것이 "어떤 기술도 다른 기술보다 멀리 닿지 못한다" 의 원인이었다

    대체가 아니라 폐지다. 셋 다 이름을 남기지 않았고, 같은 뜻의 값은 기술 정의에만 있다.
    전역 상수를 남겨 두면 두 개의 진실이 생긴다.

## 값

    | 기술 | 훑는 각 | 닿는 길이 | 끝의 굵기 |
    |---|---|---|---|
    | attack       | 150° | 1.3 | 0.7  |
    | aura-strike  | 150° | 1.3 | 0.7  |
    | heavy-attack |  40° | 2.2 | 0.55 |

    앞의 둘은 한 톨도 바뀌지 않았다. 근거는 `03-world-semantic.md` BALANCE ①~⑥.

## AFFECTED UPDATED

    world/semantic/character-catalog.ts
        `attackRange` → `engagementRange` (뜻이 좁아졌으므로 이름이 따라간다)
        값은 2.0 그대로다. 이 값이 답하는 질문이 둘에서 하나로 줄었다 —
        **스스로 판단하는 존재가 얼마나 다가가는가**. 칼끝이 닿는 길이는 이제 기술의 것이다

    world/semantic/actor.ts · spawn.ts
        같은 이름으로 따라간다. 스폰 경로는 그대로다

    world/simulation/npc-decide.ts
        `actor.engagementRange` 를 읽는다. **판단 구조는 한 글자도 바뀌지 않았다** —
        다가가는 거리도 고르는 기준("지금 치를 수 있는가")도 그대로다.
        다가간 자리에서 어느 기술이든 닿는다는 보장은 RULE-ENGAGEMENT-REACHES-001 로 옮겼다.
        2.0 이 세 기술 모두의 도달 구간 안에 있으므로 **자율 존재의 행동은 한 Tick도
        달라지지 않는다** (테스트가 확인한다)

    tools/catalog/print.ts
        표기 한 줄 — `사거리` → `교전`. 이름이 바뀌었으므로 읽는 쪽도 따라간다

## PROJECTION

    protocol/gameview.ts
        SkillProfileView 에 swingArc · swingReach · swingTipRadius 가 는다 (ADDED)

    world/projection/observer-view.ts
        세 기술의 `profile` 이 각자의 모양을 싣는다. 셋 다 같은 자리, 같은 형태다 —
        기술마다 다른 경로를 만들지 않았다

    **새 자리는 만들지 않았다.** `swing`(끝점 자리·반경·활성·닿은 목록)은 C006 이 만든
    그대로이며, 그 값이 이제 기술마다 다르게 나올 뿐이다 (04 delta.changed).

## TESTS

    world/tests/skill-shape.spec.ts (신규 · 16건)

        RULE-SKILL-SHAPE-001
            세 기술 모두 모양을 지닌다
            기본 기술과 오라 기술의 모양이 같다 (C012 의 뜻이 새 값에도 선다)
            큰 기술이 더 좁고 더 멀다 — 값이 실제로 갈린다
            기본 기술의 모양이 지금까지의 값 그대로다 (150° · 1.3 · 0.7)

        RULE-ACTION-COLLIDER-001 — **판별 자리 넷** (03 BALANCE ③④)
            옆 (90° · 1.8)        기본은 닿고 큰 기술은 닿지 않는다
            정면 멀리 (3.1)       큰 기술은 닿고 기본은 닿지 않는다
            정면 가까이 (1.8)      둘 다 닿는다 — 지금까지 맞던 것이 계속 맞는다
            등 뒤 (−1.8)          어느 기술로도 닿지 않는다 (C006 의 뜻 그대로)
            휘두르는 중 관찰에 그 기술의 굵기가 실린다

        RULE-ENGAGEMENT-REACHES-001
            등록된 두 종류와 폴백 모두 조건을 만족한다
            구간 밖의 값은 어긴 기술을 짚어 낸다

        INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001
            **큰 기술의 각·길이를 기본 기술 값으로 되돌리면 옆에 선 상대에게 닿는다.**
            규칙 코드를 한 줄도 고치지 않고 값 둘만 바꾼 것이며, 되돌리면 다시 닿지 않는다.
            이것이 "모양은 값이지 분기가 아니다" 의 실측이다

        INTENT-SHAPE-IS-OBSERVABLE-001
            세 기술의 profile 에 모양 셋이 실린다
            세 기술 모두 플레이어가 부를 수 있는 자리로 실린다 (Human 지시 — 05-review.md)

        INTENT-SHAPE-DOES-NOT-TOUCH-THE-FORMULA-001
            정면 가까이의 피해가 C015 까지의 값 그대로다

    전체     960 통과 (이전 944 + 신규 16)
    타입     `npx tsc --noEmit` 통과
    카탈로그  `npm run catalog:check` — 3원소 정합
    경계     `npm test` 가 boundary:check 를 앞세운다 — engine 편집 0

## NOTES

### 기존 테스트가 하나도 깨지지 않았다

    새 테스트를 넣기 전, 구현만 마친 상태에서 944건 중 **깨진 것은 하나뿐**이었고
    그것은 `profile` 전체를 값으로 비교하는 검사(combat.spec.ts)였다 — 새 값 셋이
    늘어난 것이 원인이며 동작이 아니다.

    **동작 테스트가 하나도 깨지지 않았다는 것이 값 보존의 실측이다.** 기본 기술과
    오라 기술의 모양이 그대로이고, 큰 기술의 정면 단일 대상 접촉도 그대로이기 때문이다.

### 기반은 한 글자도 고치지 않았다

    `engine/physics/sweep.ts` 의 `ArcSweepSpec` 이 이미 `arc` · `tipRadius` · `reach` 를
    호출마다 받는다. 팩이 넘기는 값의 출처만 바뀌었다 —
    이것이 이 Cycle 이 새 전달 형태를 세우지 않고 파라미터로 풀 수 있었던 이유다
    (DC-SKILL-COMBINE-BEFORE-NEW-FORM §29-2).

### 검증 각본이 한 걸음을 안고 간다

    이 세계에서 몸의 방향을 정하는 유일한 수단은 **걷는 것**이다
    (RULE-BODY-FACING-001). 그래서 +x 를 향하게 하면 한 걸음(0.2)이 따라온다.
    그 걸음을 두 번째 이동으로 되돌리려 하면 **몸이 그쪽으로 돌아 버린다** —
    처음 쓴 각본이 그랬고, 정면과 등 뒤가 뒤집혀 나왔다.

    되돌리지 않고 **조준을 마친 자리를 원점으로 삼는 좌표계**로 판별 자리를 잡았다
    (`aimedOrigin()`). 세계를 약하게 만든 것이 아니라, 방향을 정하는 것이 곧 움직이는
    것이라는 이 세계의 성질을 각본이 드러내 적은 것이다.

### 남은 것 — Stage 7 이 진다

    모양은 세계에 섰고 관찰에도 실린다. 그러나 **화면에는 아직 나타나지 않는다** —
    휘두름의 끝점은 충돌체 관찰(C)을 켰을 때만 그려지고, 셋을 나란히 놓고 고르는
    자리도 없다. 04 의 VIEW NOTE ①②③ 과 05 의 Human 지시가 그것을 요구한다.
