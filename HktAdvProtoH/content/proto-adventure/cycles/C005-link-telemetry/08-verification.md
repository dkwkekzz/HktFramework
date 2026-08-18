# CYCLE C005 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR
    내 것이 세계에 닿는 데 걸리는 시간을 본다   → 왕복 N ms (좋음/주의/나쁨으로 색이 갈린다)
    오는 것이 제때 오는지 본다                  → 수신 N/s · 마지막 N ms 전
    내가 얼마나 보내는지 본다                   → 보냄 N
    몇 번 다시 이었는지 본다                    → 재연결 N
    무엇에 이어져 있는지 본다                   → 나 · 내 몸 · 세계 주소
    정상일 때도 보인다                          → 이전에는 정상이면 화면에 아무것도 없었다
    세계는 받아들인 자리를 되돌린다             → observer.acknowledgedMark

## WORLD SCENARIO (View 없이 실측 — world/tests · server/tests)
    RULE-OBSERVER-MARK-001 — 받아들인 자리
        Before  참여 직후, acknowledgedMark = 0
        Input   mark(A, 7) → tick(0)
        Rule    RULE-OBSERVER-MARK-001 → success
        After   acknowledgedMark = 7, 그 관찰자의 관찰 결과에 실려 나간다
        mark 만 보내고 Tick 이 오지 않으면 0 그대로 (요청과 같은 규율)

    RULE-OBSERVER-MARK-001 — 뒤로 가지 않는다
        Before  acknowledgedMark = 10
        Input   mark(A, 4)               → failure(stale-mark), 10 그대로
        Input   mark(A, 10) (같은 값)     → failure(stale-mark), 10 그대로
        Input   mark(A, NaN) · Infinity  → failure, 0 그대로
        Input   mark('낯선 사람', 5)      → failure(unknown-observer)
        Input   mark 1,2,3 을 한 Tick 에  → 3 까지 받아들인다

    표식은 게임을 바꾸지 않는다
        Before  몸 @(8,-5) idle · 광맥 5 · World.Time = 0
        Input   mark 20회 + tick(0) 20회 (시간을 흘리지 않는다)
        After   몸의 자리·상태 · 광맥 · World.Time 전부 그대로. ack = 20.
        같은 Tick 의 요청 판정 목록이 비어 있다 — dispatch 가 한 번도 불리지 않았다

    관찰자별 (INTENT-PER-OBSERVER-PROJECTION-001)
        mark(A,11) + mark(B,22) → A 는 11, B 는 22 를 본다
        A 만 보냈을 때 B 의 ack 는 0 그대로

    인과의 왕복
        Input   request(A, mine) → mark(A, 5) → tick(0)
        After   같은 관찰 결과에 ack = 5 이고 내 몸 상태가 이미 mine 이다
                (표식이 돌아왔다는 것은 그 앞의 요청도 판정되었다는 뜻이다)

    재참여
        ack 42 → leave → tick(1.0) → join → ack 42 그대로 → mark 43 받아들여짐

    WorldHost (소켓 없이)
        receiveMark 가 세계로 도착해 관찰 결과로 돌아온다
        표식이 다른 관찰자의 관찰 결과를 건드리지 않는다
        표식 봉투 파싱 · 망가진 표식 봉투 거부

    실행 결과   world 86건 + server 16건 = 102건 통과

## PROJECTION
    04-gameview.spec.yaml 의 observer 절과 일치한다 — acknowledgedMark 가 실린다.
    투영하지 않기로 한 것은 Snapshot 어디에도 없다:
    다른 관찰자의 표식 · 표식 실패 사유 · 세계가 표식을 받은 시각.
    telemetry 5종과 binding.worldAddress 는 Snapshot 에 없다 — 관찰자 쪽에서 만들어진다.

