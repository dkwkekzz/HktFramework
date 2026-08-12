# World Semantic Stage Guide

## Role

Intent 를 실행 가능한 World Semantic (State · Rule · Authority · Observable) 으로 닫는다.

## Input

- `cycles/<CycleId>/02-intent.md`
- 관련 Existing World Semantic / Rule (`world/`, 관련 과거 Cycle 의 `03-world-semantic.md`)

## Do

```text
Intent
    ↓
Existing Semantic 확인      ← 먼저 조회한다. 중복 정의 금지
    ↓
World State
    ↓
World Rule
    ↓
Authority
    ↓
Observable Semantic
    ↓
Semantic Closure
```

1. Intent 의 각 문장이 요구하는 정보를 World State 로 도출한다.
2. 이미 존재하는 Semantic 은 재사용한다 — 새로 만들지 않는다.
3. 상태 변화를 World Rule 로 정의한다 — `Input / Preconditions / Transition / Result`.
4. 각 State 의 Authority 를 정한다 (World Authority 가 기본).
5. Rule 판단에 영향을 주는 모든 의미를 Observable 로 정의한다 (`Before → Input → Rule → After`, 실패 시 Reason).
6. Semantic Closure 를 검사한다 — Intent 의 모든 문장이 State 또는 Rule 로 연결되는가.
7. Delta 를 REUSED / ADDED / CHANGED / AFFECTED 로 분류한다.

## Output

`cycles/<CycleId>/03-world-semantic.md`

```text
SEMANTIC DELTA

REUSED
    Actor.Inventory
    Inventory.Items
ADDED
    Inventory.Capacity
    Inventory.UsedCapacity
CHANGED
    RULE-ADD-ITEM
        NEW PRECONDITION  Inventory has sufficient capacity
AFFECTED EXISTING RULES
    RULE-MINE-001
    RULE-PICKUP-001
    RULE-TRADE-RECEIVE-001

WORLD STATE
    Inventory
        Items
        Capacity        World Authority
        UsedCapacity    World Authority

WORLD RULE
    RULE-ADD-ITEM
        Implements    INTENT-INVENTORY-CAPACITY-001
        Input         Actor, Item
        Preconditions Inventory.UsedCapacity + Item.Size <= Inventory.Capacity
        Transition    Inventory.Items += Item
                      Inventory.UsedCapacity += Item.Size
        Result        Success | Failure(inventory-full)

OBSERVABLE SEMANTIC
    Inventory.UsedCapacity
    Inventory.Capacity
    AddItem.Availability + Reason

SEMANTIC CLOSURE
    "저장 한계가 있다"      → Inventory.Capacity
    "공간이 부족하다"       → UsedCapacity + Item.Size > Capacity
    "획득할 수 없다"        → RULE-ADD-ITEM Precondition 실패 + Reason
```

## Must

- 새 Semantic 정의 전에 기존 Semantic 을 **먼저 조회**한다.
- 모든 의미 있는 상태 변화는 어떤 World Rule 에 귀속된다.
- Rule 은 자신이 구현하는 Intent ID 를 명시한다.
- Observable 은 State/Rule 과 **동시에** 설계한다 — 나중에 붙이는 Debug UI 가 아니다.
- 기존 Rule 을 바꾸면 영향을 받는 기존 Rule 을 AFFECTED 에 모두 적는다.
- 모든 Semantic 변경은 현재 Cycle Goal 에서 유래해야 한다.

## Must Not

- 언어·클래스·DB·네트워크 등 구현 기술을 결정하지 않는다.
- Capability 별로 분리된 World 를 만들지 않는다 — 하나의 공유 World 다.
- Intent 에 없는 의미를 임의로 추가하지 않는다.
- View 표현(스프라이트·색·레이아웃)을 여기서 정하지 않는다.

## Done When

- Semantic Closure 통과 — Intent 의 모든 문장이 State 또는 Rule 로 연결된다.
- Observable Closure 통과 — Rule 판단에 영향을 준 모든 조건과 실패 사유를 관찰할 수 있다.
- REUSED / ADDED / CHANGED / AFFECTED 가 모두 기록되어 있다.

## Gap

닫히지 않는 문장이 있으면 임의로 State 를 만들지 않고 반환한다.

```text
WORLD DESIGN GAP
Intent            INTENT-MINING-001
Missing Semantic  ToolCapability
Reason            Mining 가능 여부를 표현할 World State 가 없음
Return To         Intent
```
