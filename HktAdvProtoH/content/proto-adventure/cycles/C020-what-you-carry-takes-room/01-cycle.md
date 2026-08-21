# CYCLE C020 — What You Carry Takes Room

[PASS] Cycle Definition           (칸이 유한해지고 · 버려서 비우고 · 종류가 데이터가 된다)
[PASS] Intent                    (자리가 든다 · 전량 아니면 전무 · 덜어내면 빈다)
[PASS] World Semantic            (카탈로그 · 자리 목록 · 받기/덜어내기 · 마지막 길 잠금)
[PASS] GameView Specification    (소지품은 목록 · 판정은 세계 · 돌 전용 칸이 사라진다)
[PASS] Human Semantic Review     (APPROVED — 버리기로 연다 · BALANCE 세 값 승인)
[PASS] World Implementation      (카탈로그·자리·받기/덜어내기 · 신규 27건 · 전체 889건)
[PASS] View Implementation      (소지품은 줄 · X 로 덜어냄 · 신규 15건 · 전체 904건)
[PASS] Verification              (검사 6종+카탈로그 통과 · 911건 · Human Play 대기)

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-WHAT-YOU-CARRY-CAN-BE-SPENT — 아이템의 바닥
                        (`master/frontier.md` SELECTED · Human 선택 2026-08-21,
                         Q32 · Q33 · Q34 승인과 함께)

    Source Goal         MG-EXPLORE-BEIRA
                        베이라를 더 깊이 감당한다 — 지금 닿지 못하는 곳에 닿는다

    Source Possibility  MP-ADAPT-BY-RESOURCE 의 첫 칸
                        "자원으로 감당한다 — 물건이 대신해 주고, 물건을 잃으면 도로
                         못 하게 된다" (BW §17)

    Target Capability   MC-USE-ITEM                      (overlay: MISSING)
                        **이 Cycle 은 이 노드를 닫지 않는다** — SCOPE NOTE ① 참조.
                        세우는 것은 그것이 얹힐 바닥(정의 · 칸 · 관찰 · 소모)이다.
                        IS §4 · §6 이 정의와 소지를 "능력이 아니라 넷의 바닥" 으로
                        판정했고, 이 Cycle 이 그 바닥과 소모까지를 맡는다

    Reused Capability   MC-DESIGNATE-TARGET       (overlay: IMPLEMENTED — C017)
                        MC-OBSERVE                (overlay: IMPLEMENTED — C014 · C016)
                        채굴 행동 얼개              (C001 · C002 — 시간 · 대상 · 중단 · 사유)

    Active Constraints  DC-ITEM-KIND-IS-DATA-NOT-BRANCH
                        DC-ITEM-CHANGE-IS-ONE-UNIT
                        DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
                        DC-ITEM-CAPACITY-IS-FINITE                (Q32 로 Active)
                        DC-WORLD-OWNS-THE-SURFACE-LIST            (GLOBAL)
                        DC-GROWTH-NEED-FROM-POSSIBILITY
                        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
                        DC-ITEM-HOLDING-IS-NOT-APPLYING 은 이 Cycle 의 대상이 아니다 —
                            적용이라는 개념이 아직 없다 (Constraint Note 참조)
                        DC-ITEM-LIVES-IN-ONE-PLACE 도 대상이 아니다 —
                            저장소가 하나뿐이라 위반할 자리가 없다
                        DC-COMBAT-* 전부 무관 — 전투에 한 글자도 닿지 않는다

    Constraint Note

        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
            `ItemKind = 'stone' | 'pickaxe'` 라는 두 개짜리 합집합과
            `MINING_CAPABLE = new Set(['pickaxe'])` 이라는 하드코딩 집합을 없앤다.
            새 아이템은 카탈로그에 정의를 더하는 것으로 끝나고, 규칙은 종류 이름을
            묻지 않는다. **이 Cycle 의 성패를 가르는 검증**은 여기다 —
            정의를 하나 더했을 때 규칙 코드가 한 줄도 열리지 않아야 한다.

        DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
            채굴 판정이 "든 것이 pickaxe 인가" 에서 "이 몸에 채굴 용도가 지금
            있는가" 로 바뀐다. 단 **"지금 있는가" 의 답은 이번엔 소지가 낸다** —
            적용(장착)이라는 개념이 아직 세계에 없기 때문이다. 그 답의 출처를
            소지에서 적용으로 옮기는 것이 장착 Cycle 의 일이며, 이 Cycle 은
            묻는 문장만 바꾼다 (묻는 곳을 한 자리로 모아 두어 그때 한 곳만 고치면
            되게 한다).

        DC-ITEM-HOLDING-IS-NOT-APPLYING
            **지금 세계는 이 원칙을 이미 어기고 있다** — 곡괭이를 가지고만 있어도
            채굴이 된다. 이 Cycle 은 그것을 고치지 않는다. 고치려면 적용이라는
            자리가 있어야 하고 그것이 장착 Cycle 이다. 여기서 하는 일은 그 위반을
            **한 자리에 모아 두는 것**이다 — 지금은 mine 규칙 안에 흩어져 있다.

        DC-ITEM-CAPACITY-IS-FINITE
            칸이라는 개념을 세우되 그 수를 규칙에 박지 않는다. 값은
            `03-world-semantic.md` 가 소유한다. 관찰에는 쓴 칸과 전체가 함께 실린다.

        DC-ITEM-CHANGE-IS-ONE-UNIT
            획득도 버리기도 전량 성공 또는 전량 실패다. 다 담기지 못한 획득은
            **아무것도 담기지 않는다** (IE §6.1). 실패한 시도는 수량에도 세계에도
            흔적을 남기지 않는다.

        DC-WORLD-OWNS-THE-SURFACE-LIST
            지닌 것의 목록과 각 항목에 지금 무엇이 되고 무엇이 왜 안 되는지를
            세계가 판정해 싣는다. View 가 "칸이 몇 개인가" 나 "이건 버릴 수 있나" 를
            자기 코드에서 계산하지 않는다.

        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
            카탈로그는 유한한 **정의**다. 개체(Instance)를 만들지 않는다 —
            같은 종류끼리 상태가 달라져야 할 이유가 아직 없다 (IS §2.1).

