# C024 — World Semantic

> 이 Cycle 은 **World State 를 하나도 늘리지 않는다.** 자리도 소지품도 유효 값도 C023 ·
> C022 · C020 이 세운 그대로다. 늘어나는 것은 정의소의 항목 하나와, 이미 있는 규칙
> 하나가 지나갈 수 있는 **경로 하나**다. 그것이 이 후보가 "작음" 인 이유이며,
> 그 경로가 열리는 순간 가방의 가득 참이 모든 문을 닫지 않게 된다.

## SEMANTIC DELTA

    REUSED

        World.EquipSlots                여섯 그대로. 수도 이름도 성격도 열리지 않는다
        Actor.Equipment                 자리 → 담긴 종류. 구조가 그대로이므로 "한 물건은
                                        한 곳에" 가 교체에서도 검사 없이 성립한다
        Actor.Inventory                 그대로
        Actor.EffectiveStats            파생 그대로. **교체 뒤의 값을 이 Cycle 이 따로
                                        계산하지 않는다** — 걸린 것이 바뀌면 저절로 맞는다
        RULE-EQUIP-SLOT-FITS-001        교체도 이 판정을 지난다. 밀어낼 수 있다고 해서
                                        아무 데나 걸리지 않는다
        RULE-EFFECTIVE-STATS-001        열리지 않는다
        RULE-INVENTORY-ADD-001 ·
        RULE-INVENTORY-REMOVE-001       교체의 두 방향이 이 통로를 지난다.
                                        세 번째 통로를 파지 않는다
        RULE-INVENTORY-ROOM-001         "둘을 합쳐 모자라는가" 가 이것 하나에 묻는다
        RULE-ITEM-UNEQUIP-001           **한 글자도 바뀌지 않는다.** 이것이 이 Cycle 의
                                        절반이다 — 4/4 에서 여전히 no-room 이다
        RULE-BODY-USES-001              열리지 않는다. 걸린 것이 바뀌므로 답이 달라진다
        RULE-BODY-GRANTABLE-USES-001    열리지 않는다

    ADDED

        ItemCategory.gear               표시용 분류 하나 (IS §180 "장비·소비재·재료").
                                        **규칙은 이 값을 묻지 않는다** — 지금도 묻는 곳이
                                        0건이고 이 Cycle 도 만들지 않는다
        ItemDefinition(buckler)         두 번째 걸 수 있는 종류. 정의소에 항목 하나다
        RULE-ITEM-EXCHANGEABLE-001      "이 물건을 찬 자리와 바꿔 걸 수 있는가" 의 읽기 판정
        ActionRequest.SlotId (거는 쪽)    **형이 아니라 뜻이 는다.** `equipSlotId` 는 이미
                                        있고 지금은 푸는 요청에만 실린다
        InventoryItemView.actions
            [exchange-item]             소지품 항목마다 하나 느는 관찰
        Failure Reason: slot-not-fit ·
                        no-occupied-slot

    CHANGED

        RULE-ITEM-EQUIP-001             **이 Cycle 의 유일한 규칙 변경이다.**
                                        Input 에 자리가 (선택적으로) 실리고, 그 자리가
                                        차 있으면 밀어내기가 같은 단위 안에서 일어난다.
                                        **자리를 밝히지 않은 요청의 뜻은 한 톨도 바뀌지
                                        않는다**
        DEFAULT_BODY.items              `{ pickaxe: 1 }` → `{ pickaxe: 1, buckler: 1 }`
                                        (세계의 초기 설정 값 — 규칙이 아니다)

    AFFECTED

        RULE-BODY-USES-001              곡괭이를 밀어내는 교체는 그 자리에서 캘 수 없게
                                        만든다. 규칙은 열리지 않고 답만 달라진다
        RULE-MINE-001                   위와 같음. 부르는 쪽은 열리지 않는다
        RULE-ITEM-DISCARD-001           밀려나 가방으로 돌아온 것은 덜어내기의 대상이
                                        된다. 판정 자체는 열리지 않는다
        RULE-BODY-GRANTABLE-USES-001    buckler 는 **용도를 주지 않으므로** 이 판정의 답이
                                        달라지지 않는다 (BALANCE · JUDGEMENT ②)
        RULE-DAMAGE-CALCULATE-001       교체 뒤 한 방의 크기가 새것의 기여만 반영한다.
                                        공식도 읽는 값의 출처도 열리지 않는다 (회귀)
        RULE-GUARD-* · 피해 감산          armor 가 처음으로 세계 안에서 오른다.
                                        읽는 자리는 유효 값 하나 그대로다

