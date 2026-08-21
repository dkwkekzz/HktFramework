# C023 — Verification

    [PASS] Semantic Closure     Intent 14 문장이 전부 State 또는 Rule 로 닿는다 (03 CLOSURE)
    [PASS] World Rule 실행       world/tests/equip.spec.ts 25/25 · World 단독
    [PASS] Projection           04 계약대로 산출 — equipment · equip-item · 유효 combatStats
    [PASS] View Binding         view/tests/equipment.spec.ts 13/13 · Fixture 만으로 (World 미기동)
    [PASS] Playable             실제 세계 프로세스 + WS 클라이언트 + 실제 브라우저 (아래)
    [PASS] Regression           982/982 · AFFECTED 여섯 전부 재실행
    [ — ] Catalog               존재 종류를 추가·변경하지 않았다 (해당 없음)

## NEW BEHAVIOR

    곡괭이를 가지고만 있으면 캐지지 않는다              ← 세계가 자기 원칙을 어기던 자리
    걸면 캘 수 있고, 몸의 물리 공격이 40 → 52 가 된다
    풀면 **정확히** 40 으로 돌아오고 다시 캘 수 없다
    걸린 것은 가방의 자리를 쓰지 않는다 (1/4 → 0/4)
    가방이 가득 차면 풀 수 없다 (`no-room`) — 두 유한함이 처음 만난다
    풀어서 가방에 둔 마지막 곡괭이는 덜어낼 수 없다 (`no-way-back`)
    걸 수 없는 물건은 `not-equippable` — **자리 탓이 아니다**

## WORLD SCENARIO — 실측 (world/tests/equip.spec.ts · 25/25 통과)

    자리가 있다
        자리 여섯이 비어 실린다 · 계약에 "무엇을 받는가" 칸이 없다 · 세계가 E1 을 고른다
    적합성
        돌 → not-equippable (억지 요청도 같은 사유) · 걸 수 있는 것은 겹치지 않는다 (IE §13.1)
        자리를 다 채우면 no-empty-slot
    걸어 둔 것만이 몸을 바꾼다
        지닌 채로 mine → no-mining-tool · 걸면 available · 풀면 다시 no-mining-tool
        곡괭이도 지니지도 걸지도 않은 몸은 **같은 사유**로 거절된다 (묻는 문장 무변경)
    재계산 ≠ 가감
        걸면 base+12 · 풀면 **정확히** base
        **백 번 걸고 백 번 풀어도 base** ← 표류가 구조적으로 불가능하다
        **둘을 걸면 base+24 · 하나만 풀면 base+12 · 둘 다 풀면 base**
        디버그로 넣은 50 은 기본값이다 → 걸면 62 · 풀면 50 (기본값은 건드려지지 않았다)
    한 곳에만
        걸면 가방에서 빠지고 used 1 → 0 · 풀면 되돌아온다
    푸는 데 자리가 필요하다
        가방 4/4 에서 풀기 불가 (`no-room`) · 억지 요청도 같은 사유 · **자리도 수량도 그대로**
        덜어내면 풀린다 · slot-empty · unknown-slot
    막힘
        걸어 둔 것이 있으면 가방의 같은 종류는 덜어낼 수 있다
        **풀어서 가방에 둔 마지막 곡괭이는 덜어낼 수 없다**
    그 밖
        걸기·풀기가 하던 행동을 끊지 않는다 · 걸린 것도 쓸 수 있다
        남의 적용은 관찰에 오지 않는다 · 자율 존재의 값은 기본값 그대로다

## VIEW FIXTURE — 실측 (view/tests/equipment.spec.ts · 13/13 통과, World 미기동)

    걸린 것과 지닌 것이 구분되어 보인다 · 걸면 가방 자리가 줄어드는 것이 보인다
    패널에 자리 여섯이 전부 서고 빈 자리도 보인다 · 번호는 걸린 자리에만
    걸어서 생긴 용도(채집)가 보인다 · 걸 수 없는 사유가 자리 탓으로 읽히지 않는다
    가득 찬 가방에서 풀기가 불가로 보인다 · 걸린 것도 쓸 수 있다
    **보태는 값을 몸의 값에 더하지 않는다** — 세계가 보낸 수 그대로 그린다
    **모르는 자리(MAIN-HAND) · 모르는 종류 · 모르는 용도 · 모르는 능력도 코드 그대로 그린다**

