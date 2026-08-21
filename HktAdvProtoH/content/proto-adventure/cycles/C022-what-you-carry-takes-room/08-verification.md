# CYCLE C022 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          (기계 구동 실측 · **Human 눈 확인 대기**)
[PASS] Regression

## NEW BEHAVIOR

    자리가 남았다              → 캔 것이 담긴다                        (지금까지대로)
    자리가 없다                → 캘 수 없다 (reason: `no-room`)         ← 새로 생긴 일
    가득 찬 채로 캐려 한다      → 거절되고 **광맥도 줄지 않는다**         ← 새로 생긴 일
    지닌 것을 덜어낸다          → 그 종류가 전부 사라지고 자리가 빈다     ← 새로 생긴 일
    돌아올 길이 없는 것을 놓는다 → 거절된다 (reason: `no-way-back`)       ← 새로 생긴 일

## WORLD SCENARIO — 실측 (world/tests/inventory-room.spec.ts · 15/15 통과)

    자리를 센다
        Before  곡괭이 1                          After  자리 1 / 4
        Before  곡괭이 1 · 돌 3                    After  자리 2 / 4   (⌈3/3⌉ = 1)
        Before  곡괭이 1 · 돌 4                    After  자리 3 / 4   (⌈4/3⌉ = 2)
        **겹치는 것과 겹치지 않는 것이 같은 식을 지난다** — 곡괭이는 ⌈1/1⌉ = 1

    담기가 거절된다
        Before  자리 4 / 4 (곡괭이 1 · 돌 9) · 광맥 3
        Input   mine
        Rule    RULE-MINE-001
        After   Failure(`no-room`) · **광맥 3 그대로** · 돌 9 그대로
        관찰    mine.available = false · reason = `no-room` (요청 전부터)

    덜어낸다
        Before  자리 4 / 4 · 돌 9
        Input   discard-item(stone)
        Rule    RULE-ITEM-DISCARD-001
        After   돌 항목 자체가 사라진다 · 자리 1 / 4 · **시간이 흐르지 않았다**
                존재 수 불변 · 광맥 불변 (덜어낸 것이 세계에 놓이지 않는다)
        그리고  mine.available 이 곧바로 true 로 돌아온다

    막힘이 막힌다
        Before  곡괭이 1 (세계에 곡괭이를 내는 광맥 0건)
        Input   discard-item(pickaxe)
        After   Failure(`no-way-back`) · 곡괭이 그대로
        대조    광맥을 말려 **돌을 다시 못 얻게 만들어도 돌은 막히지 않는다** —
                막는 것은 "다시 못 얻는 것" 이 아니라 "다시 못 얻는데 할 수 있던
                일이 사라지는 것" 이다. 판정이 종류가 아니라 **용도**를 본다는 실측이다

## VIEW FIXTURE — 실측 (view/tests/inventory-room.spec.ts · 13/13 통과, World 미기동)

    inventory-full.fixture.json  →  `자리: 4 / 4 (가득)` · 채집 `자리가 없다 — 무엇을
                                    덜어내야 한다` · 덜어내기 `가능 (B → 1)` ·
                                    곡괭이 `이걸 놓으면 되돌릴 수 없다`
    mining-available.fixture.json →  `자리: 2 / 4`
    빈 소지품                      →  자리 줄이 **그래도 뜬다** (항목 앞에 온다)

    화면이 자리를 셀 수 없다는 실측
        돌 9 개 · `stackable: true` 를 주고도 화면은 자리가 4 임을 알 수 없다 —
        한 자리에 몇까지인지가 계약에 없기 때문이다. (`'stackLimit' in item === false`)

    화면이 판정하지 않는다는 실측
        곡괭이의 `discard-item.available` 만 계약에서 뒤집으면 **View 코드 한 줄
        열지 않고** 덜어낼 수 있게 된다. 모르는 사유 코드도 화면을 멈추지 않는다.

