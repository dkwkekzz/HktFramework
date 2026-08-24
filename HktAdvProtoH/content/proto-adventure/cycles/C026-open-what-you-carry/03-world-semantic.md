# C026 — World Semantic

> **WORLD DELTA — NONE.**
>
> 이 단계가 하는 일은 새 의미를 세우는 것이 아니라, 02-intent.md 의 여덟 문장이 지금
> `world/` 에 **실제로 서 있는지**를 코드와 대조하는 것이다. 하나라도 서 있지 않으면
> 그것이 이 Cycle 의 World Delta 이고, 전부 서 있으면 이 Cycle 은 세계를 건드리지 않고
> 지나간다. 대조 결과는 아래 CLOSURE 절이며, **여덟이 전부 섰다.**
>
> 그리고 대조 중에 표면의 모양을 정하는 세 가지 사실이 확인되었다 — 자리는 넷이고,
> 빈 자리에는 주소가 없으며, 요청 하나하나의 대답을 받는 길은 이미 나 있다.
> 셋 다 새 의미가 아니라 **이미 그러한 것**이며, Stage 4 가 이 셋 위에서 계약을 쓴다.

## SEMANTIC DELTA

    REUSED

        Actor.Inventory                     semantic/inventory.ts        C001 · C020
        Inventory.Items (Map<Kind,Count>)   semantic/inventory.ts        C020
        ItemDefinition                      semantic/item.ts             C020
        ItemDefinition.Category · Origin · StackLimit · Use · Equip
        INVENTORY_CAPACITY = 4              semantic/world-state.ts      C022
        Actor.Equipment (자리 여섯)          semantic/equipment.ts        C023

        RULE-INVENTORY-ADD-001 ·
        RULE-INVENTORY-REMOVE-001           rules/inventory.ts           C020
        RULE-INVENTORY-ROOM-001             rules/inventory-room.ts      C022
        RULE-ITEM-USE-*                     rules/item-use.ts            C020
        RULE-ITEM-DISCARD-*                 rules/item-discard.ts        C022
        RULE-ITEM-EQUIP-* · UNEQUIP-* ·
        EXCHANGEABLE-*                      rules/item-equip.ts          C023 · C024
        RULE-REQUEST-REPLY-001              engine/world-kernel/
                                            request-reply.ts             C009

        투영 — projectInventory · inventoryRoom · projectEquipment
                                            projection/observer-view.ts  C020 · C022 · C023

    ADDED       없음.

    CHANGED     없음.

    AFFECTED    없음.

                **세계 쪽에 영향을 받는 것이 하나도 없다.** 이 Cycle 은 어떤 Rule 의
                Precondition 도 Transition 도 건드리지 않으므로, 기존 기능이 이 Cycle
                때문에 다르게 도는 자리가 존재하지 않는다. Stage 8 의 REGRESSION 은
                따라서 "세계가 그대로인가" 를 묻는 것이 아니라 "표면이 늘어난 뒤에도
                기존 조작 경로가 그대로 닿는가" 를 묻는다.

## WORLD STATE

    새로 두는 State 없음. 이 표면이 읽는 것은 전부 이미 서 있는 것들이다.

    Inventory.Items                 World Authority     종류별 수량. 종류당 항목 하나
    INVENTORY_CAPACITY              World Authority     상수 4 — 이 몸이 지닌 자리의 수
    Inventory.Used (파생)            World Authority     RULE-INVENTORY-ROOM-001 의 산출.
                                                        **State 가 아니라 계산 결과다**
    ItemDefinition.*                World Authority     정의. 종류가 늘면 여기가 는다
    Equipment.Slots                 World Authority     여섯 자리 (이 Cycle 은 읽지 않는다)

    ── 자리에 관하여 (표면의 모양을 정하는 사실) ──────────────────────

    **Inventory 에는 번호 붙은 칸이 없다.** `Items` 는 종류에서 수량으로 가는 Map 이며,
    "몇 번 칸에 무엇" 이라는 축이 세계에 존재하지 않는다. `Used` 는 그 Map 과 각 정의의
    겹침 한도로 **매번 다시 계산**되는 수이고, `Capacity` 는 상수다.

    그러므로:

        셀 수 있다      남은 자리 = Capacity − Used. 세계가 준 두 수의 뺄셈이다
        지목할 수 없다  그 남은 자리 중 "세 번째 것" 같은 것이 세계에 없다

    이것이 INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001 의 코드 쪽 근거다.
    Stage 4 는 빈 자리를 **수**로만 계약에 실을 수 있고, 요청의 대상으로 실을 수 없다.

