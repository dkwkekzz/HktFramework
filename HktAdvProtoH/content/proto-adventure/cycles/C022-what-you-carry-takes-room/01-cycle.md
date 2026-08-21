# CYCLE C022 — What You Carry Takes Room

[PASS] Cycle Definition           (자리와 덜어내기가 한 몸 · 앞 절반은 C020 이 세웠다 · 값은 Stage 3)
[PASS] Intent                     (자리 · 획득 원자성 · 덜어내기 · 막힘 방지 · 자리 관찰 · 값은 Stage 3)
[PASS] World Semantic             (자리는 파생 · 분기 없는 한 식 · 막힘은 용도로 판정 · 값 4·3·1·12)
[PASS] GameView Specification     (자리 둘은 목록 밖 · 덜어내기는 기존 actions 자리 · 새 interaction 없음)
[PASS] Human Semantic Review      (APPROVED — 판단 5건 이의 없음)
[PASS] World Implementation       (929 tests 통과 · 종류 이름 없는 자리·막힘 판정)
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

〔Stage 1 재작성 — 2026-08-21〕
    이 Cycle 은 `C020-what-you-carry-takes-room` 이라는 이름으로 먼저 정의되었다.
    그 판은 정의소 · 소지 관찰 · 사용 · 소모가 세계에 없다는 전제 위에 서 있었고,
    **작성 시점에는 그 전제가 참이었다.** 같은 날 다른 갈래에서 진행되던
    C020(아이템의 바닥)이 병합되면서 넷 다 서 버렸다.
    번호도 겹쳤다 — C020 이 둘이 되었으므로 이 Cycle 이 C021 로 옮겼고,
    그 뒤 C021 도 다른 갈래가 쓰고 있어 **C022 로 다시 옮겼다** (Human 지시, 2026-08-21).
    번호만 바뀌었고 이 Cycle 이 담는 의미는 한 글자도 달라지지 않았다.
    이 판은 병합된 세계를 다시 대조해 남은 것만 담는다 (SCOPE NOTE ①).

    **위층에 남은 어긋남** — `master/frontier.md` · `open-questions.md` · `HISTORY.md` 가
    이 Cycle 을 `C021` 로 부른다. Cycle Agent 는 `master/` 를 편집하지 않으므로
    고치지 않았고, `08-verification.md` 의 MASTER FEEDBACK 으로 보고한다.

