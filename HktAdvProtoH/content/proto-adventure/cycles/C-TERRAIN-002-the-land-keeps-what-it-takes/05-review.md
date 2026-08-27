# C-TERRAIN-002 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## REVIEW QUESTION 에 대한 답 (02-intent.md)

    Human 지시: **"전부 Agent 판단대로"**

    1. 뿜는 자리가 몸에 열을 돌려주는가          **예 — 돌려준다**
       INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 이 선다.
       C-TERRAIN-001 의 "한 점도 돌아오지 않는다" 가 이 Cycle 에서 바뀐다 —
       저절로 차오르는 것은 여전히 없고, **그 자리가 지닌 것을 뿜을 때만** 돌아온다.

    2. 손으로 놓인 예외(`respite`)를 지우는가     **예 — 지운다**
       `GroundZoneRole` 이 세계에서 사라진다. 법칙이 멎는 자리는 `phase = 'venting'`
       인 자리뿐이며, 이 세계에서 **영구히 안전한 자리를 적을 방법이 없어진다.**
       되돌리기 쉬운 결정이 아니라는 점을 알고 고른다.

    3. 한 자리에 머무는 평형을 받아들이는가       **예 — 받아들인다**
       보존의 결과이지 버그가 아니다. 대가는 그 몸이 그 자리에 묶이는 것이며,
       세계가 머무르는 몸에게 따로 벌을 주지 않는다.

    4. 흐름이 어디까지인가                       **몸↔땅 까지**
       땅↔땅 확산(구배·장)은 이 Cycle 이 세우지 않는다. `GroundZone.kept` 가 자리마다의
       스칼라이므로 이웃으로 옮기는 규칙을 나중에 더해도 형이 바뀌지 않는다 —
       그 확인을 근거로 미룬다.

## 결과

    APPROVED

    Return To  없음
    Reason     없음 — 03 의 SEMANTIC CLOSURE 가 닫혀 있고, 04 의 VIEW CLOSURE 열셋이
               모두 계약의 항목으로 답해진다. Stage 6 으로 넘어간다.

## 함께 확인한 것

    이 Cycle 이 도는 동안 Master 가 순환 사슬을 그래프에 세웠다 (BT §16 · HISTORY Q69(b)).
    그래서 01-cycle.md 에 `Target WorldState` 가 생겼고, 이 Cycle 은 이제 Goal 경로로
    역추적된다 — `MG-EXPLORE-BEIRA ← MW-TERRAIN-CIRCULATION ← MW-MACRO-TERRAIN`.
    Stage 8 의 MASTER FEEDBACK 은 그 셋의 `implemented` 를 판정한다.
