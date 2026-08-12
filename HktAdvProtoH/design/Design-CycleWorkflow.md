# Design-CycleWorkflow.md

Cycle-Based Observable World & GameView Development Workflow

## 1. 목적

이 문서는 최종적으로 Open World MMORPG를 구축하기 위해, 작은 플레이 목표를 하나씩 완성하고 그 결과를 재사용 가능한 Capability Module로 축적하는 전체 개발 Workflow를 정의한다.

핵심 개발 단위는 `Cycle`이다.

하나의 Cycle은 사용자가 제시한 작고 직접 플레이 가능한 목표를 입력받아 다음 과정을 수행한다.

```text
Cycle Goal
    ↓
World Workflow
    ↓
World Capability Module
    +
GameView Specification
    ↓
GameView Workflow
    ↓
GameView Module
    ↓
Integration Workflow
    ↓
Playable Build
    ↓
Cycle Verification
    ↓
Next Cycle
```

Cycle에서 만들어진 기능은 임시 Prototype이 아니다.

이후 Cycle에서 다시 구현하지 않고 그대로 사용하는 최종 MMORPG의 실제 구성 요소가 된다.

```text
Cycle 1
    Mining

Cycle 2
    Mining
    + Crafting

Cycle 3
    Mining
    + Crafting
    + Trade

Cycle 4
    Mining
    + Crafting
    + Trade
    + Combat

...

Open World MMORPG
```

## 2. 최상위 구조

전체 개발 Workflow는 세 개의 독립 Pipeline으로 분리한다.

```text
┌──────────────────────────────────────┐
│           WORLD WORKFLOW             │
│                                      │
│ 세계에서 무엇이 참인가?              │
│ 어떤 행동과 상태 변화가 가능한가?    │
│ Observer는 무엇을 볼 수 있는가?      │
└──────────────────┬───────────────────┘
                   │
                   │ Contract
                   ▼
        Observable Contract
        GameView Specification
                   │
                   ▼
┌──────────────────────────────────────┐
│          GAMEVIEW WORKFLOW           │
│                                      │
│ 전달된 의미를 어떻게 화면으로        │
│ 표현할 것인가?                       │
└──────────────────┬───────────────────┘
                   │
                   ▼
             GameView Module
                   │
                   │
     World Module  │
          └──────┬─┘
                 ▼
┌──────────────────────────────────────┐
│        INTEGRATION WORKFLOW          │
│                                      │
│ World와 GameView가 계약대로          │
│ 연결되어 플레이 가능한가?            │
└──────────────────┬───────────────────┘
                   │
                   ▼
             Playable Build
```

세 Workflow는 서로의 내부 구현을 알지 않는다.

## 3. Source of Truth

게임 의미의 Source of Truth는 다음 순서를 따른다.

```text
Human Design
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / World Rule
    ↓
Authoritative World
    ↓
Observer Projection
    ↓
Observable World
```

Goal/Possibility Graph가 세계의 의도를 정의하고, World State와 World Rule이 그것을 실행 가능한 세계 의미론으로 구체화하며, 실행 결과는 Observable World State로 인간에게 관찰 가능해야 한다.

기존 Workflow의 다음 원칙은 그대로 유지한다.

* Goal/Possibility는 가장 높은 수준의 게임 의도이다.
* Intent는 구현 요구사항이 아니라 세계에서 무엇이 참이어야 하는가를 정의한다.
* 의미 있는 World State 변경은 반드시 World Rule에 귀속된다.
* World의 판단과 결과에 영향을 주는 의미는 Observable해야 한다.
* Runtime Transition에서 Goal/Possibility까지 역추적 가능해야 한다.

## 4. Cycle의 정의

`Cycle`은 Module이나 Artifact를 의미하지 않는다.

Cycle은 전체 개발 공정 한 번을 의미한다.

Cycle은 사용자가 지정한 하나의 작고 플레이 가능한 게임 목표를 대상으로 World Workflow → GameView Workflow → Integration Workflow → Verification까지 한 번 완전히 수행하는 과정이다.

예:

```text
Cycle Goal

"곡괭이를 가진 Player가
광맥에 접근해
Stone을 채굴할 수 있다."
```

Cycle 종료 시에는 최소 두 종류의 결과물이 존재한다.

```text
World Capability Module
GameView Module
```

그리고 이 둘을 조합하여:

