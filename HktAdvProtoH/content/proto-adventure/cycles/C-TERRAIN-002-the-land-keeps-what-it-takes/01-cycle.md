# CYCLE C-TERRAIN-002 — 땅이 거둔 것을 간직한다

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] World Implementation
[PASS] View Implementation
[PASS] Verification

STATUS  IN PROGRESS — Human Play 대기 (Gate 14)

> ## 왜 이것인가 — 순환은 생명이 **놓이지 않고 생겨나기** 위한 자리다
>
> 이 Cycle 의 이유는 "빈칸을 채운다" 가 아니다. 팩 기획서가 세계 골격을 한 줄로
> 못 박아 두었고 (`design/Master-World-Beira-Terrain.md` §16), 이 Cycle 은 그 사슬의
> **셋째 고리**다.
>
>     세계압 → Principle Manifestation → 기이한 자연 순환 → 압도적인 지형
>     → 생존 압력 → 생명과 물질의 적응 → 위험과 기적적인 자원 → 자연적 피난처
>     → 사람과 문화 → 관찰과 추론 → 다양한 행동 가능성
>
> 지금 이 세계는 둘째 고리까지 서 있다 (C-TERRAIN-001 — 땅이 원리를 지닌다).
> **셋째가 비어 있으므로 그 아래 전부가 놓이는 수밖에 없다.** 생명도, 자원도,
> 피난처도, 사람도 — 세계를 적는 사람이 좌표에 찍는 것이 된다. 실제로 지금 그렇다:
> 해숨구멍은 `role='respite'` 로 손수 적혀 있고, 광맥은 `{ x: 8, z: -6 }` 에 놓여 있다.
>
> BT §15 가 대지형을 정의하는 아홉 질문에서도 순환은 셋째이고, 넷째(위험)부터
> 일곱째(자원)까지가 전부 "**그 순환이** …" 로 시작한다. `Design-Resource-Catalog-R0.md`
> §4 는 아예 모든 자원이 답해야 할 질문으로 박아 두었다 — "왜 여기에서만 생기는가 →
> 어떤 Principle 때문인가 → **그 상태가 오랜 시간 반복되면 무엇이 만들어지는가**".
> 순환이 없으면 그 질문에 답할 수 있는 자원이 세계에 하나도 없다.
>
> 그러므로 이 Cycle 이 세우는 것은 추위 게이지가 아니다. **어디에 무엇이 있을 이유**다.
> 열이 어디서 거두어지고 어디에 쌓이는지가 정해지면, 그 다음부터 생명과 자원은
> 배치되지 않고 **그 흐름이 만든 자리에서 나온다** — 그것이 이 프로젝트가 일반적인
> MMORPG 와 갈라지는 지점이고 (CLAUDE.md 목표), 이 Cycle 이 그 갈림길의 바닥이다.
>
> **그래서 지금 열이 게임에 아무 영향도 주지 않는 것은 이 Cycle 의 반증이 아니라
> 이 Cycle 의 이유다.** 빙원이 비어 있는 것은 결손이 아니라 **아직 채워지지 않은
> 자리**이며, 흐름 없이 그것을 채우면 채집물을 놓는 일이 된다.

## MASTER TRACE
    Frontier             FR-THE-LAND-KEEPS-WHAT-IT-TAKES
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Target Capability    없음 — 세우는 것은 능력이 아니라 땅의 **시간**이다.
                         MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE 가 설 바닥이지만
                         둘 다 `part_of.grounded: false` 라 Target 이 되지 않는다
                         (frontier/terrain.md Missing / Partial · C-TERRAIN-001 선례)
    Target WorldState    **MW-TERRAIN-CIRCULATION (ABSENT)** — 이 Cycle 이 여는 노드다.
                         함께 움직이는 것 둘: MW-NATURAL-REFUGE (PARTIAL — 예외가 손으로
                         놓인 상수에서 순환의 한 국면이 된다) · MW-SURVIVAL-PRESSURE
                         (PARTIAL — 압력이 상수에서 순환의 결과가 된다).
                         Stage 8 MASTER FEEDBACK 이 이 셋의 `implemented` 를 판정한다.

                         **이 줄은 Master 가 이 Cycle 중에 세워 준 것이다.** 처음 01 을
                         쓸 때 순환 계열은 그래프에 노드가 없었고, 그래서 이 Cycle 은
                         자기 이유를 Constraint 의 PARTIAL 로만 적을 수 있었다.
                         BT §16 사슬이 주입되고(MW-TERRAIN-CIRCULATION →
                         MW-SHAPED-LANDFORM · MW-SURVIVAL-PRESSURE · MW-ADAPTED-LIFE ·
                         MW-TERRAIN-RESOURCE · MW-NATURAL-REFUGE ·
                         MW-NATURAL-SETTLEMENT · MW-CIRCULATION-EVIDENCE)
                         순환이 Source Goal 을 낳게 되면서(HISTORY Q64(b)) 이 Cycle 은
                         비로소 **Goal 경로로 역추적된다**:
                         MG-EXPLORE-BEIRA ← MW-TERRAIN-CIRCULATION ← MW-MACRO-TERRAIN
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE ·
                         DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION ·
                         DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING
    Constraint Note      IS-A-PRINCIPLE 의 PARTIAL 을 이 Cycle 이 닫는다 — 그 Constraint 의
                         requires 는 "어떤 상태를 어떤 조건에서 **반복** 변화시키는지" 인데
                         C-TERRAIN-001 이 세운 것은 반복이 아니라 지속이었다
                         (C-TERRAIN-001 08 MASTER FEEDBACK). 포화와 분출이 그 반복이다.
                         LAW-IS-OBSERVABLE 는 이번에도 UNRESOLVED 로 넘어간다 — 증거가
                         **먼저** 오는 절은 다음 후보(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)의
                         몫이며, 이 Cycle 은 그 예고가 예고할 **거리**를 만든다.
                         CONDITION-OPENS-WITHOUT-RECORDING 은 **몸에 대해서만** 참을 유지한다 —
                         이 Cycle 이 State 를 두는 곳은 몸이 아니라 땅이다 (03 이 판정한다)

