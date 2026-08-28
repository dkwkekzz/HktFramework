# Design-Workflow.md

Goal/Possibility 기반 Observable World 구현 Workflow

## 1. 기본 구조

전체 구조의 Source of Truth는 다음이다.

```text
               [Human Design]

        Goal Graph       Possibility Graph
             \                 /
              \               /
               └── Intent ───┘
                     │
                     ▼
              World Definition
              ┌──────────────┐
              │ World State  │
              │ World Rule   │
              └──────────────┘
                     │
                     ▼

               [Runtime World]

              World State(t)
                     │
                Input + Rule
                     │
                     ▼
              World State(t+1)
                     │
                     ▼
            Observable World State
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
          Rendering       Verification
              │             │
              ▼             ▼
            Human         Human

```

이 Workflow의 핵심은 다음이다.

Goal/Possibility Graph가 세계의 의도를 정의하고,
World State와 World Rule이 그 의도를 실행 가능한 세계 의미론으로 구체화하며,
실행 결과 전체가 Observable World State로 표현되어 인간이 설계 언어 그대로 확인할 수 있어야 한다.

## 2. 역할을 명확하게 분리한다

개발 과정에는 서로 다른 네 종류의 작업이 존재한다.

```text
Human Design
    ↓
Intent Definition
    ↓
World Semantic Design
    ↓
Implementation
    ↓
Observation / Verification

```

각 단계는 이전 단계의 의미를 임의로 변경해서는 안 된다.

## 3. Stage 1 — Human Design

입력

게임 디자이너가 작성한:

```text
Goal Graph
Possibility Graph

```

이다.

예:

```text
AcquireStone
│
├─ PickUpStone
├─ MineStone
├─ BuyStone
└─ ReceiveStone

```

Possibility 내부에 다시 Goal이 연결될 수 있다.

```text
AcquireStone
    ↓
MineStone
    ↓
Requires Pickaxe
    ↓
AcquirePickaxe

```

이 그래프가 가장 높은 수준의 게임 의도 Source of Truth이다.

중요한 규칙

Implementation Agent는 이 그래프를 변경할 수 없다.

구현하기 어렵다는 이유로:

```text
MineStone 제거
AcquirePickaxe 생략
새로운 Goal 임의 생성

```

등을 해서는 안 된다.

그래프의 변경은 설계 변경이다.

## 4. Stage 2 — Intent Extraction

Goal/Possibility Graph를 그대로 Coding Agent에게 넘기지 않는다.

그래프에서 실제로 세계가 보장해야 하는 의미 단위를 추출한다.

이를 `Intent`라고 한다.

예:

```text
Goal:
    AcquireStone

Possibility:
    MineStone

```

에서 다음 Intent를 만든다.

```text
INTENT-MINING-001

광맥을 알고 있으며,
적절한 채굴 도구를 보유하고 있고,
광맥에 접근 가능한 Actor는

Mine 행동을 통해

광맥의 자원을 감소시키고
자신의 Stone 보유량을 증가시킬 수 있다.

```

Intent는 반드시 원본 그래프를 참조한다.

```text
Intent ID:
    INTENT-MINING-001

Source Goal:
    GOAL-RESOURCE-ACQUIRE-STONE

Source Possibility:
    POSSIBILITY-MINE-STONE

```

따라서 항상 다음 관계가 유지된다.

```text
Goal / Possibility
        │
        ▼
      Intent
        │
        ▼
World Implementation

```

코드에서 다시 원래 설계까지 추적할 수 있어야 한다.

## 5. Intent는 구현 요구사항이 아니다

Intent는 클래스 설계가 아니다.

잘못된 Intent:

```text
MiningComponent 클래스를 만든다.
Mine() 함수를 만든다.
InventoryService를 호출한다.

```

올바른 Intent:

```text
특정 조건을 만족하는 Actor가
Deposit에 Mine을 수행하면

Actor가 Resource를 획득하고
Deposit의 Resource가 감소한다.

```

Intent에서는 세계에서 무엇이 참이어야 하는가만 정의한다.

어떻게 구현할지는 다음 단계의 책임이다.