## WORLD RULE

    새로 세우는 Rule 없음. 이 Cycle 이 요청으로 부르는 Rule 은 전부 기존이며,
    부르는 방식도 바뀌지 않는다.

    RULE-ITEM-USE-BEGIN-001              Implements INTENT-USE-AVAILABILITY-001 (C020)
        Input          Actor, ItemKind
        Result         Success | Failure(not-enough | out-of-range | …)

    RULE-ITEM-DISCARD-001                Implements INTENT-DISCARD-ITEM-001 (C022)
        Input          Actor, ItemKind
        Result         Success | Failure(unknown-item | not-enough | no-way-back)

    RULE-ITEM-EQUIP-001                  Implements INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001
        Input          Actor, ItemKind, [EquipSlotId]                      (C023 · C024)
        Result         Success | Failure(unknown-item | not-enough | not-equippable |
                                         no-empty-slot | unknown-slot | slot-not-fit | no-room)

    RULE-REQUEST-REPLY-001               Implements INTENT-REQUEST-REPLY-001 ·
        Input          Observer.Id, 요청 하나, Request.Mark      INTENT-REPLY-CORRESPONDENCE-001
        Preconditions  없음 — 도착한 모든 요청이 대답을 받는다                        (C009)
        Transition     없음 — 세계 상태를 바꾸지 않는다
        Result         { accepted, rule, reason?, mark? } — 요청한 관찰자에게만 간다

    ── RULE-REQUEST-REPLY-001 을 여기 적는 이유 ────────────────────────

    이 Rule 은 C009 가 명령 표면을 위해 세웠지만 **어떤 요청에도 붙는다** — 그 Guide 의
    Preconditions 가 "없음" 인 것이 그 뜻이다. 소지품 요청도 지금까지 대답을 받고 있었고,
    받아 갈 곳이 없어 버려졌을 뿐이다 (`app/main.ts` 의 `drainOutcomes` 는 표식 없는
    대답을 명령 기록의 마지막 줄에 붙인다).

    이 Cycle 의 표면은 **그 대답을 처음으로 소지품 쪽에서 받아 간다.**
    그것은 세계에 무언가를 더하는 일이 아니라 이미 나 있는 길을 쓰는 일이다.
    보내는 쪽이 표식을 붙이면(`sendMarked`) 대답이 어느 요청의 것인지 짚을 수 있다는
    것도 C009 가 이미 세웠다 (INTENT-REPLY-CORRESPONDENCE-001).

## OBSERVABLE SEMANTIC

    이 표면이 묻는 것 전부가 이미 관찰에 실린다. **새로 여는 관찰 항목이 없다.**

    inventory[]                     종류 · 수량 · 분류 · 유래 · 겹침         C020
    inventory[].actions[]           id · role · available · unavailableReason
                                        use-item        C020
                                        equip-item      C023
                                        exchange-item   C024
                                        discard-item    C022
    inventoryRoom                   used · capacity                          C022
    Request.Outcome                 accepted · rule · reason? · mark?        C009

    ── 관찰 폐쇄 확인 ──────────────────────────────────────────────

    기획서 §1 의 세 물음에 지금 관찰만으로 답이 나오는가.

        무엇을 가지고 있는가          inventory[] 의 kind · count · category
        무엇을 지금 적용하고 있는가    equipment[] — **이 Cycle 은 그리지 않는다**
                                      (01-cycle.md EXCLUDED · VUX-IE-02)
        이 물건으로 무엇을 할 수      inventory[].actions[] 의 available 과
        있고 하면 무엇이 달라지는가    unavailableReason.
                                      **"무엇이 달라지는가" 의 앞부분(무엇을 할 수
                                      있는가)만 답이 있다.** 걸었을 때 값이 어떻게
                                      달라지는지는 세계에 없다 —
                                      `frontier.md` 후보 1 FR-SEE-BEFORE-YOU-WEAR 의
                                      몫이며 01-cycle.md 가 EXCLUDED 로 못 박았다.
                                      **화면이 contributions 를 더해 만들지 않는다**

    남은 자리는 관찰에 **수로만** 있다 (위 WORLD STATE 의 자리 절).

