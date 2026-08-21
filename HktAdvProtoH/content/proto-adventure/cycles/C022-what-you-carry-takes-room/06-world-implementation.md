# C022 — World Implementation

> 이 Cycle 이 더한 코드에는 **아이템 종류 이름이 한 번도 나오지 않는다.** 자리를 세는
> 곳도, 담기를 거절하는 곳도, 덜어내기를 막는 곳도 정의와 세계에게 물을 뿐이다.
> 그것이 이 구현의 성패 기준이다.

## IMPLEMENTED

    ItemDefinition.StackLimit            world/semantic/item.ts
                                         `stackable` 을 **대체한다** — 겹치는가는
                                         `isStackable()` 이 한도에서 유도한다.
                                         두 곳에 적힌 하나의 진실을 만들지 않는다
    World.InventoryCapacity              world/semantic/world-state.ts   (값 4)
                                         State 가 아니라 세계의 성질이다

    RULE-INVENTORY-ROOM-001              world/rules/inventory-room.ts
        ruleInventoryRoom(inventory)     Σ ⌈수량 / 한도⌉ — **분기가 하나도 없다**
        roomAfterAdd(inv, kind, count)   그 종류의 자리만 다시 센다.
                                         겹침 한도 때문에 이미 있는 수량과 합쳐야
                                         정확한 값이 나온다 (3 을 지닌 자리에 1 을
                                         더하는 것과 0 에 1 을 더하는 것은 다르다)

    RULE-WORLD-ACQUIRABLE-KINDS-001      world/rules/acquirable-kinds.ts
        ruleWorldAcquirableKinds(state)  { 광맥이 내는 종류 | 남은 양 > 0 }
        worldCanRestoreUse(state, use)   세계가 이 **용도**를 되돌려줄 수 있는가

    RULE-ITEM-DISCARD-001                world/rules/item-discard.ts
        evaluateItemDiscard()            관찰과 실행이 공유하는 판정
        ruleItemDiscard()                그 종류를 **전부** 줄인다. 즉시. Action 아님
        usesLostByDiscarding()           남은 것들이 같은 용도를 주면 잃지 않는다 —
                                         곡괭이 둘 중 하나는 덜어낼 수 있다

    InteractionId `discard-item`         world/actions/interactions.ts
                                         요청이 싣는 것은 `itemKind` 하나뿐이다
    RULE_INVENTORY_ROOM · RULE_WORLD_ACQUIRABLE_KINDS · RULE_ITEM_DISCARD
                                         protocol/semantic-id.ts
    InventoryRoomView                    protocol/gameview.ts (스냅샷의 `inventoryRoom`)

## REUSED

    Actor.Inventory · Inventory.Items    world/semantic/inventory.ts        — 손대지 않았다
    RULE-INVENTORY-REMOVE-001            world/rules/inventory.ts           — 덜어내기가 그대로 쓴다
    RULE-BODY-USES-001                   world/rules/body-uses.ts           — 막힘 판정이 읽는다
    Deposit.ResourceKind                 world/semantic/deposit.ts          — **이미 있었다**.
                                         이 Cycle 이 그것을 처음으로 **읽는다**
    ItemActionView / InteractionView     protocol/gameview.ts               — 새 기계 없음

## CHANGED

    RULE-INVENTORY-ADD-001               world/rules/inventory.ts
        + evaluateInventoryAdd()         담을 수 있는지를 묻는 **유일한 자리**.
                                         관찰(채집의 가능/사유)과 실행이 같은 함수를 쓴다
        + Precondition `no-room`         검증이 변경보다 먼저이므로 **부분 담기가
                                         일어날 수 있는 순간 자체가 없다**

    RULE-MINE-001                        world/rules/mine.ts
        + Precondition `no-room`         evaluateInventoryAdd 를 그대로 부른다.
                                         자기 판정을 새로 만들지 않는다

    RULE-MINE-COMPLETE-001               world/rules/mine.ts
        순서 변경                         자리 검증 → 광맥 감소 → 획득.
                                         **검증이 Transition 앞으로 옮겨졌다**
        `'stone'` → deposit.resourceKind  얻는 종류를 규칙이 이름으로 알지 않는다

    ItemDefinition.Stackable             world/semantic/item.ts — 필드가 사라지고
                                         `isStackable(definition)` 이 대신한다.
                                         곡괭이가 처음으로 false 가 된다

    Deposit 기본 ResourceAmount           world/index.ts   5 → 12

