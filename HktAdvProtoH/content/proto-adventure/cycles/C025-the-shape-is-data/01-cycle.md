# CYCLE C025 — The Shape Is Data

[PASS] Cycle Definition           (기존 노드의 확장 · 모양 축 하나 · 값은 Stage 3)
[PASS] Intent                     (모양은 기술의 값 · 닿는 길이가 몸에서 갈린다 · 공식 불변)
[PASS] World Semantic             (모양 셋이 정의로 · 교전 거리 정합 규칙 · 큰 기술만 움직인다 · 40°·2.2·0.55)
[PASS] GameView Specification     (새 자리 없음 · profile 에 셋 · swing 은 이미 실린다 · HUD NONE)
[PASS] Human Semantic Review      (APPROVED — 판단 3건 이의 없음 · Human 지시 3건은 Stage 7 이 진다)
[PASS] World Implementation       (960 tests · 전역 상수 셋 폐지 · 판별 자리 넷 실측 · 기반 편집 0)
[PASS] View Implementation        (973 tests · 칼끝이 평시에 보인다 · 기술 셋을 견주는 줄 · 이름 목록 0)
[PASS] Verification               (실측 완료 · Human Play 확인만 남았다)

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-THE-SHAPE-IS-DATA — 휘두름의 모양이 값이 된다
                        (`master/frontier.md` 후보 8 · 레인 B)

                        **`SELECTED` 칸에 적힌 것이 아니다.** 그 칸은 레인 A 의
                        C022(자리가 유한해진다)를 가리키며 Human Play 확인을 기다린다.
                        같은 파일의 "병렬 배치 — 두 세션으로 나눌 때" 가 `레인 A 하나 ·
                        레인 B 하나` 를 가장 안전한 배치로 적었고, Human 이 그 배치대로
                        **레인 B 의 후보 8** 을 이 세션에 지목했다 (2026-08-21).
                        후보 8 의 `의존` 칸은 `없다` 이며 아이템 축과 겹치지 않는다.

                        Cycle Agent 는 `master/` 를 편집하지 않으므로 `SELECTED` 칸은
                        그대로 두었다. 병렬 선택이 그 칸에 어떻게 적혀야 하는지는
                        `08-verification.md` 의 MASTER FEEDBACK 으로 보고한다.