## WORLD STATE

    **새 State 가 없다.**

    이 Cycle 이 요구하는 정보는 전부 이미 세계에 있다.

        Actor.Equipment[slot]     World Authority   무엇이 밀려나는가 — 여기 있다
        Actor.Inventory.Items     World Authority   무엇이 들어오는가 — 여기 있다
        World.InventoryCapacity   World Authority   자리가 모자라는가 — C022 그대로
        ItemDefinition.Equip      World Authority   걸릴 수 있는가 · 무엇을 주는가

    Authority 도 그대로다.

        Actor.Equipment           RULE-ITEM-EQUIP-001 · RULE-ITEM-UNEQUIP-001 뿐
        Actor.Inventory           RULE-INVENTORY-ADD/REMOVE-001 뿐 — 교체도 그 통로를 지난다
        Actor.EffectiveStats      누구도 바꾸지 않는다. 계산이 낳는다

    **상태를 늘리지 않고 경로만 여는 Cycle** 이라는 것이 이 절의 내용이다.
    늘릴 것이 있었다면 그것은 이 후보가 아니라 다른 후보였을 것이다.

## WORLD RULE

    RULE-ITEM-EQUIP-001 (CHANGED)
        Implements     INTENT-EXCHANGE-APPLIED-ITEM-001 ·
                       INTENT-THE-DISPLACED-IS-NAMED-001 ·
                       INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001 (CHANGED) ·
                       INTENT-EXCHANGE-DOES-NOT-ASK-FOR-NEW-ROOM-001 ·
                       INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001 ·
                       INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001
        Input          Actor, ItemKind, **SlotId?** (밝히지 않을 수 있다)
        Preconditions  1. 그 종류의 정의가 있다                       (unknown-item)
                       2. Items[kind] > 0                            (not-enough)
                       3. 정의에 Equip 이 있다                        (not-equippable)

                       ── 자리를 밝히지 않았다면 (C023 그대로) ──
                       4. RULE-EQUIP-SLOT-FITS-001 이 참인 **빈 자리**가
                          하나 이상 있다                              (no-empty-slot)

                       ── 자리를 밝혔다면 (ADDED) ──
                       5. 그 자리가 세계에 있다                        (unknown-slot)
                       6. RULE-EQUIP-SLOT-FITS-001(slot, kind) 이 참   (slot-not-fit)
                       7. 그 자리가 차 있다면, 나가는 하나를 빼고 밀려나는
                          하나를 넣은 뒤의 UsedSlots <= Capacity       (no-room)
                          — RULE-INVENTORY-ROOM-001 이 판정한다
        Transition     Slot = 밝힌 자리, 또는 조건을 만족하는 빈 자리 중 차례가 가장 앞선 것
                       Old  = Equipment[Slot]        (비어 있으면 없다)
                       RULE-INVENTORY-REMOVE-001(kind, 1)
                       Equipment[Slot] = kind
                       Old 가 있으면 RULE-INVENTORY-ADD-001(Old, 1)
        Result         Success | Failure(reason)

        Note — 왜 규칙이 둘이 아니라 하나인가

            거는 것과 바꿔 끼는 것을 **다른 요청**으로 가르면, 어느 쪽을 보낼지 정하기
            위해 화면이 "그 자리가 지금 찼는가" 를 판정해야 한다. 그것은 세계의 사실이며
            화면이 답할 것이 아니다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
            겪는 사람이 하는 일도 하나다 — "이것을 여기에 건다".

        Note — 나가는 것이 먼저다

            빼기가 담기보다 먼저이므로 밀려난 것이 들어올 자리는 이미 비어 있다.
            그러나 그것은 편의가 아니라 **순서가 결과를 바꾸지 않게 하기 위한 것**이며,
            애초에 Precondition 7 이 둘을 합친 결과를 먼저 묻는다. 검증이 변경보다
            먼저이므로 중간 상태가 관찰되는 순간이 없다.

        Note — Precondition 7 은 지금 세계에서 결코 실패하지 않는다

            걸 수 있는 물건은 **반드시 겹치지 않는다** (`semantic/item.ts` 의 카탈로그
            불변 조건 · IE §13.1). 그러므로 걸 수 있는 것 하나가 가방에서 나가면 정확히
            한 자리가 비고, 하나가 들어오면 정확히 한 자리를 쓴다 — 순 증가는 언제나 0 이다.
            같은 종류끼리의 교체에서도 0 이다.

            **그래도 규칙이 묻는다.** 묻지 않으면 이 규칙이 그 불변 조건에 조용히
            기대게 되고, 불변 조건이 언젠가 달라질 때 아무 데서도 걸리지 않는다.
            이것이 §16.1 을 "특례" 가 아니라 **계산의 결과**로 만드는 자리다.

        Note — 자리를 밝히지 않은 요청의 뜻은 바뀌지 않는다

            빈 자리가 없으면 여전히 `no-empty-slot` 이다. 세계가 슬그머니 무언가를
            밀어내지 않는다. 무엇을 잃을지는 겪는 사람이 고른다
            (INTENT-THE-DISPLACED-IS-NAMED-001).

        Note — 같은 종류로 바꿔 끼면 아무것도 바뀌지 않는다

            세계는 개체를 구분하지 않으므로(DC-GROWTH-DEFINITION-INSTANCE-SPLIT)
            자리의 곡괭이와 가방의 곡괭이는 **같은 것**이다. 그 교체는 성립하고,
            성립한 뒤의 세계는 이전과 한 톨도 다르지 않다. 거절하지 않는다 —
            거절하려면 세계가 종류의 같음을 조건으로 삼아야 하고, 그것은 아무도
            겪지 않는 사정을 위해 규칙에 분기를 하나 두는 일이다 (JUDGEMENT ①)

    RULE-ITEM-EXCHANGEABLE-001 (ADDED)
        Implements     INTENT-EXCHANGE-IS-OBSERVED-001 ·
                       INTENT-EACH-REFUSAL-HAS-ITS-OWN-REASON-001
        Input          Actor, ItemKind
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         null                 바꿔 걸 수 있다
                       unknown-item         그 종류를 세계가 모른다
                       not-enough           지니지 않았다
                       not-equippable       걸 수 있는 물건이 아니다
                       no-occupied-slot     밀어낼 수 있는 **찬 자리**가 하나도 없다
                                            (전부 비었거나, 이 물건이 걸릴 수 있는
                                             찬 자리가 없다)
        Note           **자리를 묻지 않는다.** 어느 자리와 바꿀지는 요청이 밝히므로,
                       이 판정이 답하는 것은 "바꿔 걸 자리가 하나라도 있는가" 다.
                       그러므로 관찰에 가능으로 실린 것은 **적어도 하나의 자리에서**
                       성립한다 — 겪는 사람이 그 자리들을 이미 보고 있다
                       (EquipmentSlotView 가 찬 자리와 빈 자리를 전부 싣는다).

                       `no-room` 이 이 목록에 없는 것은 위 Precondition 7 의 사정
                       그대로다 — 교체는 자리를 요구하지 않는다.

    RULE-ITEM-UNEQUIP-001 (REUSED · 변경 없음)
        Preconditions  3. 그 종류 하나를 담을 자리가 있다               (no-room)
        Note           **이 줄이 그대로인 것이 이 Cycle 의 절반이다.**
                       교체가 되도록 만들면서 이 줄까지 풀면 세계는 자리의 유한함을
                       잃는다. 같은 세계 상태에서 이 규칙은 막히고 위 규칙은 성립해야
                       하며, 둘 중 하나만 그러면 이 Cycle 은 닫히지 않는다 (IE §46 Test 09)

