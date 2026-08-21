# C020 — Verification

## 검사 6종

    [PASS] 1. Semantic Closure     Goal → Possibility → Intent → State/Rule 이 모두 연결된다
    [PASS] 2. World Rule 실행       View 없이 Before → Input → Rule → After 실측 (27건)
    [PASS] 3. Projection           04 계약대로 산출된다 (carried · carriedRoom · carry-full)
    [PASS] 4. View Binding         Fixture 만으로 View 가 그 의미를 표현한다 (15건)
    [PASS] 5. Playable             세계 → 계약 → 화면 → 요청 → 세계 가 한 줄로 이어진다 (7건)
    [PASS] 6. Regression           AFFECTED 전부 재실행 · 전체 911건 통과
    [PASS] 7. Catalog              `npm run catalog:check` — 3원소 정합 (존재 종류 무변경)

    [PASS] Human Play 확인 (2026-08-21) — 아래 STATUS 절 참조

## NEW BEHAVIOR

    지니는 데 자리가 든다
        캔 것이 자리에 담긴다. 같은 것끼리 겹쳐 쌓이고 한도를 넘으면 새 자리를 쓴다.
        자리의 수는 유한하고, 그 값은 세계를 띄우는 쪽이 정한다.

    자리가 없으면 받지 못한다
        캐기 **전에** 거절된다. 받지 못한 자원은 광맥에 그대로 남는다.
        전부 들어갈 때만 들어간다 — 반쯤 받아 두는 일이 없다.

    지닌 것 전부가 한자리에 보인다
        종류마다 따로 만든 칸이 사라졌다. 각 항목에 지금 무엇이 되고 왜 안 되는지가
        함께 온다.

    덜어낼 수 있다
        세계에 처음으로 **가진 것이 사라지는 경로**가 생겼다. 자리 하나가 요청의
        단위이며, 덜어낸 것은 세계 어디에도 놓이지 않는다.

    스스로 막히지 않는다
        지금 열려 있는 유일한 길을 여는 물건은 덜어낼 수 없다. 판정은 종류가 아니라
        **마지막인가**를 본다 — 곡괭이를 둘 지니면 하나는 덜어낼 수 있다.

    종류 이름이 규칙에서 사라졌다
        `ItemKind = 'stone' | 'pickaxe'` 합집합과 `MINING_CAPABLE` 하드코딩 집합이
        없어졌다. 채굴은 "든 것이 곡괭이인가" 대신 "이 몸에 캐는 용도가 지금 있는가"
        를 묻는다.

## WORLD SCENARIO