## SCOPE NOTE — 코드·Master 대조로 드러난 것

Frontier 의 "이미 있는 것" 칸을 Stage 1 에서 다시 대조했다. 다섯이 나왔고
그중 첫 번째는 후보 문구를 **정정**한다.

### ① 세계에 쓸 수 있는 것이 하나도 없다 — "쓴다" 를 이 Cycle 이 닫지 않는다  〔Frontier 문구 정정〕

    후보의 Playable Result 는 "가진 것을 **써서** 세계나 자기 몸을 바꾼다" 였다.
    대조 결과 그 목적어가 세계에도 Master 에도 없다.

        world/semantic/item.ts        ItemKind = 'stone' | 'pickaxe' — 둘뿐이다
        master/growth/items/types/    IT-* 6종이 전부 무기 · 방어구 · 그릇 · 정박정이다.
                                      소비재가 0건이다
        HISTORY Q31                   회복은 원천(식물 계통)이 없어 다음 Cycle 로 미뤄졌다

    돌을 쓰면 무엇이 되는가에 세계가 답을 가지고 있지 않다. 답을 여기서 만드는 것은
    "없는 의미를 만들어 채우는" 일이고 금지다.

    Human 결정 (2026-08-21) — **버리기(파기)로 연다.**
    세계 최초의 "가진 것이 사라지는 경로" 를 사용이 아니라 버리기가 맡는다.
    새 아이템 의미를 하나도 지어내지 않으며, 칸이 찼을 때의 출구가 함께 생긴다.

        MC-USE-ITEM 은 MISSING 으로 남는다. 이 Cycle 이 세우는 것은 그 바닥이다.
        **Master 에 보고할 항목이다** (08 MASTER FEEDBACK) — Frontier 의 Playable
        Result 와 "세계에 생기는 것" ④~⑥ 이 정정 대상이고, Cycle 은 master/ 를
        고치지 않는다.