## OBSERVABLE SEMANTIC

    InventoryItemView.actions           (CHANGED — exchange-item 이 하나 는다)

        equip-item                      **C023 그대로.** 자리를 밝히지 않고 빈 자리에
                                        건다. 빈 자리가 없으면 no-empty-slot.
                                        뜻도 사유도 한 글자도 바뀌지 않는다
        exchange-item        (ADDED)    이미 찬 자리의 것과 바꿔 건다.
                                        available · unavailableReason 은
                                        RULE-ITEM-EXCHANGEABLE-001 이 답한다
        use-item · discard-item         그대로

        **두 항목이 나란히 있는 것이 비대칭이 화면에 드러나는 자리다.** 가방이 가득 찬
        4/4 에서 자리의 unequip-item 은 no-room 으로 불가인데, 같은 화면의
        exchange-item 은 가능이다.

    EquipmentSlotView                   (변경 없음)

        자리마다 무엇이 담겼고 무엇을 주며 풀 수 있는지가 그대로 온다.
        **찬 자리와 빈 자리가 전부 실리므로** 겪는 사람은 어디와 바꿀 수 있는지를
        이미 보고 있다. 자리 쪽에 교체 항목을 두지 않는 이유가 이것이다 —
        자리 쪽에 두면 "무엇으로 바꾸는가" 가 빠진다 (RATIONALE 5)

    AttributesView.combatStats          (변경 없음 · 값이 움직인다)

        교체 전후로 두 값이 **동시에 반대로** 움직인다. 곡괭이를 밀어내면 물리 공격이
        기본값으로 정확히 돌아가고 armor 가 오른다. 그 정확함이 "헌것의 기여가
        사라졌다" 의 증거다 — 가산이었다면 물리 공격이 52 에 머문다

    InventoryRoomView                   (변경 없음)

        교체 전후로 **used 가 달라지지 않는다.** 이것이 §16.1 의 관찰이다

    관찰하지 않는 것

        교체하면 값이 어떻게 될까      **싣지 않는다** — 미리보기이며 후보 2 의 일이다
                                     (01-cycle.md EXCLUDED)
        어느 자리와 바꾸는 것이 나은가  세계가 고르지 않는다
        (물건 × 자리) 모든 짝의 판정    싣지 않는다. 짝의 수만큼 항목이 늘면 계약이
                                     자리 수와 소지 종류 수의 곱으로 자란다.
                                     지금 세계에서 짝의 판정은 물건 쪽과 자리 쪽으로
                                     **갈라지므로** 그 곱이 필요하지 않다 (RATIONALE 6)

    Observable Closure

        바꿔 걸 수 있는가 / 왜 안 되는가    InventoryItemView.actions[exchange-item]
        빈 자리에 걸 수 있는가 / 왜         InventoryItemView.actions[equip-item]  (C023)
        풀 수 있는가 / 왜 안 되는가         EquipmentSlotView.actions[unequip-item] (C023)
        어느 자리가 차 있는가              EquipmentSlotView.item                  (C023)
        무엇이 밀려나는가                  EquipmentSlotView.item 이 곧 그것이다
        교체 뒤 몸이 어떻게 되었는가        AttributesView.combatStats (유효 값)
        가방이 얼마나 찼는가               InventoryRoomView — 교체 전후로 같다
        캘 수 있는가 / 왜 안 되는가         InteractionView(mine) — C001 무변경.
                                        곡괭이가 밀려나면 기존 사유 그대로 불가다

