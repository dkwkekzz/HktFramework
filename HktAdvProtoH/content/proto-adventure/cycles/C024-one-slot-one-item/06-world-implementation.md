# C024 — World Implementation

> **파일이 하나도 새로 생기지 않았다** (시험 하나를 뺀다). 규칙 파일 하나가 열리고,
> 정의소에 항목 하나가 늘고, 투영에 손 하나가 붙었다. State 는 한 줄도 늘지 않았다 —
> 03 이 그렇게 닫았기 때문이다.

## IMPLEMENTED

    RULE-ITEM-EQUIP-001 (CHANGED)          world/rules/item-equip.ts
        `evaluateItemEquip(actor, kind, slotId?)` · `ruleItemEquip(actor, kind, slotId?)`
        자리를 밝히지 않으면 C023 의 경로 그대로 (`no-empty-slot` 포함).
        밝히면 unknown-slot → slot-not-fit → (찬 자리면) no-room 순으로 묻고,
        빼기 → 걸기 → 되돌리기 셋을 한 단위로 수행한다

    roomAfterExchange (내부)                world/rules/item-equip.ts
        나가는 하나를 빼고 밀려나는 하나를 넣은 뒤의 UsedSlots.
        **자리를 세는 식을 다시 만들지 않는다** — `ruleInventoryRoom` 에 소지품 사본을
        넘겨 묻는다. 두 물건이 같은 종류일 수 있으므로 순서대로 센다

    RULE-ITEM-EXCHANGEABLE-001 (ADDED)     world/rules/item-equip.ts
        `evaluateItemExchange(actor, kind)` — 읽기 판정.
        걸릴 수 있는 **찬 자리**가 하나라도 있는가. 가방의 형편이 들어가지 않는다

    ItemCategory.gear (ADDED)              world/semantic/item.ts
    ItemKind 'buckler' (ADDED)             world/semantic/item.ts
    ITEM_CATALOG.buckler (ADDED)           world/semantic/item.ts
        category gear · stackLimit 1 · uses [] · use 없음 · equip { armor: 15 }
        **카탈로그 끝에 붙였다** — 기존 줄을 옮기지 않는다 (병렬 배치 규칙)

    실패 사유 5종 (ADDED/CHANGED)            world/rules/item-equip.ts
        ItemEquipFailureReason      += unknown-slot · slot-not-fit · no-room
        ItemExchangeFailureReason    = unknown-item · not-enough · not-equippable ·
                                       no-occupied-slot

## REUSED

    Actor.Equipment · World.EquipSlots     world/semantic/equipment.ts   — 열리지 않았다
    RULE-EQUIP-SLOT-FITS-001               world/semantic/equipment.ts   — 교체도 이것을 지난다
    RULE-EFFECTIVE-STATS-001               world/semantic/equipment.ts · combat.ts
                                           **한 글자도 열리지 않았다.** 교체 뒤의 값을
                                           따로 계산하지 않는다 — 파생이므로 저절로 맞는다
    RULE-INVENTORY-ADD/REMOVE-001          world/rules/inventory.ts      — 교체가 이 통로를 지난다
    RULE-INVENTORY-ROOM-001                world/rules/inventory-room.ts — 순 증가 판정이 묻는다
    RULE-ITEM-UNEQUIP-001                  world/rules/item-equip.ts     — **변경 없음**
    RULE-BODY-USES-001                     world/rules/body-uses.ts      — 열리지 않았다

## AFFECTED UPDATED

    ActionRequest.equipSlotId              protocol/actions.ts
        **형이 아니라 주석의 뜻이 바뀌었다.** 거는 요청도 실을 수 있다

    ItemActionView.role                    protocol/gameview.ts
        값 목록 주석에 exchange-item 이 는다. 형은 그대로 (string)

    interaction `equip-item`               world/actions/interactions.ts
        `action.equipSlotId` 를 규칙에 넘긴다. **수용층이 요청의 종류를 가르지 않는다** —
        찼는지 비었는지는 세계가 판정한다

    DEFAULT_BODY.items                     world/rules/observer-body.ts
        `{ pickaxe: 1 }` → `{ pickaxe: 1, buckler: 1 }`

    RULE-BODY-USES-001 의 답                 곡괭이를 밀어내면 채굴 용도가 사라진다.
                                           규칙은 열리지 않고 답만 달라진다 (시험이 확인)
    RULE-BODY-GRANTABLE-USES-001 의 답       **달라지지 않는다** — 손방패는 용도를 주지 않는다
    RULE-DAMAGE-CALCULATE-001              열리지 않았다. 유효 값이 바뀌면 결과가 따라온다