〔번호 이동 — C023 → C024 → C025 · 두 번 옮겼다〕
    이 Cycle 은 `C023` 으로 정의되었다. **두 번 다 레인 A 가 같은 번호로 먼저 main 에
    들어왔다.**

        C023   레인 A 의 `C023-what-you-wear-changes-you` 와 겹쳤다  → C024 로 옮김
        C024   레인 A 의 `C024-one-slot-one-item` 과 겹쳤다          → C025 로 옮김

    번호만 바뀌었고 이 Cycle 이 담는 의미는 한 글자도 달라지지 않았다.

    **08 MASTER FEEDBACK ③④ 가 예고한 결손이 그대로 두 번 더 일어난 것이다** —
    `SELECTED` 칸이 병렬 레인을 담지 못하고, 레인이 둘일 때 번호를 먼저 잡는 규칙이 없었다.
    C022 가 두 번 옮긴 것까지 합치면 **네 번째**다.

    두 번째 충돌 뒤 레인 A 가 규칙을 세웠다 — `frontier.md` 의 "병렬 배치" 절에
    **`Cycle 번호를 먼저 예약한다`** 가 들어갔다 (Stage 1 을 쓰기 전에 디렉터리와 제목
    줄만 만들어 push 한다). 이 Cycle 은 그것이 서기 전에 출발해 두 번 옮겼다.
    보고는 그 자리에 그대로 두고, 실제로 일어난 것과 규칙이 선 것을 08 에 덧붙인다.

    Source Goal         MG-EXPLORE-BEIRA
                        베이라를 더 깊이 감당한다 — 지금 닿지 못하는 곳에 닿는다

    Source Possibility  MP-OUTGROW-THE-OPPONENT 외 —
                        MC-COMBAT-STRIKE 를 요구하는 전투 갈래 **전부**가 이 노드를
                        지난다. 이 Cycle 은 어느 한 갈래를 전진시키는 것이 아니라
                        그 갈래들이 공유하는 바닥을 넓힌다 (Frontier 7 조건 2)

    Target Capability   **MC-COMBAT-STRIKE 의 확장** (overlay: IMPLEMENTED)
                        새 Capability 노드를 세우지 않는다. 접촉(CONTACT)은 이미 찬
                        칸이며, 이 Cycle 은 그 칸의 내부를 넓힌다.
                        닫는 것은 그 노드에 걸린 판정 하나다 —
                        `DC-SKILL-IS-COMBINATION-NOT-NAME: UNRESOLVED`
                        (휘두름의 모양이 아직 규칙 코드에 있다)

    Reused Capability   MC-BODY-FACING          (overlay: IMPLEMENTED — C006)
                        MC-GUARD                (overlay: IMPLEMENTED — C011)
                        행동 얼개                (C002 · C019 — 시간 · 구간 · 진행도)
                        기술 정의소              (C010 · C012 · C019 — 값이 정의에 있다)

    Active Constraints  DC-SKILL-IS-COMBINATION-NOT-NAME
                        DC-SKILL-COMBINE-BEFORE-NEW-FORM
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-PLAYER-CAUSALITY
                        DC-WORLD-OWNS-THE-SURFACE-LIST                (GLOBAL)
                        DC-SKILL-DELIVERY-IS-NOT-EFFECT 는 이 Cycle 의 대상이 아니다 —
                            전달 형태를 하나도 늘리지 않는다 (EXCLUDED)
                        DC-ITEM-* 전부 무관 — 아이템에 한 글자도 닿지 않는다 (레인 A)

    Constraint Note

        DC-SKILL-IS-COMBINATION-NOT-NAME
            **이 Cycle 의 성패를 가르는 판정이 여기다.** 모양을 정의로 내리는 것이
            이 원칙이 요구하는 형태 그 자체다 (requires 세 항: 조합으로 표현된다 ·
            새 기술은 정의를 더하는 것으로 끝난다 · 규칙은 이름이 아니라 정의가 답한
            것으로 판정한다). 검증의 형태도 여기서 나온다 — **모양 값을 바꿔도 규칙
            코드가 한 줄도 열리지 않아야 하고, 판정 어디에도 기술 이름 분기가 남아서는
            안 된다.** 지금 `semantic/collision.ts` 의 `SWING_ARC` ·
            `SWING_BLADE_RADIUS` 가 전역 상수이고 닿는 길이는 `actor.attackRange` 에서
            온다 — 셋 다 기술이 무엇이든 같다.

        DC-SKILL-COMBINE-BEFORE-NEW-FORM
            **새 형태를 세우지 않는다.** 요구를 분해하면 필요한 것은 값 몇 칸이다 —
            호의 각 · 끝점 반경 · 닿는 길이. 기반 솔버(`engine/physics/sweep.ts` 의
            `ArcSweepSpec`)가 이미 그 셋을 호출마다 받는다. 즉 파라미터로 표현되므로
            §29-1·§29-2 의 문턱을 넘지 않으며, 새 형태를 세우는 것은 **금지 쪽**이다.
            C019 가 전역 상수 `SWING_BEGIN` 을 기술 정의로 내려 층 하나를 값 한 칸으로
            대신한 것이 이 Cycle 과 **똑같은 형태의 선례**다 (§29-2 의 정석 사례).

        DC-COMBAT-ONE-FORMULA
            **피해 공식에 한 글자도 닿지 않는다.** 모양은 누가 닿는가를 정할 뿐,
            닿은 뒤에 얼마가 들어가는가를 정하지 않는다. 넓은 기술이 여럿에게 닿아
            총량이 커지는 것은 공식의 변화가 아니라 접촉 건수의 변화다 — 각 접촉은
            지금과 완전히 같은 한 공식을 지난다.

        DC-COMBAT-PLAYER-CAUSALITY
            모양은 결정적이다 — 같은 자리 · 같은 방향 · 같은 기술이면 언제나 같은 접촉
            집합이 나온다. 난수가 들어갈 자리가 없다. `explainable_result` 쪽은
            아래 DC-WORLD-OWNS-THE-SURFACE-LIST 와 한 몸이다: **왜 저 몸에는 닿고 이
            몸에는 안 닿았는지가 읽혀야 한다.**

        DC-WORLD-OWNS-THE-SURFACE-LIST
            기술의 모양은 세계가 소유하고 관찰에 실어 보낸다. View 가 기술 이름으로
            자기 표를 만들어 부채꼴을 그리지 않는다. C019 가 구간 경계를
            `SkillProfileView` 에 실어 같은 형태를 이미 세웠다 — 모양도 그 자리에
            얹힌다. **어디에 무엇을 싣는지는 Stage 4 가 소유한다.**

## SCOPE NOTE — 코드를 대조해 확정한 것