### ② 칸을 넣으면 출구가 반드시 함께 와야 한다

    Q34 로 소지 한도가 이 Cycle 에 들어왔다. 그런데 지금 세계에는 가진 것이
    줄어드는 경로가 **0건**이다 (`world/rules/mine.ts` 의 `+= 1` 이 유일한 변경).

        칸만 넣으면    가방이 차는 순간 채굴이 영구히 막힌다 — 되돌릴 방법이 없다
        버리기가 오면  차면 무엇을 버릴지가 판단이 되고, 그것이 곧 한도의 의미다

    ①의 결정이 ②를 동시에 푼다. 둘은 한 몸이며, 이것이 이 Cycle 이 한 Cycle 인
    이유다 — 칸 없는 버리기는 대가가 없고, 버리기 없는 칸은 막다른 길이다.

### ③ 이 버리기는 IS §5.6 의 버리기가 아니다

    IS §5.6 · IE §34 의 버리기는 **몸 → 세계 이동**이고, 그것은 세계 개체화
    (Cycle 4)를 요구한다. IE §34 는 그 단계 전에는 버튼을 숨기라고까지 적었다.

    이 Cycle 이 여는 것은 **소모**다 (IS §5.5 — "보유 수량을 감소시키는 기본 연산").
    버린 것은 세계에 놓이지 않고 없어진다. 세계 개체화가 오면 같은 행동의
    **도착지**가 바뀔 뿐 행동 자체는 그대로 선다.

        지금        덜어낸다 → 없어진다
        Cycle 4     덜어낸다 → 세계에 놓인다

    IE §34 와의 관계도 **Master 보고 항목**이다 — 그 절이 전제한 "버리기" 와
    이 Cycle 이 세우는 "덜어냄" 이 같은 이름의 다른 행동이기 때문이다.

### ④ 관찰 계약에 목록을 실을 형이 없다

        world/projection/observer-view.ts:446   { id: 'inventory.stone', kind: 'counter' }
        world/projection/observer-view.ts:447   { id: 'tool.hasMiningTool', kind: 'flag' }
        engine/protocol-core/gameview.ts        HudItemView.kind = 'counter' | 'flag' | 'label'

    돌 전용 칸이 있는 것만 문제가 아니다. **HudItemView 는 값 하나짜리 형이라
    가변 길이 목록을 실을 수 없다.** 소지품 전체와 각 항목의 가능/사유를 실으려면
    관찰 계약에 새 자리가 필요하다.

    가능/사유 계약 자체는 이미 있다 — `InteractionView.available/reason` ·
    `CommandView` · `RequestOutcomeView` 가 모두 사유 코드를 지닌다. 새 기계를
    만들지 않고 **그 형태를 소지품 항목에 그대로 쓴다.** 자리의 이름과 형은
    Stage 4 가 정한다.

### ⑤ 곡괭이를 버리면 채굴이 영구히 막힌다

    `world/rules/observer-body.ts:33` 이 곡괭이 하나를 초기 소지품으로 준다.
    그것을 얻는 다른 경로가 세계에 0건이다. 그러므로 버리기를 아무 제약 없이
    열면 플레이어가 스스로 게임을 막을 수 있다.

    이 Cycle 은 그 상태를 만들지 않는다. **무엇으로 막는가는 Stage 3 이 정한다** —
    사유 코드가 딸린 거절(IE §29 의 `LOCKED_ITEM` 계열)이 유력하지만, 판정의
    형태를 Stage 1 이 정하지 않는다. 여기서 못박는 것은 결과 하나다:
    **플레이어가 되돌릴 수 없는 막힘을 스스로 만들 수 있어서는 안 된다.**