## 6. Stage 3 — Intent에서 World State를 도출한다

World Model Agent는 Intent를 읽고:

이 문장을 세계에서 사실로 만들기 위해 어떤 정보가 존재해야 하는가?

를 분석한다.

예:

```text
"광맥을 알고 있다"

```

를 표현하려면:

```text
Actor.Knowledge
Deposit.Identity

```

가 필요하다.

```text
"적절한 채굴 도구를 가지고 있다"

```

라면:

```text
Actor.Inventory
Item.ToolCapability

```

가 필요하다.

```text
"광맥에 접근할 수 있다"

```

라면:

```text
Actor.Position
Deposit.Position
InteractionRange

```

가 필요하다.

결과:

```text
INTENT-MINING-001

Required World State

Actor
    Position
    Inventory
    Knowledge

Tool
    Capability
    Durability

Deposit
    Position
    ResourceType
    ResourceAmount

```

## 7. World State의 기준

World State에는 세계 의미만 존재한다.

다음은 World State이다.

```text
Arin.Position
Arin.HP
Arin.Inventory
Arin.Knowledge
Deposit.ResourceAmount
Wolf.Target
Merchant.Gold

```

다음은 World State가 아니다.

```text
vector.capacity
planner.currentNodeIndex
cacheEntry
threadId
hashBucket
temporaryScoreBuffer

```

이들은 Implementation State이다.

따라서 상태를 추가할 때 항상 묻는다.

이것은 세계의 사실인가, 아니면 프로그램 구현의 사실인가?

세계의 사실만 World State에 들어간다.

## 8. 중요한 추가 규칙 — Decision Semantic State

어떤 상태가 World의 판단 결과에 영향을 준다면 그것 역시 세계의 의미로 간주한다.

예:

```text
Knowledge
Preference
Experience
Skill
CurrentGoal
CurrentPossibility

```

이 정보들이 Agent의 선택에 영향을 준다면 단순 Planner 내부 변수가 아니다.

World Semantic State이다.

따라서 관측 가능해야 한다.

## 9. Stage 4 — World Rule 정의

Intent에서 상태 변화 규칙을 도출한다.

World Rule은 다음 형태를 가진다.

```text
Rule
    Preconditions
    Input
    Transition
    Result

```

예:

```text
RULE-MINE-001

Input

    Actor
    Deposit


Preconditions

    Actor.Alive == true

    Actor.Knows(Deposit) == true

    Actor.HasTool(Mining) == true

    Distance(Actor, Deposit)
        <= MiningInteractionRange

    Deposit.ResourceAmount > 0


Transition

    Deposit.ResourceAmount
        -= ExtractAmount

    Actor.Inventory[Deposit.ResourceType]
        += ExtractAmount

```

Rule은 단순 코드 함수가 아니다.

세계에서 허용되는 상태 전이의 정의

이다.

## 10. 세계 상태는 Rule을 통해서만 의미 있게 변경된다

게임의 Semantic State에 대해서 다음 invariant를 둔다.

```text
WorldState(t)
       │
       │ Rule + Input
       ▼
WorldState(t+1)

```

즉:

세계의 의미 있는 상태 변화는 반드시 어떤 World Rule에 귀속될 수 있어야 한다.

코드 어디선가 이유 없이:

```text
stoneCount++;

```

하는 것이 허용되지 않는다.

그 변화는 반드시:

```text
Mine
Trade
Pickup
Reward
Spawn

```

등 특정 World Rule의 결과여야 한다.

## 11. Rule에는 설계 추적 정보가 존재한다

Rule도 자신이 어떤 Intent를 구현하고 있는지 알아야 한다.

예:

```text
RULE-MINE-001

Implements:
    INTENT-MINING-001

Derived From:
    GOAL-RESOURCE-ACQUIRE-STONE
    POSSIBILITY-MINE-STONE

```

따라서 추적 관계는:

```text
Goal
 ↓
Possibility
 ↓
Intent
 ↓
Rule
 ↓
State Transition

```

으로 끝까지 이어진다.

## 12. Stage 5 — Observable World State 설계

여기서 매우 중요한 규칙이 있다.