## PROJECTION

    inventory[].actions[exchange-item]     world/projection/observer-view.ts
        `evaluateItemExchange` 하나에서 available 과 사유가 온다 —
        **관찰과 실행이 같은 판정을 공유한다**

    inventory[].category                   값이 하나 늘 뿐 형태가 그대로다 (gear)
    equipment[]                            **열리지 않았다**
    combatStats · inventoryRoom            **열리지 않았다** (값만 움직인다)

## TESTS

    world/tests/exchange.spec.ts (ADDED · 20)

        INTENT-EXCHANGE-APPLIED-ITEM-001         4  한 번에 오간다 · 새것의 것만 남는다 ·
                                                    곡괭이를 밀어내면 캘 수 없다 ·
                                                    백 번 바꿔도 표류하지 않는다
        실패한 교체는 넷을 그대로 둔다              3  not-enough · not-equippable · unknown-slot
        밀려날 것은 겪는 사람이 고른다              4  밝히지 않으면 빈 자리로 · **같은 상태에서
                                                    밝히지 않은 걸기는 막히고 밝힌 걸기는 된다** ·
                                                    빈 자리를 밝히면 그냥 걸린다 ·
                                                    같은 종류 교체는 무변화 성공
        IE §15 · §16.1 비대칭                     3  **같은 상태에서 두 요청이 다른 답을 낸다** ·
                                                    순 증가 0 · 값과 용도가 따라온다
        RULE-ITEM-EXCHANGEABLE-001               4  no-occupied-slot 은 가방 탓이 아니다 ·
                                                    equip 과 같은 사유 · 관찰=실행 ·
                                                    **항목당 하나** (자리 수만큼 늘지 않는다)
        DC-ITEM-KIND-IS-DATA-NOT-BRANCH          2  정의가 전부 답한다 · 어느 자리에나 걸린다

    회귀 — 시작 소지품이 바뀌어 기준값을 옮긴 시험

        world/tests/drive.ts                  `equipBuckler` helper 추가
        world/tests/inventory-room.spec.ts    `atDepositReady` 가 둘 다 건다 →
                                              **C022 · C023 의 자리 실측이 값 그대로 산다**
                                              (돌 12 · used 0 · inventory []).
                                              시작 소지품 시험만 1 → 2 로 옮겼다
        world/tests/equip.spec.ts             가방에 손방패가 남으므로 4/4 를 채우는 돌이
                                              12 → 9. **막히는 사정도 사유도 그대로다**

    전체     `npm test` — 58 files · **1002 tests 통과** (C023 판 982 + 20)
             `npx tsc --noEmit` 통과 · `npm run boundary:check` 경계 위반 0 ·
             `npm run catalog:check` 3원소 정합

## NOTES

    ① 되돌리기 경로는 도달하지 않아야 한다

        `ruleItemEquip` 의 마지막 담기가 실패하면 자리와 수량을 되돌리고 사유를 낸다.
        위 검증이 이미 둘을 합쳐 물었으므로 이 가지는 **도달하지 않는다.**
        그래도 남긴 것은 세계가 물건을 삼키는 경로를 만들지 않기 위해서다 —
        검증과 변경이 어긋나는 날 그것이 조용한 소멸이 아니라 실패로 드러난다.

    ② `no-room` 은 구조적으로 오지 않는다 — 그래도 묻는다

        걸 수 있는 물건은 반드시 겹치지 않으므로(카탈로그 불변 조건) 순 증가는 언제나
        0 이다. 그러므로 교체가 `no-room` 을 내는 세계는 지금 없다.
        묻지 않으면 이 규칙이 그 불변 조건에 조용히 기대게 된다 (03 Precondition 7).

    ③ `slot-not-fit` 도 지금은 오지 않는다

        전용 자리를 선언한 물건이 세계에 하나도 없다. 시험이 그것을 확인한다 —
        "걸 수 있는 것은 어느 자리에나 걸린다" 를 여섯 자리 전부에 대해 돌린다.

    ④ 시작 소지품이 바뀌면서 옮긴 것은 **기준값뿐이다**

        C022 · C023 의 자리 실측은 시작 소지품이 아니라 ⌈수량 / 한도⌉ 라는 식을
        확인한다. `atDepositReady` 가 둘 다 걸게 하자 그 시험들의 값이 한 톨도
        바뀌지 않고 그대로 통과했다 — 그것이 이 변경이 식을 건드리지 않았다는 증거다.

    ⑤ 광맥의 기본값(15)을 움직이지 않았다

        C023 이 12 → 15 로 옮겼던 값이다. 가방에 손방패가 하나 남으므로 담을 수 있는
        돌이 12 → 9 로 줄지만, 광맥이 그보다 많은 것은 문제가 아니다 —
        자리가 차면 채집이 사유와 함께 막히는 것이 이미 세계의 규칙이다.