```text
Playable Build
```

가 만들어진다.

## 5. Cycle의 입력과 출력

입력

```text
1. User Cycle Goal

2. Existing World Capability Modules

3. Existing GameView Modules
```

첫 Cycle이라면 기존 Module이 없을 수 있다.

후속 Cycle에서는 이전 결과물을 그대로 사용한다.

예:

```text
Cycle 2 Input

Goal
    Resource를 이용하여 Pickaxe를 제작한다.

Existing World Modules
    Mining v1

Existing GameView Modules
    MiningView v1
```

출력

```text
1. New World Capability Module

2. GameView Specification

3. New GameView Module

4. Playable Build

5. Verification Result
```

## 6. Cycle 전체 단계

하나의 Cycle은 다음 순서를 따른다.

```text
Stage 1  Cycle Scope

Stage 2  Intent Design

Stage 3  World Semantic Design

Stage 4  Authority Design

Stage 5  Observation Design

Stage 6  GameView Specification

Stage 7  World Implementation

Stage 8  World Verification

--------------------------------
      Contract Boundary
--------------------------------

Stage 9  GameView Specification Resolution

Stage 10 Visual Composition

Stage 11 Asset Resolution

Stage 12 Observable Binding

Stage 13 GameView Implementation

Stage 14 GameView Verification

--------------------------------

Stage 15 Integration

Stage 16 Playable Verification

Stage 17 Module Packaging
```

# Part I — World Workflow

## 7. Stage 1 — Cycle Scope

역할

이번 Cycle에서 완성할 최소 플레이 경험을 고정한다.

이 단계에서는 구현 구조를 설계하지 않는다.

질문은 하나다.

이번 Cycle이 끝났을 때 사용자는 실제 게임에서 무엇을 할 수 있어야 하는가?

입력

```text
User Cycle Goal

Existing Capability Modules
```

예

```text
Cycle Goal

Player가 Pickaxe를 가지고
Stone Deposit에 접근하여
Stone을 획득한다.
```

Scope

```text
Included

    이동
    Deposit 접근
    Mine 실행
    Stone 획득

Excluded

    Crafting
    Trade
    NPC
    Deposit Respawn
    Multiple Resource Type
```

출력

```text
CYCLE SCOPE
```

완료 조건

하나의 작은 게임 Scenario로 직접 실행할 수 있을 정도로 범위가 작아야 한다.

## 8. Stage 2 — Intent Design

역할

Cycle Goal을 World Meaning으로 변환한다.

작업

Goal/Possibility를 정의한다.

```text
AcquireStone
    │
    └── MineStone
```

Intent를 추출한다.

```text
INTENT-MINING-001

Stone Deposit을 알고 있고,
Mining 가능한 Tool을 보유하고 있으며,
Deposit에 접근 가능한 Actor는

Mine을 수행하여

Deposit의 Resource를 감소시키고
자신의 Inventory에 Resource를 획득할 수 있다.
```

Intent에는 구현 방식이 들어가지 않는다.

잘못된 예:

```text
MiningComponent를 만든다.
Mine()을 호출한다.
InventoryService를 사용한다.
```

출력

```text
Goal / Possibility

Intent Set

Design Trace
```

```text
AcquireStone
    ↓
MineStone
    ↓
INTENT-MINING-001
```

## 9. Stage 3 — World Semantic Design

역할

Intent가 실제 세계에서 성립하기 위해 필요한 World State와 World Rule을 정의한다.

### 9.1 Existing Semantic Resolution

먼저 이전 Module에서 이미 존재하는 의미를 확인한다.

```text
Required Semantic
    Actor
    Inventory
    Position
    Resource
    Recipe
```

기존 Mining Module이 이미:

```text
Actor
Inventory
Position
Resource
```

를 사용하는 경우 새로 정의하지 않는다.

이번 Cycle에서는 필요한 새로운 의미만 추가한다.

```text
Recipe
Craft Rule
```

### 9.2 World State

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

World State에는 세계의 사실만 존재한다.

```text
Actor.Position
Actor.Inventory
Deposit.ResourceAmount
```

는 World State다.

반면:

```text
cacheIndex
threadId
packetSequence
vectorCapacity
```

등은 Implementation State다. 기존 Workflow에서도 World State와 Implementation State를 명확하게 분리한다.

### 9.3 World Rule