## TYPE
    Existing Capability Enhancement

    C-TERRAIN-001 이 세운 Terrain 을 확장한다. 그 Cycle 에서 땅은 **거두기만 하는
    상수**였다 — 거둔 것이 어디로도 가지 않고 사라졌고, 법칙이 멎는 자리는 손으로
    놓여 "왜 하필 거기가 안전한가" 에 세계가 답하지 못했다.

    이 Cycle 이 그 둘을 하나로 잇는다. **거둔 것을 자리가 간직하게 하면 예외는
    저절로 법칙의 결과가 된다.**

## TARGET CAPABILITY
    Terrain — 자리가 거둔 것을 간직하고, 넘치면 도로 뿜는다

    Master 의 Capability 하나를 IMPLEMENTED 로 바꾸는 Cycle 이 아니다 (위 MASTER TRACE).
    닫는 것은 BT §15 가 대지형을 정의하는 다섯 항 중 **셋째(대지 순환)** 이며,
    C-TERRAIN-001 이 그것을 건너뛰고 원리에서 위험·예외로 갔다.

## GOAL
    Player 가 빙원의 한 자리에 머물러 자기 열을 그 땅에 채워 넣으면
    그 자리가 넘쳐 **분출구가 되고**, 그 사이 먼저 열려 있던 자리는 닫힌다.

    **어디에 서 있었는가가 다음에 어디가 안전한지를 바꾼다.**

## INCLUDED
    보존               법칙이 몸에서 거두어 간 만큼이 사라지지 않고 **그 자리에 쌓인다**.
                       어느 자리가 받는지는 세계가 정한다 (03 이 판정한다 — 지금 겹친
                       자리가 여럿이면 하나만 거두므로 받는 자리도 하나다)
    포화와 분출        쌓인 것이 임계를 넘으면 그 자리가 분출한다. 분출하는 동안
                       **그 자리에서 그 법칙이 멎고**, 분출은 쌓인 것을 소모한다.
                       다 소모하면 도로 거두기 시작한다 — 이것이 반복이다
                       (DC-WORLD-TERRAIN-IS-A-PRINCIPLE 의 requires)
    돌려줌             분출이 내보내는 것을 그 자리 안의 몸이 받는다. 받은 만큼 쌓인
                       것이 준다. 아무도 받지 않으면 그만큼 흩어진다 — 어느 쪽이든
                       나간 만큼만 준다. **이것이 없으면 보존은 거두는 쪽 반쪽만
                       참이고, 몸에는 되채울 길이 영영 없다** (C-TERRAIN-001 은 열이
                       한 점도 돌아오지 않는 세계를 남겼다). 승인은 Stage 5 에 묻는다
                       (02-intent.md REVIEW QUESTION 1)
    예외가 낳아진다    손으로 놓인 `respite` 자리를 지운다. 지금 열려 있는 자리는
                       **분출 중인 맥**이며, 오늘의 해숨구멍은 세계가 시작할 때 이미
                       포화되어 있던 맥이다 (DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION 을
                       형태로 닫는다 — 영구히 안전한 자리를 **적을 방법이 없어진다**)
    자리의 관찰        자리마다 지금 얼마나 찼는지와 뿜는 중인지가 관찰에 실린다.
                       무엇을 어떤 형태로 싣는지는 04 가 확정한다
                       (DC-WORLD-OWNS-THE-SURFACE-LIST)