## SEMANTIC CLOSURE

    02-intent.md 의 여덟 문장을 코드와 대조한 결과.

    INTENT-INVENTORY-IS-OBSERVED-001                          ✔ 선다
        "지닌 것 전부가 하나의 목록으로"    → inventoryEntries(semantic/inventory.ts)
        "순서가 흔들리지 않는다"            → ITEM_KINDS 정의 순서 (같은 상태 = 같은 순서)
        "항목마다 같은 모양"                → projectInventory 가 종류를 분기하지 않는다

    INTENT-CARRY-ROOM-IS-OBSERVED-001                         ✔ 선다
        "쓴 자리와 전체가 함께"             → inventoryRoom { used, capacity }
        "지닌 것이 없어도 온다"             → 목록 밖의 자리이므로 언제나 실린다
        "화면이 다시 세지 않는다"           → used 는 ruleInventoryRoom 의 산출이다

    INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001                      ✔ 선다 (부정형으로)
        "번호 붙은 빈 자리가 없다"          → Items 가 Map<Kind,Count> 다.
                                             칸 축이 세계에 존재하지 않는다
        "지목할 수 없다"                    → 어떤 Rule 도 칸 번호를 Input 으로 받지 않는다

    INTENT-EACH-THING-CARRIES-WHAT-IT-CAN-DO-001              ✔ 선다
        "항목마다 할 수 있는 일들이 함께"   → projectInventory 가 항목마다 actions 를 짓는다
        "못 하는 물건은 빈 목록"            → use 가 없는 정의에는 use-item 이 실리지 않는다

    INTENT-EVERY-REFUSAL-CARRIES-ITS-REASON-001               ✔ 선다
        "안 되는 것도 사유와 함께 남는다"   → available:false + unavailableReason.
                                             항목이 목록에서 빠지지 않는다
        "읽는 사유 = 요청의 사유"           → 투영과 실행이 **같은 evaluate* 함수**를 쓴다
                                             (evaluateItemUse · Discard · Equip · Exchange)

    INTENT-THE-REQUEST-IS-WHAT-WAS-OBSERVED-001               ✔ 선다
        "관찰이 실어 온 것을 되돌린다"      → ActionRequest = { interactionId: action.id,
                                                              itemKind: entry.kind }
        확인된 형태     action.id 는 역할 이름 그대로이고(`use-item` 등) 어느 물건의
                        것인지는 **그 항목의 kind** 가 답한다. 그러므로 표면이 되돌릴 것은
                        고른 항목과 고른 행동 둘뿐이며, 새로 조립하는 것이 없다

    INTENT-CAPABILITY-COMES-FROM-THE-DEFINITION-001           ✔ 선다
        "종류 이름이 분기가 되지 않는다"    → projectInventory 에 종류 이름이 한 번도
                                             나오지 않는다 (그 함수의 머리글이 밝힌다)

    INTENT-OBSERVATION-IS-THE-ONLY-TRUTH-001                  ✔ 선다
        "요청만으로는 아무것도 바뀌지 않는다" → 요청은 받아 두었다가 Tick 에 판정된다 (C003)
        "그 사이가 표면에서 거짓이 되지 않는다"
                                            → 이것은 **표면 쪽 약속**이다. 세계는 이미
                                              올바르며, 어길 수 있는 것은 화면뿐이다.
                                              Stage 4 가 계약으로 못 박고 Stage 8 이 잰다
        "대답이 닿는다"                     → RULE-REQUEST-REPLY-001 · Request.Outcome

    INTENT-INVENTORY-SINGLE-CHANNEL-001                       ✔ 선다
        "수량을 바꾸는 통로는 둘뿐"         → RULE-INVENTORY-ADD-001 / REMOVE-001.
                                             이 Cycle 은 어느 쪽도 부르지 않는다 —
                                             기존 요청들이 부를 뿐이다

    ── 판정 ────────────────────────────────────────────────────────

    **여덟 문장이 전부 선다. WORLD DESIGN GAP 없음.**
    이 Cycle 은 `world/` 를 한 줄도 고치지 않고 Stage 6 을 통과할 것으로 예상된다.
    Stage 6 이 무언가를 고쳐야 한다고 판정하면 그것은 이 대조가 틀렸다는 뜻이며,
    조용히 고치지 말고 이 단계로 반환한다.

## STAGE 4 로 넘기는 세 가지 사실

    ① 자리는 **넷**이다 (INVENTORY_CAPACITY = 4).
       격자는 기획서 §2.2 의 6열이 아니라 **capacity 만큼**이어야 한다.
       열 수를 계약이 정하지 않는다 — 그것은 표현이다. 계약이 정하는 것은
       "칸의 수는 capacity 다" 라는 뜻뿐이다.

    ② 빈 칸은 **수**이지 대상이 아니다.
       계약에 빈 칸의 목록을 만들지 않는다. 그리는 쪽이 `capacity − used` 만큼
       같은 모양의 빈 자리를 놓을 뿐이며, 그 칸들은 서로 구별되지 않고
       요청의 대상이 되지 않는다.

    ③ 요청 하나하나의 대답을 받는 길이 **이미 나 있다** (Request.Outcome · Mark).
       Stage 4 는 pending 과 거절 사유를 새 관찰로 요구할 필요가 없다 —
       C009 의 계약을 소지품 쪽에서 처음 쓰는 것으로 족하다.
