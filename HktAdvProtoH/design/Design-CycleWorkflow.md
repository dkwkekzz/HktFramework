# Design-CycleWorkflow.md

Incremental Cycle-Based World Capability Development

## 1. 목적

이 문서는 대규모 Open World MMORPG를 한 번에 설계하고 구현하는 대신, 작고 직접 플레이 가능한 게임 목표를 하나씩 완성하고 그 결과를 재사용 가능한 World Capability Module로 축적하는 점진적 개발 구조를 정의한다.

전체 개발의 기본 단위는 Cycle이다.

하나의 Cycle은 사용자가 제시한 작은 게임 목표를 입력으로 받아 다음 전체 Workflow를 한 번 완전히 수행한다.

```text
Cycle Goal
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / World Rule
    ↓
Observable World State
    ↓
Implementation
    ↓
Playable World
    ↓
Verification
```

기존 Workflow에서 Goal/Possibility Graph는 세계의 의도를 정의하고, World State와 World Rule은 그 의도를 실행 가능한 세계 의미론으로 구체화하며, 실행 결과는 Observable World State를 통해 인간에게 관찰 가능해야 한다.

Cycle은 이 Workflow를 축소하거나 대체하지 않는다.

Cycle 하나가 기존 Workflow 전체를 한 번 수행한다.

그리고 하나의 Cycle이 끝나면 두 가지 결과물이 만들어진다.

```text
1. Reusable World Capability Module
2. Playable Verification World
```

첫 번째는 이후 Cycle이 재사용하는 실제 개발 자산이고,

두 번째는 해당 Capability가 올바르게 동작하는지 인간이 게임으로 직접 확인할 수 있도록 만든 실행 가능한 세계이다.

⸻

## 2. 핵심 개발 철학

이 구조의 목표는 작은 프로토타입을 여러 개 만든 뒤 나중에 하나의 MMORPG로 다시 만드는 것이 아니다.

목표는 다음과 같다.

```text
작은 플레이 가능한 세계
        ↓
이 세계를 구성하는 Capability를 보존
        ↓
새로운 Capability 추가
        ↓
조금 더 큰 플레이 가능한 세계
        ↓
기존 Capability 보존
        ↓
새로운 Capability 추가
        ↓
...
        ↓
Open World MMORPG
```

따라서 첫 번째 Cycle에서 만드는 광석 채굴 미니게임 역시 버려질 Prototype이 아니다.

그 Cycle에서 만들어진 Mining Capability는 이후 Crafting, Economy, NPC AI, Quest, Territory 등의 Cycle에서도 그대로 사용되는 최종 MMORPG의 실제 구성 요소여야 한다.

핵심 원칙은 다음과 같다.

각 Cycle은 작은 게임을 새로 만드는 과정이 아니라, 최종 게임에 영구적으로 남을 World Capability 하나를 실제 플레이 가능한 형태로 완성하는 과정이다.

⸻

## 3. Cycle의 정의

Cycle은 설계 Artifact나 Module 자체를 의미하지 않는다.

Cycle은 개발 공정이다.

정의하면 다음과 같다.

Cycle은 사용자가 지정한 하나의 작고 플레이 가능한 게임 목표를 대상으로 Design → Intent → World Semantics → Observable → Implementation → Verification Workflow 전체를 한 번 수행하는 과정이다.

따라서 하나의 Cycle에는 반드시 시작과 끝이 존재한다.

### Cycle 시작

사용자가 다음과 같은 목표를 제시한다.

```text
"곡괭이를 가진 캐릭터가 광맥에 접근하여
Stone을 하나 채굴할 수 있는 작은 게임을 만든다."
```

### Cycle 종료

실제로 게임을 실행하여:

```text
Player가 광맥에 접근한다.
        ↓
Mine을 수행한다.
        ↓
Stone 0 → 1
Deposit 10 → 9
```

를 확인할 수 있고,

동시에 해당 기능이 다른 Cycle에서 사용할 수 있는 Module로 패키징되어 있어야 한다.