```text
RULE-MINE-001

Input

    Actor
    Deposit


Preconditions

    Actor knows Deposit

    Actor has Mining Tool

    Actor is in Interaction Range

    Deposit has Resource


Transition

    Deposit.ResourceAmount
        -= ExtractAmount

    Actor.Inventory[ResourceType]
        += ExtractAmount
```

World Rule은 코드 함수가 아니라 세계에서 허용되는 상태 변화다.

출력

```text
World Semantic Delta

Existing Semantic Dependencies

New World State

New World Rules

Intent → State / Rule Trace
```

완료 조건 — Semantic Closure

Intent에 존재하는 모든 의미가 State 또는 Rule에 연결되어야 한다.

```text
"광맥을 안다"
    → Knowledge

"도구를 가지고 있다"
    → Inventory

"Mining 가능한 도구"
    → Tool Capability

"접근 가능하다"
    → Position / Interaction Range

"Mine한다"
    → Mine Rule

"Stone을 획득한다"
    → Inventory Transition
```

하나라도 연결되지 않으면 Semantic Closure 실패다.

## 10. Stage 4 — Authority Design

역할

World State를 누가 실제로 소유하고 변경할 수 있는지 정의한다.

최종 MMORPG 구조에서 Authoritative World는 Server가 소유한다.

```text
Server
    =
Authoritative World
```

초기 Cycle에서 실제 Dedicated Server를 실행할 필요는 없다.

그러나 논리적인 Authority 경계는 처음부터 유지한다.

### 10.1 Authority 지정

예:

```text
Actor.Inventory
    Server Authority

Actor.Knowledge
    Server Authority

Deposit.ResourceAmount
    Server Authority

Tool.Capability
    Server Authority
```

### 10.2 Client Command

Client는 상태 변경 결과를 전달하지 않는다.

잘못된 방식:

```text
Client

Stone += 1
```

올바른 방식:

```text
Client

Mine(
    Player01,
    Deposit01
)
```

Client는 행동 의도만 전달한다.

### 10.3 Authoritative Transition

```text
Client Command
        ↓
Server Input
        ↓
World Rule
        ↓
Precondition Evaluation
        ↓
Semantic Transition
        ↓
Authoritative World State
```

출력

```text
Authority Contract

Client Command Contract

Authoritative Transition Contract
```

완료 조건 — Authority Closure

모든 Semantic Transition에 대해 다음을 추적할 수 있어야 한다.

```text
Input

Rule

Precondition Result

Authoritative Transition
```

## 11. Stage 5 — Observation Design

역할

Authoritative World를 특정 Observer가 볼 수 있는 Semantic World로 투영한다.

```text
ObservableWorld
    =
Projection(
        AuthoritativeWorld,
        ObserverContext
    )
```

Observation은 Rendering이나 Network Packet이 아니다.

World Semantic Projection이다.

## 12. Observer 정의

최소한 다음 Observer를 구분한다.

```text
Player Observer

Designer Observer
```

이후 필요에 따라:

```text
AI Observer
Party Observer
Guild Observer
GM Observer
Spectator Observer
```

등이 추가될 수 있다.

## 13. Player Projection

Player에게는 플레이에 필요한 의미만 제공한다.

예:

```text
Player.Position

Player.Inventory

Visible Deposit

Known Resource

Mine Availability

Current Action

Action Result
```

제공하지 않을 수 있는 정보:

```text
Unknown Resource Location

Other Player Private Goal

Hidden NPC Knowledge

Server-only World State
```

## 14. Designer Projection

Designer는 세계가 의도대로 움직이고 있는지 확인해야 한다.

따라서 다음과 같은 정보를 볼 수 있다.

```text
Current Goal

Current Possibility

Possibility Availability

Preconditions

Selected Rule

Before State

Input

After State

Failure Reason
```

Designer 역시 World 내부 구현을 직접 읽지 않는다.

Designer Observer Projection을 사용한다.

기존 Workflow의 View 역시 World 내부 구현에 직접 접근하지 않고 Observable World State만 사용하도록 규정한다.

## 15. Observable Transition

현재 State만이 아니라 Transition도 관찰 가능해야 한다.

```text
Before
    ↓
Input
    ↓
Rule
    ↓
After
```

예:

```text
Transition #1742

Intent
    AcquireStone through MineStone

Before

    Player.Stone = 0
    Deposit.Amount = 10

Input

    Mine(Player, Deposit)

Rule

    RULE-MINE-001

After

    Player.Stone = 1
    Deposit.Amount = 9
```