## MASTER TRACE

    Frontier            FR-WHAT-YOU-CARRY-TAKES-ROOM — 자리가 유한해진다
                        (`master/frontier.md` SELECTED)
                        새 선택이 아니다 — Human 이 2026-08-21 에 고른 "아이템의 바닥"
                        이 Q34 로 다섯 조각이 되었고, 그중 넷이 C020 으로 닫혔다.
                        남은 하나가 자리이며 덜어내기가 그것과 한 몸인 것도
                        같은 날 Human 이 정했다 (master/HISTORY.md)

    Source Goal         MG-EXPLORE-BEIRA
                        베이라를 더 깊이 감당한다 — 지금 닿지 못하는 곳에 닿는다

    Source Possibility  MP-ADAPT-BY-RESOURCE
                        "자원으로 감당한다 — 물건이 대신해 주고, 물건을 잃으면 도로
                         못 하게 된다" (BW §17). 그 갈래의 첫 칸은 C020 으로 굴러가고,
                        이 Cycle 은 **무엇을 들고 나갈지가 선택이 되는 자리**를 연다

    Target Capability   **없음 — Capability 노드를 목표로 삼지 않는다.**
                        소지 한도는 할 수 있는 일을 늘리는 것이 아니라 좁히는 것이라
                        Capability 가 아니다 (`master/overlay.md` 아이템 절 · IS §4 · §6).
                        이 Cycle 이 여는 것은 **MC-EQUIP-ITEM 의 전제**다 —
                        IE §48 이 칸을 Cycle 1 에, 장착을 Cycle 2 에 두었고
                        Human 이 Q34 로 그 배치를 확정했다.
                        Frontier 의 7 조건 1 도 이 사유로 "노드 아님" 이다

    Reused Capability   MC-USE-ITEM              (overlay: **IMPLEMENTED** — C020)
                        MC-DESIGNATE-TARGET      (overlay: IMPLEMENTED — C017)
                        행동 얼개                 (C001 · C002 · C019 — 시간 · 대상 ·
                                                 중단 · 사유)

    Active Constraints  DC-ITEM-CAPACITY-IS-FINITE                (Q32 로 Active)
                        DC-ITEM-CHANGE-IS-ONE-UNIT
                        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
                        DC-WORLD-OWNS-THE-SURFACE-LIST            (GLOBAL)
                        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
                        DC-ITEM-LIVES-IN-ONE-PLACE 는 이 Cycle 의 대상이 아니다 —
                            저장소가 하나뿐이라 위반할 자리가 없다
                        DC-ITEM-HOLDING-IS-NOT-APPLYING 도 대상이 아니다 —
                            적용이라는 개념이 아직 없다 (아래)
                        DC-COMBAT-* 전부 무관 — 전투에 한 글자도 닿지 않는다

    Constraint Note

        DC-ITEM-CAPACITY-IS-FINITE
            칸이라는 개념을 세우되 **그 수를 규칙에 박지 않는다.** 값은
            `03-world-semantic.md` 가 소유한다. 관찰에는 쓴 칸과 전체가 함께 실린다.
            이 Cycle 의 성패를 가르는 검증이 여기다 — 칸 수를 바꿔도 규칙 코드가
            한 줄도 열리지 않아야 한다 (DC 의 requires 세 번째 항).

        DC-ITEM-CHANGE-IS-ONE-UNIT
            획득도 덜어내기도 전량 성공 또는 전량 실패다. 다 담기지 못한 획득은
            **아무것도 담기지 않는다** (IE §6.1). 실패한 시도는 수량에도 세계에도
            흔적을 남기지 않는다. C020 이 사용 쪽에서 이미 같은 형태를 세웠으므로
            (검증 → 효과 → 소모) 그 형태를 획득과 덜어내기로 넓히는 일이다.

        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
            C020 이 정의소를 세워 이 원칙의 본체는 이미 섰다. 이 Cycle 이 더하는 것은
            **겹칠 수 있는가와 그 한도**이며, 그것도 정의가 답한다. 규칙은 종류 이름을
            묻지 않는다.

        DC-WORLD-OWNS-THE-SURFACE-LIST
            쓴 자리와 전체, 그리고 "왜 못 받았는가" 를 세계가 판정해 싣는다.
            View 가 "칸이 몇 개인가" 나 "이건 덜어낼 수 있나" 를 자기 코드에서
            계산하지 않는다.

        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
            개체(Instance)를 만들지 않는다 — 같은 종류끼리 상태가 달라져야 할 이유가
            아직 없다 (IS §2.1). 칸은 위치이지 개체가 아니다.

        DC-ITEM-HOLDING-IS-NOT-APPLYING — 왜 대상이 아닌가
            **지금 세계는 이 원칙을 이미 어기고 있다** — 곡괭이를 가지고만 있어도
            채굴이 된다. C020 이 그 판정을 한 자리로 모았고(`world/rules/body-uses.ts`),
            그 답의 출처를 소지에서 적용으로 옮기는 것이 장착 Cycle 의 일이다.
            이 Cycle 은 그 자리를 건드리지 않는다.

## SCOPE NOTE — C020 병합 뒤 다시 대조한 것

다섯 중 둘이 **정정**이고 셋은 그대로 선다.