## PLAYABLE — 실제 세계 프로세스 + 실제 이어짐

    구성      `npm run world` (별도 프로세스, 자기 시계) ← WebSocket ← 클라이언트
              클라이언트는 브라우저와 **똑같은 봉투**(join · action)만 보내고
              관찰 결과만 읽는다. 세계 내부를 들여다보지 않는다.

    ① 세계에 붙었다 — 내 몸 player-1
       자리 1 / 4 · 지닌 것 [["pickaxe",1]]        ← 곡괭이가 자리 하나를 쓴다
    ② 광맥으로 간다 — (8, -6) 에 남은 것 12 · 닿았다 (거리 1.17)
    ③ 캔다 — 돌 9 · 자리 4 / 4 · 채집 가능? false · 사유 no-room
    ④ 가득 찬 채로 다시 캐 본다 — 세계의 대답 ["no-room"]
       광맥 3 → 3 · 돌 9 → 9                       ← **거절이 세계의 것을 축내지 않았다**
    ⑤ 곡괭이를 놓아 본다 — 가능? false · 사유 no-way-back · 세계의 대답 ["no-way-back"]
    ⑥ 돌을 덜어낸다 — 돌 0 · 자리 1 / 4 · 채집 가능? true
    ⑦ 다시 캔다 — 돌 1 · 자리 2 / 4 · 광맥 3 → 2

    → **Cycle Goal 의 문장이 그대로 일어났다.**

    브라우저 클라이언트 (빌드된 dist 를 세계 프로세스가 서빙 · 헤드리스 Chromium)
        입력 경로  `B` → `1` 을 눌렀다 → 세계가 거절 → 곡괭이 1 그대로 · 페이지 오류 0
        화면       스크린샷으로 확인. **첫 판은 여기서 걸렸다** — 위 띠가 감싸지 않아
                   오른쪽이 잘려 있었다. 07 REVISION 이 그 경위와 고침이다.
        고친 뒤 실측 (가방이 가득 찬 몸으로 다시 들어가 확인)
            띠     `… 채집: 자리가 없다 — 무엇을 덜어내야 한다 · 자리: 4 / 4 (가득) ·
                    🪨 1. 돌: 9 · ⛏ 2. 곡괭이: 1 · 행동: 대기 …`  세 줄로 감싸진다
            패널   `소지품` / `1. 돌 ×9 · 쓰기 ✗ 이 대상엔 안 됨 · 덜어내기 ✓ B → 1`
                   / `2. 곡괭이 ×1 · 쓰기 ✗ 자리 없음 · 덜어내기 ✗ 되돌릴 수 없음`
            **잘리는 곳이 없다.** 페이지 오류 0

## CONSTRAINT 실측 — DC-ITEM-CAPACITY-IS-FINITE

    "칸 수를 바꿔도 규칙 코드가 한 줄도 열리지 않아야 한다" 를 **말이 아니라 실행으로**
    확인했다. 값 두 개만 바꾸고 **같은 플레이 각본을 그대로** 다시 돌렸다.

        자리 4 · 돌 3겹    →  돌 9 에서 가득 · `no-room` · 덜어내고 다시 캔다   PASS
        자리 3 · 돌 2겹    →  돌 4 에서 가득 · `no-room` · 덜어내고 다시 캔다   PASS
        자리 6 · 돌 5겹    →  **가득 차지 않는다** — 돌 12 에 자리 4/6

    바꾼 파일   `world-state.ts` 한 줄 · `item.ts` 한 줄. 규칙 코드 0줄.
    각본 수정   0줄 (각본이 값을 읽어 판단하므로 그대로 돈다)

    세 번째 줄이 값진 발견이다 — 자리가 광맥보다 커지면 한도가 **겪히지 않는다.**
    03 RATIONALE 4 가 광맥을 5 → 12 로 올린 이유가 추측이 아니라 관찰이 되었다.
    자리의 유한함은 세계에 캘 것이 자리보다 많을 때만 성립한다.