## AFFECTED UPDATED

    projectInventory                     world/projection/observer-view.ts
                                         `discard-item` 이 **지닌 모든 항목**에 붙는다
                                         (쓸 수 있는 물건만 놓을 수 있는 것이 아니다).
                                         `stackable` 이 isStackable 에서 나온다
    projectObserverView                  같은 파일 — `inventoryRoom` 이 스냅샷에 실린다
    world/tests/item-use.spec.ts         `stone.stackable` → `isStackable(stone)`
    world/tests/mine.spec.ts             광맥 양을 **명시**한다 (기본값을 따라다니지 않는다)
    world/tests/observer.spec.ts         같은 이유
    view/tests/fixtures/*.json (19)      `inventoryRoom` 이 는다. 곡괭이를 지닌 둘은
                                         `stackable: false` 로 바로잡았다
    view/tests/resolve.spec.ts           손으로 짓는 스냅샷에 `inventoryRoom` 이 는다

## PROJECTION

    inventoryRoom.used                   ruleInventoryRoom(self.inventory)
    inventoryRoom.capacity               INVENTORY_CAPACITY
    inventory[].stackable                isStackable(definition)
    inventory[].actions[discard-item]    evaluateItemDiscard 의 판정과 사유
    interactions.mine.reason             `no-room` 이 값에 는다

    **싣지 않은 것** — 04 의 excluded 그대로다. StackLimit 수치도, 항목이 차지한 자리
    수도, 세계가 다시 내어줄 수 있는 종류의 목록도 보내지 않는다. 보내면 화면이 그것으로
    판정할 수 있게 되고, 그것이 DC-WORLD-OWNS-THE-SURFACE-LIST 가 막으려는 것이다.

## TESTS

    world/tests/inventory-room.spec.ts   15 tests — **전부 통과**

        RULE-INVENTORY-ROOM-001
            시작한 몸은 곡괭이로 자리 1 (겹치지 않는 종류)
            돌 3 까지 자리 1, 4 에서 자리 2 — 한 식이 두 갈래를 다 답한다
        INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
            돌 9 에서 자리 4/4 → mine.available=false · reason=`no-room` (부딪히기 전)
            억지 요청도 같은 사유로 거절 (관찰 = 실행)
            거절된 채집이 광맥을 축내지 않는다 (남은 양 3 → 3)
            완료 시점 재검증
        RULE-ITEM-DISCARD-001
            덜어내면 그 종류가 전부 사라지고 자리가 빈다 — **시간이 흐르지 않았는데** 비었다
            덜어내면 다시 캘 수 있다 (자리와 덜어내기가 한 몸)
            덜어낸 것이 세계에 놓이지 않는다 (존재 수 · 광맥 불변)
            하던 채집을 끊지 않는다
        INTENT-NO-SELF-INFLICTED-DEAD-END-001
            곡괭이 = `no-way-back` (관찰과 실행 양쪽)
            돌은 언제든 덜어낼 수 있다
            **광맥이 말라 돌을 다시 못 얻어도 돌은 막히지 않는다** — 막는 것은
            "다시 못 얻는 것" 이 아니라 "다시 못 얻는데 할 수 있던 일이 사라지는 것"
        DC-ITEM-CAPACITY-IS-FINITE
            관찰이 자리 둘만 싣는다 (StackLimit 이 새어 나가지 않는다)

    전체 회귀                             `npm test` → **54 files · 929 tests 전부 통과**
                                         (boundary:check 포함 — engine→content 경계 정상)
    타입                                  `npx tsc --noEmit` 오류 없음

## NOTES

    1. 자리를 저장하지 않았다
       `Inventory.UsedSlots` 는 필드가 아니다. 저장하면 Items 와 UsedSlots 라는 두 진실이
       생기고 둘을 맞추는 책임이 모든 변경 지점에 흩어진다 — 변경 단일 통로가 없애려던
       바로 그것이다. 세는 비용은 지닌 종류 수에 비례하고 그 수는 자리 수를 넘지 못한다.

    2. 막힘 판정에 곡괭이가 없다
       `item-discard.ts` 를 통째로 읽어도 `pickaxe` 라는 문자열이 없다. 묻는 것은
       "이걸 놓으면 사라지는 용도가 있는가" 와 "세계가 그 용도를 되돌려줄 수 있는가"
       둘뿐이다. 곡괭이를 내는 광맥이 생기면 그날부터 저절로 풀린다 — 시험이 그것을
       광맥을 말려서 확인한다 (돌은 안 막히고 곡괭이는 막힌다).

    3. 덜어내기가 Action 얼개를 지나지 않는다
       그래서 `world/semantic/action.ts` 가 열리지 않았고 상태값도 늘지 않았다.
       "덜어내는 중" 이라는 순간이 세계에 존재하지 않으므로 계약에도 만들지 않았다.

    4. `engine/` 을 한 줄도 건드리지 않았다
       필요한 것이 전부 팩 안에 있었다. 기반 반환 없음.

    5. 남은 것 하나 — 빈 가방을 만들 수 없다
       곡괭이가 `no-way-back` 이고 돌은 캐야 생기므로, 지금 세계에서 자리 0 인 상태를
       플레이로 만들 수 없다. 규칙은 0 을 정상으로 답하고(시험이 형태로 확인) 실제로도
       그 상태가 관찰 가능하지만, **사람이 그 화면을 보는 경로가 없다.**
       결함이 아니라 지금 세계의 크기다 — 아이템이 늘면 저절로 사라진다.