## TYPE

    New Capability
        아이템이라는 개념 자체가 지금 세계에 형태로만 있다 — 종류별 숫자 Map 하나다.
        카탈로그 · 칸 · 소지품 관찰 · 소모는 전부 없던 것이다.
        다만 닫는 Master Capability 는 없다 (SCOPE NOTE ①) — 이 Cycle 은 IS 가
        "능력이 아니라 넷의 바닥" 이라 판정한 두 층에 소모를 더해 세운다.

## TARGET CAPABILITY

    아이템의 바닥 (Item Foundation)
        세계가 아이템을 정의하고, 그것이 유한한 칸에 담기며, 그 전부가 하나의
        관찰 계약으로 보이고, 덜어내면 사라진다.

## GOAL

    플레이어가 캔 것이 유한한 칸에 쌓이는 것을 보고, 칸이 차면 더 캐도 받지
    못하며 — 무엇을 덜어낼지 골라 자리를 비우면 다시 캘 수 있다.

## INCLUDED

    아이템 카탈로그          세계가 아이템 종류를 정의하는 단일 정의소. 무엇인가 ·
                            어떤 분류인가 · 겹칠 수 있는가 · 어떤 용도를 지니는가.
                            `ItemKind` 합집합과 `MINING_CAPABLE` 집합이 사라진다.
                            신규 아이템은 정의를 더하는 것으로 끝난다
    상위 정의 연결           각 정의가 자기가 어느 `IT-*` 에서 왔는지 밝힌다.
                            돌은 `IT-COMMON-STONE` 까지 추적된다. 세계 이름과 Master
                            이름을 같은 문자열로 강제하지 않는다 (IS §5.1)
    용도로 묻는 채굴          mine 규칙이 "든 것이 pickaxe 인가" 대신 "이 몸에 채굴
                            용도가 지금 있는가" 를 묻는다. 판정이 한 자리로 모인다
    유한한 칸               담을 자리가 유한해진다. 겹칠 수 있는 것은 한도까지 한 칸에
                            쌓이고, 겹칠 수 없는 것은 칸 하나를 차지한다. 칸 수와
                            겹침 한도의 **값은 Stage 3 이 소유한다**
    획득의 원자성            다 담기지 못하는 획득은 아무것도 담지 않고 사유와 함께
                            거절된다. 세계의 것은 그대로 남는다 (IE §6.1)
    소지품 관찰              지닌 것 전부가 한자리에 보인다 — 종류 · 수량 · 표시 정보 ·
                            지금 가능한 행동 · 불가 사유. 쓴 칸과 전체가 함께 온다.
                            `inventory.stone` 전용 칸이 사라진다 (SCOPE NOTE ④)
    덜어내기 (소모)          지닌 것을 덜어내면 그만큼 사라진다. 세계 최초로 가진 것이
                            줄어드는 경로다. 세계에 놓이지 않는다 (SCOPE NOTE ③)
    덜어내기의 원자성         수량이 줄거나 줄지 않거나 둘 중 하나다. 실패한 요청은
                            흔적을 남기지 않는다
    막힘 방지               플레이어가 스스로 되돌릴 수 없는 막힘을 만들 수 없다.
                            판정의 형태는 Stage 3 (SCOPE NOTE ⑤)

