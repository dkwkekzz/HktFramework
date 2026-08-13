# CYCLE C005 — Link Telemetry

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review    APPROVED
[PASS] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## TYPE
    Existing Capability Enhancement    이진 상태였던 이어짐을 수치로 연다

## TARGET CAPABILITY
    Observer Link

## GOAL
    관찰자는 자신이 세계와 얼마나 잘 이어져 있는지를 수치로 본다 —
    내가 보낸 것이 세계에 닿아 돌아오는 데 얼마나 걸리는지,
    세계가 보내는 것이 제때 오고 있는지,
    그리고 내가 누구로 어느 몸에 이어져 있는지가 화면에 늘 떠 있다.

## INCLUDED
    표식과 받아들임        관찰자가 보낸 것에 표식을 붙이고, 세계는 어디까지 받아들였는지 알린다
    왕복 시간              내 표식이 세계에 닿아 관찰 결과로 돌아오기까지 걸린 시간
    도착의 흐름            관찰 결과가 초당 몇 개 오는가 · 마지막으로 온 지 얼마나 되었는가
    내가 보내는 양         이어진 뒤 보낸 요청과 표식의 수
    다시 이은 횟수         이어짐이 몇 번 끊겼다 다시 붙었는가
    이어짐의 신원          내 관찰자 식별 · 내 몸 · 붙어 있는 세계 주소
    상시 표시              정상일 때도 보인다 — 지금은 정상이면 아무것도 표시되지 않는다

## EXCLUDED
    Client Prediction / 보정   요청을 미리 반영하고 나중에 맞추는 것              → 다음 Cycle
    지연 보상 / 롤백           측정한 지연으로 판정을 되감는 것                   → 다음 Cycle
    영속(Persistence)          측정값을 저장하는 것 · 세계를 저장하는 것          → 별도 Cycle
    대역폭 · 메시지 크기       주고받은 바이트 양
    세계 내부의 성능           Tick 소요 시간 · 메모리 — 세계의 내부 사정이지
                               관찰자와 세계 사이의 일이 아니다
    다른 관찰자의 통신 상태    남이 얼마나 잘 이어져 있는지 (내 관찰 결과의 일이 아니다)
    이력 · 그래프              지나간 값의 기록과 그림 — 지금 값만 본다
    자동 품질 조절             느리면 알아서 무언가를 줄이는 것
    새로운 게임 행동           이번 Cycle 은 행동을 늘리지 않는다

## RELATED EXISTING CAPABILITY
    Observer Link State (C003)         확장 — 이어짐 · 잇는 중 · 끊김 세 상태에
                                       "얼마나 잘 이어져 있는가" 가 더해진다
    Observer (C004)                    확장 — 세계가 아는 관찰자에게
                                       "이 관찰자에게서 어디까지 받았는가" 가 더해진다
    RULE-WORLD-TICK-001 (C003·C004)    변경 — Transition 0 이 표식도 처리한다
    Observer Projection (C004)         확장 — 받아들인 표식이 관찰 항목에 추가된다
    GameView Specification session 절  확장 — C003 이 만든 관찰자 쪽 계약 자리를 넓힌다
        (C003·C004)
    protocol/transport (C003·C004)     확장 — 표식 봉투가 하나 는다.
                                       판정 결과를 돌려보내지 않는다는 원칙은 그대로다 —
                                       표식은 게임 판정이 아니라 "어디까지 받았다"는 사실이다
    World Authority                    재사용 — 표식도 World Rule 로만 기록된다

    → C001 Stone Mining · C002 Character Action · C003 World Server Separation ·
      C004 Multi Observer 의 플레이는 이번 Cycle 이후에도 그대로 성립해야 한다 (Regression).

## 왜 이 Cycle 이 지금인가 (Human 지정)
    지금 화면은 붙었다/끊겼다만 알린다. 정상일 때는 아무것도 표시되지 않아
    "느려지는 중"과 "멀쩡함"을 구분할 수 없다. 다중 클라이언트가 된 뒤로는
    내가 누구이고 어느 몸인지조차 화면에 없다.

    그리고 이 값들은 다음 Cycle(Client Prediction · 지연 보상)의 전제다 —
    예측이 맞았는지 틀렸는지 보이지 않으면 예측을 만들 수 없다.
    특히 "세계가 내게서 어디까지 받아들였는가"는 예측 보정이 반드시 필요로 하는 값이다.