WorldState가 구현된 뒤에 Debug UI를 붙이는 것이 아니다.

World State와 Rule을 정의하면서 동시에 Observable Representation을 정의한다.

질문은 다음이다.

인간이 이 Intent가 실제로 세계에서 성립하고 있음을 확인하려면 무엇을 볼 수 있어야 하는가?

## 13. Observable World State

Observable World State는 World State의 Semantic Projection이다.

```text
WorldState
     │
     ▼
ObservableWorldState

```

여기에서 중요한 조건은:

설계 판단에 필요한 의미가 Projection 과정에서 사라져서는 안 된다.

이를 다음과 같이 정의한다.

```text
Semantic Lossless Projection

```

메모리 데이터를 모두 복제한다는 의미는 아니다.

세계의 의미가 사라지지 않는다는 의미이다.

## 14. Mining Intent의 Observable Definition

예:

```text
OBS-MINING-001

Actor
    Name
    Position

Knowledge
    Knows Deposit01

Inventory
    Pickaxe x1
    Stone x0

Deposit01
    Resource
        Stone

    Amount
        100

Current Goal
    AcquireStone

Selected Possibility
    MineStone

Current Rule
    Mine

```

Rule 실행 후:

```text
Actor.Inventory.Stone
    0 → 1

Deposit01.Amount
    100 → 99

```

이렇게 표현되어야 한다.

## 15. State뿐만 아니라 Transition도 Observable 해야 한다

단순히 현재 상태만 보면 원인을 알 수 없는 경우가 많다.

따라서 Semantic Transition은:

```text
Before
Input
Rule
After

```

형태로 관찰 가능해야 한다.

예:

```text
Transition #1742

Intent
    AcquireStone through MineStone

Before

    Arin.Stone = 0
    Deposit01.Amount = 100

Input

    Mine(Arin, Deposit01)

Rule

    RULE-MINE-001

After

    Arin.Stone = 1
    Deposit01.Amount = 99

```

이것이 Runtime 검증의 가장 기본적인 단위다.

## 16. Stage 6 — View는 Observable World State만 본다

매우 중요한 Architecture Rule이다.

```text
                    WorldState
                        │
                        ▼
               ObservableWorldState
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       GameView     DebugView    DesignerView

```

View가 World 내부 구현을 직접 읽어서는 안 된다.

잘못된 구조:

```text
GameView ─────→ CombatSystem 내부
DebugView ────→ Planner 내부
DesignerView ─→ WorldState

```

그러면 서로 다른 세계를 보고 있는 셈이 된다.

올바른 구조:

```text
              World
                ↓
         ObservableWorld
          ↓      ↓      ↓
       Game   Debug   Designer

```

이다.

## 17. Rendering 자체가 검증 수단이 된다

게임 화면 역시 Observable State의 View이다.

예:

```text
Observable

HP = 73
Position = (10, 20)
Action = Attack
Buff = Poison

```

Game View:

```text
HP Bar
Character Position
Attack Animation
Poison Effect

```

Debug View:

```text
HP: 73
Action: Attack Wolf17
Poison Stack: 2

```

두 View 모두 동일한 Observable State를 읽는다.

따라서 Rendering 자체도 세계 상태가 올바르게 구성됐는지를 보는 하나의 검증 수단이 된다.

## 18. Goal/Possibility 실행도 Observable 해야 한다

현재 설계에서 특히 중요하다.

정적 Graph:

```text
AcquireFood
│
├─ Hunt
├─ Gather
├─ Buy
└─ Receive

```

Runtime에서는:

```text
AcquireFood
│
├─ Hunt
│    AVAILABLE
│    score = ...
│
├─ Gather
│    UNAVAILABLE
│    reason = no known resource
│
├─ Buy
│    UNAVAILABLE
│    reason = insufficient gold
│
└─ Receive
     UNAVAILABLE
     reason = no candidate

```

그리고:

```text
Selected
    Hunt

Executing
    Attack Wolf17

```

처럼 Overlay 되어야 한다.

따라서 인간은 정적 설계와 실제 Runtime 선택을 같은 언어로 비교한다.

## 19. 하나의 Agent 작업 단위

