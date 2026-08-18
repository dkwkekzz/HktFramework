# Artifact 형식

각 Stage 출력의 골격. 항목 이름은 유지하고 내용만 채운다.
값이 없는 항목은 지우지 말고 `없음` 또는 사유를 적는다.

디렉터리: `cycles/C<번호>-<이름>/` (예: `cycles/C012-inventory-capacity/`)

---

## 01-cycle.md

```markdown
# CYCLE C012 — Inventory Capacity

[    ] Cycle Definition
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE
    Frontier            FR-INVENTORY-SCARCITY
    Source Goal         MG-SURVIVE-EXPEDITION
    Source Possibility  MP-CHOOSE-WHAT-TO-CARRY
    Target Capability   MC-CARRY-LIMIT        (overlay: MISSING)
    Active Constraints  DC-CHOICE-HAS-COST
    Constraint Note     한계는 관찰 가능해야 하고 거절 사유가 설명되어야 한다

## TYPE
    New Capability | Existing Capability Enhancement

## TARGET CAPABILITY
    Inventory

## GOAL
    Inventory 에는 저장 가능한 한계가 있고
    공간이 부족하면 Item 을 추가로 획득할 수 없다.

## INCLUDED
    Inventory Capacity
    Capacity Check
    Acquisition Failure

## EXCLUDED
    Weight
    Equipment Slot
    Item Durability

## RELATED EXISTING CAPABILITY
    Inventory
    Item Acquisition
```

`MASTER TRACE` 는 위층(`master/`)과의 접합점이다. `master/frontier.md` 에서 Human 이 고른
Frontier 의 내용을 그대로 옮긴다. Frontier 에서 출발하지 않은 Cycle 은 `없음` + 사유를 적는다
(예: `없음 — 도구 정비 Cycle. Master Capability 를 늘리지 않는다`). 비워 두지 않는다.

의미는 `HktAdvProtoH/design/Master-Intent-Graph-Policy.md` §29.1 이 소유한다.

상태 블록은 Stage 가 끝날 때마다 `[PASS]` 로 갱신한다. 실패하면 `[FAIL]` + 원인.

```text
[PASS] Intent
[FAIL] Semantic Closure
Missing   Tool.Capability
Return To World Semantic
```

---

## 02-intent.md

```markdown
## GOAL / POSSIBILITY
    GOAL-RESOURCE-ACQUIRE-STONE
        └── POSSIBILITY-MINE-STONE

## INTENT SET
    INTENT-MINING-001

        Stone Deposit 을 알고 있고,
        Mining 가능한 Tool 을 보유하고 있으며,
        Deposit 에 접근 가능한 Actor 는

        Mine 을 수행하여

        Deposit 의 Resource 를 감소시키고
        자신의 Inventory 에 Stone 을 획득할 수 있다.

## DESIGN TRACE
    INTENT-MINING-001
        Source Goal         GOAL-RESOURCE-ACQUIRE-STONE
        Source Possibility  POSSIBILITY-MINE-STONE

## EXISTING INTENT DELTA
    REUSED   ...
    CHANGED  ...
```

---

## 03-world-semantic.md

```markdown
## SEMANTIC DELTA
    REUSED
        Actor.Inventory
        Inventory.Items
    ADDED
        Inventory.Capacity
        Inventory.UsedCapacity
    CHANGED
        RULE-ADD-ITEM
            NEW PRECONDITION  Inventory has sufficient capacity
    AFFECTED
        RULE-MINE-001
        RULE-PICKUP-001
        RULE-TRADE-RECEIVE-001

## WORLD STATE
    Inventory
        Items           World Authority
        Capacity        World Authority
        UsedCapacity    World Authority

## WORLD RULE
    RULE-ADD-ITEM
        Implements     INTENT-INVENTORY-CAPACITY-001
        Input          Actor, Item
        Preconditions  UsedCapacity + Item.Size <= Capacity
        Transition     Items += Item
                       UsedCapacity += Item.Size
        Result         Success | Failure(inventory-full)

## OBSERVABLE SEMANTIC
    Inventory.UsedCapacity / Capacity
    AddItem.Availability + FailureReason

## SEMANTIC CLOSURE
    "저장 한계가 있다"   → Inventory.Capacity
    "공간이 부족하다"    → UsedCapacity + Item.Size > Capacity
    "획득할 수 없다"     → RULE-ADD-ITEM Precondition 실패 + Reason
```

Intent 의 모든 문장이 State 또는 Rule 로 연결되어야 한다. 하나라도 남으면 Closure 실패다.

---

## 04-gameview.spec.yaml