## PLAYABLE — 실제 세계 프로세스 + 실제 이어짐

    구성      `npm run world` (별도 프로세스, 자기 시계) ← WebSocket ← 클라이언트
              클라이언트는 브라우저와 **똑같은 봉투**(join · action)만 보내고
              관찰 결과만 읽는다. 세계 내부를 들여다보지 않는다.

    ① 세계에 붙었다 — 내 몸 player-1
       가방 1 / 4 · 지닌 것 [["pickaxe",1]] · 걸린 것 [] · 빈 자리 6 · 물리 공격 40
    ② 광맥으로 갔다 — 남은 것 15 · 거리 1.00
    ③ **가지고만 있는 채로 캐 본다** — 채집 가능? false · 사유 no-mining-tool
       세계의 대답 ["no-mining-tool"] · 지닌 것 [["pickaxe",1]]
       ← **곡괭이를 손에 쥔 채로 캘 수 없다.** 이 Cycle 이 여는 문장이 여기 있다
    ④ 건다 — 세계의 대답 [성공]
       걸린 것 ["E1:pickaxe physicalAttack+12"] · 가방 0 / 4 · 지닌 것 []
       물리 공격 **40 → 52** · 채집 가능? true
    ⑤ 가방이 찰 때까지 캤다 — 돌 12 · 가방 4 / 4 · 채집 불가(no-room) · 광맥 3 남음
    ⑥ 가득 찬 채로 풀어 본다 — 풀기 가능? false · 사유 no-room
       세계의 대답 ["no-room"] · 걸린 것 그대로  ← **아무것도 바뀌지 않았다** (IE §15)
    ⑦ 돌을 덜어낸다 — 가방 0 / 4 · 풀기 가능? true
    ⑧ 푼다 — 물리 공격 **52 → 40** · 걸린 것 [] · 지닌 것 [["pickaxe",1]]
       채집 가능? false (no-mining-tool)  ← **물건을 잃으면 도로 못 하게 된다**
    ⑨ 풀어 둔 마지막 곡괭이를 덜어내 본다 — 가능? false · 사유 no-way-back
       세계의 대답 ["no-way-back"] · 지닌 것 그대로
       ← **막힘 판정이 자리까지 보게 되어 C022 의 문장이 그대로 살았다**
    ⑩ 다시 걸고 캔다 — 돌 1 · 물리 공격 52 · 광맥 2

    → **Cycle Goal 의 문장이 그대로 일어났다** —
      "걸어야 캘 수 있고, 걸어 둔 것이 몸의 값을 바꾸며, 풀면 정확히 이전으로 돌아온다."

    브라우저 클라이언트 (빌드된 dist 를 세계 프로세스가 서빙 · 헤드리스 Chromium)

        붙은 직후    띠   `걸린 것: 없음 · 자리: 1 / 4 · ⛏ 1. 곡괭이: 1`
                    패널 `걸어 둔 것 (M → 번호)` / `· 빈 자리` ×6
                         `소지품` / `1. 곡괭이 ×1 · 쓰기 ✗ 대상 없음 ·
                          걸기 ✓ N → 1 · 덜어내기 ✗ 되돌릴 수 없음`
                         `물리 공격 40 …`

        N → 1 (건다) 띠   `걸린 것: 곡괭이 · 물리 공격 +12 · 자리: 0 / 4 · 소지품: 없음`
                    패널 `1. 곡괭이 · 물리 공격 +12 · 채집 · 쓰기 ✗ 대상 없음 ·
                          풀기 ✓ M → 1` / `· 빈 자리` ×5
                         `물리 공격 52 …`   ← **화면에서 값이 달라졌다**

        M → 1 (푼다) 띠   `걸린 것: 없음 · 자리: 1 / 4 · ⛏ 1. 곡괭이: 1`
                         `물리 공격 40 …`   ← **정확히 돌아왔다**

        페이지 오류 0 · 잘리는 곳 없음

    **첫 판은 여기서 걸렸다** — 07 REVISION ① 이 그 경위다. 손가락 자리를 `V` 에 두었는데
    `V` 는 이미 속성 관찰이었다. World 시험도 Fixture 시험도 전부 통과했다 — 둘 다 키를
    모르기 때문이다. 화면은 `걸기 ✓ V → 1` 이라고 **거짓을 말하고 있었다.**
    B(덜어내기) 옆 N·M 으로 옮긴 뒤 위 실측이 나왔다.