## VIEW FIXTURE (World 미기동)
    link-telemetry.spec.ts (16건) — 시계를 주입한 순수 누산기
        왕복    없으면 null / 돌아오면 그 시간 / 아직이면 null /
                여러 개면 가장 나중 것 / 다음 표식으로 갱신
        흐름    도착 없으면 0 / 창 안의 수로 초당 건수 / 끊기면 0 으로 /
                마지막 이후 시간이 는다
        이력    보낸 수 · 다시 이은 수
        표현    값이 없어도 줄은 있다 / 왕복 등급 3단 / 도착률 등급 /
                재연결 강조 / 신원 세 줄
    world-link.spec.ts (18건, C005 7건) — 가짜 소켓
        조용해도 간격마다 표식이 나간다 / 표식은 커지기만 한다 /
        돌아오면 왕복이 잡힌다 / 아직이면 비어 있다 /
        다시 이은 횟수(처음은 세지 않는다) / 끊긴 동안 표식도 안 나간다 / 세계 주소

    실행 결과   view 65건 통과. 전체 167건 통과.
    타입 검사   tsc --noEmit 통과 · 빌드 성공 · 번들에 world 코드 0건 ·
                world/server → view import 0건

## PLAYABLE
    ### 소켓 관찰자 둘 — 세계 프로세스(5180) 밖에서 실측
    ① 둘 접속            a.ack = 0 · b.ack = 0
    ② a 가 표식 10회     a.ack = 10 · b.ack = 0  ← 남의 표식은 오지 않는다
                         왕복 10회 실측: 최소 16ms · 중앙 22ms · 최대 27ms
                         (세계 Tick 주기 33ms 안에서 판정되어 돌아온 값)
    ③ 도착률             1초 동안 30건 도착 (세계 Tick 30Hz 와 일치)
    ④ 요청 뒤 표식       표식 11 받아들여짐 + 같은 관찰 결과에서 내 몸 상태 = move
    ⑤ 옛 표식            mark 1 을 다시 보냄 → ack 11 → 11 (되돌아가지 않는다)
    ⑥ 망가진 표식        {type:'mark'} · mark:'곧' → ack 11 그대로,
                         세계 시간은 계속 흐른다 (세계를 흔들지 못한다)
    ⑦ 표식 100회         돌 0 → 0 · 광맥 5 → 5 · ack = 111
                         (표식은 게임을 아무것도 바꾸지 않는다)

    ### 브라우저 둘 — 패널을 사람이 보는 화면에서 (Chromium 자동 조작)
    ① 둘 접속 (정상)
        A  나 observer-s32t4lhc · 내 몸 player-3 · 세계 ws://127.0.0.1:5180/world
           왕복 269ms[warn] · 수신 35.0/s[good] · 마지막 1ms 전 · 보냄 6 · 재연결 0
        B  나 observer-wj2kdv1v · 내 몸 player-4 · …
        ← 정상일 때도 패널이 떠 있다. 이전에는 아무것도 없었다.
    ② A 가 D 키로 이동 중   보냄 6 → 24 (요청마다 표식이 따라 나간다)
    ③ 조작 없이 3초         보냄 34 → 40 · 왕복 179 → 186ms
                            ← 조용해도 표식이 나가 왕복이 갱신된다
    ④ 세계 프로세스 종료
        수신 35.0/s[good] → 0.0/s[bad] · 마지막 2890ms → 5668ms 전
        왕복은 마지막으로 잰 값 186ms 로 얼어 있다 (frozen-with-age)
        패널 배경이 붉어지고 화면 전체가 탈색된다 (스크린샷 c005-3)
    ⑤ 세계 재시작
        스스로 다시 이어짐 · 재연결 0 → 1[warn] · 수신 29.5/s[good] 로 복귀

    ### 실측에서 드러난 사실 두 가지 (숨기지 않고 적는다)
    (1) 왕복이 소켓 클라이언트는 16~27ms, 브라우저는 165~270ms 다.
        차이는 선이 아니라 브라우저 쪽에 있다 — 3D 렌더 루프가 메인 스레드를 잡고 있는
        동안 도착한 관찰 결과의 처리가 밀린다. 이 Cycle 이 재기로 한 것이 바로
        "내 조작이 화면에 나타나기까지"(INTENT-LINK-ROUNDTRIP-001)이므로 이 값이 맞다.
        선만 재는 값이었다면 이 사실은 드러나지 않았다.
        (headless Chromium 이라 실제 브라우저보다 나쁠 수 있다.)
    (2) 세계를 재시작하자 같은 식별인데 내 몸이 player-3 → player-1 로 바뀌었다.
        세계와 함께 관찰자 표가 사라졌기 때문이다 — 영속은 C004 · C005 모두 EXCLUDED 다.
        C005 의 binding 표시 덕분에 이 사실이 화면에서 눈에 보이게 되었다.
        영속 Cycle 이 닫을 자리다.