### ① 없는 것은 모양 하나뿐이다 — 나머지는 이미 서 있다

    `world/semantic/collision.ts` · `world/simulation/swing-strike.ts` 를 대조했다.

        판정 자리          이미 한 곳이다. 휘두른 끝이 훑는 호 안의 몸만 맞는다
        여럿 타격          이미 된다. `struckActorIds` 로 한 휘두름에 몸마다 한 번씩,
                          닿은 몸 전부가 대상이다 — 코드는 수를 제한하지 않는다
        기술별 값          이미 있다. `SKILL_DEFINITIONS` 가 위력 · 길이 · 기력 수지 ·
                          방식 · 구간 경계를 지닌다 (C010 · C012 · C019)
        기반 솔버          이미 받는다. `arcSweepCollider` 가 `arc` · `tipRadius` ·
                          `reach` 를 호출마다 받는다 — 기반을 고칠 일이 없다

    **없는 것은 그 셋을 넘기는 쪽이다.** 지금은 팩이 전역 상수와 Actor 값을 넘긴다.

        SWING_ARC             150° — 기술이 무엇이든 같다        (collision.ts 전역 상수)
        SWING_BLADE_RADIUS    0.7  — 기술이 무엇이든 같다        (collision.ts 전역 상수)
        swingReach()          actor.attackRange − 0.7            (몸이 정한다, 기술이 아니라)

    그래서 이 Cycle 이 여는 것은 **모양 축 하나**다. 이미 여럿을 치는 세계에서,
    무엇이 여럿에 닿는지가 비로소 기술의 선택이 된다.

### ② 닿는 길이가 몸에서 오는 것은 이 Cycle 이 다루는 결손이다

    `swingReach(actor.attackRange)` 는 **종류가 정한 값**이다
    (`semantic/character-catalog.ts` — 관찰자도 자율 존재도 2.0). 기술이 아니라 몸이
    닿는 거리를 정하고 있으므로, 찌르기가 베기보다 멀리 닿을 방법이 세계에 없다.

    그러나 `attackRange` 를 없애지는 않는다 — 자율 존재가 **얼마나 다가갈지**를 그 값으로
    정하고 있다 (`simulation/npc-decide.ts`). 몸의 교전 거리와 기술의 닿는 길이가
    **같은 값이어야 할 이유가 없다**는 것이 이 Cycle 이 여는 구분이며,
    **둘을 어떻게 잇는지는 Stage 3 이 소유한다.**

### ③ 오라 기술은 기본 기술과 모양도 같아야 한다

    C012 가 `aura-strike` 를 기본 기술과 **모든 값이 같게** 두었고, 그 뜻이 정의 주석에
    남아 있다 — "값이 다르면 결과 차이가 방식 때문인지 값 때문인지 갈리지 않는다."
    모양은 새로 생기는 값이므로 그 원칙이 그대로 적용된다.

    그러므로 이 Cycle 이 **다르게** 만드는 것은 기본 기술과 큰 기술 둘이다.
    셋째 기술은 방식만 다른 대조군으로 남는다 — 그것이 C012 가 산 것이다.

### ④ 기존 실측을 보존할 것인가 바꿀 것인가 — Stage 3 의 결정이다

    모양이 갈리면 **어느 한쪽은 지금과 다르게 닿는다.** C007 · C010 · C012 · C015 ·
    C019 의 실측 각본이 전부 이 궤적 위에서 잡혔으므로, 어느 기술의 모양을 움직이는지가
    회귀 범위를 정한다.

    Stage 1 이 못박는 것은 결과 하나다 — **값이 다른 기술 둘이 같은 자리에 선 상대에
    대해 실제로 다른 접촉 집합을 낸다.** 어느 쪽을 기준선으로 두고 어느 쪽을 움직이는지,
    그리고 바뀌는 실측을 어떻게 다시 잡는지는 Stage 3 이 정한다.
    C019 가 큰 기술만 움직이고 기본 기술을 한 톨도 건드리지 않은 것이 유력한 선례다.

### ⑤ 여럿을 함께 치는 것은 목적이 아니라 결과다

    Frontier 가 직접 못박은 줄이다. 이 Cycle 은 "광역 공격" 을 세우지 않는다.
    넓은 모양이 결과적으로 옆의 둘에 닿을 뿐이고, 좁은 모양은 정면 하나에만 닿는다.
    **대상 수를 세는 규칙도, 여럿에게 나눠 주는 감쇄도 만들지 않는다** —
    그런 것을 만들면 그것이 곧 새 전달 형태다 (DC-SKILL-COMBINE-BEFORE-NEW-FORM).