## CONSTRAINT 실측 — DC-ITEM-KIND-IS-DATA-NOT-BRANCH · DC-ITEM-CAPABILITY-COMES-FROM-GRANTS

    "자리 수도 기여도 값이며, 바꿔도 규칙 코드가 한 줄도 열리지 않아야 한다" 를
    **말이 아니라 실행으로** 확인했다. 값만 바꾸고 같은 각본을 그대로 다시 돌렸다.

        자리 6 · 기여 12   →  40/40 통과   (기준)
        자리 6 → **3**     →  40/40 통과
        + 기여 12 → **20** →  40/40 통과

        바꾼 파일   `equipment.ts` 한 줄 · `item.ts` 한 줄
        `world/rules/` · `world/projection/` 변경 줄 수   **0**
        각본 수정   0줄 (각본이 정의에서 값을 읽어 판단하므로 그대로 돈다)

    **이 시험을 세우다 한 번 되돌렸다.** 첫 판은 각본에 `base + 12` 를 박아 두어
    기여를 20 으로 바꾸자 세 곳이 깨졌다 — 규칙이 아니라 **시험이** 값을 알고 있었다.
    정의에서 읽도록 고친 뒤에야 이 항이 실제로 증명되었다.

    DC-ITEM-HOLDING-IS-NOT-APPLYING  **해소되었다.** 위 PLAYABLE ③ 이 그 실측이다.
    DC-ITEM-LIVES-IN-ONE-PLACE       걸린 것이 가방에서 사라지는 것을 ④ 가 보인다
    DC-ITEM-CHANGE-IS-ONE-UNIT       거절된 풀기가 자리도 수량도 건드리지 않는다 (⑥)
    DC-WORLD-OWNS-THE-SURFACE-LIST   화면의 available·사유가 전부 세계 판정에서 온다
    DC-GROWTH-DEFINITION-INSTANCE-SPLIT  개체를 만들지 않았다 — 자리가 종류를 담는다

## REGRESSION

    전체 982 tests 통과. 03 의 AFFECTED 여섯을 항목별로 확인했다.

    RULE-MINE-001              **코드 0줄.** 같은 함수에 같은 물음을 하고 답이 달라졌다.
                               mine.spec 7/7 — 걸기를 앞세운 뒤 C001 이래의 각본이 그대로 돈다
    RULE-ITEM-DISCARD-001      판정 범위가 넓어졌다. inventory-room.spec 15/15 —
                               C022 의 각본 전부가 자리 수만 하나씩 줄어든 채로 그대로 산다
    RULE-INVENTORY-ADD/REMOVE  걸기·풀기가 그 통로를 지난다. 수량이 음수가 되는 상태 없음
    RULE-DAMAGE-CALCULATE-001  **공식 0줄.** damage · damage-type · penetration · critical ·
                               combat · guard 6개 spec 전부 통과 — 아무것도 걸지 않은 몸의
                               피해가 C010~C015 의 실측치와 한 톨도 달라지지 않았다
    RULE-ATTRIBUTE-SET-001     밖에서 넣은 값은 기본값이다 (equip.spec 이 값으로 확인)
    RULE-OBSERVER-JOIN-001     **코드 0줄.** 새 몸은 빈 자리를 지니고 태어난다

    세계를 띄우는 값 하나가 움직였다 — 광맥 12 → 15.
    걸면 곡괭이가 가방을 떠나 담을 수 있는 돌이 9 → 12 로 늘었고, 광맥 12 로는 가방이
    차는 순간과 광맥이 마르는 순간이 겹쳐 **C022 가 세운 `no-room` 관찰이 플레이에서
    사라진다.** C022 자신이 5 → 12 를 올린 이유(그 03 RATIONALE 4)를 그대로 지킨 것이며,
    위 PLAYABLE ⑤ 가 `no-room` 이 여전히 겪힘을 보인다.

    갱신한 시험의 성격 — **의미가 아니라 자세가 바뀌었다.** 채집을 쓰는 각본 앞에
    `equipPickaxe(world)` 한 줄이 섰다. C014 의 `observeFully` · C017 의 `selectTarget` 이
    같은 자리에 선 것과 같으며, 세계를 약하게 만든 것이 아니라 걸기가 플레이의 한 걸음으로
    들어온 것이다.

## MASTER FEEDBACK

**보고까지가 이 단계의 책임이다 — `master/` 를 편집하지 않았다.**

