# CYCLE C004 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR
    둘 이상이 같은 세계에 들어온다      → 각자 자기 몸을 받고 서로를 화면에서 본다
    조작은 내 몸에만 닿는다             → 남의 몸을 적어 보내도 남의 몸은 움직이지 않는다
    나만의 것은 나만 본다               → 내가 캔 돌은 내 화면에만 늘고, 세계의 광맥은 함께 준다
    떠나도 몸은 세계에 남는다           → 자리 비움으로 표시되고 하던 행동은 끝까지 진행된다
    다시 이어도 나는 나다               → 같은 몸 · 같은 자리 · 가진 것 그대로
    몸 하나에 조종하는 이는 하나다      → 같은 나로 다른 곳에서 들어오면 먼저 것이 떨어진다
    함께 보고 있는 수가 보인다          → 👥 함께: N명

## WORLD SCENARIO (View 없이 실측 — world/tests · server/tests)
    RULE-OBSERVER-JOIN-001 — 몸은 관찰자가 들어와야 생긴다
        Before  관찰자 0명. Actors = 자율 존재들뿐
        Input   join('observer-a') → tick(0)
        Rule    RULE-OBSERVER-JOIN-001 → success
        After   observer.characterId = 'player-1', role = player-character
        밝히는 즉시가 아니라 다음 Tick 이 판정한다 (join 직후 latestObservation = null)

    RULE-OBSERVER-JOIN-001 — 밝힘의 판정
        join('아무나')                    → success (자격을 따지지 않는다)
        join('')                          → failure(invalid-observer-id)
        join('x'.repeat(65))              → failure(invalid-observer-id)
        join(A) + join(B)                 → 서로 다른 몸 (player-1 · player-2), 자리도 다르다
        join(A) 두 번                     → 몸은 하나

    INTENT-PER-OBSERVER-PROJECTION-001 — 같은 몸, 다른 관찰 결과
        A 의 화면   player-1 = player-character · player-2 = other-player-character
        B 의 화면   player-1 = other-player-character · player-2 = player-character
        같은 값     위치 · 상태 · world.time
        다른 값     inventory.stone (A=1 / B=0) · mine.available (A=true / B=false out-of-range)

    INTENT-REQUEST-ATTRIBUTION-001 — 요청은 보낸 이의 몸에만
        Before  player-1 idle, player-2 idle
        Input   request(A, move) → tick(0)
        After   player-1 = move, player-2 = idle
        Input   request(A, {mine, targetEntityId: 'player-2'})
        After   failure — 남의 몸은 그대로 idle (주체를 지정하는 수단이 아니다)
        Input   request('낯선 사람', mine)
        After   failure(DISPATCH/unknown-observer) — 어떤 Rule 에도 위임되지 않았다

    RULE-OBSERVER-LEAVE-001 — 떠남
        Before  player-1 채굴 중, attended = true
        Input   leave(A) → tick × 60 (2초)
        After   몸은 같은 자리 · attended = false · 채굴은 끝났고 광맥 5 → 4
                120 Tick 을 더 돌려도 state = idle (스스로 새 행동을 시작하지 않는다)
                떠난 관찰자에게는 observations 가 만들어지지 않는다
        leave('낯선 사람')                → failure(unknown-observer)

    INTENT-OBSERVER-REJOIN-001 — 되찾음
        Before  player-1 @ (8,-5) · stone 1 · A 는 떠나 있음
        Input   tick(1.0) → join(A) → tick(0)
        After   characterId = player-1 (새 몸이 아니다) · stone 1 · 자리 (8,-5)
                끊긴 동안 흐른 3.0초가 world.time 으로 한 번에 보인다
                몸은 늘지 않았다

    WorldHost (소켓 없이)
        밝히고 붙으면 다음 Tick 에 자기 몸이 있는 세계를 받는다
        둘이 붙으면 각자 자기 관찰 결과를 받는다 (observer.id 가 서로 다르다)
        같은 나로 다시 붙으면 먼저 있던 이어짐에 onEvicted 가 가고 교체된다 (observerCount 1)
        밀려난 쪽이 뒤늦게 detach 해도 새 이어짐을 끊지 않는다
        떠난 이의 몸이 남은 이에게 attended = false 로 보인다

    실행 결과   world 72건 + server 13건 통과 (npx vitest run)

## PROJECTION
    04-gameview.spec.yaml 의 항목이 모두 산출된다.
        observer.self · role 3종 · attended · hud.observers.present ·
        기존 hud/interaction 은 관찰자 자신의 몸 기준
    투영하지 않기로 한 것은 Snapshot 어디에도 없다
        다른 관찰자의 Observer.Id · 참여 실패 사유 · World.TickInterval
    판정 결과(ActionResult)는 여전히 소켓으로 나가지 않는다 — 관찰 결과만 나간다

