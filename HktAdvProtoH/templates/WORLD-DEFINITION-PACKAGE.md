# WORLD DEFINITION PACKAGE

```text
Cycle:
    CYCLE-XXX

Covers Intents:
    INTENT-...
```

## 1. Semantic Closure Map

Intent의 모든 문장을 State / Rule로 연결한다. 연결되지 않은 문장이 하나라도 있으면 실패.

```text
"<Intent 문장>"
    → <State / Rule>

예:
"광맥을 알고 있다"        → Actor.Knowledge, Deposit.Identity
"채굴 도구를 가지고 있다"  → Actor.Inventory, Item.ToolCapability
"광맥에 접근 가능하다"     → Actor.Position, Deposit.Position, InteractionRange
```

## 2. Required World State

세계 의미만 기재 (Implementation State 금지). Entity 단위 의미로 표현.

```text
Actor
    Identity
    Position
    ...

<Entity>
    ...
```

## 3. Required World Rule

```text
RULE-<NAME>-NNN

Implements:
    INTENT-...

Derived From:
    GOAL-...
    POSSIBILITY-...

Input:
    ...

Preconditions:
    ...

Transition:
    ...
```

## 4. Observable Contract

State/Rule과 동시에 정의한다 — Semantic Lossless Projection.

```text
Must expose:

    <Rule 판단에 영향을 주는 모든 Decision Semantic State>
    Current Goal
    Current Possibility
    Preconditions (각각 true/false + 실행 불가 시 reason)
    Selected Rule
    Transition:
        Before
        Input
        Rule
        After
```

## 5. Baseline 관계

```text
재사용하는 기존 Semantic:
    ...

새로 추가되는 Semantic:
    ...
```