기존 Workflow에서도 이 구조를 Runtime 검증의 기본 단위로 사용한다.

출력

```text
Observer Definitions

Observable Contract

Observable Transition Contract
```

완료 조건 — Observable Closure

Rule의 판단과 결과를 이해하기 위해 필요한 의미가 적절한 Observer에게 제공되어야 한다.

## 16. Stage 6 — GameView Specification

이 단계가 World Workflow와 GameView Workflow의 경계다.

역할

World Workflow는 Observable Semantic이 플레이어에게 어떤 의미로 표현되어야 하는지만 선언한다.

직접 Rendering을 구현하지 않는다.

질문은 다음과 같다.

플레이어가 이번 Cycle Goal을 게임으로 이해하고 수행하기 위해 어떤 Observable 의미가 어떻게 표현되어야 하는가?

## 17. GameView Specification 예

```text
GAMEVIEW SPEC
    VIEW-MINING-001


OBSERVABLE INPUT

    Actor.Position
    Actor.CurrentAction

    Deposit.Position
    Deposit.ResourceAmount

    Actor.Inventory.Stone

    MineStone.Availability


WORLD REPRESENTATION

    Actor

        Visual Role
            Character

        Placement
            WorldSpace

        Position Source
            Actor.Position


    Deposit

        Visual Role
            ResourceNode

        Placement
            WorldSpace

        Position Source
            Deposit.Position


STATE REPRESENTATION

    Actor.CurrentAction == Mine

        Visual Meaning
            Mining


    Deposit.ResourceAmount > 0

        Visual Meaning
            Available Resource


    Deposit.ResourceAmount == 0

        Visual Meaning
            Depleted Resource


HUD REPRESENTATION

    Actor.Inventory.Stone

        Visual Meaning
            Owned Stone Amount

        Placement
            Resource Summary


INTERACTION REPRESENTATION

    MineStone == AVAILABLE

        Visual Meaning
            Interactable Target
```

## 18. GameView Specification이 결정하지 않는 것

World Workflow는 다음을 절대 결정하지 않는다.

```text
Mesh 이름

Blueprint / GameObject 구조

Animation Clip

Particle System

Shader

Material

Widget Framework

UI Pixel Position

Font

Texture

Asset Path

Rendering Pipeline
```

예를 들어 World Workflow는:

```text
Placement
    Resource Summary
```

라고만 지정한다.

GameView Workflow가:

```text
Resource Summary
    → HUD 왼쪽 상단
    → padding 24
    → Stone Icon + Number
```

으로 구현한다.

## 19. Observable과 GameView Specification의 차이

두 개는 반드시 분리한다.

Observable Contract

```text
Actor.HP = 73
```

의미:

현재 Observer가 Actor의 HP를 알 수 있다.

GameView Specification

```text
Actor.HP
    → Character Health Representation
```

의미:

이 정보를 플레이어에게 Health 상태로 표현해야 한다.

GameView Implementation

```text
HP Bar
```

의미:

실제 Renderer는 Bar 방식으로 표현한다.

따라서:

```text
World Semantic
    ↓
Observable Semantic
    ↓
Presentation Semantic
    ↓
Rendering Implementation
```

의 네 계층을 유지한다.

## 20. Stage 7 — World Implementation

역할

지금까지 정의된 World Semantic, Authority, Observation을 실제 Runtime으로 구현한다.

GameView 구현은 포함하지 않는다.

Implementation Package

```text
WORLD IMPLEMENTATION PACKAGE

1. Cycle Scope

2. Goal / Possibility

3. Intent

4. Existing Module Dependencies

5. World Semantic Delta

6. World Rules

7. Authority Contract

8. Observable Contract

9. Traceability

10. Completion Conditions
```

기존 Workflow에서도 Coding Agent에게 전체 문서가 아니라 Intent, State, Rule, Observable, Completion Condition이 포함된 Implementation Package를 전달하도록 한다.

## 21. 초기 Server/Client 실행 구조

초기 Cycle에서는 하나의 Process 안에서 실행할 수 있다.

```text
┌─────────────────────────────────┐
│                                 │
│        Local Runtime            │
│                                 │
│   Client Command                │
│          ↓                      │
│   Authoritative World           │
│          ↓                      │
│   Observable Projection         │
│                                 │
└─────────────────────────────────┘
```