```yaml
id: VIEW-INVENTORY-CAPACITY-001
observer: player            # player | designer

delta:
  reused: [inventory.items]
  added: [inventory.capacity]
  changed: []
# 변화 없으면:  change: NONE

scene: <scene-name>

entities:
  player:
    role: player-character
    position: { source: Actor.Position }
    state: { source: Actor.CurrentAction }
  deposit:
    role: resource-deposit
    position: { source: Deposit.Position }
    state:
      available: { when: ResourceAmount > 0 }
      depleted:  { when: ResourceAmount == 0 }

interactions:
  pickup:
    role: acquire-item
    target: ItemDrop
    available: { source: AddItem.Availability }
    unavailableReason: { source: AddItem.FailureReason }

hud:
  inventory:
    items: { source: Actor.Inventory.Items }
    capacity:
      used:    { source: Actor.Inventory.UsedCapacity }
      maximum: { source: Actor.Inventory.Capacity }
```

Designer Observer 는 같은 계약으로 `goal / possibility / availability / preconditions /
before / after / reason` 을 노출한다. 별도 World 접근 경로를 만들지 않는다.

금지: sprite 파일명 · texture path · Three.js · CSS · React · shader · mesh · renderer · 카메라 설정.

---

## 05-review.md — Human 전용

```markdown
## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과
    APPROVED | RETURNED
    Return To  <Intent | World Semantic | GameView Specification>
    Reason     <무엇이 부족한가>
```

---

## 06-world-implementation.md

```markdown
## IMPLEMENTED
    Inventory.Capacity        world/semantic/inventory.ts
    RULE-ADD-ITEM (changed)   world/rules/add-item.ts

## REUSED
    Actor.Inventory           world/semantic/inventory.ts

## AFFECTED UPDATED
    RULE-MINE-001             world/rules/mine.ts

## PROJECTION
    inventory.capacity        world/projection/player-view.ts

## TESTS
    add-item.spec.ts          full / room available / boundary

## NOTES
```

---

## 07-view-implementation.md

```markdown
## SPEC CONSUMED
    hud.inventory.capacity      view/hud/inventory.ts
    interactions.pickup.reason  view/hud/interaction-hint.ts

## ASSET MAPPING
    resource-deposit:stone → stone-deposit.png

## INPUT → ACTION REQUEST
    클릭 → Pickup(Player, ItemDrop)

## FIXTURE TESTS
    inventory-full.fixture.json → 획득 불가 표시 확인

## NOTES
    GAMEVIEW CHANGE: NONE 이면 변경 없음을 여기에 기록한다.
```

---

## 08-verification.md

```markdown
# CYCLE C012 — Verification

[    ] Semantic Closure
[    ] World Rule Execution
[    ] Projection
[    ] View Binding
[    ] Playable
[    ] Regression

## NEW BEHAVIOR
    Inventory has room  → Item acquisition succeeds
    Inventory full      → Item acquisition fails (reason: inventory-full)

## WORLD SCENARIO
    Before  UsedCapacity = 9, Capacity = 10
    Input   Pickup(Player, Stone)
    Rule    RULE-ADD-ITEM
    After   UsedCapacity = 10, Items += Stone

## VIEW FIXTURE
    inventory-full.fixture.json → 획득 불가 표시됨

## PLAYABLE
    <사람이 실제로 Cycle Goal 을 달성한 절차와 결과>

## REGRESSION
    Mining with available capacity  → still succeeds  (C003)
    Pickup with available capacity  → still succeeds  (C002)

## MASTER FEEDBACK
    Capability Overlay
        MC-CARRY-LIMIT    MISSING → IMPLEMENTED    근거 이 문서의 WORLD SCENARIO · PLAYABLE
    Constraint Evaluation
        DC-CHOICE-HAS-COST    SATISFIED    거절 사유가 관찰 결과로 드러난다
    Constraint Candidate
        없음    (또는 관찰된 반복 패턴 — 승격 판단은 Human)
    Master Gap
        없음    (또는 상위 의미와 어긋난 지점 · Affected · Trade-off)

## FAILURES
    [FAIL] <항목> / Missing <...> / Return To <Stage>

## STATUS
    IN PROGRESS | COMPLETE
```

통과 주장이 아니라 실행 결과를 적는다. STATUS 는 Human Play 확인 이후에만 `COMPLETE` 다.

`MASTER FEEDBACK` 은 위층으로의 **보고**다. Cycle Agent 는 여기까지만 하고
`master/` 파일을 직접 편집하지 않는다 — 반영은 Master Feedback 작업(`guides/master-feedback.md`)이
한다. Master Layer 를 쓰지 않는 Cycle 이면 각 항목에 `해당 없음` 을 적는다.
의미는 `HktAdvProtoH/design/Master-Intent-Graph-Policy.md` §29.2 가 소유한다.
