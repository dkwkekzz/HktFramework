# CYCLE-001 — Cycle Contract

> **상태: DRAFT — 인간 확정 대기**
>
> 이 초안은 작업 환경 구성 과정에서 Workflow 명세 §21–§23 의 Cycle 001 예시를 그대로 옮겨
> 씨앗으로 둔 것이다. **인간이 확정하기 전까지 Stage 1 (Intent) 을 시작하지 않는다.**
> 확정 시 이 블록을 지우고 상태를 `CONFIRMED` 로 바꾼다.

---

## Cycle ID

```text
CYCLE-001
```

## Target Horizon

```text
Persistent Open World MMORPG
```

(→ [../../context/TARGET-HORIZON.md](../../context/TARGET-HORIZON.md))

## Capability Added

```text
Resource Extraction
```

세계에 "Actor 가 세계의 자원 매장지로부터 자원을 꺼내어 자신의 것으로 만든다" 는
의미를 처음으로 추가한다.

## Existing Semantics Used

```text
(없음 — Baseline v0)
```

CYCLE-001 은 첫 Cycle 이므로 재사용할 검증된 Semantic 이 없다.
따라서 여기서 정의하는 Permanent Semantic Foundation 이 이후 모든 Cycle 의 기반이 된다.

## New Semantics

```text
Actor
    Identity
    Position
    Inventory
    Knowledge

Item
    Identity
    ToolCapability

ResourceDeposit
    Identity
    Position
    ResourceType
    ResourceAmount
```

Rule:

```text
Mine(actor, deposit, tool)
```

Preconditions:

```text
Actor knows Deposit
Actor owns Tool
Tool supports Mining
Actor is within interaction range
Deposit contains Resource
```

Effects:

```text
Deposit.ResourceAmount -= quantity
Actor.Inventory[ResourceType] += quantity
```

> 이 목록은 **Contract 수준의 범위 선언**이다.
> 정확한 State / Rule / Observable 정의는 Stage 2 (World Model) 의 산출물이다.

## Goal / Possibility Scope

```text
Goal:
    AcquireStone

Possibility:
    MineStone
```

이번 Cycle 에서 다루는 Goal / Possibility 는 위 하나의 쌍뿐이다.
`BuyStone`, `PickUpStone`, `ReceiveStone` 등 같은 Goal 의 다른 Possibility 는 다루지 않는다.

## Observable Proof

인간(Designer)이 다음을 직관적으로 볼 수 있으면 이 Cycle 은 관측 가능하다.

```text
Actor
    Arin

Current Goal
    AcquireStone

Possibility
    MineStone

Preconditions
    KnowsDeposit       true
    HasMiningTool      true
    InRange            true
    ResourceAvailable  true

Selected Rule
    RULE-MINE-001

Before
    Arin.Stone                 0
    Deposit01.ResourceAmount 100

Input
    Mine(Arin, Deposit01, Pickaxe01)

After
    Arin.Stone                 1
    Deposit01.ResourceAmount  99
```

Precondition 이 하나라도 거짓일 때 **왜 실행되지 않았는지** 도 같은 화면에서 읽을 수 있어야 한다.

```text
MineStone
    unavailable

Reason:
    Actor is out of interaction range.
```

## Explicitly Deferred

이번 Cycle 에서 구현하지 않는다.

```text
Crafting
Combat
Trading / Economy
Resource Respawn
Resource Ownership / 분쟁
Multiple Actor 동시 접근
Persistence
Network Authority
Tool Durability 소모
Fatigue / Skill / Experience 성장
자율 계획(Goal 그래프 재귀 탐색)
```

> Runtime instance 는 `Arin` / `Pickaxe01` / `StoneDeposit01` 하나씩으로 충분하다.
> 그러나 Semantic Model 을 Arin 전용이나 Stone 전용으로 설계하지 않는다.

## Evolution Questions

Stage 6 에서 이 질문들에 답한다. 답이 구조적으로 막혀 있으면 Cycle 은 완료되지 않는다.
(답을 실제로 구현할 필요는 없다.)

```text
Q1  다른 Actor 도 동일한 Mine Rule 을 사용할 수 있는가?

Q2  다른 ResourceType 도 같은 Resource 모델을 사용할 수 있는가?

Q3  다른 Tool 이 Mining Capability 를 제공할 수 있는가?

Q4  두 Actor 가 같은 Deposit 과 상호작용하는 기능을 추가할 때
    기존 Semantic 을 폐기해야 하는가?

Q5  Persistence 나 Network Authority 를 추가할 때
    Mine 의 세계 의미 자체를 다시 정의해야 하는가?
```