## REGRESSION
    C001 Stone Mining
        mine.spec 7건 (C001 REGRESSION 포함)                → 통과
    C002 Character Action & Animation
        action 7건 · attack 13건 · npc 5건 · motion 15건     → 통과
    C003 World Server Separation
        world-tick 9건 · server 16건 · world-link 이어짐 11건 → 통과
        세계는 관찰자 없이도 진행 · 요청은 도착 후 판정 ·
        끊김/재접속/조용히 죽은 이어짐                       → 통과
    C004 Multi Observer
        observer.spec 26건 (참여·식별·투영·귀속·이탈·재참여)  → 통과
        브라우저 둘이 각자 자기 몸으로 접속 (위 PLAYABLE)     → 통과
        resolve.spec 의 다중 관찰자 4건                       → 통과
    AFFECTED (03-world-semantic.md)
        "없음" 으로 판정했고 구현·검증에서도 그대로였다 —
        표식은 어떤 Rule 의 Precondition 도 Transition 도 건드리지 않는다.
        테스트로 확인했다 (표식 20회·100회에도 몸·광맥·세계 시간 불변).

    변경된 것 (의도된 변경)
        요청을 보낸 직후 표식이 한 개 따라 나간다 —
        world-link.spec 의 "끊긴 동안에는 요청을 보낼 수 없다" 가 그것을 반영한다.
        판정 내용은 그대로다.
        fixture 5종에 observer.acknowledgedMark 가 추가되었다 (계약이 요구한다).

## CYCLE COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다              01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                        02-intent.md 2 Goal · 5 Possibility
    [x] Intent 가 존재한다                                    02-intent.md INTENT SET 6종
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다        03-world-semantic.md CLOSURE PASS
                                                              (World 책임 1종 + 관찰자 쪽 5종)
    [x] World State 변화가 World Rule 을 통해서만 발생한다     표식도 Tick 안의 Rule 이다
    [x] World 는 Authoritative 하다                           표식은 게임을 바꾸지 못한다.
                                                              모르는 관찰자의 표식은 무효.
    [x] GameView Specification 이 존재한다                    04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다          번들에 world 코드 0건
    [x] World 는 View 구현 정보를 사용하지 않는다             world·server → view import 0건
    [x] World 를 View 없이 검증할 수 있다                     world 86건 + server 16건
    [x] View 를 Fixture 만으로 검증할 수 있다                 view 65건 (시계 주입 · 가짜 소켓)
    [x] Server + Client 연결 시 실제 플레이가 가능하다        PLAYABLE 절 (소켓 2인 · 브라우저 2인)
    [x] Runtime 결과를 Goal / Intent 까지 추적할 수 있다      ActionResult.rule → semantic-id.ts →
                                                              Rule 주석 Implements → 02-intent.md
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다        ← 사용자 확인 대기
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다        아래

## FAILURES
    없음.
    검증 중 드러난 두 가지 사실(브라우저 왕복이 큰 것 · 세계 재시작 시 몸이 바뀌는 것)은
    실패가 아니라 이 Cycle 이 보이게 하려던 것이며, PLAYABLE 절에 그대로 적었다.

## 다음 Cycle 이 그대로 쓰는 것
    Client Prediction · 지연 보상의 자리 — 예측 보정이 필요로 하는 세 가지가 모두 갖춰졌다.
        내 몸이 무엇인지          observer.self (C004)
        세계가 내게서 어디까지 받았는지  observer.acknowledgedMark (C005)
        얼마나 앞서 가야 하는지   telemetry.roundTripMs (C005)
        보정 결과가 맞았는지 틀렸는지도 이 패널로 눈에 보인다.
    영속(Persistence)의 자리 — 세계 재시작 시 몸이 바뀌는 것이 이제 화면으로 드러난다.
        World.Observers(Id · ActorId · AcknowledgedMark)를 저장·복원하면 닫힌다.
    통신 진단의 자리 — 대역폭·메시지 크기·이력 그래프를 얹을 자리가 telemetry 절이다.
        World 를 건드리지 않고 View 쪽에서만 늘어난다.

## STATUS
    IN PROGRESS  (Human Play 확인 후 COMPLETE)