⸻

## 4. Cycle Goal

Cycle은 항상 Cycle Goal에서 시작한다.

Cycle Goal은 기술적인 작업 목록이 아니다.

잘못된 예:

```text
Inventory System을 만든다.
MiningComponent를 구현한다.
Resource Manager를 구현한다.
UI를 만든다.
```

이것들은 구현 작업이다.

올바른 Cycle Goal은 세계에서 가능한 플레이 경험으로 정의한다.

예:

```text
Player가 광맥을 찾아가
적절한 도구를 사용하여
Stone을 획득할 수 있다.
```

또는:

```text
Player가 수집한 Stone과 Wood를 사용하여
Pickaxe를 제작할 수 있다.
```

또는:

```text
Player가 Merchant에게 Stone을 판매하고
Gold를 획득할 수 있다.
```

Cycle Goal에는 중요한 제한이 하나 있다.

Cycle 종료 시 인간이 작은 게임으로 직접 실행하고 결과를 직관적으로 확인할 수 있을 정도로 작아야 한다.

⸻

## 5. 전체 개발 구조

전체 개발 구조는 다음과 같다.

```text
                     User
                      │
                 Cycle Goal
                      │
                      ▼
        Previous Capability Modules
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
         Existing World    New Goal
              │               │
              └───────┬───────┘
                      ▼
             ┌────────────────┐
             │     CYCLE N    │
             │                │
             │ Goal           │
             │ Possibility    │
             │ Intent         │
             │ State          │
             │ Rule           │
             │ Observable     │
             │ Implementation │
             │ Verification   │
             └───────┬────────┘
                     │
             ┌───────┴────────┐
             ▼                ▼
       Capability Module   Playable World
             │                 │
             │             Human Verify
             │
             ▼
       Module Registry
             │
             ▼
        Next Cycle Input
```

즉 각 Cycle은:

```text
Previous Modules
        +
New Cycle Goal
        ↓
New Capability Module
```

이라는 구조를 가진다.

⸻

## 6. Cycle과 Module은 다르다

Cycle과 Cycle의 결과물을 명확하게 분리한다.

```text
Cycle
    = 작업 과정
Capability Module
    = Cycle의 재사용 가능한 결과물
Playable World
    = Cycle의 실행/검증 결과물
```

예:

```text
Cycle 1
    "Stone을 채굴한다."
```

결과:

```text
Mining Module v1
+
Mining Verification Game
```

다음:

```text
Cycle 2
    "Stone과 Wood를 이용해 Pickaxe를 제작한다."
```

입력:

```text
Mining Module v1
+
Cycle 2 Goal
```

결과:

```text
Mining Module v1
+
Crafting Module v1
+
Mining + Crafting Verification Game
```

다음 Cycle에서도 동일하게 반복한다.

⸻

## 7. 누적 구조

Cycle이 중첩되는 것이 아니라 Cycle 결과물인 Module이 누적된다.

```text
Cycle 1
    ↓
Module A
Cycle 2
    ↓
Module B
Cycle 3
    ↓
Module C
```

실제 게임은 다음과 같이 성장한다.

```text
Game 1
    = A
Game 2
    = A + B
Game 3
    = A + B + C
Game 4
    = A + B + C + D
...
Open World MMORPG
    = A + B + C + D + ...
```

보다 정확하게는 새로운 Cycle이 이전 Module을 자신의 dependency로 사용할 수 있다.

```text
Cycle 1
    ↓
Mining Module
Mining Module
    ↓
Cycle 2
    ↓
Crafting Module
Mining Module
Crafting Module
    ↓
Cycle 3
    ↓
Trading Module
```

이 구조가 전체 프로젝트의 기본 성장 방식이다.

⸻

## 8. 중요한 원칙 — 이전 Cycle의 결과를 다시 구현하지 않는다

새로운 Cycle이 시작될 때 이전 Cycle의 Capability는 이미 완료된 것으로 간주한다.