## REGRESSION

    전체        `npm test` → **55 files · 943 tests 전부 통과** (boundary:check 포함)
    타입/빌드    `npx tsc --noEmit` 무오류 · `npm run build` (tsc + vite) 성공
    카탈로그     `npm run catalog:check` → 3원소 정합 (존재 종류를 바꾸지 않았다)
    경계        engine → content import 0 · 팩 간 격리 유지

    03 AFFECTED 항목별

        RULE-ITEM-USE-COMPLETE-001   item-use.spec.ts 통과 — 소모는 자리를 열 뿐이다
        RULE-BODY-USES-001           mine.spec.ts · item-use.spec.ts 통과.
                                     곡괭이를 못 놓으므로 채집 용도가 사라지지 않는다
        RULE-OBSERVER-BODY-001       observer.spec.ts 통과 — 초기 소지품 그대로,
                                     이제 자리 1 을 쓴다 (플레이 ① 실측)
        RULE-MINE-001 / COMPLETE     mine.spec.ts 통과 — 자리가 있을 때 캐는 일은
                                     한 글자도 달라지지 않았다
        projectInventory             inventory.spec.ts (C020) 통과 — 목록의 형태 불변
        C020 전체                    item-use.spec.ts 통과 — 던지기·소모·정의소 그대로
        전투 계통 (C007~C019)         전 spec 통과 — 한 글자도 닿지 않았다

    고친 기존 시험 3건 (의미 변경이 아니라 **기대값의 출처**를 바로잡았다)
        mine.spec.ts · observer.spec.ts   광맥 양을 명시한다 (기본값을 따라다니지 않는다)
        item-use.spec.ts                  `stone.stackable` → `isStackable(stone)`
        combat.spec.ts · resolve.spec.ts  HUD 줄 순서에 `inventory.room` 이 든다

## MASTER FEEDBACK

    Capability Overlay

        없음 — 이 Cycle 은 Capability 노드를 목표로 삼지 않았다 (01 MASTER TRACE).
        소지 한도는 할 수 있는 일을 늘리는 것이 아니라 좁히는 것이므로 Capability 가 아니다.

        보고할 것은 **전제가 섰다** 는 것이다.
            MC-EQUIP-ITEM   막고 있던 것이 사라졌다.
                            `frontier.md` 의 "지금 열 수 없는 것" 표는
                            "막는 것이 하나만 남았다 — 자리가 유한해지는 것" 이라 적었고,
                            그것이 이 Cycle 로 섰다. 이제 IE §15 · §16.1 의 비대칭
                            ("가방이 가득할 때 해제는 막히고 교체는 된다")을 표현할
                            자리가 세계에 있다 — `Inventory.UsedSlots` 와 `no-room`.
                            근거: 이 문서의 WORLD SCENARIO · PLAYABLE
            MC-USE-ITEM     IMPLEMENTED 그대로 (C020). 이 Cycle 이 바꾸지 않았다

    Constraint Evaluation

        DC-ITEM-CAPACITY-IS-FINITE      SATISFIED
            칸이 생겼고, 관찰에 쓴 칸과 전체가 함께 실리며, 값을 바꿔도 규칙이 열리지
            않는다. **세 번째 항을 실행으로 확인했다** (위 CONSTRAINT 실측)

        DC-ITEM-CHANGE-IS-ONE-UNIT      SATISFIED
            획득도 덜어내기도 검증이 변경보다 먼저다. 부분 담기가 일어날 수 있는
            순간 자체가 코드에 없다. 거절된 채집이 광맥도 축내지 않는 것을 실측했다

        DC-ITEM-KIND-IS-DATA-NOT-BRANCH SATISFIED
            자리를 세는 코드에도, 담기를 거절하는 코드에도, 덜어내기를 막는 코드에도
            종류 이름이 한 번도 나오지 않는다. 오히려 **하드코딩이 하나 사라졌다** —
            `ruleInventoryAdd(actor, 'stone', 1)` 이 `deposit.resourceKind` 가 되었다

        DC-WORLD-OWNS-THE-SURFACE-LIST  SATISFIED
            쓴 자리·전체·모든 사유를 세계가 판정해 싣는다. 화면이 자리를 셀 수 없다는
            것을 시험이 지킨다 (StackLimit 이 계약에 없다)

        DC-GROWTH-DEFINITION-INSTANCE-SPLIT  SATISFIED
            개체를 만들지 않았다. 자리는 위치가 아니라 **수**다 — 자리에 이름이 없다

        DC-ITEM-LIVES-IN-ONE-PLACE · DC-ITEM-HOLDING-IS-NOT-APPLYING
            대상 아님 (01 MASTER TRACE 의 사유 그대로)

    Constraint Candidate

        **되돌릴 수 없는 막힘을 플레이어가 스스로 만들 수 없다** (가칭 DC-NO-DEAD-END)

        이 Cycle 에서 처음 이름을 얻었지만 처음 나타난 것은 아니다 — C019 의 캔슬,
        C011 의 막기 무너짐도 "스스로를 회복 불가능한 자리에 몰아넣을 수 있는가" 를
        같은 방식으로 다뤘다. 이번에 다른 점은 그 판정이 **세계의 상태에서 유도**된다는
        것이다 (표식이 아니라 "돌아올 길이 있는가"). 아이템이 늘고 경로가 늘수록 같은
        물음이 되풀이될 자리다.
        승격 판단은 Human 이다.

    Master Gap

        ① 번호 어긋남 — `master/` 가 이 Cycle 을 아직 `C021` 로 부른다
            자리    `frontier.md` (SELECTED 절 · "지금 열 수 없는 것" 표) ·
                    `open-questions.md` · `HISTORY.md`
            사유    같은 날 다른 갈래가 C021 을 쓰고 있어 Human 이 C022 로 옮기게 했다
                    (05-review.md). Cycle Agent 는 `master/` 를 편집하지 않는다
            할 일    세 파일의 `C021` → `C022`. 의미는 하나도 바뀌지 않는다

        ② IE §48 이 Cycle 1 에 넣은 것 하나를 이 Cycle 이 **하지 않았다**
            빠진 것  자리 배치 조작 (옮기기 · 맞바꾸기 · 나누기 · 정렬 · 필터)
            사유    세계가 자리를 소유하고 획득이 자리를 채우는 것까지가 "담을 자리가
                    유한하다" 의 본체이며, 그 배치를 사람이 손으로 바꾸는 것은 표면의
                    편의다. 지금 세계에 종류가 둘뿐이라 옮길 곳도 나눌 이유도 없다
            결과    **자리에 이름이 없다** — `UsedSlots` 는 수 하나다. 배치를 열려면
                    자리마다 신원을 주는 일이 먼저이고, 그것은 되돌리기 어려운 선택이다.
                    Master 가 그것을 별도 Frontier 로 세울지 판단할 자리다

        ③ 같은 이름의 다른 행동 — IE §34 의 "버리기" 와 이 Cycle 의 "덜어냄"
            IE §34 의 버리기는 **몸 → 세계 이동**이고 세계 개체화(IS §6 Cycle 4)를
            요구한다. 이 Cycle 이 세운 것은 **소모**다 (IS §5.5) — 덜어낸 것은 세계에
            놓이지 않고 없어진다.
            세계 개체화가 오면 같은 행동의 **도착지만** 바뀌고 행동 자체는 그대로 선다
            (RULE-ITEM-DISCARD-001 의 Transition 에 한 줄이 더해진다).
            Master 가 두 이름을 하나로 볼지 갈라 둘지 정할 자리다

        ④ 빈 가방을 플레이로 만들 수 없다
            곡괭이는 `no-way-back` 이고 돌은 캐야 생기므로 자리 0 인 화면을 사람이
            볼 경로가 없다. 규칙은 0 을 정상으로 답하고 계약도 그 값을 싣는다 —
            결함이 아니라 **지금 세계의 크기**다. 아이템이 늘면 저절로 사라진다