## EXCLUDED
    작용 전의 예고     FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 의 몫. 서리 무늬도, 작용
                       이전의 증거도, 남은 시간의 표시도 세우지 않는다. 이 Cycle 은
                       **지금 상태**까지만 싣는다 — 앞으로 어떻게 될지는 싣지 않는다
    자리 사이의 흐름   쌓인 것이 이웃 맥으로 옮겨 가지 않는다. 흐름 벡터도, 확산도
                       없다. 열은 몸과 자리 사이에서만 오간다
    거두는 속도의 변화 포화 상태가 거두는 **속도**를 바꾸지 않는다 (BT §5.2 의 굵기·
                       지하 흐름). 속도가 변하는 것은 예고와 한 몸이라 다음 후보가 받는다
                       (C-TERRAIN-001 05-review.md 승인 ③ 이 이미 그렇게 갈랐다)
    태양심 · 채굴      쌓인 열을 캐어 가는 것은 자원 카탈로그의 몫이다 (HISTORY Q50(a)).
                       BT §5.7 일곱째 줄이 이 Cycle 위에 서지만 이 Cycle 이 아니다
    두 번째 법칙       법칙은 여전히 `heat-binding` 하나다. 여덟 대지형도 아니다
    주기 · 안전한 길   MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE 는 아직 Target 이 아니다
                       (`part_of.grounded: false`). 이 Cycle 은 그것들이 **셀 주기**를
                       세울 뿐 능력을 세우지 않는다
    지니고 나르는 것   FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED 의 몫. 분출에서 받는 것은
                       몸이지 그릇이 아니다 — 담아서 나가는 것은 없다
    새로운 죽음의 형태 C-TERRAIN-001 과 같다. 끝의 형태는 이미 세계에 있고
                       (INTENT-DOWNED-001) 이 Cycle 은 그 끝에 이르는 길을 **되돌리는**
                       쪽만 더한다
    자율 존재의 관여   빙원에 들어가는 자율 존재를 두지 않는다. 배치의 결과이지
                       규칙의 예외가 아니라는 판단은 C-TERRAIN-001 과 같다

## RELATED EXISTING CAPABILITY

    재사용 대상 — 이 Cycle 이 다시 만들지 않는 것

        자리와 그 안인가의 판정
            world/semantic/terrain.ts#GroundZone · isInsideGroundZone (C-TERRAIN-001)
        법칙의 카탈로그 — 조건과 결과로 적힌 정의
            world/semantic/terrain.ts#GROUND_LAWS · GroundLawDefinition
            임계·뿜는 속도가 늘어나는 자리가 여기다. 규칙은 열리지 않는다
        거두는 규칙 — dt 로 몸에서 뺀다
            world/simulation/ground-law-apply.ts#ruleGroundLawApply
            **보존은 뺀 만큼 자리에 더하는 것이다** — 이 함수가 CHANGED 의 중심이다
        자리가 State 라는 것
            world/semantic/world-state.ts#WorldState.groundZones
            C-TERRAIN-001 이 "예외가 사라질 수 있다는 것이 이 세계의 원칙" 이라며
            상수가 아니라 State 로 두었다. 그 예비가 이 Cycle 에서 쓰인다
        자리가 관찰에 실리는 형태
            protocol/gameview-terrain.ts#GroundZoneView · GroundSelfView
        자리를 그리는 결정과 기반 장치
            view/terrain-presentation.ts#groundZonePlan ·
            engine/view-kernel 의 SceneGroundZone (`intensity` 자리가 이미 있다)
        몸의 값이 시간에 따라 변하는 Tick 자리
            world/index.ts 의 SYSTEMS — ruleGroundLawApply 가 이미 그 순서에 있다

    영향 가능 대상 — 변경 여부를 03 이 판정한다

        world/semantic/terrain.ts#GroundZoneRole · isSheltered · activeGroundLaws
            `respite` 가 놓이는 것에서 **일어나는 것**으로 바뀌면 이 셋이 함께 바뀐다
        world/semantic/world-state.ts#GROUND_ZONES · STATE_VERSION
            자리의 형태가 바뀌면 스냅샷 형태가 바뀐다 — 버전을 올릴 책임이 이 Cycle 에 있다
        protocol/gameview-terrain.ts#GroundZoneView.role
            `role` 이 놓인 것이 아니라 지금의 상태가 되면 이 코드의 뜻이 바뀐다
        view/terrain-presentation.ts
            멎는 자리의 색을 `role` 로 고르고 있다 — 위가 바뀌면 함께 바뀐다
        world/tests/terrain.spec.ts · view/tests/terrain.spec.ts
            C-TERRAIN-001 의 검사들이 회귀 기반이다 (verification.md REGRESSION)
