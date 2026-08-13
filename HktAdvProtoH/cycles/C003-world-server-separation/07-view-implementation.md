# CYCLE C003 — View Implementation

## SPEC CONSUMED
    delivery.mode: pushed          view/net/world-link.ts — 받은 것을 쌓아 두고,
    delivery.latest: last-received app/main.ts 가 매 프레임 link.latest() 를 그린다
    delivery.ordering: as-sent     늦게 온 관찰 결과가 앞선 것을 대체한다
    hud.worldTime                  view/presentation/hud-presentation.ts ('세계 시간', 초 단위)
    session.link                   view/presentation/session-presentation.ts
    session.whileDisconnected
        shows: last-received       link.latest() 를 계속 그린다
        marks: stale               container[data-stale] → 화면 전체 탈색 (index.html)
        requests: rejected         link.send() 가 false 를 돌려주고 아무것도 보내지 않는다
    session.onReconnect            다시 이어지면 최신 관찰 결과가 화면을 대체한다

    entities · interactions · hud 의 나머지는 C002 계약 그대로다 — 해석 코드 변경 없음.

## CLIENT 가 된 app/main.ts
    BEFORE  world 를 만들고, 매 프레임 world.tick(dt) 을 부르고, projectPlayerView() 로
            상태를 읽어 그렸다. 세계가 클라이언트 안에 있었다.
    AFTER   world/ 를 import 하지 않는다. 하는 일은 셋뿐이다.
            1. 받은 관찰 결과를 그린다   2. 입력을 요청으로 보낸다   3. 이어짐을 표시한다

    빌드 결과로 확인 — dist/assets/index-*.js 안에
        RULE-MINE-001 · wanderIndex · perceptionRange · createWorld  모두 0건.
    클라이언트 번들에 세계가 없다. 경계가 규율이 아니라 물리적 사실이 되었다.

## INPUT → ACTION REQUEST
    변경 없음 (같은 ActionRequest). 보내는 방식만 바뀌었다.
        WASD 연속 이동   매 프레임 → 0.1초 간격 (MOVE_REQUEST_INTERVAL)
                         요청이 선을 타므로 60/s 를 보낼 이유가 없다. 키를 떼면 정지 요청 1회.
        E · F · 클릭     그대로. 다만 send() 는 끊겨 있으면 false 를 돌려주고 보내지 않는다.

## CAPABILITY 고도화
    World Link                view/net/world-link.ts
        이어짐 상태 · 재접속(300ms→5s 백오프) · 수신 타임아웃 · 요청 차단.
        소켓을 주입받는다 — 전송 수단 없이 검증할 수 있다.
        browserSocketFactory 가 실제 WebSocket 을 끼운다.
    위치 보간                 view/renderer/renderer.ts
        관찰 결과는 세계 Tick 주기(30Hz)로 띄엄띄엄 온다. 받은 위치로 곧장 튀지 않고
        지수 감쇠로 따라간다(SMOOTHING 18). 카메라와 자취도 보간된 위치를 쓴다.
        순수 표현 능력이며 세계 상태를 만들어내지 않는다 (예측이 아니다).
    HUD 이어짐 표시           view/hud/hud.ts · index.html
        끊김 배너 + 화면 전체 탈색(grayscale). 이어져 있으면 아무것도 표시하지 않는다.
    HUD 값 형식               hud-presentation 의 format — world.time 을 "13s" 로

## 발견하고 고친 것 — 조용히 죽는 이어짐
    소켓이 close 를 알리지 못한 채 죽는 경우(네트워크 단절)에는 close 이벤트가 오지 않아
    끊김을 알 수 없었다. 실제로 브라우저 오프라인 전환에서 재현되었다.
    → 관찰 결과 수신 타임아웃(OBSERVATION_TIMEOUT_MS = 1500)을 두고, 프레임마다
      link.poll(now) 이 이를 검사해 끊긴 것으로 처리하고 재접속을 예약한다.
    INTENT-OBSERVER-LINK-001 의 "끊김을 안다"는 소켓 이벤트만으로는 닫히지 않는다.

## FIXTURE TESTS
    view/tests/world-link.spec.ts                                               8건
        잇는 중 → 이어짐 · 늦게 온 것이 앞선 것을 대체
        끊기면 마지막 세계를 보되 stale · 끊긴 동안 요청 불가
        스스로 재접속하고 최신 세계로 복귀 · 망가진 메시지 무시 · 닫으면 재접속 안 함
        조용히 죽은 이어짐을 수신 타임아웃으로 걷어냄
    view/tests/resolve.spec.ts · motion.spec.ts       C002 그대로 통과 (Regression)

    npm test → 76 passed (world 38 · view 30 · server 8)

## NOTES
    - session 은 GameView Snapshot 에서 오지 않는다. resolvePresentation 은 손대지 않고
      sessionPresentation(link) 을 따로 해석해 hud.render 의 3번째 인자로 넘긴다 —
      World 계약과 관찰자 쪽 상태를 섞지 않기 위해서다.
    - 보간은 표현이지 예측이 아니다. 화면의 위치는 언제나 "받은 위치로 가는 중"이며,
      받지 못한 미래를 만들어내지 않는다 (Client Prediction 은 01-cycle.md EXCLUDED).