### ① 앞 절반은 이미 섰다  〔이전 판의 전제를 정정한다〕

    이전 판은 "세계에 쓸 수 있는 것이 하나도 없다" 를 근거로 정의소 · 관찰 · 소모를
    이 Cycle 이 세운다고 적었다. 병합된 세계에서 그 넷은 이미 있다.

        world/semantic/item.ts        아이템 정의의 **단일 출처**. 분류 · 용도 ·
                                      선언된 행동 · 위력 · 사용(사거리 · 시간 · 대상 ·
                                      소모량) · 효과 갈래를 정의가 지닌다
        world/rules/inventory.ts      수량 변경의 단일 통로
        world/rules/item-use.ts       사용 행동 — 검증 → 효과 → 소모가 한 단위다
        world/rules/body-uses.ts      "이 몸에 그 용도가 지금 있는가" 를 묻는 한 자리
        protocol/gameview.ts          `InventoryItemView[]` — 지닌 것 전부와 각 항목의
                                      가능/불가 사유가 이미 관찰에 실린다

    그러므로 이 Cycle 에 남은 것은 **넷**이다: 자리 · 획득의 원자성 · 덜어내기 ·
    막힘 방지. Master Capability 를 닫지 않는 것은 이전 판과 같으나, 이유가 다르다 —
    "쓸 대상이 없어서" 가 아니라 **한도가 애초에 Capability 가 아니기 때문**이다.

### ② 칸을 넣으면 출구가 반드시 함께 와야 한다  〔유지 · 근거 갱신〕

    C020 으로 줄어드는 경로가 하나 생겼다. 그러나 그 경로는 **조건이 붙는다** —
    고른 대상이 있어야 하고, 사거리 안이어야 하고, 그 대상이 요구 종류와 맞아야 한다.
    즉 **자리를 비우려고 쓸 수 있는 수단이 아니다.** 그리고 곡괭이는 쓸 수 없다.

        칸만 넣으면    상대가 없는 곳에서 가방이 차는 순간 채굴이 영구히 막힌다
        덜어내기가 오면 차면 무엇을 덜어낼지가 판단이 되고, 그것이 곧 한도의 의미다

    둘은 한 몸이며 이것이 이 Cycle 이 한 Cycle 인 이유다 — 칸 없는 덜어내기는 대가가
    없고, 덜어내기 없는 칸은 막다른 길이다.

### ③ 이 덜어내기는 IS §5.6 의 버리기가 아니다  〔유지〕

    IS §5.6 · IE §34 의 버리기는 **몸 → 세계 이동**이고, 그것은 세계 개체화
    (Cycle 4)를 요구한다. IE §34 는 그 단계 전에는 버튼을 숨기라고까지 적었다.

    이 Cycle 이 여는 것은 **소모**다 (IS §5.5 — "보유 수량을 감소시키는 기본 연산").
    덜어낸 것은 세계에 놓이지 않고 없어진다. 세계 개체화가 오면 같은 행동의
    **도착지**가 바뀔 뿐 행동 자체는 그대로 선다.

        지금        덜어낸다 → 없어진다
        Cycle 4     덜어낸다 → 세계에 놓인다

    IE §34 와의 관계는 **Master 보고 항목**이다 — 그 절이 전제한 "버리기" 와
    이 Cycle 이 세우는 "덜어냄" 이 같은 이름의 다른 행동이기 때문이다.

### ④ 목록 관찰 계약은 이미 있다  〔이전 판의 ④ 를 정정한다〕

    이전 판은 "`HudItemView` 는 값 하나짜리 형이라 목록을 실을 수 없다" 를 근거로
    새 자리가 필요하다고 적었다. C020 이 그 자리를 만들었다 —
    `InventoryItemView[]` 가 종류 · 수량 · 분류 · 상위 정의 · 겹침 여부와
    항목별 가능/사유를 이미 싣는다.

    없는 것은 **쓴 자리와 전체**다. 그 두 값을 어디에 싣는지는 Stage 4 가 정한다 —
    항목마다가 아니라 소지품 전체에 붙는 값이라는 것만 여기서 못박는다.

