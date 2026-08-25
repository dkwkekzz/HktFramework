# CYCLE C009 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          (자동 조작으로 실측 — Human Play 확인 대기)
[PASS] Regression
[PASS] Catalog           (해당 없음 — 존재 종류 변화 없음. `npm run catalog:check` 통과)

측정 환경: 세계 프로세스 `PORT=5199 tsx server/main.ts`, 클라이언트는 빌드된 `dist/`,
브라우저는 Chromium (headless). 아래 값은 전부 실행 결과이며 주장이 아니다.

## NEW BEHAVIOR

    세계가 걸 수 있는 것을 밝힌다
        관찰 결과에 commands 가 늘 실린다 — 걸어 보아야 알게 되는 것이 없다

    세계가 요청에 대답한다
        요청 하나 → 받아들임/거절 + 사유 + 내가 붙인 표식
        값이 그대로인 것과 거절된 것이 구분된다

    이동 속도를 올려 실제로 빨라진 몸으로 돌아다닌다
        set-attribute moveSpeed 24 → 세계가 그 값으로 지금까지대로 판정한다

    목록을 보고 고른다
        열면 걸 수 있는 것 전부가 뜻·받는 것·허용 범위와 함께 먼저 보인다

    이미 있던 관찰 토글이 같은 자리에 모인다
        C006 충돌체 · C007 R2 속성 펼침 — 다시 만들지 않고 origin 으로 구분해 얹었다

## WORLD SCENARIO

    실측 — `node e2e.mjs` (실제 세계 프로세스에 소켓으로 붙어 측정)

    [세계가 밝힌 목록]
        set-attribute  available=true  effect=set-attribute
          - target    required=false  omitted=self  domain=entity
          - attribute required=true   domain=hp|hpMax|cp|cpMax|moveSpeed|
                                             runSpeedMultiplier|actionSpeed|moveMode
          - value     required=true   domain=from-previous-choice
        moveSpeed thenDomain = {"kind":"number","minimum":0,"maximum":100}

    [Before]  내 이동 속도 = 6

    [Input → Rule → 대답]
        mark=101  set-attribute moveSpeed 24        → accepted=true   RULE-ATTRIBUTE-SET-001
        mark=102  set-attribute moveSpeed 9999      → refused         value-out-of-range
        mark=103  set-attribute wingspan 1          → refused         unknown-attribute
        mark=104  set-attribute ghost hp 1          → refused         unknown-target
        mark=105  summon-dragon                     → refused  DISPATCH  unknown-interaction
        mark=106  set-attribute npc-1 hp 7          → accepted=true   RULE-ATTRIBUTE-SET-001

        여섯 요청이 각자 자기 표식을 달고 돌아왔다 — 섞이지 않았다
        (INTENT-REPLY-CORRESPONDENCE-001).

    [After]   내 이동 속도 = 24 · 지목한 npc 생명 = 7
              거절된 넷은 세계를 아무것도 바꾸지 않았다

    [바뀐 값 위에서 세계가 굴러가는가]
        moveSpeed=24 로 목적지 요청 → 0.5초 이동 거리 = 12.00 (요청한 12 에 도달해 멈춤)
        기존 6 이었다면 3.0 밖에 가지 못한다 — 세계가 바뀐 값으로 판정했다

    [세계는 대답을 쌓아 두지 않는다]
        요청 없던 Tick 의 outcomes.size = 0 (world/tests/command.spec.ts)
        받은 관찰 결과 45회 — 명령과 무관하게 세계는 계속 돌았다

    [debug 자리 이동 확인]
        debug.open = true · debug 에 mutableAttributes 있는가 = false
        허용 목록은 없어진 것이 아니라 set-attribute 의 attribute Domain 으로 옮겨졌다