Coding Agent에게 넘기는 것은 일반 설계 문서 전체가 아니다.

`Implementation Package` 하나다.

구조는 다음과 같다.

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

## 20. 실제 Package 예제

```text
PACKAGE
    WORLD-MINING-001


SOURCE DESIGN

Goal:
    AcquireStone

Possibility:
    MineStone


INTENT

광맥의 위치를 알고 있고
채굴 가능한 도구를 보유하고 있으며
광맥에 접근 가능한 Actor는

Mine을 통해 Stone을 획득할 수 있다.


WORLD STATE

Actor.Position
Actor.Inventory
Actor.Knowledge

Tool.Capability

Deposit.Position
Deposit.ResourceType
Deposit.ResourceAmount


WORLD RULE

Mine

Preconditions:
    knows deposit
    has mining tool
    in interaction range
    deposit contains resource

Effects:
    deposit resource decreases
    actor inventory increases


OBSERVABLE

Must expose:

    Actor
    Goal
    Possibility
    Rule
    Preconditions
    Before State
    After State


VIEW

Designer must be able to see:

AcquireStone
    ↓
MineStone
    ↓
Mine

Before:
    Stone 0
    Deposit 100

After:
    Stone 1
    Deposit 99

```

## 21. Agent가 할 수 있는 것

Implementation Agent는 다음을 결정할 수 있다.

```text
클래스 구조
자료구조
파일 분리
함수 구조
캐싱 전략
일반적인 코드 추상화

```

즉 Implementation Mechanism은 Agent에게 맡긴다.

## 22. Agent가 할 수 없는 것

Agent는 다음을 임의로 변경할 수 없다.

```text
Goal 의미 변경
Possibility 추가/삭제
Intent 의미 변경
World Rule의 게임 의미 변경
필요한 World State 생략
Observable 의미 생략

```

예를 들어 구현하기 어렵다는 이유로:

```text
Knowledge 체크 제거

```

는 할 수 없다.

이것은 코드 최적화가 아니라 세계 규칙 변경이기 때문이다.

## 23. Agent가 설계상 부족함을 발견한 경우

Agent가 다음을 발견할 수 있다.

```text
Mine의 가능 여부를 판단하려면
ToolCapability라는 State가 필요한데
현재 World Definition에는 존재하지 않는다.

```

이 경우 Agent가 임의로 의미를 확정하지 않는다.

다음 형태로 Proposal을 생성한다.

```text
WORLD DESIGN GAP

Intent:
    INTENT-MINING-001

Missing Semantic:
    ToolCapability

Reason:
    Mining 가능 여부를 표현할 World State가 없음.

Proposed State:
    Tool.Capability

```

즉 Agent는 설계 변경을 수행하는 것이 아니라 설계 변경 후보를 제출한다.

## 24. 구현 완료의 정의

다음 중 하나라도 빠지면 완료가 아니다.

```text
Goal/Possibility Trace
        ✓

Intent
        ✓

World State
        ✓

World Rule
        ✓

Runtime Transition
        ✓

Observable State
        ✓

Observable Transition
        ✓

View
        ✓

```

즉:

```text
코드가 동작한다

```

는 완료 조건이 아니다.

완료 조건은:

설계 Intent가 세계의 상태와 규칙으로 존재하고, 실제 상태 전이가 발생하며, 그 전이가 인간에게 설계 언어 그대로 관측 가능하다.

이다.

## 25. Semantic Closure 검사

각 구현 단위에는 `Semantic Closure`라는 Gate를 둔다.

Intent에 등장하는 모든 의미가 World Definition에 존재해야 한다.

예:

```text
Intent

"광맥을 알고 있고
 도구를 가지고 있으며
 가까이에 있으면
 채굴할 수 있다."

```

그러면 반드시:

```text
알고 있다
    → Knowledge State

도구를 가지고 있다
    → Inventory State

채굴 가능 도구
    → Tool Capability State

가까이 있다
    → Position / Range State

채굴
    → Mine Rule

자원을 얻는다
    → Inventory Transition

```

로 연결돼야 한다.

연결되지 않은 문장이 하나라도 있으면 Semantic Closure 실패다.

