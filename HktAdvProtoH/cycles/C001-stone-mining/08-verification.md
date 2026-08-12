# CYCLE C001 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression (해당 없음 — 첫 Cycle)

## NEW BEHAVIOR
    곡괭이 보유 + 광맥 인접 + 자원 있음  → Mine 성공: Stone +1, 광맥 잔량 -1
    곡괭이 없음                          → Mine 실패 (no-mining-tool)
    광맥에서 InteractionRange(2) 밖      → Mine 실패 (out-of-range)
    광맥 자원 0                          → Mine 실패 (deposit-depleted), depleted 표현
    Bounds 안 지점으로 이동 요청          → 시간에 걸쳐 도달 (moving → idle)
    Bounds 밖 지점                       → Move 실패 (out-of-bounds)

## WORLD SCENARIO (실측 — npx vitest run, 2026-08-12 16:10)
    world/tests/mine.spec.ts — 5 passed
        Before  Actor(8,-5) pickaxe·Stone 0 / Deposit(8,-6) 잔량 5
        Input   Mine(Actor, deposit-1)
        Rule    RULE-MINE-001
        After   Stone 1 · 잔량 4  (실패 3종 + available→depleted 전이 포함)
    world/tests/move.spec.ts — 4 passed
        Before  Actor(0,0) → Input Move(6,0) → Rule RULE-MOVE-001/PROGRESS-001
        After   0.5s 후 x≈3 (moving) → 1.1s 후 x=6 (idle, 목표 초과 없음)
        이동으로 out-of-range → available 전이 확인
    합계: 12 passed (world 9 + view 3), 실패 0

## PROJECTION
    world/projection/player-view.ts 가 04-gameview.spec.yaml 의
    entities/interactions/hud 전 필드를 산출 — 위 테스트가 Snapshot 필드로 검증.
    Rule 과 Projection 이 동일 Precondition 평가(evaluateMinePreconditions)를 공유.

## VIEW FIXTURE (World 미기동 — view/tests/interpret.spec.ts, 3 passed)
    mining-available.fixture.json  → 채굴 가능 상태·스프라이트 매핑 표시
    out-of-range.fixture.json      → moving 스프라이트 + "멀다" 사유 표시
    deposit-depleted.fixture.json  → depleted 스프라이트 + "고갈" 사유 표시

## BOUNDARY (실측 — import 방향 검사)
    view/ → world/ import: 0건    world/ → view/ import: 0건
    view/ 외부 의존: three · vitest 뿐 — World 정보는 protocol Snapshot 만 사용.

## PLAYABLE (헤드리스 chromium 실측, vite preview 빌드)
    절차  시작(Stone 0, "광맥이 너무 멀다") → WASD 로 광맥(8,-6) 접근
          → "[E] 채굴" 표시 → E 입력 → HUD "Stone: 1" · 잔량 라벨 "돌 4"
          → "+1 Stone 획득!" 토스트. 콘솔 에러 0건. RESULT: MINED
    Human Play  미확인 — run.bat / run.sh (npm run dev) 로 확인 요청 상태.

## REGRESSION
    해당 없음 — 첫 Cycle. 03-world-semantic.md AFFECTED 없음, 과거 Cycle Scenario 없음.
    본 Cycle 의 위 Scenario 들이 이후 Cycle 의 Regression 기반이 된다.

## COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다            (01)
    [x] Goal / Possibility 가 존재한다                      (02)
    [x] Intent 가 존재한다                                  (02)
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다      (03 Semantic Closure)
    [x] World State 변화가 World Rule 을 통해서만 발생한다   (rules/ 외 전이 없음)
    [x] World 는 Authoritative 하다                         (state 캡슐화, dispatch/tick/project 만)
    [x] GameView Specification 이 존재한다                  (04)
    [x] View 는 Spec 외 World 정보를 사용하지 않는다         (import 0건)
    [x] World 는 View 구현 정보를 사용하지 않는다            (import 0건)
    [x] World 를 View 없이 검증할 수 있다                   (world 테스트 9)
    [x] View 를 Fixture 만으로 검증할 수 있다               (fixture 테스트 3)
    [x] Server + Client 연결 시 실제 플레이가 가능하다       (헤드리스 MINED)
    [x] Runtime 결과를 Goal/Possibility/Intent 까지 추적 가능 (ActionResult.rule → Implements 주석 → 02)
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다      ← 대기 중
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다       (공유 world/·view/·protocol/)

## FAILURES
    없음

## STATUS
    IN PROGRESS — Human Play 확인 후 COMPLETE 로 전환한다.