## VIEW FIXTURE (World 미기동)
    two-observers.fixture.json
        내 몸        cameraFollow = true · tint 없음
        남의 몸      cameraFollow = false · tint 0xffd9a0 · 같은 sprite 시트
        자리 비움    tint 0x6b6b6b · label '자리 비움'
        함께         '함께' 2명
        소지품       inventory.stone 항목은 하나뿐 (남의 것은 애초에 오지 않는다)
    world-link (가짜 소켓)
        열리면 sent[0] = {"type":"join","observerId":…}
        끊겼다 다시 열리면 다시 밝힌다 (sent[1] 도 join)
        관찰 결과가 누구의 것인지 안다 (observer.id / observer.characterId)
        C003 의 이어짐 상태 전이 8건은 그대로 통과
    observer-identity (브라우저 없이)
        없으면 만들어 보관 / 있으면 그것을 다시 / 여러 번 물어도 같은 나 /
        64자 이내 / 다른 보관소는 다른 나

    실행 결과   view 42건 통과. 전체 127건 통과. tsc --noEmit 통과. vite build 성공.

## PLAYABLE
    ### 두 소켓 관찰자 — 세계 프로세스(5180) 밖에서 (node + ws)
    ① alpha 접속        내몸=player-1(idle) @0,0 · 남의몸=[] · 함께=1 · 세계시간=33.7s
                        ← 접속하자마자 33.7초다. 세계는 붙기 전부터 돌고 있었다.
    ② beta 접속         alpha: 남의몸=[player-2:idle:조종중] · 함께=2
                        beta : 내몸=player-2 @3,2 · 남의몸=[player-1:idle:조종중] · 함께=2
                        ← 같은 세계, 서로 다른 몸, 서로가 서로를 본다
    ③ alpha 만 이동     alpha: 내몸 move @7.6,-4.8
                        beta : 남의몸=[player-1:move:조종중] · 내몸은 idle 그대로
    ④ alpha 채굴        alpha: 돌=1        beta: 돌=0
                        ← 나만의 것은 나만 본다
    ⑤ beta 가 남의 몸을 적어 채굴 요청
                        player-1 상태 idle → idle (아무 일도 없다)
                        ← 요청에 남의 몸을 적어도 남의 몸은 움직이지 않는다
    ⑥ alpha 끊김        beta: 남의몸=[player-1:idle:자리비움] · 함께=1
                        player-1 은 여전히 @7.611632776749671,-4.757270485468545 · attended=false
    ⑦ alpha 재접속      내몸=player-1 (이전과 같음) · 자리 그대로 · 돌 1 그대로
    ⑧ 같은 나로 또 접속 먼저 있던 이어짐 closed=true · 나중 이어짐이 player-1 을 갖는다

    ### 두 브라우저 — 서로 다른 localStorage = 서로 다른 관찰자 (Chromium 자동 조작)
    ① A 접속            식별 observer-66sajvpr · 👥 함께: 1명 · 세계 시간 18s
    ② B 접속            식별 observer-m30lurf1
                        A · B 둘 다 👥 함께: 2명 · 같은 세계 시간 22s
                        화면: A 의 눈에 내 몸(원색, 카메라 추적) 옆에 남의 몸(따뜻한 색),
                              자율 존재 둘은 푸른 색 — 셋이 색으로 갈린다
    ③ A 가 D 키로 이동  A: 행동 이동 / B: 행동 대기 (B 의 몸은 가만히)
                        B 의 화면에서 A 의 몸이 움직인다 (스크린샷)
    ④ B 창을 닫음       A: 👥 함께: 1명 · B 의 몸 자리에 '자리 비움' 라벨 + 탈색된 몸
                        ← 몸은 세계에 남아 있다
    ⑤ A 새로고침        식별 observer-66sajvpr (그대로) · 세계 시간 34s (0 으로 돌아가지 않는다)

    ### C001 회귀 — 관찰자가 둘인 세계에서 실제로 캔다 (Chromium)
    이동(WASD) → 광맥 도달 → E
        보낸 것  {"type":"action","action":{"interactionId":"mine","targetEntityId":"deposit-1"}}
        결과     A: 행동 채굴 → Stone 0 → 1 · '+1 Stone 획득!' · 광맥 돌 5 → 4
                 B: Stone 0 그대로 · 광맥은 B 의 화면에서도 돌 4
        ← 세계의 사실은 함께 줄고, 얻은 것은 캔 사람에게만 간다

    실행 중 마주친 세계의 판정 하나 — 첫 E 요청이 거절되었다.
        NPC 가 다가와 때리고 있어 행동이 '피격' 이었고, 세계가 action-busy 로 거절했다
        (C002 INTENT-ACTION-EXCLUSIVE-001). 틈이 나자 같은 요청이 받아들여졌다.
        요청 경로가 아니라 세계의 판정이 막은 것이다 — 보낸 봉투를 가로채 확인했다.

