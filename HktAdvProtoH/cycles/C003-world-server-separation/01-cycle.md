# CYCLE C003 — World Server Separation

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] World Implementation
[PASS] View Implementation
[PASS] Verification (Human Play 확인 대기)

STATUS  IN PROGRESS

## TYPE
    Existing Capability Enhancement    World / View 경계를 실제 실행 경계로 만든다

## TARGET CAPABILITY
    World Authority

## GOAL
    세계는 내 화면 밖에서 자기 시계로 돌아간다 —
    내가 보고 있지 않아도 NPC 는 계속 행동하고,
    내 조작은 세계에 보내는 요청이 되어 세계가 받아들인 뒤에야 화면에 나타나며,
    세계와 이어져 있는지 아닌지를 내가 알 수 있다.

## INCLUDED
    World Clock              세계가 자기 시계로 진행한다 (관찰자의 프레임에 종속되지 않는다)
    World Time               세계가 시작된 뒤 흐른 시간 — 독립성을 관찰하는 수단
    Observation Emission     세계가 자신의 진행에 맞추어 관찰 결과를 내보낸다
    Remote Action Request    조작은 세계로 보내는 요청이 되고, 결과는 다음 관찰 결과로 드러난다
    Observer Link State      이어짐 / 잇는 중 / 끊김 을 관찰자가 안다 (관찰자 쪽 상태)
    Reconnect                끊기면 다시 잇고, 이어지면 최신 세계로 돌아온다

## EXCLUDED
    다중 클라이언트          둘 이상의 관찰자가 같은 세계에 접속하는 것
    관찰자별 투영            접속마다 다른 Actor 를 부여하는 것
    Client Prediction        요청을 화면에서 미리 반영하고 나중에 보정하는 것
    지연 보상 / 롤백         Lag compensation · rewind
    영속(Persistence)        세계 상태를 저장하고 재시작 뒤 복원하는 것
    인증 · 세션 식별         누가 접속했는지 가리는 것
    새로운 게임 행동         이번 Cycle 은 행동을 늘리지 않는다

## RELATED EXISTING CAPABILITY
    World Authority (C001·C002)      재사용 — 판정은 그대로 World Rule 이 한다
    Action Request 수용 (C001)       변경 — 같은 프로세스 호출에서 세계로 보내는 요청이 된다
    Observer Projection (C001·C002)  변경 — 요청받아 만들던 것에서 세계가 내보내는 것으로
    시간 진행 Rule (C001·C002)       변경 — 부르는 주체가 관찰자의 렌더 루프에서 세계 자신으로
        RULE-MOVE-PROGRESS-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001
        판정 내용은 바뀌지 않는다.
    GameView Specification (C002)    확장 — 세계 시간이 관찰 항목에 추가된다

    → C001 Stone Mining 과 C002 Character Action 의 플레이는 이번 Cycle 이후에도
      그대로 성립해야 한다 (Regression).

## 결정된 전송 형태 (Human)
    Node 프로세스 + WebSocket. 세계는 브라우저 밖에서 돈다.
    다중 클라이언트는 이번 Cycle 에서 다루지 않는다 — 이 위에 얹는 다음 Cycle 이다.