`world/tests/carry.spec.ts` — 27건 전부 통과. 실행 결과를 그대로 옮긴다.

    ── 카탈로그 ──────────────────────────────────────────────────────────
    정의 소유          pickaxe = { tool · stackable false · stackLimit 1 ·
                                  uses ['mining'] · itemType IT-COMMON-STONE }   PASS
    상위 유래          모든 정의가 `IT-*` 형태를 가리킨다                          PASS
    미등록 폴백        usesOf('unknown-thing') = [] · 겹치지 않는 것으로 친다      PASS

    ── 용도로 묻는다 ────────────────────────────────────────────────────
    용도 있음          mine.available = true                                     PASS
    용도 없음          actorItems {} → reason 'no-mining-tool'                    PASS
    재료만 지님        actorItems { stone: 1 } → reason 'no-mining-tool'          PASS
                       → **지녔다는 사실이 아니라 무엇을 여는가**를 묻는 것이 실측됐다

    ── 자리 ────────────────────────────────────────────────────────────
    시작               used 1 / total 3 · slot 0 = pickaxe ×1                     PASS
    쌓임과 새 자리      돌1 → 2/3 · 돌2 → 2/3 · 돌3 → 3/3                          PASS
    설정값             carryCapacity 8 → used 1 / total 8                        PASS

    ── 전량 아니면 전무 ──────────────────────────────────────────────────
    가득해도 받음      3/3 인데 mine.available = true → 돌 4                       PASS
    거절               돌 5 시도 → reason 'carry-full'                            PASS
    세계에 남는다      거절 뒤 광맥 잔량 1 그대로 · 지닌 돌 4 그대로                PASS
    부분 수용 없음      roomFor 1 일 때 canAccept(1)=true · canAccept(2)=false     PASS
    사유의 순서        고갈된 광맥 → 'deposit-depleted' (자리 이야기가 안 나온다)   PASS

    ── 관찰 ────────────────────────────────────────────────────────────
    전용 칸 제거       hud 에 inventory.stone · tool.hasMiningTool 없음            PASS
    가능/사유 동반      pickaxe.actions[0] = { let-go · available false ·
                       reason 'last-way-locked' }                                PASS
    용도 노출          pickaxe.uses = ['mining']                                 PASS
    빈 자리 미노출      capacity 8 인데 carried 는 1개                             PASS

    ── 덜어내기 ─────────────────────────────────────────────────────────
    자리가 빔          3/3 → 2/3 · 돌 4 → 2 (자리 하나가 통째로) · 다시 캘 수 있다  PASS
    세계에 안 나타남    덜어낸 뒤 entities 수 변화 0                                PASS
    없는 자리          carriedSlot 2 (빈 자리) → 'carried-not-found' · 상태 불변    PASS
    자리 미기재        carriedSlot 없음 → 'carried-not-found' · 상태 불변          PASS
    채굴 중에도 됨      state = 'mine' 인 채로 let-go 성공                          PASS

    ── 막힘 방지 ────────────────────────────────────────────────────────
    마지막 길 잠금      곡괭이 하나 → 'last-way-locked' · 그대로 남는다             PASS
    둘이면 풀린다      곡괭이 2 → 첫 요청 success · 남은 하나는 다시 잠긴다         PASS
    용도 없으면 무관    lastWayUses = ['mining'] · stone 의 uses = []               PASS

    ── BALANCE 여섯 판정이 한 시나리오에서 순서대로 ────────────────────────

        새 자리 2/3
        쌓임 2/3 · 돌 2
        가득 참 3/3
        가득해도 받음 돌 4
        거절 carry-full
        덜어냄 2/3 · 다시 캘 수 있는가 true

    기본 세계(광맥 하나 · 자원 다섯 · 자리 셋 · 돌 겹침 둘)에서 여섯이 전부 도달한다.
    03 BALANCE 의 주장이 그대로 재현됐다.

## VIEW FIXTURE

`view/tests/carry.spec.ts` — 15건 전부 통과 (World 미기동).

    소지품은 목록          전용 칸 없음 · carried.0 · carried.1 두 줄 (빈 자리 없음)  PASS
    겹침 표시              '돌 ×2 (2/2)' · 곡괭이는 이름만 (× 없음)                  PASS
    갈래 라벨              도구 / 재료                                              PASS
    잠긴 자리의 사유        '다시 캘 수 없다' 가 줄에 붙는다                          PASS
    허락된 자리            사유가 붙지 않는다                                        PASS
    겨눌 자리              letGoTargetSlot = 1 (0 은 잠김) · '[X]' 표시               PASS
    전부 잠긴 몸           targetSlot null · '덜어낼 수 있는 것이 없다'               PASS
    carry-full 문구        '자리가 없다' 를 포함한다                                 PASS
    가방 요약              '2/3' · 가득 차면 '3/3 — 가득 찼다'                       PASS
    세어서 알 수 없음       줄은 2개인데 전체는 3 — 목록만으로는 알 수 없는 값이다     PASS
    X → 요청               { interactionId 'let-go', carriedSlot 1 }                PASS
    겨눌 것 없으면          아무것도 보내지 않는다                                    PASS
    Client 무변경          요청만 나가고 Fixture 는 그대로                            PASS

## PLAYABLE