### ⑤ 곡괭이를 덜어내면 채굴이 영구히 막힌다  〔유지〕

    `world/rules/observer-body.ts` 가 곡괭이 하나를 초기 소지품으로 준다.
    그것을 얻는 다른 경로가 세계에 0건이다. 그러므로 덜어내기를 아무 제약 없이
    열면 플레이어가 스스로 게임을 막을 수 있다.

    이 Cycle 은 그 상태를 만들지 않는다. **무엇으로 막는가는 Stage 3 이 정한다** —
    사유 코드가 딸린 거절(IE §29 의 `LOCKED_ITEM` 계열)이 유력하지만, 판정의
    형태를 Stage 1 이 정하지 않는다. 여기서 못박는 것은 결과 하나다:
    **플레이어가 되돌릴 수 없는 막힘을 스스로 만들 수 있어서는 안 된다.**

## TYPE

    Existing Capability Enhancement

    C020 이 세운 아이템의 바닥(정의소 · 소지 · 관찰 · 사용 · 소모) 위에 **자리**를
    얹는다. 새로 생기는 개념은 하나다 — 지닌 것에 한도가 있다는 것, 그리고 그
    한도 때문에 플레이어가 스스로 줄이게 된다는 것.

## TARGET CAPABILITY

    자리의 유한함 (Finite Room)
        지닌 것이 유한한 자리에 담기고, 차면 더 받지 못하며, 덜어내면 자리가 빈다.
        Master Capability 노드는 아니다 (MASTER TRACE 참조) — 장착의 전제다.

## GOAL

    플레이어가 캔 것이 유한한 자리에 쌓이는 것을 보고, 자리가 차면 더 캐도 받지
    못하며 — 무엇을 덜어낼지 골라 자리를 비우면 다시 캘 수 있다.

## INCLUDED

    유한한 자리              담을 자리가 유한해진다. 겹칠 수 있는 것은 한도까지 한 자리에
                            쌓이고, 겹칠 수 없는 것은 자리 하나를 차지한다. **자리 수와
                            겹침 한도의 값은 Stage 3 이 소유한다.** 겹칠 수 있는가와
                            그 한도는 정의가 답한다 (C020 의 정의소에 항목이 는다)
    획득의 원자성            다 담기지 못하는 획득은 아무것도 담지 않고 사유와 함께
                            거절된다. 세계의 것은 그대로 남는다 (IE §6.1).
                            채굴이 세계에서 유일한 획득 경로이므로 그 규칙에 거절이 는다
    덜어내기                 지닌 것을 골라 덜어내면 그만큼 사라진다. **플레이어가
                            조건 없이 스스로 줄이는 첫 경로**다 — 사용(C020)은 대상과
                            사거리를 요구하므로 자리를 비우는 수단이 되지 못한다.
                            덜어낸 것은 세계에 놓이지 않는다 (SCOPE NOTE ③)
    덜어내기의 원자성         수량이 줄거나 줄지 않거나 둘 중 하나다. 실패한 요청은
                            흔적을 남기지 않는다
    자리의 관찰              쓴 자리와 전체가 함께 온다. 항목마다가 아니라 소지품 전체에
                            붙는 값이다 (SCOPE NOTE ④). 덜어내기의 가능/불가도
                            항목마다 이미 있는 형태로 실린다
    막힘 방지               플레이어가 스스로 되돌릴 수 없는 막힘을 만들 수 없다.
                            판정의 형태는 Stage 3 (SCOPE NOTE ⑤)

