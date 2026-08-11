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

## 5. Visual Requirement

State/Rule/Observable과 동시에 정의한다 — 인간이 이 Intent의 Runtime 동작을 **게임 공간에서** 이해하려면 무엇을 볼 수 있어야 하는가.
의미 수준으로만 기재한다 — Visual Component/Primitive 이름(ValueBar, Billboard 등) 지정 금지. 그 선택은 Implementation Stage의 몫이다.

```text
Designer must be able to see:

    <공간 관계 — 예: Actor와 Deposit의 위치 관계>
    <상태 — 예: Deposit의 현재 Resource 양>
    <Transition 발생 — 예: Mine 실행과 Resource 이동>
```

## 6. Baseline 관계

```text
재사용하는 기존 Semantic:
    ...

새로 추가되는 Semantic:
    ...
```