`world/tests/c020-integration.spec.ts` — 7건 전부 통과.
Fixture 가 아니라 **진짜 World 를 굴린 관찰 결과**를 진짜 View 결정 Layer 에 통과시키고,
거기서 나온 요청을 다시 세계에 넣는다.

    시작 화면          '1/3' · '곡괭이' · '다시 캘 수 없다' 가 화면 줄에 보인다      PASS
    캐면 함께 찬다      1/3 → 2/3 → '돌 ×1 (1/2)' → '돌 ×2 (2/2)'                    PASS
    가득 찬 화면        '3/3 — 가득 찼다' · 채집 프롬프트에 '자리가 없다'             PASS
    X → 세계가 비운다   요청 { let-go, carriedSlot 1 } → 3/3 → 2/3 → 다시 캘 수 있고
                       한 번 더 캐면 다시 3/3                                       PASS
    허락된 자리만       곡괭이만 지닌 몸에서 X → 보낼 자리 없음 · 아무 일도 없음       PASS
    두 자리 소멸        세계에도 화면에도 inventory.stone · tool.hasMiningTool 없음   PASS
    C001 REGRESSION    캐면 돌이 늘고 광맥이 5 → 4                                   PASS

    클라이언트 빌드    `npx vite build` — 성공

    ### 실제 브라우저 실측 (2026-08-21)

    빌드된 클라이언트를 헤드리스 Chromium 에 띄우고 광맥을 눌러 지목한 뒤 키보드로만
    조작했다. 전투 소음을 없애려 자율 존재를 빼고 몸을 광맥 옆에 세웠을 뿐 **규칙은
    하나도 바꾸지 않았다** (`npcs: []` · `actorPosition`).

    | 조작 | 가방 | 채집 | 광맥 |
    |---|---|---|---|
    | 시작 | `1/3` | 가능 | 돌 5 |
    | E ×4 | `3/3 — 가득 찼다` | 가방에 넣을 자리가 없다 | 돌 1 |
    | E 한 번 더 | `3/3` 그대로 | 가방에 넣을 자리가 없다 | **돌 1 그대로** |
    | B | `2/3` | 가능 | 돌 1 |
    | E | `3/3 — 가득 찼다` | — | 돌 0 |
    | B ×3 | `1/3` 에서 멈춤 | 광맥이 고갈되었다 | 돌 0 |

    페이지 오류 0. 곡괭이 줄은 여섯 순간 내내 `— 이걸 버리면 다시 캘 수 없다` 를 달고
    있었고, B 를 세 번 눌러 돌 두 자리를 다 비운 뒤에도 `1/3` 에서 멈췄다.

    **이 실측이 KeyX 버그를 잡았다** (07 NOTES ⑤). 화면에 `[X] 돌 ×2` 가 떠 있는데
    눌러도 아무 일이 없었다 — 그 키는 엔진이 시점 회전에 쓰고 있었다. 테스트 26건이
    전부 통과하는 상태였다: 모두 `binding.invoke` 를 직접 부르고 있었기 때문이다.

## REGRESSION

03 SEMANTIC DELTA 의 AFFECTED 를 전부 재실행했다.

    RULE-MINE-001 / COMPLETE-001      mine.spec.ts 7건 — 전부 통과.
                                      채굴의 기존 의미(대상·거리·고갈·행동 진입 시점)는
                                      하나도 바뀌지 않았다
    Observer 별 투영                   observer.spec.ts — "남의 소지품은 실리지 않는다"
                                      가 carried 목록에서도 그대로 성립한다
    Server Host                       world-host.spec.ts — 재참여 시 "같은 몸과 가진 것이
                                      이어진다" 가 통과한다 (호스트는 팩을 모른 채로)
    RULE-TARGET-SELECT-001 (C017)     target.spec.ts — 무변경
    행동 얼개 (C002)                   action.spec.ts — 무변경. 덜어내기는 행동이 아니다
    C019 선딜·캔슬                     c019-integration.spec.ts 3건 — 무변경
    View 결정 Layer                    resolve · combat · target spec 의 단언이 새 자리를
                                      가리키도록 바뀌었을 뿐 **검증의 의미는 무변경**

    전체       53 files · 911 tests 통과 (C020 이전 862 → 49 증가)
    타입       `npx tsc --noEmit` 오류 0
    경계       `npm run boundary:check` 위반 0 (engine→content · 팩 간 격리)
    카탈로그   `npm run catalog:check` 정합 (존재 종류를 건드리지 않았다)

## MASTER FEEDBACK

**보고까지가 이 단계의 책임이다.** `master/` 는 편집하지 않았다.

