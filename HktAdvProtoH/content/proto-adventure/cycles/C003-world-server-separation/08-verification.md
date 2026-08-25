# CYCLE C003 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR
    세계는 관찰자 없이도 진행한다        → 탭을 닫아 둔 동안에도 World.Time 이 흐른다
    세계는 화면과 별개다                 → 새로고침해도 세계 시간이 0 으로 돌아가지 않는다
    조작은 요청이다                      → 입력이 선을 타고 가고, 판정은 세계 쪽에서 난다
    관찰자는 이어짐을 안다               → 이어짐 / 잇는 중 / 끊김
    끊기면 마지막으로 본 세계를 본다     → 화면이 멈추고 탈색되며 요청이 나가지 않는다
    다시 이어지면 현재로 돌아온다        → 끊긴 동안 흐른 세계 시간이 한 번에 반영된다

## WORLD SCENARIO (View 없이 실측 — world/tests · server/tests)
    RULE-WORLD-TICK-001 — 시간
        Before  World.Time = 0
        Input   tick(0.5) → tick(0.25)
        After   World.Time = 0.75, 관찰 결과의 hud.world.time 으로 관찰됨

    RULE-WORLD-TICK-001 — 관찰자 없는 진행
        Before  npc-1(-8,4), 순회 경로 보유, 플레이어는 인지 밖
        Input   tick(1/30) × 60 (아무도 관찰 결과를 읽지 않음)
        After   npc-1 이 순회 방향으로 이동해 있음, World.Time ≈ 2.0

    INTENT-REMOTE-REQUEST-001 — 요청은 도착하고 나서 판정된다
        Before  player(8,-5) idle
        Input   request(Mine)          → 관찰 결과: 여전히 idle (아무 일도 없다)
        Input   tick(0)                → results = [success RULE-MINE-001], 관찰 결과: mine
        같은 Tick 에 request(Mine) + request(Move) → ['success', 'failure(action-busy)']
        (도착 순서대로 판정된다)

    관찰 결과의 성질
        latestObservation() 은 마지막 Tick 이 내보낸 바로 그 객체다 (새로 만들지 않는다)
        JSON 왕복 후에도 동일 — 선을 탈 수 있는 모양이다
        관찰 결과를 고쳐도 세계는 변하지 않는다

    WorldHost
        붙는 즉시 현재 세계 1회 수신 · Tick 마다 모든 관찰자에게 전달
        관찰자 0명이 되어도 진행 (떨어진 뒤 1.0초 진행 → 다시 붙으니 World.Time = 1.5)
        실제 setInterval 시계로 200ms 방치 → World.Time > 0.1

    실행 결과   world 45건 + server 8건 통과

## PROJECTION
    04-gameview.spec.yaml 의 항목이 모두 산출된다. C002 대비 추가는 hud.worldTime 하나.
    투영하지 않기로 한 값(World.TickInterval)은 Snapshot 어디에도 없다.
    판정 결과(ActionResult)는 소켓으로 나가지 않는다 — 관찰 결과만 나간다.

## VIEW FIXTURE (World 미기동 — view/tests/world-link.spec.ts)
    가짜 소켓으로 이어짐 상태 전이를 전부 검증했다.
        connecting → connected            열림
        연속 수신                          늦게 온 것이 앞선 것을 대체
        connected → disconnected          닫힘 · 수신 타임아웃(1.5s) 둘 다
        disconnected 동안                 latest 유지 + stale=true + send() = false
        재접속                             백오프 후 다시 열고 최신 세계로 복귀
        망가진 메시지                      무시 (마지막 세계 보존)
    C002 의 fixture 테스트(resolve · motion) 22건은 수정 없이 그대로 통과.

