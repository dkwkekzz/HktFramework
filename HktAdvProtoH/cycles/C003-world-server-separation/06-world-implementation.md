# CYCLE C003 — World Implementation

## IMPLEMENTED
    World.Time                     world/semantic/world-state.ts (WorldState.time)
    World.TickInterval             world/semantic/world-state.ts (TICK_INTERVAL = 1/30)
    RULE-WORLD-TICK-001            world/simulation/world-tick.ts
    World Clock (세계 자신의 시계)  world/clock.ts
    World 경계 재정의              world/index.ts
        request(action)            요청이 도착한다 (판정하지 않는다)
        tick(dt)                   RULE-WORLD-TICK-001 — 관찰 결과를 내보낸다
        latestObservation()        마지막 Tick 이 내보낸 바로 그 값 (새로 만들지 않는다)
    World Host                     server/world-host.ts — 세계 하나 + 관찰자 목록 + 시계
    WebSocket 부착                 server/attach.ts
    세계 프로세스 진입점            server/main.ts (`npm run server`)
    개발 서버 부착                 vite.config.ts (`npm run dev` 한 줄 유지)
    전송 경계 타입                 protocol/transport.ts

## REUSED
    C001 · C002 의 모든 Semantic 과 Rule — 게임 행동의 의미는 하나도 바뀌지 않았다.
    world/rules/* · world/semantic/* 는 Rule 판정 코드 변경 없음.

## AFFECTED UPDATED
    world/index.ts
        dispatch(action): ActionResult → request(action): void
        tick(dt): void → tick(dt): WorldTickResult
        projectPlayerView() 공개 경로 제거 — 관찰 결과는 Tick 이 내보낸다
    world/simulation/{move-progress,action-progress,npc-decide}.ts
        코드 변경 없음. 부르는 주체만 RULE-WORLD-TICK-001 이 되었다.
    world/projection/player-view.ts
        hud 에 world.time 추가. specId 가 VIEW-WORLD-SERVER-001 로.
    world/actions/dispatch.ts
        변경 없음 — 이제 RULE-WORLD-TICK-001 의 요청 처리 단계에서 불린다.

## PROJECTION
    hud.world.time    counter — World.Time (04-gameview.spec.yaml hud.worldTime)
    나머지 항목은 C002 와 동일하다.

## 전송 경계 (protocol/transport.ts)
    관찰자 → 세계   { type: 'action', action: ActionRequest }
    세계 → 관찰자   { type: 'observation', snapshot: GameViewSnapshot }

    판정 결과(ActionResult)는 선을 타지 않는다.
    WorldTickResult.results 는 진단·검증용으로만 존재하며 소켓으로 나가지 않는다 —
    요청이 받아들여졌는지는 그 뒤의 관찰 결과로만 드러난다
    (04-gameview.spec.yaml requestResult: from-next-observation).

    알 수 없는 메시지는 무시한다. 세계를 흔들 수 있는 입력은 ActionRequest 하나뿐이다.

## 실행 형태
    개발    npm run dev     Vite dev 서버 프로세스 안에서 세계가 돈다 (vite.config.ts 플러그인)
    빌드    npm run build   클라이언트만 dist/ 로 나온다
    운영    npm run server  Node 프로세스가 세계를 돌리고 dist/ 를 함께 서빙한다

    두 경로 모두 같은 server/world-host.ts 를 쓴다 — 세계를 올리는 방법은 하나다.

## TESTS
    world/tests/world-tick.spec.ts                                              8건
        World.Time 누적 · 관찰자 0명 상태의 진행
        request 만으로는 변하지 않음 · 한 Tick 안의 요청 순서 · 판정이 관찰 결과로 드러남
        latestObservation 이 Tick 이 내보낸 바로 그 값 · 직렬화 가능 · 스냅샷을 고쳐도 세계 불변
    server/tests/world-host.spec.ts                                             8건
        붙는 즉시 현재 세계 수신 · Tick 마다 모든 관찰자에게 전달
        관찰자가 떨어져도 진행 · 요청은 다음 Tick 에 판정
        시계를 붙이면 스스로 진행 (실제 setInterval)
        전송 봉투 왕복 · 알 수 없는 메시지 무시
    world/tests/drive.ts                                                        신규
        C001 · C002 테스트가 쓰던 dispatch/tick/observe 를 유지하는 검증용 시계.
        기존 30건은 판정 내용을 그대로 유지한 채 이 시계 위에서 돈다 (Regression).

## NOTES
    - `world.tick()` 을 부를 수 있는 것은 세계의 시계(world/clock.ts)와 검증 코드뿐이다.
      Client 는 물리적으로 부를 수 없다 — 다른 프로세스에 있다.
    - MAX_TICK_DT = 0.25 로 한 Tick 의 dt 를 제한한다. 프로세스가 잠시 멈췄다 돌아와도
      세계가 한 번에 건너뛰지 않는다 (C002 의 결정론 보호와 같은 취지).
    - ws 를 `{ server }` 로 붙이면 그 서버의 모든 upgrade 를 가로채 Vite HMR 소켓까지
      끊는다. `{ noServer: true }` + 경로 판별로 우리 경로만 받는다 (server/attach.ts).