## BALANCE

    ItemCategory                   material | tool | consumable | **gear**  (ADDED)

    buckler (ADDED)                손방패 — 문명권에서 만든 평범한 것.
                                   곡괭이와 같은 사정이다
        Category                   gear
        Origin                     **없음** — 곡괭이와 같다. 상위 정의를 세울지는
                                   위층의 판단이며 Q36 이 그것을 열어 두고 있다
                                   (JUDGEMENT ③)
        StackLimit                 1      걸 수 있는 것은 겹치지 않는다 (불변 조건)
        Uses                       **없음** — 용도를 주지 않는다.
                                   그래서 곡괭이를 밀어내면 캘 수 없게 된다
        Use                        **없음** — 쓸 수 있는 물건이 아니다
        Equip.Targets              (없음) → 제한 없음. 여섯 어느 자리에나 걸린다
        Equip.Contributions        **armor +15**

    pickaxe                        그대로 — physicalAttack +12
    stone                          그대로
    World.EquipSlots               6 그대로
    World.InventoryCapacity        4 그대로 — **움직이지 않는다**
    DEFAULT_BODY.items             { pickaxe: 1, **buckler: 1** }

    왜 armor +15 인가

        rabbit-swordsman 의 기본 armor 는 50 이다. +15 는 그 **30%** 이며, 곡괭이가
        물리 공격 40 에 +12(=30%)를 주는 것과 **같은 비율**이다. 두 물건의 무게를
        같게 두어 "무엇을 걸까" 가 값의 크기 비교가 아니라 **무엇을 할 것인가**의
        선택이 되게 한다.

    이 값들이 만드는 플레이

        아무것도 걸지 않음         물리 공격 40 · armor 50 · 캘 수 없다
        곡괭이만 걸음              물리 공격 52 · armor 50 · **캘 수 있다**
        곡괭이 자리에 방패 교체      물리 공격 **40** · armor **65** · 캘 수 없다
        방패 자리에 곡괭이 교체      물리 공격 52 · armor 50 · 캘 수 있다

        40 으로 **정확히** 돌아가는 것이 이 Cycle 의 핵심 관찰이다.

    비대칭이 실측되는 상태

        칸 4 · 자리 6 · 초기 소지품 { pickaxe 1, buckler 1 } = 2칸

        곡괭이를 E1 에 건다               가방 1칸 (buckler)
        돌을 일곱 캔다                    ⌈7/3⌉ = 3칸 → 가방 **4/4**
        E1 을 풀려 하면                   **no-room** — 담을 칸이 없다
        buckler 를 E1 에 걸려 하면         **성공** — 나간 자리에 곡괭이가 들어온다
        교체 뒤에도 가방은                 **4/4** — used 가 달라지지 않았다

        **두 요청을 같은 상태에서 연달아 던진다.** 하나만 확인하면 §15 와 §16.1 중
        하나를 잘못 구현하고도 통과한다 (IE §46 Test 09)

