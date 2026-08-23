# C026 — World Implementation

> **세계를 한 줄도 고치지 않았다.**
>
> 03-world-semantic.md 가 `WORLD DELTA NONE` 으로 닫혔고, 이 단계는 그 판정이 실제로
> 성립하는지를 확인하는 자리다. 확인 방법은 하나다 — **아무것도 고치지 않고 Stage 7 이
> 요구하는 것을 전부 낼 수 있는가.**
>
> 낼 수 있다. 아래가 그 대조다.

## IMPLEMENTED

    없음. 이 Cycle 이 `world/` 에 더한 파일도 고친 줄도 없다.

## REUSED

    Inventory.Items                     world/semantic/inventory.ts
    ItemDefinition (stone·pickaxe·buckler)
                                        world/semantic/item.ts
    INVENTORY_CAPACITY = 4              world/semantic/world-state.ts
    RULE-INVENTORY-ROOM-001             world/rules/inventory-room.ts
    RULE-ITEM-USE-* / DISCARD-* /
    EQUIP-* / UNEQUIP-* / EXCHANGEABLE-*
                                        world/rules/item-use.ts · item-discard.ts · item-equip.ts
    RULE-REQUEST-REPLY-001              engine/world-kernel/request-reply.ts

## AFFECTED UPDATED

    없음. 어떤 Rule 의 Precondition 도 Transition 도 건드리지 않았으므로
    이 Cycle 때문에 다르게 도는 기존 기능이 존재하지 않는다.

## PROJECTION

    변경 없음.

    projectInventory · inventoryRoom · projectEquipment 가 그대로다
    (world/projection/observer-view.ts). Stage 7 이 읽는 것은 전부 이미 나오고 있던 값이다.

## TESTS

    새로 더한 것 없음. 기존 world 테스트가 그대로 증거다 —
    **이 Cycle 이 세계를 건드리지 않았다는 것은 기존 테스트가 한 줄도 바뀌지 않은 것으로
    관찰된다.**

## 대조 — Stage 7 이 요구하는 것과 지금 세계가 내는 것

    지닌 것의 목록                  inventory[]           ✔ 나온다
    종류 · 수량 · 분류 · 겹침 여부   inventory[].*         ✔ 나온다
    항목마다 되는 것과 사유          inventory[].actions[] ✔ 나온다 (네 역할 전부)
    쓴 자리와 전체                  inventoryRoom         ✔ 나온다
    요청 하나하나의 대답            Request.Outcome       ✔ 나온다 (C009 · 표식 포함)

    **못 내는 것 하나** — 어느 물건이 몇 번 칸에 있는가, 어느 빈칸이 몇 번인가.
    이것은 결손이 아니라 세계가 그렇게 생긴 것이다
    (INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001 · 03 WORLD STATE).
    Stage 7 은 그것을 요구하지 않는 표면을 만든다.

## NOTES — 이 단계에서 드러난 수치 하나

    `stone.stackLimit = 3` 이고 `INVENTORY_CAPACITY = 4` 다.

    그러므로 **항목의 수와 쓴 자리의 수는 자주 어긋난다.** 돌 넷을 지니면 항목은 하나인데
    자리는 둘이고, 곡괭이·손방패·돌 넷이면 항목 셋에 자리 넷이다.

    Stage 7 이 이것을 알고 있어야 한다 — 04-gameview.spec.yaml 의 `inventoryRoom.
    surface_rule` 이 "capacity 만큼의 칸을 놓고 그중 항목이 앉지 않은 것을 빈 자리로"
    라고 적었는데, **그 규칙은 성립하지 않는다.** 계약이 겹침 한도를 싣지 않으므로
    (C022 가 일부러 뺐다) 화면은 한 항목이 자리를 몇 개 쓰는지 알 수 없고, 따라서
    항목들을 capacity 크기의 격자에 앉힐 수 없다.

    Stage 7 이 이것을 `GAMEVIEW GAP` 으로 Stage 4 에 반환한다. 세계 쪽 문제가 아니므로
    이 단계에서 고칠 것은 없다.

    시작 소지품은 `pickaxe 1 · buckler 1` 이다 (world/rules/observer-body.ts) —
    항목 둘 · 자리 2/4. Stage 8 의 첫 화면이 이 상태다.