## TYPE

    Existing Capability Enhancement

    C019 가 시간 축(구간 경계)을 전역 상수에서 기술 정의로 내렸다. 이 Cycle 은 같은 일을
    **공간 축**에 한다. 새로 생기는 개념은 하나다 — 기술마다 닿는 모양이 다르고,
    그 모양이 코드가 아니라 값이라는 것.

## TARGET CAPABILITY

    휘두름의 모양 (Swing Shape)
        기술이 닿는 모양 — 어디를 · 얼마나 넓게 · 얼마나 멀리 — 이 그 기술의 정의에 있고,
        접촉 판정이 그것을 읽는다. Master Capability 노드는 아니다 (MASTER TRACE 참조) —
        MC-COMBAT-STRIKE 의 내부다.

## GOAL

    플레이어가 좁고 멀리 닿는 기술과 넓게 쓸어 내는 기술을 골라 쓰면, 같은 자리에 선
    상대가 기술에 따라 맞기도 하고 안 맞기도 하는 것을 보고 — 어느 기술을 걸지가
    자리에 따라 달라진다.

## INCLUDED

    모양이 정의에 담긴다        기술 정의가 자기 모양을 지닌다 — 훑는 각 · 끝점의 굵기 ·
                              닿는 길이. **축의 개수와 이름, 그리고 값은 Stage 3 이
                              소유한다.** 기반 솔버가 이미 받는 셋이 유력하나 Stage 1 이
                              정하지 않는다 (SCOPE NOTE ①)

    판정이 그 모양을 읽는다     충돌체를 만드는 자리가 전역 상수와 몸의 값 대신 그 기술의
                              정의를 읽는다. **규칙 어디에도 기술 이름 분기가 없다**
                              (DC-SKILL-IS-COMBINATION-NOT-NAME). 새 판정 경로를 만들지
                              않는다 — 지금 있는 한 자리가 읽는 값이 바뀔 뿐이다

    값이 다른 기술 둘           기본 기술과 큰 기술이 실제로 다른 모양을 갖는다. 오라
                              기술은 기본 기술과 같은 모양이다 (SCOPE NOTE ③).
                              **새 기술 종류를 만들지 않는다**

    다르게 닿는다는 사실        같은 자리에 선 상대에 대해 두 기술이 다른 접촉 집합을
                              낸다. 하나는 닿고 하나는 안 닿는 자리가 실제로 존재한다.
                              이것이 이 Cycle 의 플레이 결과다

    모양의 관찰                기술의 모양이 관찰에 실려 **걸기 전에** 읽힌다.
                              View 가 기술 이름으로 자기 표를 만들지 않는다
                              (DC-WORLD-OWNS-THE-SURFACE-LIST).
                              어디에 어떤 형태로 싣는지는 Stage 4

    닿음의 설명                왜 저 몸에는 닿고 이 몸에는 안 닿았는지가 읽힌다.
                              이미 있는 관찰 계약 위에 선다 — 새 기계를 만들지 않는다.
                              형태는 Stage 3 · Stage 4

## EXCLUDED

    새 전달 형태               투사체 · 장판 · 광선 · 설치 · 소환. HISTORY Q44 가 이후
                              추가 기획으로 미뤘고, 그중 여럿은 세계에 **몸이 아닌
                              존재**가 먼저 서야 한다. 이 Cycle 은 휘두름 하나의
                              모양만 다룬다 (DC-SKILL-COMBINE-BEFORE-NEW-FORM)

    타게팅 방식의 갈래          범위 타격 · 단일 대상 타격 · 유도 · 연쇄. HISTORY Q42 ·
                              Q38 이 같은 문서를 기다린다. 지목(MC-DESIGNATE-TARGET)은
                              C017 이 세운 그대로 쓴다 — 한 글자도 바꾸지 않는다

    광역 규칙                  대상 수 제한 · 여럿에게 나누는 감쇄 · 주 대상과 부수 대상의
                              구분. 여럿에 닿는 것은 모양의 결과이지 규칙이 아니다
                              (SCOPE NOTE ⑤)

    새 기술 종류                기술의 갈래를 늘리지 않는다. 값이 다른 둘이면 이 Cycle 이
                              여는 것을 다 보인다. 새 기술을 더하는 값어치는 그때
                              **정의 한 벌로 끝난다**는 사실이며, 그것은 이 Cycle 이
                              닫은 뒤의 증거다

    피해 공식                  기본 피해 · 공격 기여 · 방어 · 관통 · 치명 · 막기 —
                              한 글자도 닿지 않는다 (DC-COMBAT-ONE-FORMULA)

    구간 경계                  선딜 · 판정 구간 · 후딜은 C019 가 이미 정의로 내렸다.
                              이 Cycle 은 그 값을 재사용하며 바꾸지 않는다

    무기가 모양을 정하는 것      장착이 세계에 없다 (레인 A 후보 2). 모양의 출처는 기술의
                              정의 하나다 — 그것이 나중에 무기에서 오게 되더라도 이
                              Cycle 이 세우는 자리는 그대로 선다

    부위 타격                  어디를 때리는가 (MC-TARGET-SPECIFIC-PART). 모양은 공간의
                              범위이지 몸의 부위가 아니다

    높이 · 3차원 모양           판정은 지면 평면에 투영된 원이다 (C006 이 정한 그대로).
                              위아래로 갈리는 모양을 만들지 않는다

    회피                       모양을 몸으로 피하는 새 행동 (MC-EVADE — R1 §13 이연).
                              지금 있는 이동으로 자리를 옮기는 것은 이미 된다

    모양의 성장                세계 안에서 모양 값을 올리는 경로. 값을 바꾸는 것은
                              디버그 명령의 일이며, 그것을 늘릴지는 이 Cycle 밖이다

    아이템 축 전부              소지 · 자리 · 장착 · 제작 · 세계의 아이템. 레인 A 가
                              소유한다 — 겹치는 파일에서 지키는 규칙은
                              `master/frontier.md` 의 "병렬 배치" 가 소유한다