## RATIONALE

    1. 왜 State 를 하나도 늘리지 않는가

        교체가 요구하는 정보는 전부 이미 있다 — 무엇이 밀려나는가는 `Equipment[slot]` 이,
        무엇이 들어오는가는 요청이, 자리가 모자라는가는 `RULE-INVENTORY-ROOM-001` 이
        답한다. 새 State 를 세우면 그것은 이 셋 중 하나의 사본이 되고, 두 곳에 적힌
        하나의 진실은 반드시 어긋난다 (C022 가 UsedSlots 에 대해, C023 이
        EffectiveStats 에 대해 이미 판정한 것과 같은 사정이다).

    2. 왜 요청 하나인가 — 화면이 자리의 형편을 판정하게 두지 않기 위해

        "걸기" 와 "바꿔 끼기" 를 다른 요청으로 가르면 어느 쪽을 보낼지 정하기 위해
        화면이 그 자리가 찼는지를 읽고 **판정**해야 한다. 관찰이 그 사실을 싣고 있으므로
        읽을 수는 있지만, 그 읽기가 요청의 종류를 정하는 순간 화면이 규칙의 일부가 된다.
        요청을 하나로 두면 화면은 "이것을 여기에" 만 보내고 나머지는 세계가 판정한다.

    3. 왜 교체는 자리를 요구하지 않는가 — 그것이 계산의 결과이기 때문

        걸 수 있는 것은 겹치지 않는다는 **정의소의 불변 조건**에서 나온다. 나가는 하나가
        정확히 한 칸을 비우고 들어오는 하나가 정확히 한 칸을 쓰므로 순 증가는 0 이다.
        그러므로 §16.1 은 "교체만 예외로 봐준다" 가 아니라 **같은 식이 다른 답을 내는
        것**이다. 규칙에 특례가 없다는 것이 이 절의 요점이다.

    4. 왜 해제는 그대로 두는가

        푸는 것은 밖에서 들어오는 것이 없으므로 칸을 새로 요구한다. 그것이 자리의
        유한함이며, 여기에 손대면 C022 가 세운 것이 무너진다. **두 규칙이 서로 다른
        답을 내는 것이 이 Cycle 의 결과이지 결함이 아니다.**

    5. 왜 exchange-item 이 소지품 쪽에 붙는가

        교체는 "무엇을" 과 "어디에" 를 함께 요구한다. 자리 쪽에만 두면 "무엇으로" 가
        빠지고, 세계가 대신 고르는 수밖에 없어진다 — 그것이 정확히
        INTENT-THE-DISPLACED-IS-NAMED-001 이 막는 것의 반대편이다.
        소지품 쪽에 두면 "이 물건은 바꿔 걸 수 있다" 가 오고, 어느 자리인지는 이미
        실려 있는 자리 목록에서 겪는 사람이 고른다.

    6. 왜 (물건 × 자리) 모든 짝을 싣지 않는가

        지금 세계에서 짝의 판정은 **갈라진다.** 물건 쪽 사정(걸 수 있는가 · 지녔는가)과
        자리 쪽 사정(그 자리가 있는가 · 찼는가)이 서로를 참조하지 않기 때문이다.
        유일하게 짝에 걸리는 것은 `slot-not-fit` 인데, 전용 자리를 선언한 물건이 세계에
        하나도 없으므로 지금은 발생하지 않는다.

        그런 물건이 생기는 날 이 결정은 다시 봐야 한다 — `RULE-ITEM-EXCHANGEABLE-001` 이
        "걸릴 수 있는 찬 자리가 하나라도 있는가" 를 묻도록 세운 것은 그때에도 이 관찰이
        **거짓말을 하지 않게** 하기 위해서다. 다만 그때 겪는 사람은 어느 자리가 가능한지를
        따로 알아야 하며, 그것이 그때의 일감이다.

    7. 왜 두 번째 걸 수 있는 종류를 여기서 세우는가

        세우지 않으면 이 Cycle 의 Observable Result 를 확인할 방법이 없다 — 같은 종류
        둘 사이의 교체는 아무것도 바꾸지 않기 때문이다. 늘어나는 것은 정의소의 항목
        하나이며, 규칙도 관찰 계약도 그것을 위해 열리지 않는다. **그 사실 자체가
        C023 이 세운 "새 장비는 정의가 늘어나는 일이다" 의 두 번째 증거다.**