## PLAYABLE
    실행      npx vite (127.0.0.1:5199) — 세계는 Vite dev 서버 프로세스에서 돈다
              브라우저는 ws://…/world 로 접속. Chromium 자동 조작으로 기록.

    접속 직후    Stone 0 · 행동: 대기 · 세계 시간 7s
                 ← 접속하자마자 7초다. 세계는 브라우저가 열리기 전부터 돌고 있었다.
    D/W 입력     행동: 이동                       (요청이 선을 타고 가 판정되었다)
    광맥 도달    힌트 "[E] 채굴" · 세계 시간 11s
    E 입력       행동: 채굴 (진행 막대)
    1.3초 후     Stone 1 · 행동: 대기 · 세계 시간 13s
    네트워크 차단 "세계와 끊김 — 마지막으로 본 모습입니다" · 화면 전체 탈색 · stale=true
    끊긴 2초 동안 화면의 세계 시간 13s → 13s (멈춰 있다 — 마지막으로 받은 세계다)
    끊긴 중 E    아무 일도 일어나지 않음 (요청이 나가지 않는다)
    네트워크 복구 배너 사라짐 · stale=false · 세계 시간 22s
                 ← 끊겨 있던 9초 동안 세계는 계속 돌고 있었다.

    두 프로세스 분리 실측 (scripts/run-split 경로 — 클라 5199 / 세계 5180)
        접속            클라이언트가 다른 포트의 세계에 붙어 세계 시간 55s 를 받는다
        D 누르는 중     행동: 이동            (요청이 프로세스를 건너 전달된다)
        세계 프로세스 종료
                        "세계와 끊김 — 마지막으로 본 모습입니다" + 화면 탈색.
                        클라이언트 프로세스는 살아 있다.
        세계 재시작     스스로 다시 이어짐 · stale 해제 · 세계 시간 8s
                        (새 세계라 0 부터 — 영속은 01-cycle.md EXCLUDED)

    세계의 독립성 실측 (별도 회차)
        접속 16s → 2초 대기 18s
        새로고침 후 20s        (클라이언트는 다시 시작해도 세계는 0 으로 돌아가지 않는다)
        탭을 완전히 닫고 3초 뒤 새 탭 → 26s (증가분 6s — 관찰자 0명 동안에도 흘렀다)

    클라이언트 번들 검사
        dist/assets/index-*.js 안에 RULE-MINE-001 · wanderIndex · perceptionRange ·
        createWorld 모두 0건. 클라이언트에 세계 코드가 들어 있지 않다.

## REGRESSION
    C001 Stone Mining Goal — 이동 후 채굴로 Stone 획득
        world 테스트 (mine.spec.ts "C001 REGRESSION")   → 통과
        실제 플레이 (위 PLAYABLE)                        → 통과
    C002 Character Action & Animation
        행동 상태·진행도·배타 판정 (action.spec 7건)     → 통과
        공격·타격·피격 (attack.spec 13건)                → 통과
        NPC 자율·결정론 (npc.spec 5건)                   → 통과
        모션 주입·폴백·재생 (motion.spec 15건)           → 통과
        모션이 화면에서 재생됨 (스크린샷)                → 통과
    C002 View Fixture · C001 View Fixture               → 수정 없이 통과

    변경된 것 (의도된 변경)
        World 경계 이름 — dispatch/projectPlayerView → request/tick/latestObservation.
        기존 30건의 테스트는 world/tests/drive.ts 를 통해 판정 내용을 그대로 유지한다.

## CYCLE COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다              01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                        02-intent.md
    [x] Intent 가 존재한다                                    02-intent.md INTENT SET 4종
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다        03-world-semantic.md CLOSURE PASS
    [x] World State 변화가 World Rule 을 통해서만 발생한다     모든 전이가 RULE-WORLD-TICK-001 경유
    [x] World 는 Authoritative 하다                           Client 는 다른 프로세스에 있고
                                                              ActionRequest 외에는 보낼 수 없다
    [x] GameView Specification 이 존재한다                    04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다          클라이언트 번들에 world 코드 0건
    [x] World 는 View 구현 정보를 사용하지 않는다             world/ · server/ → view/ import 0건
    [x] World 를 View 없이 검증할 수 있다                     world 45건 + server 8건
    [x] View 를 Fixture 만으로 검증할 수 있다                 view 30건 (가짜 소켓 포함)
    [x] Server + Client 연결 시 실제 플레이가 가능하다        PLAYABLE 절
    [x] Runtime 결과를 Goal / Intent 까지 추적할 수 있다      WorldTickResult.results 의 rule →
                                                              semantic-id.ts → Rule 주석 Implements
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다        ← 사용자 확인 대기
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다        아래

## FAILURES
    없음. 구현 중 발견해 고친 것 2건은 07-view-implementation.md · 06-world-implementation.md
    NOTES 에 기록했다 (조용히 죽는 이어짐 / ws 가 다른 WebSocket 을 끊는 문제).

## 다음 Cycle 이 그대로 쓰는 것
    다중 클라이언트의 자리는 이미 열려 있다 —
        server/world-host.ts 의 관찰자 목록은 이미 여럿을 받는다 (테스트로 확인).
        남은 것은 "접속마다 다른 Actor" 와 "관찰자별 투영"이며,
        그것은 World Semantic 변경(Observer 개념 도입)이므로 다음 Cycle 의 Goal 이다.
    영속(Persistence)의 자리 — 세계가 프로세스와 함께 사라진다. WorldState 를 저장·복원하는
    Cycle 이 이 위에 얹힌다.
    지연 보상 / 예측의 자리 — 지금은 보간만 한다. 필요해지면 View 쪽 Cycle 로 얹는다.

## STATUS
    IN PROGRESS  (Human Play 확인 후 COMPLETE)
