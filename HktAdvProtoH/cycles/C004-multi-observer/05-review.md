# CYCLE C004 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 검토자에게 제시된 되돌리기 어려운 결정 4가지
    1. 몸은 관찰자가 들어올 때 생긴다.
       세계가 시작할 때 조종되는 몸은 없다 (기존: player Actor 가 언제나 하나 있었다).
    2. 관찰자가 떠나도 몸은 세계에 남는다.
       무인 상태로 그 자리에 있고, 하던 행동은 끝까지 진행되며, NPC 의 인지 대상이 된다.
       스스로 새 행동은 시작하지 않는다.
       기각된 대안 — 떠나면 몸이 사라진다: 재참여 시 "같은 자리로 돌아온다"가 성립하지 않는다.
    3. 요청에 주체를 적는 자리를 만들지 않는다.
       주체는 요청이 도착한 이어짐에 붙은 관찰자의 몸으로만 정해진다.
       남의 식별을 적어 남의 몸을 움직이는 일이 구조적으로 불가능하다.
    4. 식별자는 관찰자가 스스로 만들어 보관하고 다시 이을 때 같은 것을 밝힌다.
       세계는 그것이 참인지 따지지 않는다 (이번 Cycle 의 "인증" = 식별까지).

    부수 결정
        다른 관찰자의 이름은 투영하지 않는다 — 몸과 함께 보는 사람의 수만 보인다.
        내 몸의 role 은 player-character 로 유지하고 (C001~C003 회귀 안전),
        다른 관찰자의 몸에 other-player-character 를 더한다.

## 결과
    APPROVED
    Return To  없음
    Reason     위 4가지 결정을 포함해 승인.

## 기록 경위
    이 판정은 검토자가 대화에서 직접 선택한 것을 그대로 옮겨 적은 것이다.
    Agent 가 판정하지 않았다.