## VIEW FIXTURE

    view/tests/fixtures/command.fixture.json → view/tests/command.spec.ts  34항목 통과
    World 미기동 상태에서 전부 돈다.

        목록          두 출처가 한 목록 · origin 구분 · 뜻 문구 · usage ·
                      자리별 범위 · 토글 현재 상태 · 권한이 닫혀도 남는다 ·
                      세계가 밝히지 않은 것은 없다
        안내          이름 좁힘 · 다음 자리 · 선택이 값 범위를 정함 · 자리 안 좁힘 ·
                      쓰는 중엔 탓하지 않음 · 덜 쓴 낱말로는 안 걸림 ·
                      범위 밖 미리 알림 · 없는 이름과 범위 밖의 구분 · 남은 낱말
        지목          비우면 내 몸 · Id 로 지목 · 없는 Id · refers 밖은 후보에서 제외
        요청 만들기   수치/낱말/대상 · 모르는 명령도 이름만 실어 보냄
        표면 전체     기본 닫힘 · 열고 쓴 것 반영 · 토글 상태 일치 · 기록 ·
                      C006·C007 R2 관찰이 그대로

## PLAYABLE

    실측 — Chromium 에서 사람이 하는 순서 그대로 조작 (`node ui.mjs`)

    [UI-1]  조작 안내 첫 줄        "명령: /"  — 입구가 화면에 있다
    [UI-2]  기본 상태             표면은 닫혀 있다 (visible = false)
    [UI-3]  / 를 누른다           열린다 (visible = true)
    [UI-4]  열면 먼저 보이는 것    세계 · set-attribute [target] <attribute> <value>
                                  "존재의 속성 값을 바꾼다"
                                  대상 npc-1 | npc-2 | player-1 · 비우면 내 몸
                                  속성 hp | hpMax | cp | cpMax | moveSpeed |
                                       runSpeedMultiplier | actionSpeed | moveMode
                                  내 화면 · collider-observe 꺼짐 · attribute-inspect 꺼짐
                                  → 아무것도 모르는 사람이 이 목록만으로 시작할 수 있다
    [UI-5]  "set-attribute move"  후보가 moveSpeed · moveMode 로 좁혀진다 (문제 표시 없음)
    [UI-6]  "…moveSpeed "         다음: 값  0 … 100  — 고른 속성이 값의 범위를 정했다
    [UI-7]  "…moveSpeed 9999"     "허용된 범위를 벗어난 값이다 — 9999 (0 … 100)"
                                  세계까지 가지 않고 걸기 전에 알려 준다
    [UI-8]  그대로 Enter           기록에 남는다 — 조용히 사라지지 않는다.
                                  세계로 나가지 않았다 (거는 것이 막힌다)
    [UI-9]  "…moveSpeed 30" Enter  기록: "받아들여졌다"
                                  자기 정보 패널이 "이동 속도 30 · 달리기 ×1.8" 로 바뀐다
                                  (대답과 관찰 결과가 각자 제 자리에서 드러난다)
    [UI-10] "collider-observe"     기록: "켰다" — 세계로 나가지 않았다
    [UI-11] 목록 재확인            collider-observe 켜짐 / attribute-inspect 꺼짐
                                  같은 값이 두 곳에서 어긋나지 않는다
    [UI-12] "teleport"             "그런 명령이 없다 — teleport"
    [UI-13] 쓰는 동안 W 두 번       입력칸에 "ww" 가 들어갔다 — 몸이 움직이지 않았다
    [UI-14] Escape                 닫힌다

    화면 확인 (스크린샷)
        c009-4-accepted   목록·안내·입력·기록이 한 화면에 있고, 받아들여진 줄은 초록,
                          거절된 줄은 빨강으로 갈린다. 세계 배지(파랑)와 내 화면
                          배지(노랑)가 origin 을 나눈다.
        c009-6-closed     collider-observe 를 명령으로 켠 뒤 — 세 몸에 초록 캡슐
                          충돌체가 그려져 있다 (C006 그대로, 다시 만들지 않았다).

    Cycle Goal 달성 — 목록을 펼쳐 보고, 골라, 값을 바꾸고, 대답을 사유와 함께 읽고,
    같은 자리에서 충돌체 관찰을 켰다. 전부 게임 안에서 이루어졌다.