### ① Overlay — 승격할 Capability 가 없다

    MC-USE-ITEM        MISSING 유지
    MC-EQUIP-ITEM      MISSING 유지
    MC-CRAFT-*         MISSING 유지
    MC-TRANSFER-ITEM   MISSING 유지

    이 Cycle 은 넷 중 **아무것도 닫지 않았다.** IS §4 · §6 이 "능력이 아니라 넷의 바닥"
    이라 판정한 정의·소지 두 층에 소모를 더해 세웠을 뿐이다.

    다만 `overlay.md` 의 아이템 영역 표에서 **근거 칸이 낡았다.** 지금 그 표는
    "인벤토리는 종류→개수 Map 하나이고 그 값을 읽는 곳은 곡괭이가 있는가 하나뿐이다"
    라고 적고 있는데, 그 문장은 더 이상 사실이 아니다. 갱신 제안:

        MC-USE-ITEM 의 근거     "쓴다 · 준다 · 없어진다 가 0건이다" →
                               **"없어진다 는 C020 이 세웠다. 쓴다 · 준다 가 남았다"**
        MC-EQUIP-ITEM 의 근거   "지닌 것과 몸의 능력치는 서로를 모른다" 는 그대로.
                               다만 **접합점이 한 자리로 모였다**는 사실을 더할 만하다
                               (`carriedUses` — 06 NOTES ②)

### ② Frontier 문구 정정 — 이 Cycle 이 후보와 다르게 닫혔다

    `FR-WHAT-YOU-CARRY-CAN-BE-SPENT` 의 "세계에 생기는 것" 은 ④ 물건을 쓰는 행동
    ⑤ 쓰면 줄어든다 ⑥ 효과와 수량이 한 단위 를 약속했다. **④ 는 서지 않았다.**

    사유는 01 SCOPE NOTE ① 에 있다 — 세계에도 Master 에도 소비재가 0건이라 "쓴다" 의
    목적어가 없었고, Human 이 2026-08-21 에 "버리기(파기)로 연다" 를 골랐다.

    Master 가 정정할 것:

        Playable Result    "가진 것을 써서" → "가진 것이 자리를 차지하고, 덜어내면
                          자리가 빈다" (실제로 닫힌 것)
        세계에 생기는 것 ④  물건을 쓰는 행동 → **다음 Cycle 로**
        Missing / Partial  MC-USE-ITEM 은 이 Cycle 이 닫지 않았다

    **후보를 지우지 말 것을 권한다** — 남은 "쓴다" 가 다음 Cycle 의 후보이고,
    그 후보는 이 Cycle 이 세운 바닥 위에 곧바로 선다.

### ③ Cycle 경계 축소 보고 — IE §48 Cycle 1 행과의 차이

    Q34 로 확정된 IE §48 Cycle 1 행은 "이동·정렬·필터·분할(§31~§33)" 을 포함한다.
    이 Cycle 은 그것을 **EXCLUDED 로 두었다** (01 EXCLUDED "칸 배치 조작").

    사유: 세계가 칸을 소유하고 획득이 칸을 채우는 것까지가 "담을 자리가 유한하다" 의
    본체이고, 그 배치를 사람이 손으로 바꾸는 것은 표면의 편의다 (IS 비주입 판정과
    같은 계열). Cycle 을 한 몸으로 유지하기 위한 판단이기도 하다.

    Master 가 결정할 것: 이 축소를 받아들여 IE §48 을 정정할 것인가, 아니면 배치 조작을
    별도 후보로 세울 것인가. **Agent 는 후자를 권하지 않는다** — 배치 조작은 할 수 있는
    일을 늘리지 않아 단독 Cycle 의 조건(CLAUDE.md 원칙 6)을 만족하지 않는다.

### ④ IE §34 와의 관계 — 같은 이름의 다른 행동

    IE §34 는 "World Item System 이 구현되지 않은 단계에서는 [버리기] 버튼을 숨기거나
    `ACTION_NOT_AVAILABLE` 로 관찰한다" 고 적었다. 이 Cycle 은 그 단계에서 **덜어내기를
    열었다.**

    어기지 않았다고 본다 — IE §34 의 버리기는 **세계에 놓는 것**(IS §5.6)이고, 이 Cycle 이
    연 것은 **소모**(IS §5.5)다. 도착지가 다르다. 다만 두 행동이 플레이어에게는 같은
    이름으로 보일 것이므로, IE 가 그 구분을 본문에 두는 편이 낫다.

    제안 문안: "세계에 놓는 버리기는 World Item System 을 요구한다. 그 전에도 **덜어내기**
    (지닌 것을 없애 자리를 비우는 일)는 열 수 있다 — 도착지가 없을 뿐 소모는 소모다."