## JUDGEMENT — Human 확인이 필요한 판단

    ① 같은 종류로 바꿔 끼면 성공인가 거절인가

        Agent 판단      **성공** (아무것도 바뀌지 않는다).
        근거            세계가 개체를 구분하지 않으므로 자리의 곡괭이와 가방의 곡괭이는
                        같은 것이다. 거절하려면 종류의 같음을 조건으로 삼는 분기를
                        규칙에 하나 두어야 하는데, 그 분기가 막는 것은 아무 해도 없는
                        무변화 하나다.
        대안            `already-equipped` 같은 사유로 거절한다 — 겪는 사람에게
                        "이미 그것이다" 를 알려 준다. 대신 규칙에 분기가 하나 는다.

    ② buckler 를 잃으면 되돌릴 수 없다 — 세계가 막지 않는다

        사실            세계가 buckler 를 다시 내어줄 길이 없다 (광맥은 돌만 낸다).
                        덜어내면 영원히 없어지고, 그러면 이 Cycle 의 교체를 다시
                        겪을 수 없다.
        왜 막지 않는가   C022 의 막힘 판정은 **용도**를 잃는 것만 본다
                        (RULE-BODY-GRANTABLE-USES-001). buckler 는 용도를 주지 않으므로
                        그 판정에 걸리지 않는다.
        Agent 판단      **이 Cycle 에서 넓히지 않는다.** "용도가 아닌 것의 되돌릴 수
                        없음" 은 세계에 아직 개념이 없고, 그것을 세우는 것은 이 후보가
                        아니다. 덜어내기가 그 물건을 잃게 만드는 것은 겪는 사람의
                        선택이며 관찰에 사유 없이 가능으로 실린다.
        대안            초기 소지품이 아니라 세계가 내어주는 것으로 만든다 — 광맥의
                        `resourceKind` 가 지금 `'stone'` 으로 고정이므로 그 형이 열린다.
                        이 Cycle 의 크기를 넘는다.

    ③ buckler 의 상위 정의(`IT-*`)가 없다

        사실            곡괭이와 정확히 같은 사정이며, 그것은 이미 Q36 (OPEN) 이다.
        Agent 판단      **여기서 정하지 않는다.** `Design-Resource-Catalog-R0.md` 는
                        아직 승인 대기이고, 그 문서를 승인하면 Q36 과 함께 닫힌다.
                        Cycle 이 `IT-*` 를 새로 지어 붙이는 것은 위층의 일을 대신하는 것이다.
        보고            08 의 MASTER FEEDBACK 이 "유래를 답하지 못하는 아이템이 둘이
                        되었다" 를 올린다.

    ④ 표시 분류 `gear` 를 세우는 것

        Agent 판단      **세운다.** IS §180 이 이미 "장비·소비재·재료" 로 아이템을 가른다.
        영향            **규칙은 이 값을 묻지 않는다** — 지금도 묻는 곳이 0건이다.
                        화면은 분류를 아이콘 표로 읽으며 모르는 분류에는 아이콘이 없다.
        대안            `tool` 로 둔다 — 방패를 도구라 부르게 된다.

    ⑤ armor +15

        기본 armor 50 의 30%. 곡괭이의 비율과 같게 두었다. 이 값이 크면 방패가 정답이
        되어 "무엇을 걸까" 가 선택이 아니게 되고, 작으면 교체할 이유가 없어진다.
        **결정론에 영향을 주므로 상수로 고정한다.**