## EXCLUDED

    정의소 · 소지 관찰 · 사용 · 소모  **C020 이 이미 세웠다** (SCOPE NOTE ①).
                            이 Cycle 은 그것을 다시 만들지 않는다 — 정의에 항목
                            (겹침 여부·한도)이 늘고, 관찰에 값 둘이 는다
    장착                     자리 · 적합성 · 적용/해제 · 교체 · 유효 능력치.
                            IS §6 Cycle 2 · IE 전체가 소유한다. 이 Cycle 이 그 전제다
    세계에 놓이는 아이템       위치를 가진 아이템 존재 · 줍기 · 전리품 · 획득 권한 · 소멸.
                            IS §6 Cycle 4 다. 덜어낸 것은 세계에 나타나지 않는다
    제작                     재료 → 결과물. IS §6 Cycle 3
    자리 배치 조작            옮기기 · 맞바꾸기 · 나누기 · 정렬 · 필터. 세계가 자리를
                            소유하고 획득이 자리를 채우는 것까지가 "담을 자리가
                            유한하다" 의 본체이며, 그 배치를 사람이 손으로 바꾸는 것은
                            표면의 편의다 (IE §31~§33).
                            **IE §48 은 이것을 Cycle 1 행에 넣었다 — 08 MASTER FEEDBACK
                            에서 이 축소를 보고한다**
    가방 확장                자리 수를 늘리는 규칙. 자리 수는 이 Cycle 이 정하는 하나의
                            값이고, 그것을 바꾸는 것은 다음 이야기다 (IE §3.1)
    무게 · 부피              유한해지는 것은 자리이지 무게가 아니다. IE 는 무게 시스템을
                            요구하지 않는다
    개체 (Instance)          내구도 · 강화 · 귀속 · 랜덤 옵션. 같은 종류끼리 상태가
                            달라져야 할 이유가 없다 (IS §2.1 · DC-GROWTH-DEFINITION-INSTANCE-SPLIT)
    거래 · 화폐 · 등급 · 희귀도  아직 어느 Possibility 도 요구하지 않는다
    새 아이템 종류            쓸 물건의 갈래를 늘리지 않는다. 소비재 계통은 원천이
                            세계에도 그래프에도 없다 (HISTORY Q31)
    전투                     피해 · 방어 · 기력 · 스킬 · 캔슬에 한 글자도 닿지 않는다
    새 채집 대상              캘 수 있는 것을 늘리지 않는다. 세계에 있는 돌 하나로 족하다

## RELATED EXISTING CAPABILITY

    인벤토리 (C001 · C020)   종류별 수량과 그것을 바꾸는 단일 통로가 있다
                            (`world/semantic/inventory.ts` · `world/rules/inventory.ts`).
                            자리도 한도도 없다 — 이 Cycle 의 **CHANGED** 자리다
    아이템 정의소 (C020)      `world/semantic/item.ts` 가 종류의 단일 출처다.
                            겹침 여부와 한도가 여기 는다 — **CHANGED** (항목 추가)
    채굴 (C001 · C002 · C017)  광맥을 골라 캐면 돌이 하나 는다. 세계에서 유일하게
                            인벤토리를 늘리는 경로이며, 이 Cycle 이 여기에 **거절**
                            을 더한다 (`world/rules/mine.ts`)
    용도 판정 (C020)         `world/rules/body-uses.ts` 가 "이 몸에 그 용도가 지금
                            있는가" 를 한 자리에서 답한다. 곡괭이를 덜어내면 그 답이
                            바뀐다 — **재사용**이며 바꾸지 않는다 (SCOPE NOTE ⑤)
    사용 행동 (C020)         `world/rules/item-use.ts` — 검증 → 효과 → 소모가 한 단위다.
                            덜어내기가 같은 형태를 따른다. **재사용**
    행동 얼개 (C002 · C019)   모든 존재는 하나의 행동 안에 있고 시간 · 대상 · 중단 ·
                            진행도를 지닌다. 덜어내기가 시간을 요구하는 행동인지 즉시
                            요청인지는 Stage 3 이 정한다 — 구조는 **재사용**
    소지품 관찰 (C020)       `InventoryItemView[]` 가 지닌 것 전부와 항목별 가능/사유를
                            싣는다. 쓴 자리와 전체가 는다 — **CHANGED** (값 추가)
    가능/사유 계약 (C009 · C010)  `InteractionView.available/reason` · `CommandView` ·
                            `RequestOutcomeView`. 덜어내기의 가능/불가가 이 형태 위에
                            선다 — 새 기계를 만들지 않는다. **재사용**
    초기 소지품 (C001)       `observer-body.ts` 가 곡괭이 하나를 준다. 자리가 생기면
                            그것도 자리 하나를 차지한다. 곡괭이를 얻는 다른 경로는
                            0건이다 (SCOPE NOTE ⑤)