### 1. Overlay 승격 — MC-EQUIP-ITEM: MISSING → PARTIAL

    근거는 위 실측이다 (코드가 있다는 사실이 아니다).

        닫힌 절반    빈 자리에 걸고 푼다 · 적합성 · 걸기/풀기의 원자성 ·
                    유효 값의 재계산 · 용도의 출처 · 적용의 관찰
        남은 절반    **교체** — 이미 찬 자리를 바꿔 끼우는 것, 그리고 가방이 가득 찬
                    상태의 비대칭("해제는 막히고 교체는 된다" IE §16.1).
                    그 노드의 world_shape 이 그것까지 요구한다.
                    지금은 `no-empty-slot` 으로 거절된다 (FR-ONE-SLOT-ONE-ITEM 이 닫는다)

    이로써 `IM-*` 의 grants 가 **처음으로 몸에 닿았다** — overlay 가 "이것이 없어
    grants 가 몸에 닿지 못한다" 로 적어 둔 자리다.

### 2. Overlay 갱신 — MC-ATTACK-POWER 의 결손 하나가 열렸다

    overlay.md 48행이 그 노드를 PARTIAL 에 두며 적은 결손이
    "**세계 안에서 이 값을 올릴 방법이 없다 — 디버그 명령이 유일한 경로다**" 였다.

    **곡괭이를 거는 것이 그 첫 경로다.** 물리 공격 40 → 52 가 플레이로 관찰된다.
    노린 것이 아니라 따라온 것이므로 Master 가 판정할 항목이다.
    (여전히 PARTIAL 인 이유는 그 값을 **키우는** 축 — 성장 · 배움 — 이 없기 때문이다.
    지금 열린 것은 "물건으로 값이 달라진다" 하나다.)

### 3. Possibility 갱신 — MP-ADAPT-BY-RESOURCE 의 문장이 세계에서 참이 되었다

    "물건이 대신해 주고, **물건을 잃으면 도로 못 하게 된다**" (BW §17).
    C020 으로 앞 절반이 섰고, **뒤 절반이 이 Cycle 로 섰다** — PLAYABLE ⑧ 이 그 실측이다.
    남은 것은 제작(MC-CRAFT-FROM-MATERIALS)이며 회복·절단 앞을 여전히 막고 있다.

### 4. Constraint Candidate — CC-THE-EFFECTIVE-IS-DERIVED-NOT-STORED

    "몸의 값이 여러 출처로 합성될 때, 그 값을 **저장하지 않고 매번 다시 센다**."

    관찰 둘이 같은 형태다 — C022 의 `UsedSlots`(자리)와 C023 의 유효 능력치.
    둘 다 저장하면 두 개의 진실이 생기고 그것을 맞추는 책임이 모든 변경 지점으로
    흩어진다. 파생으로 두면 "표류하지 않는다" 가 검사가 아니라 **구조**가 된다.

    승격 여부는 Human 판단이다. Scope 는 아이템에 한정되지 않는다 — 조건 층(지속 효과)이
    설 때 같은 얼개를 요구하게 되고(IE §21 의 "하나의 합성 얼개"), 그때 이 원칙이 미리
    서 있으면 그 층이 자기 기계를 따로 만들지 않는다.

### 5. Constraint Candidate — CC-THE-SURFACE-MUST-NOT-PROMISE-WHAT-THE-INPUT-CANNOT-DO

    "화면이 안내하는 손가락 자리는 실제로 그 일을 해야 한다."

    이 Cycle 의 첫 판이 정확히 그것을 어겼다 — 화면은 `걸기 ✓ V → 1` 이라고 말했고
    `V` 는 속성 관찰을 열었다. **World 시험도 Fixture 시험도 이것을 잡지 못한다** (둘 다
    키를 모른다). 지금 이 위반을 막는 것은 Stage 8 의 사람 손뿐이다.

    Master 노드가 아니라 **공정의 문제**일 수 있다 — 키 바인딩의 충돌을 기계가 확인하는
    자리가 없다. Constraint 로 세울지 도구로 세울지는 Human 판단이다.

### 6. Master Gap — 없음

    상위 Goal / Possibility / Capability / Constraint 와 어긋난 지점이 없다.
    다만 아래 둘은 Master 가 알아야 할 **어긋남에 가까운 것**이다.

    ① IE §10 의 비(比)가 이 세계에서 뒤집혀 있다 — 자리 6 · 가방 4
       "자리 수가 소지 칸 수보다 훨씬 적다" (30 : 6) 가 이 세계에서 6 : 4 다.
       **지금은 겪히지 않는다** — 걸 수 있는 물건이 곡괭이 하나뿐이라 자리가 여섯이든
       하나든 플레이가 같다. 겪히기 시작하는 것은 걸 수 있는 종류가 자리 수를 넘을
       때이고, 그날 값 하나가 움직이면 된다 (위 CONSTRAINT 실측이 그것을 보였다).
       어느 쪽을 움직일지(가방을 늘릴지 자리를 줄일지)는 그때의 Human 판단이다.

    ② 03 이 답하지 않은 것 하나를 Stage 6 이 닫았다 — 걸린 것을 쓰는 입구
       C020 이 세운 "곡괭이를 쓰면 채집이 시작된다" 가, 곡괭이가 가방을 떠나면서
       조용히 사라질 뻔했다. 규칙은 이미 옳았고 관찰만 없었으므로 자리에 `use-item` 을
       실었다 (06 NOTES ① · 04 에 반영). 의미를 새로 만든 것이 아니라 **잃을 뻔한 것을
       지킨 것**이며, Master Capability 를 늘리지 않는다.

