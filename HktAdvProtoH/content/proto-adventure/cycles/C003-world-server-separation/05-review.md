# CYCLE C003 — Human Semantic Review

## 검토 대상
    01-cycle.md → 02-intent.md → 03-world-semantic.md → 04-gameview.spec.yaml

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과
    APPROVED

    Reviewer   Human (대화 상에서 구두 승인 — Agent 가 전사)
    Decision   "실제 서버/클라 분리하는 Cycle로 진행해줘"

## 승인과 함께 확정된 것 (Human 선택)
    전송 형태
        Node 프로세스 + WebSocket. 세계는 브라우저 밖에서 자기 시계로 돈다.
        (대안이던 Web Worker 는 선택되지 않았다 — 다중 클라이언트 길을 열어 두기 위해.)

    범위
        다중 클라이언트는 이번 Cycle 에서 다루지 않는다.
        "세계가 내 화면 밖에서 자기 시계로 돌고, 내 입력은 요청이 된다" 까지만 닫는다.
        접속마다 다른 Actor 를 부여하는 관찰자별 투영은 다음 Cycle 의 자리다.

## 검토자가 확인한 경계 판단
    INTENT-OBSERVER-LINK-001(이어짐 상태)을 World State 에 두지 않고 관찰자 쪽 의미로
    규정한 것 — 세계가 누가 보고 있는지에 따라 달라지지 않아야 한다는 판단에 따른다.
    04-gameview.spec.yaml 의 session 절이 `owner: observer` 로 이를 명시한다.