## SEMANTIC CLOSURE

    "찬 자리에 걸면 하나의 성공 단위다"
        → RULE-ITEM-EQUIP-001 Transition (셋이 한 단위) · Precondition 전부가 먼저

    "실패하면 자리도 수량도 값도 용도도 그대로다"
        → 검증이 변경보다 먼저 · EffectiveStats 가 파생 · Uses 가 파생

    "바꾸는 도중에도 한 물건은 한 곳에 있다"
        → Actor.Equipment 가 종류를 직접 담는 구조 (C023) — 새 검사가 없다

    "밀려날 것은 겪는 사람이 고른다"
        → Input 의 SlotId · Precondition 5 · 밝히지 않으면 빈 자리만 본다

    "자리를 밝히지 않은 요청의 뜻은 바뀌지 않는다"
        → Precondition 4 (C023 그대로) · no-empty-slot 그대로

    "교체는 가방의 자리를 새로 요구하지 않는다"
        → Precondition 7 이 나가는 것과 들어오는 것을 **합쳐** 묻는다
        → RULE-INVENTORY-ROOM-001 · 걸 수 있는 것은 겹치지 않는다는 불변 조건

    "해제는 자리를 요구한다"
        → RULE-ITEM-UNEQUIP-001 Precondition 3 — 변경 없음

    "두 거절은 서로 다른 사유로 온다"
        → no-room (해제) · no-empty-slot (자리 없는 걸기) ·
          unknown-slot · slot-not-fit · no-occupied-slot (교체 쪽)

    "걸 수 있는 것이 둘 이상이고 서로 다른 것을 준다"
        → ITEM_CATALOG 의 pickaxe(physicalAttack +12) · buckler(armor +15)

    "새 종류가 느는 것은 정의가 늘어나는 일이다"
        → 규칙 어디에도 종류 이름이 없다 · 관찰 계약이 열리지 않는다

    "그 종류가 손에 들어오는 길이 있다"
        → DEFAULT_BODY.items 에 실린다 (JUDGEMENT ②)

    "무엇으로 바꿔 낄 수 있는지가 보인다"
        → InventoryItemView.actions[exchange-item] ·
          EquipmentSlotView 가 찬 자리를 전부 싣는다 (C023)

    "화면이 가방의 형편에서 교체 가능 여부를 유추하지 않는다"
        → exchange-item 의 available 이 RULE-ITEM-EXCHANGEABLE-001 에서 온다.
          그 판정에 Capacity 가 들어가지 않는다

    "교체 뒤 몸에는 새것이 주는 것만 있다"
        → RULE-EFFECTIVE-STATS-001 (파생) · RULE-BODY-USES-001 (파생) — 둘 다 무변경