## REGRESSION

    03 AFFECTED 전 항목.

    RULE-ATTRIBUTE-SET-001            판정 4종이 그대로다 (WORLD SCENARIO mark 101~104·106)
    RULE-MOVE-001 / MOVE-PROGRESS     move 요청이 지금까지대로 판정되고 대답도 온다
                                      (world/tests/command.spec.ts — RULE-MINE-001 로 확인,
                                       실측에서 move 로 12.00 이동)
    RULE-MINE-001                     세계 안의 행동도 같은 길로 대답을 받는다
    RULE-SKILL-BEGIN-001              world/tests/attack.spec.ts · combat.spec.ts 그대로
    RULE-MOVE-MODE-001                combat.spec.ts 그대로
    RULE-OBSERVER-JOIN/LEAVE/MARK     observer.spec.ts 26 · observer-mark.spec.ts 14 그대로
    RULE-DOWNED-001                   생명 0 → 쓰러짐, 되돌리면 일어남 (command.spec.ts)
    RULE-TEMPO-MOVE / ACTION          바뀐 속도로 지금까지대로 판정 (실측 12.00)
    RULE-CP-RUN-DRAIN-001             combat.spec.ts 그대로
    RULE-WORLD-TICK-001               world-tick.spec.ts 9항목 그대로 — 판정 순서 무변경

    과거 Cycle Scenario
        C001 Mining        mine.spec.ts 7       통과
        C002 Action        action.spec.ts 7     통과
        C003 World Server  world-host.spec.ts   통과 (+C009 6항목)
        C004 Multi Observer observer.spec.ts 26 통과
        C005 Link          link-telemetry 16 · world-link 18   통과
        C006 Collision     collision.spec.ts 8 · collision-debug.spec.ts 7   통과
        C007 Combat        combat.spec.ts 39 (world) · 21 (view)   통과
        C008 Orientation   view-orientation 16 · facing.spec.ts    통과

    전체            368 passed / 25 files      (npx vitest run)
    타입            tsc --noEmit 통과
    빌드            npm run build 통과
    Kind 정합       npm run catalog:check — "카탈로그 3원소가 정합한다"

## FAILURES

    구현 중 실측으로 발견해 고친 결함 2건. 둘 다 Stage 7 안에서 닫혔다 —
    설계 반환은 없었다.

    [FIXED] 대상 후보에 광맥이 섞였다
        증상   목록의 대상 자리가 npc-1 | npc-2 | player-1 | deposit-1 을 보여 주었다.
               광맥은 Actor 가 아니므로 세계는 그것을 unknown-target 으로 거절한다.
        원인   04 commandCatalog.domain.entity.refers 를 View 가 읽지 않고
               화면의 모든 존재를 후보로 내놓았다.
        고침   entityPool() 이 refers 로 거른다. 밝혀진 것과 걸 수 있는 것이 어긋나면
               목록은 안내가 아니라 함정이 된다.
        회귀   view/tests/command.spec.ts — "대상이 될 수 없는 존재는 후보에 없다"

    [FIXED] 쓰는 중인 낱말을 틀렸다고 말했다
        증상   "set-attribute move" 까지 쳤을 때 후보가 moveSpeed·moveMode 로 좁혀지면서
               동시에 "그 자리에 넣을 수 없다 — move" 가 빨갛게 떴다.
        원인   다 쓰지 않은 낱말에도 완성된 값과 같은 판정을 적용했다.
        고침   couldBecome() — 이어질 가망이 남아 있는 동안은 말하지 않는다.
               가망이 사라지면(zzz) 그때 말한다. 덜 쓴 낱말로는 걸리지 않는다.
        회귀   view/tests/command.spec.ts — "아직 쓰는 중인 낱말은 탓하지 않는다" ·
               "덜 쓴 낱말로는 걸리지 않는다"

    [NOTE] 사유 코드 이름 하나가 04 와 다르다 — 결함이 아니라 정합이다.
        04 는 목록에 없는 명령의 사유를 unknown-command 로 적었으나 실제 코드는
        기존 DISPATCH 의 unknown-interaction 이다. 뜻은 같다.
        명령과 세계 안의 행동이 같은 수용 경로를 지나므로 코드도 하나여야 한다 —
        두 이름을 두면 같은 판정이 어디로 왔느냐에 따라 다르게 불린다.
        06 NOTES 에 기록했고 문구 사전과 실측이 이 코드를 기준으로 한다.