따라서 Cycle 2에서 Mining이 필요하다고 해서 Mining을 다시 구현하지 않는다.

잘못된 구조:

```text
Cycle 1
    Mining 구현
Cycle 2
    Mining 다시 구현
    Crafting 구현
Cycle 3
    Mining 다시 구현
    Crafting 다시 구현
    Trade 구현
```

올바른 구조:

```text
Cycle 1
    Mining Module 생성
Cycle 2
    Mining Module 사용
    +
    Crafting Module 생성
Cycle 3
    Mining Module 사용
    Crafting Module 사용
    +
    Trade Module 생성
```

즉 이전 Cycle의 결과는 다음 Cycle에서 가능한 한 Black Box Capability로 사용한다.

⸻

## 9. Module의 의미

Module은 일반적인 코드 Library만을 의미하지 않는다.

World Capability Module은 특정한 세계 능력 전체를 패키징한다.

예를 들어 Mining Module은 단순히:

```text
Mine()
```

함수를 제공하는 Module이 아니다.

다음을 함께 제공해야 한다.

```text
Mining Module
Provides
    Goal/Possibility Semantic
        MineResource
    Intent
        Mining Intent
    World Rule
        Mine
    Semantic Transition
        Deposit Resource decreases
        Actor Resource increases
    Observable
        Mine availability
        Preconditions
        Executing Rule
        Before / After Transition
    Traceability
        Goal
        Possibility
        Intent
        Rule
        Runtime Transition
```

기존 Workflow 역시 Runtime Transition에서 World Rule, Intent, Possibility, Goal까지 역추적 가능해야 하고 반대로 설계에서 Runtime까지 내려갈 수 있어야 한다고 정의한다.

따라서 이 Traceability도 Module과 함께 보존되어야 한다.

⸻

## 10. Module Contract

각 Module에는 최소한 다음 Contract가 존재해야 한다.

```text
MODULE
Identity
Requires
Provides
World Semantic Dependencies
World Rules
Observable Contract
Traceability
Verification Scenarios
```

예:

```text
MODULE
    Mining
REQUIRES
    Actor
    Actor.Position
    Actor.Inventory
    Actor.Knowledge
    Tool.Capability
    ResourceDeposit.Position
    ResourceDeposit.ResourceType
    ResourceDeposit.ResourceAmount
PROVIDES
    Possibility
        MineResource
    Rule
        Mine
    Transition
        Deposit Resource decreases
        Actor Inventory increases
    Observable
        KnowsDeposit
        HasMiningTool
        InRange
        DepositAvailable
        Mine execution
        Before / After
```

Requires는 이 Module이 세계에 존재하기 위해 필요한 Semantic이다.

Provides는 이 Module을 추가함으로써 세계에서 새롭게 가능해지는 Capability이다.

⸻

## 11. 공유 World Semantic

Module을 독립적으로 만든다고 해서 각 Module마다 별개의 World를 만들어서는 안 된다.

예를 들어 다음 구조는 잘못되었다.

```text
MiningInventory
CraftingInventory
TradeInventory
```

Mining, Crafting, Trade가 모두 Inventory라는 동일한 세계 의미를 사용한다면 하나의 공유 World Semantic을 사용해야 한다.

```text
                   WORLD
                     │
        ┌────────────┼────────────┐
        │            │            │
     Mining       Crafting       Trade
        │            │            │
        └────────────┼────────────┘
                     │
                 Inventory
```

Module은 자기만의 World State를 만드는 것이 아니다.

Module은 하나의 공유 World 안에 새로운 Capability를 추가한다.

⸻

## 12. World State와 Implementation State의 분리

공유되는 것은 구현 내부 구조가 아니라 세계의 의미다.

예:

```text
Actor.Inventory
Actor.Position
Actor.Knowledge
Deposit.ResourceAmount
```

는 World Semantic이다.

반면:

```text
vector.capacity
cacheEntry
planner.currentIndex
threadId
```

등은 Implementation State이다.