### ⑤ Constraint 판정 — 여섯 전부 지켜졌다

    DC-ITEM-KIND-IS-DATA-NOT-BRANCH    SATISFIED
        `ItemKind` 합집합과 `MINING_CAPABLE` 이 사라졌다. 규칙 코드에 종류 이름이
        남아 있지 않다 — 유일한 예외는 카탈로그 자체의 정의 목록이고 그것이 열쇠의 자리다
    DC-ITEM-CAPABILITY-COMES-FROM-GRANTS  SATISFIED
        채굴이 용도를 묻는다. 실측: 재료만 지닌 몸이 'no-mining-tool' 로 거절된다
    DC-ITEM-CHANGE-IS-ONE-UNIT          SATISFIED
        받기·덜어내기 모두 판정이 변경보다 먼저다. 실측: 거절 뒤 광맥도 지닌 것도 불변
    DC-ITEM-CAPACITY-IS-FINITE          SATISFIED
        규칙 코드가 3 을 묻지 않는다. carryCapacity 8 로 띄운 세계가 그대로 돈다
    DC-WORLD-OWNS-THE-SURFACE-LIST      SATISFIED
        `evaluateCarryLetGo` 를 관찰과 Rule 이 **함께 부른다**. View 는 판정을 하나도
        하지 않는다 — 실측: 화면이 겨누는 자리는 언제나 세계가 허락한 자리다
    DC-ITEM-HOLDING-IS-NOT-APPLYING     NOT_APPLICABLE (이 Cycle 의 대상이 아니다)
        적용이라는 개념이 세계에 없다. **세계는 여전히 이 원칙을 어기고 있다** —
        곡괭이를 지니고만 있어도 채굴이 된다. 장착 Cycle 이 닫을 자리이며,
        이 Cycle 은 그 위반을 `carriedUses` 한 자리로 모아 두었다

### ⑥ Constraint Candidate 후보 — 하나 관찰됐다

    **"세계가 여는 선택지 중 무엇을 고를지는 View 가 정한다."**

    이 Cycle 에서 두 번 나타났다.
        · `letGoTargetSlot` — 세계가 자리마다 되는지를 말하고, 화면이 그중 첫 자리를 고른다
        · 기존 `guardToggle` (C011) — 세계가 걸기·놓기를 열고, 화면이 지금 상태를 보고 고른다

    DC-WORLD-OWNS-THE-SURFACE-LIST 의 **경계**에 해당한다 (그 DC 는 "무엇이 선택지인가"
    만 세계에 두고 표현은 View 에 남긴다). 그 경계 조항이 이미 있으므로 새 DC 로
    승격할 필요는 없어 보이지만, 두 번째 관찰이므로 보고한다. 세 번째가 나오면
    그 DC 의 `prefers` 로 한 줄 더할 만하다.

### ⑦ Master Gap — 없다

    상위 의미와 어긋난 지점은 ② 하나이고, 그것은 Human 이 Stage 1 에서 이미 결정한
    사항이다. 새로 발견된 어긋남은 없다.

## FAILURES

    없음 — 검사 6종 + 카탈로그 전부 통과.

    Stage 6 에서 04 의 문장 하나를 정정했다 (SPEC AMENDMENT — `carriedSlot`).
    dispatch 가 `interactionId` 를 정확히 맞춰 찾으므로 "자리마다 다른 id" 가 성립하지
    않았다. 게임 의미가 바뀌지 않아 재승인을 받지 않았고 04 에 AMENDMENT 로 남겼다.
    이 판단이 과했다고 보면 Stage 5 로 반환한다.

## STATUS

    COMPLETE (2026-08-21)

    기계 검증 915 tests · tsc 0 · boundary 0 · catalog 정합 · 빌드 성공,
    그리고 **Human 이 실제 게임에서 Cycle Goal 달성을 확인했다.**

    Cycle Completion Gate 15항이 모두 참이다. 특히 마지막 둘:

        인간이 실제 게임에서 Cycle Goal 달성을 확인했다
            → 위 "실제 브라우저 실측" 의 여섯 순간 · Human 확인 2026-08-21
        결과를 다음 Cycle 에서 그대로 재사용할 수 있다
            → `carriedUses` 한 자리가 장착 Cycle 의 접합점이다 (06 NOTES ②).
              `ruleCarryLetGo` 의 Transition 한 줄이 세계 개체화의 접합점이다 (06 NOTES ④)