## GATE (guides/verification.md DONE WHEN 15항)

    [x] 작은 플레이 가능한 Goal 이 정의되어 있다          01-cycle.md GOAL (R1)
    [x] Goal / Possibility 가 존재한다                    02-intent.md 4 Goal · 10 Possibility
    [x] Intent 가 존재한다                                02-intent.md 9 Intent
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다    03 SEMANTIC CLOSURE
                                                          (닫히지 않는 3건은 WORLD CHANGE: NONE
                                                           으로 사유와 함께 명시)
    [x] World State 변화가 World Rule 을 통해서만 발생한다  이번 Cycle 은 State 를 더하지 않았다.
                                                          값 변경은 RULE-ATTRIBUTE-SET-001 만이 한다
    [x] World 는 Authoritative 하다                       Client 는 요청만 한다. 범위 밖 값을
                                                          걸어도 세계가 거절했다 (mark=102)
    [x] GameView Specification 이 존재한다                04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다       view/ 에 world/ import 없음.
                                                          명령 목록도 세계가 준 것만 쓴다
                                                          ("세계가 밝히지 않은 명령은 목록에 없다")
    [x] World 는 View 구현 정보를 사용하지 않는다          world/ 에 view/ import 없음.
                                                          세계는 명령의 문법을 모른다
    [x] World 를 View 없이 검증할 수 있다                  world/tests/command.spec.ts 24항목
    [x] View 를 Fixture 만으로 검증할 수 있다              view/tests/command.spec.ts 34항목
    [x] Server + Client 연결 시 실제 플레이가 가능하다      PLAYABLE UI-1~14 실측
    [x] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
                                                          대답에 rule 이 실린다 —
                                                          RULE-ATTRIBUTE-SET-001 → INTENT-
                                                          ATTRIBUTE-MUTATE-001 → GOAL-WORLD-
                                                          TRANSPARENT (C007 R2).
                                                          RULE-REQUEST-REPLY-001 → INTENT-
                                                          REQUEST-REPLY-001 → GOAL-REQUEST-ANSWERED
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다     대기 — 자동 조작으로는 UI-1~14 까지
                                                          확인했다. 사람의 확인이 남았다
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다      COMMAND_CATALOG 에 항목을 더하면
                                                          목록·안내·기록·입력 차단이 그대로 돈다.
                                                          남는 것은 요청 형태 한 줄 (아래)

## NEXT CYCLE 후보 (이번 Cycle 이 남긴 것)

    요청 형태의 일반화
        새 명령을 더할 때 View 에서 손댈 곳이 정확히 한 줄 남는다 —
        command-request.ts 의 BUILDERS. 04 가 interaction 마다 요청 형태를 고정했기
        때문이며(SetAttribute(TargetActorId?, AttributeId, Value)), ActionRequest 가
        이름-값 묶음을 그대로 실어 나르면 사라진다. 세계 쪽 dispatch 의 분기도 함께 줄어든다.

    01 EXCLUDED 중 다음에 값어치가 큰 것
        세계 시간 조작 (멈춤 · 한 걸음 · 배속)
            충돌 순간을 멈춰 세워야 충돌체 라인을 제대로 읽을 수 있다.
            이번 Cycle 에서 캡슐이 그려지는 것은 확인했지만(c009-6-closed),
            움직이는 몸의 접촉 순간을 눈으로 붙잡을 수단은 아직 없다.
        존재 소환·제거
            시험용 몸이 있어야 전투 규칙을 반복해 볼 수 있다.
            지금은 세계가 띄울 때 정한 NPC 로만 시험한다.

## STATUS

    IN PROGRESS — Human Play 확인 대기

    15항 중 14항 통과. 남은 하나는 사람이 직접 플레이해 Cycle Goal 달성을 확인하는 것이며,
    그 확인 전에는 COMPLETE 로 바꾸지 않는다.

    사람이 확인할 것
        1. `./scripts/run.sh` (또는 `npm run dev`) 로 띄운다
        2. 화면 오른쪽 위 "명령: /" 를 보고 `/` 를 누른다
        3. 목록만 읽고 무엇을 할 수 있는지 알 수 있는가
        4. `set-attribute moveSpeed 30` 을 걸고 실제로 빨라진 몸으로 뛰어 본다
        5. `set-attribute moveSpeed 9999` 를 걸어 거절 사유가 읽히는가
        6. `collider-observe` 를 걸어 충돌체 라인이 켜지는가
        7. 명령을 쓰는 동안 WASD 가 몸을 움직이지 않는가