## FAILURES

    없음.

    Gate 15항 중 하나가 **미충족**이다 — `[ ] 인간이 실제 게임에서 Cycle Goal 달성을
    확인했다`. 기계가 같은 각본을 실제 세계 프로세스와 실제 브라우저로 두 번 돌았으나
    그것이 사람의 확인을 대신하지 않는다 (Verification Guide MUST).

    Human 확인 절차 (약 1분)
        1. `./run-split.sh`  (또는 `npm run world` + `npm run client`)
        2. HUD 왼쪽 위 `자리: 1 / 4` 를 본다
        3. 광맥으로 걸어가 `Esc` 로 지목을 풀었다면 광맥을 클릭해 고르고 `E` 로 캔다
        4. 아홉 번 캐면 `자리: 4 / 4 (가득)` 이 되고 채집 프롬프트가 불가로 바뀐다
        5. 소지품의 곡괭이 줄에 `덜어내기: 이걸 놓으면 되돌릴 수 없다` 가 떠 있다
        6. 돌 줄의 `덜어내기: 가능 (B → 1)` 대로 `B` 를 누르고 `1` 을 누른다
        7. 돌이 사라지고 `자리: 1 / 4` 로 돌아오며 다시 캘 수 있다

## STATUS

    IN PROGRESS — AWAITING HUMAN PLAY

    나머지 14 항은 충족되었고 그 근거는 이 문서의 실측이다.
    Human 이 위 절차로 확인하면 이 줄과 `01-cycle.md` 의 STATUS 를 `COMPLETE` 로 바꾼다.