기존 Workflow에서도 World State에는 세계의 사실만 존재해야 하고 프로그램 구현의 사실은 들어가지 않아야 한다고 규정한다.

따라서 Module 간 Contract 또한 Implementation 객체가 아니라 World Semantic을 중심으로 정의해야 한다.

⸻

## 13. Cycle 내부 Workflow

모든 Cycle은 동일한 Workflow를 따른다.

### Stage 1 — Cycle Goal 입력

사용자가 이번 Cycle의 목표를 정의한다.

예:

```text
Player가 Pickaxe를 가지고
Stone Deposit에 접근하여
Stone을 획득할 수 있다.
```

동시에 이전 Cycle에서 만들어진 Module 목록을 입력으로 받는다.

```text
Available Modules
None
```

Cycle 2라면:

```text
Available Modules
Mining v1
```

처럼 된다.

⸻

## 14. Stage 2 — Goal / Possibility Design

Cycle Goal을 Goal/Possibility 구조로 표현한다.

예:

```text
AcquireStone
    │
    └── MineStone
```

Goal/Possibility Graph는 기존 Workflow와 마찬가지로 해당 게임 의도의 Source of Truth이다.

Cycle의 범위가 작기 때문에 Graph 역시 작게 시작할 수 있다.

중요한 것은 처음부터 MMORPG 전체 Goal Graph를 정의하는 것이 아니다.

이번 Cycle에서 필요한 Graph만 정의한다.

⸻

## 15. Stage 3 — Intent Extraction

Goal/Possibility를 World Meaning으로 변환한다.

예:

```text
INTENT-MINING-001
Stone Deposit을 알고 있고,
적절한 Mining Tool을 보유하고 있으며,
Deposit에 접근 가능한 Actor는
Mine을 수행하여
Deposit의 Stone을 감소시키고
자신의 Inventory에 Stone을 획득할 수 있다.
```

Intent는 클래스나 함수 구조가 아니라 세계에서 무엇이 참이어야 하는지를 정의한다.

기존 Workflow에서도 Intent는 구현 요구사항이 아니며, Implementation 방식이 아니라 World Meaning을 정의하도록 되어 있다.

⸻

## 16. Stage 4 — Existing Module Resolution

새 Cycle에서 필요한 Semantic 중 기존 Module이 이미 제공하고 있는 것은 다시 만들지 않는다.

예를 들어 Cycle 4에서 다음 Intent가 있다고 하자.

```text
Actor가 자신이 소유한 Stone을 Merchant에게 판매한다.
```

필요한 의미가:

```text
Actor
Inventory
Stone
Ownership
Merchant
Gold
Trade
```

라면 기존 Module Registry를 조회한다.

```text
Mining Module
    provides Resource / Inventory interaction
Crafting Module
    uses Inventory
Currency Module
    provides Gold
Trade
    missing
```

그러면 이번 Cycle에서는 기존 의미를 재구현하지 않고 새로운 의미만 정의한다.

```text
NEW SEMANTIC
Trade
Merchant
Trade Rule
```

이 단계가 Cycle의 누적성을 보장한다.

⸻

## 17. Stage 5 — World State / Rule Design

Intent가 필요로 하는 World Semantic을 정의한다.

Mining 예:

```text
Actor
    Position
    Inventory
    Knowledge
Tool
    Capability
ResourceDeposit
    Position
    ResourceType
    ResourceAmount
```

그리고 상태 전이를 정의한다.

```text
RULE-MINE
Preconditions
    Actor knows Deposit
    Actor owns Mining Tool
    Actor is in interaction range
    Deposit has Resource
Transition
    Deposit.ResourceAmount
        -= ExtractAmount
    Actor.Inventory[ResourceType]
        += ExtractAmount
```

세계의 의미 있는 상태 변화는 반드시 World Rule에 귀속되어야 한다는 기존 invariant를 그대로 사용한다.

⸻

## 18. Stage 6 — Observable Contract Design

World State와 World Rule을 설계할 때 동시에 Observable을 설계한다.