## EXCLUDED

    사용 행동 (MC-USE-ITEM)   지닌 것을 써서 몸이나 대상의 상태를 바꾸는 것. 세계에
                            쓸 대상이 0건이라 이번에 서지 못한다 (SCOPE NOTE ①).
                            다음 Cycle 이 원천과 함께 가져온다
    회복                     MC-RESTORE-BIOLOGICAL-STATE. Q31 이 이미 미뤘고 이 Cycle 도
                            닫지 않는다. 임의의 수치 회복으로 그 자리를 채우지 않는다
    세계에 놓이는 아이템       위치를 가진 아이템 존재 · 줍기 · 전리품 · 획득 권한 · 소멸.
                            IS §6 Cycle 4 다. 덜어낸 것은 세계에 나타나지 않는다
    장착                     자리 · 적합성 · 적용/해제 · 교체 · 유효 능력치. IS §6 Cycle 2 ·
                            IE 전체가 소유한다. 이 Cycle 이 그 바닥이다
    제작                     재료 → 결과물. IS §6 Cycle 3
    칸 배치 조작              옮기기 · 맞바꾸기 · 나누기 · 정렬 · 필터. 세계가 칸을 소유하고
                            획득이 칸을 채우는 것까지가 "담을 자리가 유한하다" 의 본체이며,
                            그 배치를 사람이 손으로 바꾸는 것은 표면의 편의다
                            (IS 비주입 판정과 같은 계열 · IE §31~§33).
                            **IE §48 은 이것을 Cycle 1 행에 넣었다 — 08 MASTER FEEDBACK
                            에서 이 축소를 보고한다**
    가방 확장                칸 수를 늘리는 규칙. 칸 수는 이 Cycle 이 정하는 하나의 값이고,
                            그것을 바꾸는 것은 다음 이야기다 (IE §3.1)
    무게 · 부피              유한해지는 것은 칸이지 무게가 아니다. IE 는 무게 시스템을
                            요구하지 않는다
    개체 (Instance)          내구도 · 강화 · 귀속 · 랜덤 옵션. 같은 종류끼리 상태가 달라져야
                            할 이유가 없다 (IS §2.1 · DC-GROWTH-DEFINITION-INSTANCE-SPLIT)
    거래 · 화폐 · 등급 · 희귀도  아직 어느 Possibility 도 요구하지 않는다
    전투                     피해 · 방어 · 기력 · 스킬 · 캔슬에 한 글자도 닿지 않는다
    새 채집 대상              캘 수 있는 것을 늘리지 않는다. 세계에 있는 돌 하나로 족하다

## RELATED EXISTING CAPABILITY

    인벤토리 (C001)          `Inventory { items: Map<ItemKind, number> }` — 종류별 숫자다.
                            칸도 한도도 없고 줄이는 함수도 없다. 이 Cycle 의 **CHANGED**
                            자리다 (`world/semantic/inventory.ts`)
    아이템 종류 (C001)       `ItemKind = 'stone' | 'pickaxe'` 와 `MINING_CAPABLE` 집합.
                            카탈로그가 이것을 대신한다 — 이 Cycle 의 **CHANGED**
                            (`world/semantic/item.ts`)
    채굴 (C001 · C002 · C017)  광맥을 골라 캐면 돌이 하나 는다. 세계에서 유일하게
                            인벤토리를 늘리는 경로이며, 이 Cycle 이 여기에 **거절**
                            을 더한다 (`world/rules/mine.ts` RULE-MINE-COMPLETE-001)
    도구 판정 (C001)         `hasMiningTool` → `hasMiningCapability` → 하드코딩 Set.
                            묻는 문장이 바뀌는 자리다 — **CHANGED**
    행동 얼개 (C002)         모든 존재는 하나의 행동 안에 있고 시간 · 대상 · 중단 · 진행도를
                            지닌다. 덜어내기가 시간을 요구하는 행동인지 즉시 요청인지는
                            Stage 3 이 정한다 — 구조 자체는 **재사용**이며 바꾸지 않는다
    고른 대상 (C017)         관찰자별로 고른 존재 하나를 세계가 지닌다. 채굴이 이미 그
                            관계에서 대상을 읽는다. 이 Cycle 은 그 자리를 건드리지 않는다
    가능/사유 계약 (C009 · C010)  `InteractionView.available/reason` · `CommandView` ·
                            `RequestOutcomeView`. 아이템의 가능/불가가 이 형태 위에 선다 —
                            새 기계를 만들지 않는다. **재사용**
    관찰 계약 (C002 · C004)   `HudItemView` 는 값 하나짜리 형이라 목록을 실을 수 없다.
                            소지품을 위한 자리가 새로 필요하다 — **ADDED** (SCOPE NOTE ④)
    초기 소지품 (C001)       `observer-body.ts` 가 곡괭이 하나를 준다. 칸이 생기면 그것도
                            칸 하나를 차지한다. 곡괭이를 얻는 다른 경로는 0건이다
                            (SCOPE NOTE ⑤)