중요한 것은 실제 Process 분리가 아니라 논리적 Boundary다.

```text
Client
    ↓ Command

Authority
    ↓ World Transition

Observation
    ↓ Observable
```

나중에 Dedicated Server를 사용해도 구조는 동일하다.

```text
Client
    ↓
Network
    ↓
Server
```

Network는 기존 Contract 사이에 삽입되는 Transport일 뿐이다.

## 22. Replication과 Observable 분리

다음 둘은 동일하지 않다.

```text
Observable World

Network Representation
```

구조는 다음과 같다.

```text
Authoritative World
        ↓
Observer Projection
        ↓
Observable Semantic
        ↓
Replication Representation
        ↓
Transport
        ↓
Client Observable Replica
```

다음은 World Semantic이다.

```text
Actor.Position
Actor.CurrentAction
Deposit.ResourceAmount
```

다음은 Implementation Detail이다.

```text
Snapshot
Delta Compression
Packet
Sequence Number
Serialization
Prediction Buffer
```

## 23. Stage 8 — World Verification

GameView 없이도 World Capability 자체를 검증할 수 있어야 한다.

검증 항목:

```text
Semantic Closure

Authority Closure

Observable Closure

Runtime Scenario

Traceability
```

예:

```text
Input
    Mine(Player, Deposit)

Before
    Player.Stone = 0
    Deposit.Stone = 10

Rule
    RULE-MINE-001

After
    Player.Stone = 1
    Deposit.Stone = 9
```

이 결과가 Observable Contract를 통해 확인되면 World Capability 자체는 완료될 수 있다.

## 24. World Workflow Output

World Workflow의 결과는 다음이다.

```text
WORLD CAPABILITY MODULE

Identity

Version

Requires

Provides

Intent

World State Semantic

World Rules

Authority Contract

Observable Contract

Traceability

Verification Scenarios
```

그리고 별도의:

```text
GAMEVIEW SPECIFICATION
```

을 출력한다.

이 시점부터 GameView 구현은 World Workflow의 책임이 아니다.

# Part II — GameView Workflow

## 25. GameView Workflow의 기본 원칙

GameView Workflow는 다음 두 개만 입력으로 받는다.

```text
Observable Contract

GameView Specification
```

GameView Workflow는 다음을 알지 못한다.

```text
Goal Graph 내부 구조

Intent 구현 구조

World Rule 구현

Server State

Database

Planner

Simulation 내부 객체
```

Architecture Rule:

GameView는 Observable Contract와 GameView Specification 이외의 World 내부 정보를 참조할 수 없다.

## 26. Stage 9 — Specification Resolution

역할

전달된 명세에서 실제 구현해야 할 Visual Requirement를 추출한다.

입력:

```text
Observable Contract

GameView Specification
```

출력:

```text
VISUAL REQUIREMENT SET
```

Mining 예:

```text
Character Representation

Resource Deposit Representation

Mining Action Representation

Depleted Deposit Representation

Stone Amount Representation

Interaction Availability Representation
```

이 단계에서는 아직 Asset을 선택하지 않는다.

## 27. Stage 10 — Visual Composition

역할

Visual Requirement를 실제 화면 구조로 배치한다.

예:

```text
WORLD

    Character

    Resource Deposit

    Interaction Indicator


HUD

    Resource Summary
```

그리고 의미를 UI 구조에 연결한다.

```text
Character
    → World Entity

Resource Deposit
    → World Entity

Stone Amount
    → Resource Summary

Mine Availability
    → Target Interaction Indicator
```

이 단계부터는 GameView Workflow의 자유 영역이다.

World Workflow는 이 결정을 알 필요가 없다.

## 28. Stage 11 — Asset Resolution

역할

Visual Role에 실제 표현 자산을 연결한다.

예:

```text
Character
    → CharacterMesh_A

Resource Deposit
    → StoneDepositMesh_B

Mining
    → MiningAnimation_C

Stone Resource
    → StoneIcon_D

Depleted State
    → DepletedMaterial_E
```

Asset 선택은 World Semantic에 영향을 주지 않는다.

## 29. Stage 12 — Observable Binding

역할

Observable Semantic과 Rendering State를 연결한다.

예:

```text
Actor.Position
    ↓
Character Transform
```