Debug UI를 구현 마지막에 추가하지 않는다.

질문은 다음과 같다.

사람이 이 Cycle Goal이 실제 세계에서 성립하는 것을 확인하기 위해 무엇을 볼 수 있어야 하는가?

Mining 예:

```text
Actor
    Position
    Inventory
Goal
    AcquireStone
Possibility
    MineStone
Preconditions
    KnowsDeposit
    HasMiningTool
    InRange
    DepositAvailable
Current Rule
    Mine
Before
After
```

기존 Workflow에서도 World State 구현 후 Debug UI를 붙이는 것이 아니라 World State/Rule과 Observable Representation을 동시에 정의하도록 한다.

⸻

## 19. Stage 7 — Implementation Package

설계가 완료되면 Coding Agent에게 Implementation Package를 전달한다.

기존 구조를 그대로 사용한다.

```text
IMPLEMENTATION PACKAGE
1. Source Design
2. Intent
3. Required World State
4. Required World Rule
5. Observable Contract
6. Required Views
7. Constraints
8. Completion Conditions
```

이 구조는 기존 Workflow의 Agent 작업 단위와 동일하다.

추가로 Cycle 구조에서는 다음 정보가 포함된다.

```text
9. Existing Module Dependencies
10. New Module Boundary
```

즉 Coding Agent는 무엇을 새로 구현해야 하고 무엇을 기존 Module에서 사용해야 하는지 명확하게 알 수 있어야 한다.

⸻

## 20. Stage 8 — Implementation

Implementation Agent는 Package를 기반으로 실제 World Capability를 구현한다.

Agent가 결정할 수 있는 것은:

```text
Class structure
Data structure
File structure
Function structure
Caching
Implementation abstraction
```

등이다.

기존 Workflow에서도 Implementation mechanism은 Agent에게 맡기되 Goal, Possibility, Intent, World Rule, 필요한 World State, Observable 의미는 임의로 변경할 수 없도록 정의한다.

또한 기존 Module의 내부 구현을 직접 변경하는 것은 기본적으로 금지한다.

⸻

## 21. Stage 9 — Playable Assembly

새 Module이 구현되면 실제 작은 게임을 구성한다.

Cycle 1이라면:

```text
Mining Module
    +
Minimal World
    +
Player Input
    +
Game View
```

Cycle 2라면:

```text
Mining Module
    +
Crafting Module
    +
Minimal World
    +
Player Input
    +
Game View
```

Cycle 3이라면:

```text
Mining
+
Crafting
+
Trade
+
Minimal World
```

와 같이 구성한다.

Playable Assembly는 임시 Prototype이 아니다.

현재까지 완성된 Module을 실제 Game World 안에서 조립한 현재 버전의 게임이다.

⸻

## 22. Stage 10 — Game Verification

Cycle은 반드시 실제 플레이를 통해 확인할 수 있어야 한다.

Cycle 1 예:

초기 상태:

```text
Actor
    Pickaxe = 1
    Stone = 0
Deposit
    Stone = 10
```

게임 행동:

```text
Player moves near Deposit.
Player executes Mine.
```

결과:

```text
Actor.Stone
    0 → 1
Deposit.Stone
    10 → 9
```

동시에 Designer View에서는 다음을 확인한다.

```text
Goal
    AcquireStone
Possibility
    MineStone
Available
    true
Preconditions
    KnowsDeposit       true
    HasMiningTool      true
    InRange            true
    DepositAvailable   true
Rule
    RULE-MINE-001
Before
    Actor.Stone        0
    Deposit.Stone      10
After
    Actor.Stone        1
    Deposit.Stone      9
```

기존 Workflow에서도 State만이 아니라 Before → Input → Rule → After 전체 Semantic Transition을 Observable하게 만들어 Runtime 검증의 기본 단위로 사용한다.

⸻

## 23. Negative Verification

성공 Scenario만 검증해서는 안 된다.

각 Rule의 의미가 실제로 동작하는지를 확인하기 위해 실패 조건 역시 플레이 가능한 형태로 검증한다.