## 26. Observable Closure 검사

다음으로 `Observable Closure`를 검사한다.

World Rule의 판단에 영향을 주는 모든 설계 의미가 관찰 가능해야 한다.

예:

```text
Mine Precondition

KnowsDeposit
HasMiningTool
InRange
DepositAvailable

```

라면 Designer View에서 최소한:

```text
KnowsDeposit
    true

HasMiningTool
    true

InRange
    false

DepositAvailable
    true

```

를 볼 수 있어야 한다.

그리고 왜 실행되지 않았는지도:

```text
MineStone
    unavailable

Reason:
    Actor is out of interaction range.

```

처럼 표현될 수 있어야 한다.

## 27. Design → Runtime 전체 Traceability

모든 Runtime 의미는 설계까지 역추적 가능해야 한다.

```text
Runtime Transition
        ↓
World Rule
        ↓
Intent
        ↓
Possibility
        ↓
Goal

```

반대로 설계에서도 Runtime까지 내려갈 수 있어야 한다.

```text
Goal
 ↓
Possibility
 ↓
Intent
 ↓
Rules
 ↓
Current Runtime Instances

```

이 연결이 끊어지면 해당 코드는 설계에서 유래한 것인지 판단할 수 없게 된다.

## 28. Agent Workflow

실제 Agent들은 다음 순서로 작업한다.

```text
┌─────────────────────────┐
│ Human Design            │
│ Goal / Possibility      │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│ Intent Agent            │
│                         │
│ Graph → Intent Package  │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│ World Model Agent       │
│                         │
│ Intent → State / Rule   │
│        → Observable     │
└────────────┬────────────┘
             ▼
      Human Semantic Review
             │
             ▼
┌─────────────────────────┐
│ Implementation Agent    │
│                         │
│ World 구현              │
│ Observable 구현         │
│ View 연결               │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│ Verification Agent      │
│                         │
│ Semantic Closure        │
│ Observable Closure      │
│ Runtime Scenario        │
└────────────┬────────────┘
             ▼
        Human Observation

```

## 29. 인간의 Review 지점

인간이 모든 코드를 리뷰하는 것이 아니다.

두 곳에 집중한다.

첫 번째

```text
Intent
    ↓
World State / Rule

```

즉:

이 세계 정의가 내가 설계한 의도를 정확하게 표현하는가?

를 본다.

두 번째

```text
Runtime
    ↓
Observable
    ↓
View

```

즉:

실제 세계가 내가 의도한 방식으로 움직이고 있는가?

를 본다.

## 30. 최종 원칙

이 Workflow에서 가장 중요한 규칙은 다음이다.

Rule 1

Goal/Possibility Graph가 게임 의도의 Source of Truth이다.

Rule 2

Intent는 그래프에서 추출하며 Implementation Agent가 임의로 변경하지 않는다.

Rule 3

Intent의 모든 의미는 World State 또는 World Rule로 표현되어야 한다.

Rule 4

세계의 의미 있는 상태 변화는 World Rule에 의해 발생해야 한다.

Rule 5

World Rule의 판단과 결과에 관계되는 의미적 상태는 Observable 해야 한다.

Rule 6

View는 World 내부 구현이 아니라 Observable World State를 읽는다.

Rule 7

정적 Goal/Possibility와 동적 Runtime 상태는 동일한 설계 언어로 함께 관찰할 수 있어야 한다.

Rule 8

설계적으로 의미 있는 상태가 관측되지 않는 기능은 구현 완료가 아니다.

## 31. 한 문장으로 정의

Goal/Possibility Graph로 세계의 의도를 정의하고, 각 의도를 World State와 World Rule이라는 실행 가능한 세계 의미론으로 폐쇄한 뒤, 그 상태와 전이를 Observable World State로 의미 손실 없이 투영하여 동일한 설계 언어로 인간이 관찰할 수 있게 만드는 것이 구현의 완료 조건이다.

따라서 AI Agent의 역할은

코드를 작성하는 것

이 아니라

주어진 Intent를 `State → Rule → Transition → Observable`이라는 닫힌 세계 단위로 구현하는 것

이다.