```text
Actor.CurrentAction == Mine
    ↓
Mining Animation
```

```text
Deposit.ResourceAmount == 0
    ↓
Depleted Visual State
```

```text
Actor.Inventory.Stone
    ↓
Stone Counter
```

Binding은 반드시 Observable만 참조한다.

다음과 같은 접근은 금지한다.

```text
GameView
    ↓
MiningSystem.CurrentTarget

GameView
    ↓
WorldState.InternalInventory

GameView
    ↓
Planner.CurrentNode
```

## 30. Stage 13 — GameView Implementation

역할

실제 Renderer에서 화면을 구현한다.

이 단계에서는 자유롭게 다음을 사용할 수 있다.

```text
Scene Object

Mesh

Sprite

Animation

Material

Particle

Shader

Sound

Camera

HUD

Widget

Layout
```

이 구현은 World Workflow와 완전히 독립적이다.

## 31. Stage 14 — GameView Verification

World correctness와 View correctness를 분리한다.

World Verification:

```text
Deposit.ResourceAmount
    1 → 0
```

가 실제로 발생했는가?

GameView Verification:

```text
Observable

Deposit.ResourceAmount
    1 → 0
```

가 들어왔을 때:

```text
Expected Visual

Available Resource
    →
Depleted Resource
```

로 표현되었는가?

## 32. GameView Contract Gap

GameView 구현 중 필요한 Observable이 존재하지 않는 경우 GameView가 World 내부에 직접 접근해서는 안 된다.

예:

```text
Actor.CurrentAction = Mine
```

은 있지만:

```text
CurrentActionTarget
```

이 없다.

그러면 다음 Proposal을 생성한다.

```text
GAMEVIEW CONTRACT GAP

Required Visual

    Actor must visually face
    the Deposit currently being mined.


Missing Observable

    Actor.CurrentActionTarget


Reason

    Mining action exists,
    but its target cannot be identified.
```

World Workflow가 이 Proposal을 검토한다.

진짜 World Semantic으로 필요한 정보라면 Observable Contract를 확장한다.

GameView가 임의로 World 의미를 생성해서는 안 된다.

## 33. GameView Module Output

완료된 GameView Workflow는 다음 Module을 만든다.

```text
GAMEVIEW MODULE

Identity

Version

Consumes
    Observable Contract

Implements
    GameView Specification

Visual Composition

Observable Bindings

Asset Bindings

Verification Scenarios
```

예:

```text
MiningView Module v1
```

# Part III — Integration Workflow

## 34. Integration Workflow의 역할

World Workflow와 GameView Workflow를 직접 결합하지 않는다.

둘 사이의 연결은 별도의 Integration Workflow가 담당한다.

```text
World Capability Module
        +
GameView Module
        ↓
Integration
        ↓
Playable Build
```

Integration은 양쪽의 내부 구현을 알 필요가 없다.

Contract만 검사한다.

## 35. Integration 입력

```text
World Capability Modules

GameView Modules

Observable Contracts

GameView Specifications

World Configuration
```

예:

```text
Mining World Module

MiningView Module

Small Mining Map

Player

Deposit
```

## 36. Integration 검증

다음 연결을 검사한다.

```text
Client Input
    ↓
World Command
    ↓
Authoritative Rule
    ↓
World Transition
    ↓
Observer Projection
    ↓
Observable
    ↓
GameView Binding
    ↓
Rendering
```

Mining Cycle 예:

```text
Player presses Mine

        ↓

Mine(Player, Deposit)

        ↓

RULE-MINE-001

        ↓

Player.Stone
0 → 1

Deposit.Amount
10 → 9

        ↓

Observable

Actor.Inventory.Stone = 1
Deposit.ResourceAmount = 9

        ↓

GameView

Stone Counter = 1
Deposit Visual Updated
Mining Animation
```

## 37. 세 종류의 완료 상태

완료 상태를 하나로 합치지 않는다.

World Complete

```text
Intent
State
Rule
Authority
Observable
Traceability
```

가 올바르다.

GameView Complete

```text
Specification
Composition
Binding
Rendering
```

이 올바르다.

Playable Cycle Complete

```text
World Complete
        +
GameView Complete
        +
Integration Verification
```

이 모두 통과했다.

이 구분 덕분에 Rendering 문제가 World Capability 실패로 취급되지 않는다.

## 38. Module 재사용