예:

```text
No Mining Tool
    → Mine unavailable
Unknown Deposit
    → Mine unavailable
Out of Range
    → Mine unavailable
Empty Deposit
    → Mine unavailable
```

Observable에서는 단순히:

```text
Mine failed
```

가 아니라:

```text
MineStone
    UNAVAILABLE
KnowsDeposit
    true
HasMiningTool
    true
InRange
    false
DepositAvailable
    true
Reason
    Actor is outside interaction range.
```

처럼 인간이 원인을 확인할 수 있어야 한다.

이는 World Rule의 판단에 영향을 주는 모든 의미가 관찰 가능해야 한다는 기존 Observable Closure 원칙과 동일하다.

⸻

## 24. Stage 11 — Module Packaging

게임 동작이 확인되면 이번 Cycle에서 추가된 Capability를 Module로 패키징한다.

```text
CAPABILITY MODULE
ID
Version
Requires
Provides
Intent
World State Semantic
World Rules
Observable Contract
Traceability
Verification Scenarios
```

Module은 이후 Cycle이 사용할 공식적인 결과물이다.

⸻

## 25. Cycle Completion Gate

하나의 Cycle은 다음 조건을 모두 만족해야 완료된다.

```text
[ ] 사용자의 Cycle Goal이 명확하다.
[ ] Goal이 작은 게임으로 직접 플레이 가능하다.
[ ] Goal/Possibility가 정의되어 있다.
[ ] Intent가 정의되어 있다.
[ ] Intent의 모든 의미가 World State 또는 Rule에 존재한다.
[ ] 의미 있는 상태 변화가 World Rule을 통해 발생한다.
[ ] 필요한 Semantic State가 Observable하다.
[ ] Before / Rule / After Transition이 Observable하다.
[ ] Game View에서 직접 결과를 확인할 수 있다.
[ ] Designer View에서 설계 언어로 결과를 확인할 수 있다.
[ ] Positive Scenario가 동작한다.
[ ] Negative Scenario가 동작한다.
[ ] 새 Capability가 Module로 패키징되어 있다.
[ ] Module의 Requires / Provides가 명확하다.
[ ] 기존 Module을 재구현하지 않았다.
[ ] 다음 Cycle이 내부 구현을 몰라도 이 Module을 사용할 수 있다.
```

기존 Workflow에서 코드가 동작하는 것만으로는 완료가 아니며, 설계 Intent가 실제 World State/Rule/Transition으로 존재하고 인간에게 관찰 가능해야 완료라고 정의한다.

Cycle Completion은 여기에 재사용 가능한 Module 완성 조건을 추가한 것이다.

⸻

## 26. 기존 Module 변경 규칙

기본 원칙:

완료된 이전 Cycle Module은 새로운 Cycle에서 직접 수정하지 않는다.

새로운 요구사항은 가능한 한 새로운 Capability 또는 Extension으로 추가한다.

예:

```text
Mining Module v1
Mine Resource
```

나중에 Tool Durability가 필요해진 경우:

```text
Tool Durability Module
Requires
    Tool
    Rule Execution
Provides
    Durability
    Durability Consumption
```

를 추가하여 Mining과 조합한다.

⸻

## 27. Module Version 변경

기존 Module의 의미 자체가 잘못되어 새로운 기능을 추가할 수 없는 경우가 있을 수 있다.

이때 기존 Module을 조용히 수정하지 않는다.

명시적으로 Version을 변경한다.

```text
Mining Module v1
        ↓
Mining Module v2
```

Version 변경에는 최소 다음이 기록되어야 한다.

```text
Previous Semantic
Problem
New Semantic
Affected Modules
Affected Intent
Affected Rules
Affected Observable
Migration Verification
```

이렇게 해야 어느 Cycle에서 세계의 의미가 변경되었는지 추적할 수 있다.

⸻

## 28. Cycle 1 예제 — Mining

Cycle Goal