## FAILURES

    없음. 이 Cycle 에서 되돌린 것 셋은 전부 검증 중에 잡혀 그 자리에서 고쳤다.

    ① 자리마다 성격을 박은 첫 판          Stage 5 에서 Human 이 되돌렸다 (05 검토 중 정정)
       IE §11 의 **예시**를 기본 사양으로 읽었다. 자리는 서로 같고 제한은 물건이
       선언할 때만 생기는 예외다 (IE §10).
    ② 손가락 자리 V·U                     Stage 8 PLAYABLE 에서 걸렸다 (07 REVISION ①)
    ③ 각본에 박힌 기여 값 12              위 CONSTRAINT 실측에서 걸렸다
       규칙이 아니라 시험이 값을 알고 있었다. 정의에서 읽도록 고쳤다.

    ②·③ 은 **기계 검증이 통과한 뒤에 걸린 것들**이다. 그것이 이 Stage 가 존재하는 이유다.

## STATUS

    COMPLETE

    Cycle Completion Gate 15항 **전부 충족**이다.

        [x] 작은 플레이 가능한 Goal 이 정의되어 있다
        [x] Goal / Possibility 가 존재한다
        [x] Intent 가 존재한다
        [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다
        [x] World State 변화가 World Rule 을 통해서만 발생한다
        [x] World 는 Authoritative 하다
        [x] GameView Specification 이 존재한다
        [x] View 는 Spec 외 World 정보를 사용하지 않는다
        [x] World 는 View 구현 정보를 사용하지 않는다
        [x] World 를 View 없이 검증할 수 있다
        [x] View 를 Fixture 만으로 검증할 수 있다
        [x] Server + Client 연결 시 실제 플레이가 가능하다
        [x] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
        [x] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다
        [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다

    마지막 항의 근거 — **Human 이 2026-08-21 에 닫았다.** 기계 실측(위 PLAYABLE)을 받고
    Cycle 을 완료로 판정했다. Agent 가 대신한 판정이 아니다.

    확인하는 법 (재현용으로 남긴다)
        npm run world  →  http://localhost:5180
        광맥 옆으로 가서 E — 캐지지 않는다 (곡괭이를 지녔는데도)
        N → 1 로 곡괭이를 건다 — 물리 공격 40 → 52 · 자리 1/4 → 0/4
        E 로 캔다 — 가방이 차면 no-room
        M → 1 로 풀어 본다 — 못 푼다 (no-room). B → 1 로 돌을 덜어낸 뒤 다시 M → 1
        풀면 물리 공격이 정확히 40 으로 돌아오고 다시 캐지지 않는다

## 다음으로 넘기는 것

    ① MASTER FEEDBACK 반영 — **아직 하지 않았다.** `master/` 는 Cycle 이 편집하지 않는다.
       위 MASTER FEEDBACK 여섯 항(Overlay 승격 2 · Possibility 갱신 1 ·
       Constraint Candidate 2 · 어긋남 보고 2)을 `advprotoh-master` 가 받아 반영한다.

    ② 소지품·장착 화면의 타일뷰 — 격자·빈 슬롯·드래그·우클릭 메뉴.
       **Cycle 이 아니라 기반 트랙 일이다** — 지금 `SceneHudItem.widget` 이
       `counter | flag | label` 셋뿐이라 격자를 그릴 능력이 없다 (engine/view-kernel).
       표시·우클릭·드래그로 걸기/풀기까지는 **World 도 계약도 바뀌지 않는다** —
       `inventoryRoom.capacity` 가 칸 수를, `equipment[]` 가 빈 자리를,
       `actions[]` 가 메뉴 항목과 사유를 이미 싣고 있다.
       칸 사이 이동·나누기·정렬은 세계에 칸 인덱스가 없어 후보 5 가 필요하다.