완료된 Cycle 결과는 이후 Cycle에서 수정하지 않고 사용한다.

```text
Cycle 1

Mining World Module
MiningView Module
```

Cycle 2:

```text
Existing

    Mining World Module
    MiningView Module

New

    Crafting World Module
    CraftingView Module
```

최종 Build:

```text
Mining World
+
Crafting World

        ↓ Observable

MiningView
+
CraftingView
```

Cycle 3에서는 다시:

```text
Mining
+
Crafting
+
Trade
```

로 확장한다.

## 39. Shared World Semantic

각 Capability Module이 별도의 World를 만들어서는 안 된다.

잘못된 구조:

```text
MiningInventory

CraftingInventory

TradeInventory
```

올바른 구조:

```text
                 WORLD

                   │
        ┌──────────┼──────────┐
        │          │          │
      Mining    Crafting    Trade
        │          │          │
        └──────────┼──────────┘
                   │
               Inventory
```

Capability Module은 공유 World Semantic 위에 새로운 행동 가능성을 추가한다.

## 40. Module Contract

각 World Capability Module은 명확한 Contract를 가진다.

```text
MODULE
    Mining


REQUIRES

    Actor
    Position
    Inventory
    Knowledge
    Tool
    ResourceDeposit


PROVIDES

    Possibility
        MineResource

    Rule
        Mine

    Transition
        Resource extraction

    Observable
        Mine Availability
        Mine Execution
        Resource Transition
```

후속 Module은 `Requires / Provides`를 통해 기존 Capability를 사용한다.

이전 Module의 내부 구현을 알 필요가 없다.

## 41. Module 변경 규칙

기본 원칙:

완료된 Module은 후속 Cycle에서 직접 수정하지 않는다.

새로운 의미는 가능한 한 새로운 Capability나 Extension으로 추가한다.

예:

```text
Mining v1
```

후에 Tool Durability가 필요하다면:

```text
ToolDurability Module
```

을 추가한다.

기존 Semantic 자체가 잘못되어 수정이 불가피한 경우에만:

```text
Mining v1
    ↓
Mining v2
```

라는 명시적 Version Migration을 수행한다.

## 42. 전체 Cycle Completion Gate

하나의 Cycle은 다음을 모두 만족해야 한다.

World

```text
[ ] Cycle Goal이 플레이 가능한 범위다.

[ ] Goal / Possibility가 정의되어 있다.

[ ] Intent가 정의되어 있다.

[ ] Semantic Closure가 통과되었다.

[ ] World State가 정의되어 있다.

[ ] World Rule이 정의되어 있다.

[ ] 모든 Semantic Transition이 Authority를 통한다.

[ ] Observable Contract가 정의되어 있다.

[ ] Observable Closure가 통과되었다.

[ ] Runtime Transition이 설계까지 추적 가능하다.
```

GameView

```text
[ ] GameView Specification이 존재한다.

[ ] GameView가 World 내부를 직접 참조하지 않는다.

[ ] 모든 Binding은 Observable을 통해 이루어진다.

[ ] 명세된 Visual State가 구현되었다.

[ ] GameView Verification을 통과했다.
```

Integration

```text
[ ] World Capability Module과 GameView Module이 Contract로 연결된다.

[ ] 실제 입력이 World Transition을 발생시킨다.

[ ] Transition 결과가 Observable로 전달된다.

[ ] GameView가 해당 Observable을 올바르게 표현한다.

[ ] 사용자가 Cycle Goal을 실제 게임으로 수행할 수 있다.

[ ] 기존 Module을 다시 구현하지 않았다.

[ ] 새로운 Module을 다음 Cycle에서 재사용할 수 있다.
```

## 43. 최종 Agent Workflow

```text
                  USER
                   │
             Cycle Goal
                   │
                   ▼
            Cycle Scope
                   │
                   ▼
             Intent Agent
                   │
                   ▼
          World Model Agent
                   │
          State / Rule
                   │
                   ▼
         Authority Designer
                   │
                   ▼
        Observation Designer
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
Observable Contract     GameView Spec
         │                    │
         ▼                    │
World Implementation          │
         │                    │
World Verification            │
         │                    │
         ▼                    ▼
World Capability       GameView Workflow
     Module                    │
                               ▼
                        GameView Module
                               │
         ┌─────────────────────┘
         │
         ▼
      Integration
         │
         ▼
   Playable Verification
         │
         ▼
     Cycle Complete
         │
         ▼
     Module Registry
         │
         ▼
      Next Cycle
```