```text
Player가 Pickaxe를 가지고
Stone Deposit에 접근하여
Stone을 하나 획득할 수 있다.
```

Goal / Possibility

```text
AcquireStone
    └── MineStone
```

Output Module

```text
Mining Module v1
```

Playable World

```text
Player
Pickaxe
Stone Deposit
Small Map
```

Verification

```text
Move
    ↓
Approach Deposit
    ↓
Mine
    ↓
Stone 0 → 1
Deposit 10 → 9
```

⸻

## 29. Cycle 2 예제 — Crafting

Existing Module

```text
Mining Module v1
```

Cycle Goal

```text
Player가 획득한 Resource를 이용하여
Pickaxe를 제작할 수 있다.
```

Workflow

```text
CraftPickaxe
      ↓
Crafting Intent
      ↓
Recipe / Material Semantic
      ↓
Craft Rule
      ↓
Observable
      ↓
Crafting Implementation
```

Mining은 다시 만들지 않는다.

Resource 획득이 필요하면:

```text
Mining Module
```

을 사용한다.

Output

```text
Crafting Module v1
```

Playable World

```text
Mining Module
+
Crafting Module
```

사용자는 실제로:

```text
Mine Resource
      ↓
Open Crafting
      ↓
Consume Materials
      ↓
Create Pickaxe
```

까지 하나의 게임으로 확인한다.

⸻

## 30. Cycle 3 예제 — Trade

Existing

```text
Mining Module
Crafting Module
```

New Goal

```text
Player가 획득한 Stone을 Merchant에게 판매하고
Gold를 획득할 수 있다.
```

Output

```text
Trade Module
```

Current Game

```text
Mining
+
Crafting
+
Trade
```

이 시점에서 게임은 이미 작은 경제 Loop를 가지게 된다.

```text
Mine
 ↓
Resource
 ↓
Craft / Sell
 ↓
Equipment / Gold
```

각 행동은 별도 Module이지만 동일한 World State를 통해 연결된다.

⸻

## 31. 장기 성장 구조

이 방식으로 Capability를 계속 추가한다.

```text
Cycle 1
Mining
Cycle 2
Crafting
Cycle 3
Trade
Cycle 4
Combat
Cycle 5
Loot
Cycle 6
NPC Goal Execution
Cycle 7
Quest
Cycle 8
Party
Cycle 9
World Persistence
Cycle 10
Region / Exploration
Cycle 11
Market
Cycle 12
Territory
Cycle 13
Guild
...
```

중요한 것은 각 Cycle의 정확한 순서를 미리 확정하는 것이 아니다.

사용자가 다음 Cycle Goal을 결정한다.

Workflow는 그 Goal을 대상으로 하나의 완전한 Capability를 만들어낸다.

⸻

## 32. 전체 Agent Workflow

최종적으로 Agent 구조는 다음과 같다.

```text
                  USER
                   │
             Cycle Goal
                   │
                   ▼
          Module Resolver
                   │
       ┌───────────┴────────────┐
       │                        │
Existing Capability      Missing Capability
       │                        │
       └───────────┬────────────┘
                   ▼
             Intent Agent
                   │
                   ▼
          World Model Agent
                   │
          State / Rule
          Observable
                   │
                   ▼
        Human Semantic Review
                   │
                   ▼
       Implementation Package
                   │
                   ▼
       Implementation Agent
                   │
                   ▼
          Playable Assembly
                   │
                   ▼
        Verification Agent
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    Semantic   Observable   Runtime
    Closure     Closure     Scenario
        └──────────┼──────────┘
                   ▼
           Human Observation
                   │
                   ▼
           Module Packaging
                   │
                   ▼
            Module Registry
                   │
                   ▼
              Next Cycle
```

기존 Workflow의 Agent 구조인 Human Design → Intent Agent → World Model Agent → Human Semantic Review → Implementation Agent → Verification Agent → Human Observation은 유지한다.

Cycle 구조에서는 앞에:

```text
Module Resolver
```

를 추가하고,

끝에:

```text
Module Packaging
Module Registry
```