## RELATED EXISTING CAPABILITY

    휘두름 판정 (C006 · P6)     `world/semantic/collision.ts` 가 충돌체를 만들고
                              `world/simulation/swing-strike.ts` 가 접촉을 판정한다.
                              전역 상수 `SWING_ARC` · `SWING_BLADE_RADIUS` 와
                              `swingReach(attackRange)` 가 여기 있다 —
                              이 Cycle 의 **CHANGED** 자리다

    기술 정의소 (C010 · C012 · C019)  `world/semantic/combat.ts` 의 `SKILL_DEFINITIONS` 가
                              위력 · 길이 · 기력 수지 · 방식 · 구간 경계의 단일 출처다.
                              모양이 여기 는다 — **CHANGED** (항목 추가)

    구간 경계 (C019)           `swingBegin` · `swingEnd` 가 이미 기술에서 온다.
                              모양과 **같은 경계**를 써야 한다 — 칼끝이 활성인 구간이
                              곧 `active` 다. 그 정합은 이미 세워져 있다. **재사용**

    기반 호 스윕 솔버 (P6)      `engine/physics/sweep.ts` 의 `arcSweepCollider` 가
                              `arc` · `tipRadius` · `reach` 를 호출마다 받는다.
                              **기반은 편집하지 않는다** — 팩이 넘기는 값만 바뀐다.
                              **재사용**

    몸이 향한 방향 (C006)       `faceToward` 가 휘두르기 전에 몸을 돌린다. 모양은 그
                              방향을 기준으로 선다. **재사용**

    교전 거리 (C002 · npc-decide)  `actor.attackRange` 로 자율 존재가 얼마나 다가갈지를
                              정한다. 닿는 길이가 기술에서 오면 이 값과의 관계가
                              달라진다 — **AFFECTED** (SCOPE NOTE ②)

    기술 관찰 (C007 · C012 · C019)  `protocol/gameview.ts` 의 `SkillProfileView` 가
                              위력 · 수지 · 방식 · 구간 경계를 걸기 전에 싣는다.
                              모양이 여기 얹힌다 — **CHANGED** (값 추가)

    적대 판정 (C018)           `world/rules/relation.ts` 의 RULE-HARM-GATE-001 이
                              닿은 뒤에 성립을 가른다. 모양이 넓어져 닿는 몸이 늘면
                              성립하지 않는 접촉도 는다 — 그 사유는 이미 관찰에
                              실린다 (`unharmedContacts`). **재사용**이며 바꾸지 않는다

    막기 (C011)                `GUARD_ARC_COS` 로 정면에서 온 타격만 막힌다. 그 판정은
                              **맞는 쪽의 방향**이지 휘두르는 모양이 아니다 —
                              겹치지 않는다. **재사용**

    캔슬 (C019)                선딜 중에 맞으면 기술이 끊긴다. 넓은 모양이 여럿을
                              동시에 끊을 수 있게 되지만 규칙은 그대로다 — **AFFECTED**

    치명 · 관통 · 상성 (C012~C015)  접촉마다 도는 계산이며 모양과 무관하다.
                              접촉 건수가 늘면 계산 횟수가 늘 뿐이다. **재사용**
