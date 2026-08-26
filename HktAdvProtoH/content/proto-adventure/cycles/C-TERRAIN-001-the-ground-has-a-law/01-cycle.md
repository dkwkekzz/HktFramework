# CYCLE C-TERRAIN-001 — 땅이 법칙을 지닌다

[PASS] Cycle Definition
[PASS] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE
    Frontier             FR-THE-GROUND-HAS-A-LAW
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Target Capability    없음 — 세우는 것은 능력이 아니라 그 능력들이 놓일 땅이다
                         (MW-MACRO-TERRAIN ABSENT · MW-TERRAIN-* 여덟 ABSENT · C022 선례)
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE ·
                         DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION ·
                         DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING
    Constraint Note      LAW-IS-OBSERVABLE 는 UNRESOLVED 로 넘어간다 — 겪는 것은 이
                         Cycle 이 세우지만 **예고**는 다음 후보의 몫이다
                         (FR-THE-LAND-SHOWS-BEFORE-IT-TAKES). 이 Cycle 에서 그 원칙을
                         다 닫으려 하지 않는다

## TYPE
    New Capability

    세계에 **땅**이라는 것이 아직 없다. 자리를 가진 것(광맥)도, 자리로 판정하는 것
    (지키는 자리)도 있지만 둘 다 존재에 붙어 있다. 이 Cycle 이 처음으로 자리를
    **무대 자체**에 붙인다.

## TARGET CAPABILITY
    Terrain — 무대의 자리마다 걸린 법칙과 그것이 몸에서 거두어 가는 것

    Master 의 Capability 하나를 IMPLEMENTED 로 바꾸는 Cycle 이 아니다 (위 MASTER TRACE).
    대지형 MC 아홉이 각자의 `overlay_gap` 으로 가리키는 하나 — "땅이 없다" — 를 연다.

## GOAL
    Player 가 열을 거두는 땅 위에 서 있으면 몸의 값이 계속 줄고,
    그 안의 따뜻한 자리로 걸어 들어가면 멎는다.

    **어디에 서 있는가가 처음으로 결과를 바꾼다.**

## INCLUDED
    땅의 자리          무대가 범위로 나뉘고 각 범위가 자기 법칙을 지닌다.
                       걸리는 것은 기후 이름이 아니라 "무엇을 어떤 조건에서 거두어
                       가는가" 의 정의다 (DC-WORLD-TERRAIN-IS-A-PRINCIPLE)
    지속적인 거둠      그 법칙이 범위 안의 몸에서 무언가를 시간에 따라 거두어 간다.
                       무엇을 거두는가는 03 이 정한다 — 선례는 `cp-run-drain` (dt 기반)
    자연적 예외        법칙이 닿지 않는 자리가 그 안에 있고 그 안에서는 멎는다.
                       사람이 만든 안전이 아니라 땅에 원래 있는 것이다
                       (DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION)
    지금의 관찰        이 몸이 어떤 법칙 위에 있고 무엇이 일어나는 중인지가
                       사유와 함께 실린다. 무엇을 싣는지는 04 가 확정한다
                       (DC-WORLD-OWNS-THE-SURFACE-LIST)
    땅의 그림          법칙이 걸린 범위와 예외 자리의 범위가 화면에서 구분되어 보인다.
                       기반 장치(`SceneGroundZone`)는 ENGINE 레인이 세우고 이 Cycle 은
                       그것을 소비한다 — 소유 분해는 design/Design-Terrain-Visualization.md

## EXCLUDED
    여덟 대지형        법칙 하나 · 예외 하나로 축이 서는지만 본다. 바이옴 아트도 아니다
    지역 간 이동       경계 넘기도 로딩도 아니다 — 무대는 여전히 하나다
    지형이 낳는 자원   여덟 대지형의 자원 24종은 자원 카탈로그 승인이 받는다 (HISTORY Q50(a))
    지니고 나르는 것   FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED 의 몫 — 채우는 것도 나누는 것도 없다
    작용 전의 예고     FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 의 몫. 증거도 퍼지는 무늬도 없다.
                       이 Cycle 은 겪는 것까지만 세운다
    새로운 죽음의 형태 얼어붙은 몸을 위한 별도의 상태도, 즉사도, 되돌릴 수 없는 소멸도
                       세우지 않는다. 생명이 다한 몸이 어떻게 되는가는 이미 세계에 있고
                       (INTENT-DOWNED-001) 땅은 그 끝에 이르는 **새 길**일 뿐이다 —
                       길은 이 Cycle 이 열고 끝의 형태는 손대지 않는다.
                       이 읽기의 승인은 Stage 5 에 묻는다 (02-intent.md REVIEW QUESTION 1)
    주기 · 안전한 길   MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE 는 아직 Target 이 아니다
                       (`part_of.grounded: false`)
    미니맵 · 경고 UI   세계의 사실이 아닌 화면의 친절은 이 트랙이 금지한 방향이다

## RELATED EXISTING CAPABILITY

    재사용 대상 — 이 Cycle 이 다시 만들지 않는 것

        자리를 가진 범위와 "그 안인가" 판정
            world/semantic/relation.ts#GuardedGround · isInsideGuardedGround (C018)
            지금은 존재에 붙어 있다 — 이 Cycle 이 같은 형태를 땅에 붙인다
        상태가 이어지는 동안 계속 줄어드는 형태
            world/simulation/cp-run-drain.ts — dt 기반, 물리 뒤 Tick 자리
        자리를 가진 것이 세계에 있는 형태
            world/semantic/deposit.ts#DepositState — WorldState 의 나란한 목록
        무대의 경계와 그 밖을 막는 판정
            world/semantic/world-state.ts#WORLD_BOUNDS · position.ts#inBounds
            (RULE-MOVE-001 `out-of-bounds`)
        사유 코드를 실어 보내는 관찰 계약
            protocol/ 의 기존 도메인 파일들 — 이 Cycle 은 자기 도메인 파일을 새로 낸다

    영향 가능 대상 — 변경 여부를 03 이 판정한다

        몸의 값이 시간에 따라 줄어드는 다른 자리 (cp-run-drain 과 같은 Tick 창)
        RULE-MOVE-001 — 걸어 들어가고 나오는 것이 이 Cycle 의 유일한 입력이다.
                        새 Action 을 만들지 않는다
        world/semantic/actor.ts — 거두어 갈 것이 새 자리를 요구하면 여기에 는다.
                        WORLD·GROWTH 와 같은 파일이다 — 자기 영역 끝에 추가만 하고
                        기존 줄을 옮기지 않는다 (LANES.md 충돌표)