## REGRESSION
    C001 Stone Mining Goal — 이동 후 채굴로 Stone 획득
        world 테스트 (mine.spec 7건, "C001 REGRESSION" 포함)      → 통과
        실제 플레이 (위 C001 회귀 절, 관찰자 둘인 세계)            → 통과
    C002 Character Action & Animation
        행동 상태·진행도·배타 판정 (action.spec 7건)              → 통과
        공격·타격·피격 (attack.spec 13건)                         → 통과
        NPC 자율·결정론 (npc.spec 5건)                            → 통과
        모션 주입·폴백·재생 (motion.spec 15건)                    → 통과
        실제 플레이에서 NPC 가 다가와 때렸고 피격 판정이 났다     → 통과
    C003 World Server Separation
        세계는 관찰자 없이도 진행한다 (world-tick.spec 9건)       → 통과
        요청은 도착하고 나서 판정된다                              → 통과
        WorldHost 자기 시계 · 관찰자 0명 진행 (server 13건)        → 통과
        이어짐 상태 전이 · 재접속 (world-link.spec 8건)           → 통과
        접속 시 세계 시간이 이미 흘러 있다 / 새로고침해도 0 아님   → 통과 (실측)
        클라이언트 번들에 world 코드 0건                          → 통과
    AFFECTED (03-world-semantic.md)
        RULE-NPC-DECIDE-001 — 조종되는 몸이 여럿일 때 가장 가까운 것을 고른다,
            보는 이가 없는 몸도 인지 대상이 된다, 무인 몸은 스스로 결정하지 않는다
            → observer.spec · npc.spec 로 확인
        RULE-MOVE/MINE/ATTACK/ACTION-BEGIN — 주체만 바뀌고 판정은 그대로
            → 기존 32건이 판정 내용 수정 없이 통과

    변경된 것 (의도된 변경, 06-world-implementation.md NOTES 에 근거)
        "세계가 시작되면 모든 Actor 는 대기" (C002) —
            관찰 결과가 관찰자의 참여 Tick 에 만들어지므로 그 Tick 에서 이미
            RULE-NPC-DECIDE-001 이 돈다. 순회 경로도 인지도 없는 자율 존재로
            같은 의미를 확인하도록 시나리오를 바꿨다.
        npc.spec "플레이어 입력 없이 행동이 시작된다" —
            첫 관찰 결과부터 NPC 가 자기 행동 안에 있다는 단언으로 바꿨다.
        몸의 이름 'player' → 'player-1' (세계가 순번으로 정한다)

## CYCLE COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다              01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                        02-intent.md 4 Goal · 8 Possibility
    [x] Intent 가 존재한다                                    02-intent.md INTENT SET 6종
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다        03-world-semantic.md CLOSURE PASS
    [x] World State 변화가 World Rule 을 통해서만 발생한다     참여·이탈도 Tick 안의 Rule 이다
    [x] World 는 Authoritative 하다                           요청에 주체를 적는 자리가 없다.
                                                              주체는 세계가 아는 Observer.ActorId
    [x] GameView Specification 이 존재한다                    04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다          번들에 world 코드 0건
    [x] World 는 View 구현 정보를 사용하지 않는다             world·server → view import 0건
    [x] World 를 View 없이 검증할 수 있다                     world 72건 + server 13건
    [x] View 를 Fixture 만으로 검증할 수 있다                 view 42건 (가짜 소켓·메모리 보관소)
    [x] Server + Client 연결 시 실제 플레이가 가능하다        PLAYABLE 절 (소켓 2인 · 브라우저 2인)
    [x] Runtime 결과를 Goal / Intent 까지 추적할 수 있다      ActionResult.rule → semantic-id.ts →
                                                              Rule 주석 Implements → 02-intent.md
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다        ← 사용자 확인 대기
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다        아래

## FAILURES
    없음.
    검증 중 확인한 것 하나 — HUD 프롬프트는 키 지시 interaction 중 앞선 것을 보여준다.
    공격이 언제나 가능하므로 광맥 옆에 서도 '[F] 공격' 이 표시되고 '[E] 채굴' 은 가려진다.
    C002 부터 있던 표시 규칙이며 이번 Cycle 의 의미와 무관하다. E 는 정상 동작한다
    (요청 봉투와 채굴 성공을 실측했다). 표시를 고치려면 별도 Cycle 의 View 작업이다.

## 다음 Cycle 이 그대로 쓰는 것
    영속(Persistence)의 자리 — World.Observers 가 생겨 "누가 이 몸의 주인인가" 가
        세계의 상태로 존재한다. 세계를 저장·복원하는 Cycle 은 이 표를 함께 저장하면
        재시작 뒤에도 같은 사람이 같은 몸으로 돌아온다. 지금은 프로세스와 함께 사라진다.
    Client Prediction · 지연 보상의 자리 — 관찰 결과에 observer.self 가 있으므로
        View 가 "내 몸"을 알고 있다. 미리 반영할 대상이 정해져 있다는 뜻이다.
    자격 증명(진짜 인증)의 자리 — RULE-OBSERVER-JOIN-001 의 Precondition 하나만
        늘리면 된다. 밝힘을 받아 적는 구조는 그대로 쓴다.
    관찰자 간 상호작용의 자리 — 다른 관찰자의 몸이 이미 세계의 Actor 이고
        other-player-character 로 관찰된다. 거래·공격 대상이 될 준비가 되어 있다.
    시야 범위 컬링의 자리 — 투영이 이미 관찰자별이다. 자를 지점이 한 곳뿐이다.

## STATUS
    IN PROGRESS  (Human Play 확인 후 COMPLETE)