## 44. 최상위 Architecture Rules

Rule 1 — Design Source of Truth

Goal/Possibility와 Intent가 게임 의미의 Source of Truth이다.

Rule 2 — Semantic Closure

Intent의 모든 의미는 World State 또는 World Rule로 표현되어야 한다.

Rule 3 — Server Authority

World Semantic의 실제 상태 변화는 Authoritative World Rule을 통해서만 발생한다.

Rule 4 — Command Boundary

Client는 World State를 직접 변경하지 않고 Action Command만 전달한다.

Rule 5 — Observer Projection

Player와 Designer는 World 내부를 직접 읽지 않고 Observer별 Observable World를 사용한다.

Rule 6 — Semantic Observation

Observable은 Network Packet이 아니라 World의 Semantic Projection이다.

Rule 7 — GameView Isolation

World Workflow는 GameView 구현을 알지 못한다.

World Workflow가 전달하는 것은:

```text
Observable Contract
GameView Specification
```

뿐이다.

Rule 8 — GameView Isolation

GameView는 World State, Rule, Server 내부 구현을 직접 참조하지 않는다.

오직 Observable Contract를 소비한다.

Rule 9 — Presentation Independence

GameView Specification은 Mesh, Animation, UI Framework, Asset, Renderer와 독립적이어야 한다.

Rule 10 — Integration Independence

World와 GameView의 결합은 두 Workflow 외부의 Integration Workflow가 담당한다.

Rule 11 — Module Reuse

이전 Cycle의 Capability는 후속 Cycle에서 재구현하지 않는다.

Rule 12 — Shared World

각 Module은 별개의 World를 만들지 않고 동일한 World Semantic을 공유한다.

Rule 13 — Transport Independence

Local Call, IPC, Network, Serialization, Replication은 World Semantic을 변경하지 않는 Implementation Detail이다.

Rule 14 — Playable Verification

모든 Cycle은 최종적으로 사용자가 직접 플레이하여 목표 달성을 확인할 수 있어야 한다.

## 45. 최종 전체 구조

```text
══════════════════════════════════════════════
                CYCLE GOAL
══════════════════════════════════════════════
                     │
                     ▼

══════════════════════════════════════════════
              WORLD WORKFLOW
══════════════════════════════════════════════

Cycle Scope
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / Rule
    ↓
Semantic Closure
    ↓
Authority
    ↓
Observation
    ↓
Observable Contract
    +
GameView Specification
    ↓
World Implementation
    ↓
World Verification
    ↓
World Capability Module

══════════════════════════════════════════════
              CONTRACT BOUNDARY
══════════════════════════════════════════════

Observable Contract
GameView Specification

                     │
                     ▼

══════════════════════════════════════════════
             GAMEVIEW WORKFLOW
══════════════════════════════════════════════

Specification Resolution
    ↓
Visual Composition
    ↓
Asset Resolution
    ↓
Observable Binding
    ↓
Rendering Implementation
    ↓
View Verification
    ↓
GameView Module

══════════════════════════════════════════════
            INTEGRATION WORKFLOW
══════════════════════════════════════════════

World Capability Module
        +
GameView Module
        ↓
Playable Composition
        ↓
End-to-End Verification
        ↓
Playable Build

══════════════════════════════════════════════
              CYCLE COMPLETE
══════════════════════════════════════════════

World Capability Module
GameView Module
Playable Build

        ↓

Module Registry

        ↓

Next Cycle
```

## 46. 한 문장 정의

하나의 Cycle은 사용자가 제시한 작은 플레이 목표를 Goal/Possibility → Intent → World Semantic → Authority → Observation으로 정의하고 World Capability로 구현한 뒤, Observable Contract와 GameView Specification만을 독립된 GameView Workflow에 전달하여 화면을 구현하고, 마지막 Integration Workflow에서 두 결과를 조합해 실제 게임으로 검증한 후 그 Capability를 다음 Cycle에서 재사용 가능한 Module로 축적하는 공정이다.

더 압축하면 다음과 같다.

World Workflow는 세계를 정의하고 실행하며, GameView Workflow는 전달된 세계의 Projection을 표현하고, Integration Workflow는 둘을 계약으로 연결해 플레이 가능성을 검증한다.