를 추가한다.

⸻

## 33. Module Registry

완료된 모든 Capability는 Module Registry에 등록한다.

예:

```text
WORLD CAPABILITY REGISTRY
Mining
    Version: 1
    Provides:
        MineResource
Crafting
    Version: 1
    Provides:
        CraftItem
Trade
    Version: 1
    Provides:
        Buy
        Sell
Combat
    Version: 1
    Provides:
        Attack
        Damage
```

새로운 Cycle을 시작할 때 Agent는 먼저 Registry를 확인한다.

질문은 다음과 같다.

```text
이번 Goal을 달성하기 위해 필요한 Capability 중
이미 존재하는 것은 무엇인가?
그리고 새로 만들어야 하는 것은 무엇인가?
```

이 과정을 통해 동일한 Capability의 중복 구현을 방지한다.

⸻

## 34. 최종 구조

전체 개발 과정을 한 장으로 표현하면 다음과 같다.

```text
══════════════════════════════════════════════
                  USER
══════════════════════════════════════════════
              Cycle Goal N
                   │
                   ▼
          Capability Resolver
                   │
          Existing Modules
                   │
                   ▼
══════════════════════════════════════════════
                  CYCLE
══════════════════════════════════════════════
        Goal / Possibility
                ↓
             Intent
                ↓
         World State / Rule
                ↓
            Observable
                ↓
       Human Semantic Review
                ↓
      Implementation Package
                ↓
         Implementation
                ↓
        Playable Assembly
                ↓
          Verification
                ↓
══════════════════════════════════════════════
                OUTPUT
══════════════════════════════════════════════
      Capability Module N
                +
       Playable World N
                │
                ▼
         Module Registry
                │
                ▼
              Next Cycle
══════════════════════════════════════════════
Cycle 1 → Module A
Cycle 2 → Module B using A
Cycle 3 → Module C using A + B
Cycle 4 → Module D using A + B + C
...
Open World MMORPG
    =
A + B + C + D + ...
```

⸻

## 35. 최종 원칙

Rule 1

Cycle은 Module이 아니라 Workflow 전체를 한 번 실행하는 공정이다.

Rule 2

Cycle은 항상 사람이 직접 플레이해서 확인할 수 있을 정도로 작은 Goal을 대상으로 한다.

Rule 3

작은 Goal이라도 Goal/Possibility → Intent → State → Rule → Observable → Runtime 전체가 완전히 연결되어야 한다.

Rule 4

Cycle의 장기 결과물은 Prototype이 아니라 재사용 가능한 World Capability Module이다.

Rule 5

새로운 Cycle은 이전 Cycle의 Capability를 다시 구현하지 않고 Module로 사용한다.

Rule 6

Module은 별개의 World를 가지지 않는다.

모든 Module은 동일한 World Semantic을 공유한다.

Rule 7

Module의 Contract는 구현 클래스가 아니라 Requires / Provides World Semantic을 중심으로 정의한다.

Rule 8

Observable과 Traceability 역시 Module의 일부이다.

Rule 9

이전 Module은 후속 Cycle에서 기본적으로 수정하지 않는다.

의미 변경이 필요한 경우 명시적인 Module Version 변경으로 처리한다.

Rule 10

각 Cycle에서 추가된 Module을 이전 Module들과 실제로 조립하여 하나의 플레이 가능한 게임으로 검증한다.

⸻

## 36. 한 문장 정의

사용자가 제시한 하나의 작고 플레이 가능한 게임 목표를 대상으로 Goal/Possibility → Intent → World State/Rule → Observable → Implementation → Verification Workflow 전체를 완주하고, 그 결과를 이후 Cycle에서 수정 없이 조립하여 사용할 수 있는 World Capability Module로 만든 뒤, 이러한 Module을 반복적으로 누적하여 최종 Open World MMORPG를 구성한다.

더 짧게 표현하면:

Cycle로 검증하고, Module로 보존하며, Composition으로 MMORPG를 성장시킨다.
