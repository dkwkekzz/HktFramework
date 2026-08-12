# Design-CycleWorkflow.md

Cycle-Based AI Agent Workflow for an Observable MMORPG World

## 1. 목적

이 문서는 작은 게임 단위인 `Cycle`을 반복하여 최종적으로 하나의 Open World MMORPG를 구축하기 위한 AI Agent 개발 Workflow를 정의한다.

개발의 기본 단위는 기능, 시스템, 티켓이 아니다.

기본 단위는:

```text
Cycle

```

이다.

하나의 Cycle은:

사용자가 직접 플레이하여 하나의 명확한 게임 목표를 달성할 수 있는 가장 작은 게임 단위

를 의미한다.

예:

```text
Cycle 001
    이동하여 광맥에 접근할 수 있다.

Cycle 002
    광맥에서 Stone을 채굴할 수 있다.

Cycle 003
    Stone으로 Pickaxe를 제작할 수 있다.

Cycle 004
    제작한 Pickaxe로 더 좋은 광물을 채굴할 수 있다.

Cycle 005
    다른 Player에게 자원을 판매할 수 있다.

```

각 Cycle은 Prototype을 만들고 버리는 과정이 아니다.

모든 Cycle의 결과는 최종 MMORPG의 실제 구성 요소가 된다.

```text
Cycle 001
    ↓
Cycle 001 + 002
    ↓
Cycle 001 + 002 + 003
    ↓
Cycle 001 + 002 + 003 + ...
    ↓
Open World MMORPG

```

## 2. 최상위 원칙

전체 Workflow에는 여섯 가지 절대 원칙이 존재한다.

Rule 1 — Cycle First

모든 개발은 하나의 작은 플레이 가능한 Cycle 단위로 진행한다.

거대한 시스템을 먼저 만들고 게임을 나중에 만드는 방식은 사용하지 않는다.

```text
작은 게임
    ↓
작은 게임 + 새로운 가능성
    ↓
더 큰 게임
    ↓
MMORPG

```

Rule 2 — Design Workflow Inside Every Cycle

모든 Cycle 내부에서는 반드시 `Design-Workflow.md`의 의미론적 순서를 따른다.

```text
Human Design
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State
    ↓
World Rule
    ↓
Observable Semantic
    ↓
GameView Specification
    ↓
Implementation
    ↓
Verification

```

Cycle이라고 해서 이 과정을 생략할 수 없다.

Rule 3 — Every Agent Step Produces a Visible Artifact

Agent가 내부적으로 무엇을 생각했는지는 완료 조건이 아니다.

각 단계에서 인간이 즉시 확인할 수 있는 명시적 결과물이 존재해야 한다.

```text
Cycle Goal
    ↓
Goal / Possibility Artifact
    ↓
Intent Artifact
    ↓
World Semantic Artifact
    ↓
GameView Specification
    ↓
Implementation Result
    ↓
Verification Result

```

인간은 Agent의 추론 과정을 읽는 것이 아니라 이 산출물을 보고 판단한다.

Rule 4 — World Is Server

최종 MMORPG에서 World는 Server다.

```text
World
=
Authoritative Server Simulation

```

World는 다음을 소유한다.

```text
World State
World Rules
Goal / Possibility Runtime
AI Decisions
Player State
NPC State
Resource State
Combat State
Economy State
Persistence-relevant Semantic

```

Client는 이것을 소유하지 않는다.

Rule 5 — View Is Client

View는 Client다.

```text
View
=
Game Client Presentation

```

View의 책임은:

```text
GameView Specification
        ↓
Rendering
        ↓
Player Interaction

```

이다.

View는 World의 내부 객체를 읽지 않는다.

Rule 6 — World → View Boundary Is GameView Specification

World가 View에 전달하는 공개 결과는 하나뿐이다.

```text
GameView Specification

```

별도의:

```text
Observable Contract
WorldState DTO
Debug State
Replication State
Game State Object

```

를 View가 직접 소비하지 않는다.

필요한 Observable 의미는 모두 `GameView Specification`에 포함된다.

## 3. 최종 Architecture

최종 구조는 다음처럼 단순하게 유지한다.

```text
                 USER
                   │
                   │ Input
                   ▼
            ┌──────────────┐
            │     VIEW     │
            │    Client    │
            └──────┬───────┘
                   │
             Action Request
                   │
                   ▼
            ┌──────────────┐
            │    WORLD     │
            │    Server    │
            │              │
            │ World State  │
            │ World Rules  │
            │ Simulation   │
            └──────┬───────┘
                   │
                   │ Projection
                   ▼
        ┌────────────────────────┐
        │ GameView Specification │
        └────────────┬───────────┘
                     │
                     ▼
            ┌──────────────┐
            │     VIEW     │
            │    Client    │
            └──────┬───────┘
                   │
                   ▼
                Human

```

World와 View 사이에서 World 내부 Semantic은 노출되지 않는다.

## 4. GameView Specification의 의미

`GameView Specification`은 단순한 UI 명세가 아니다.

다음 질문에 대한 World의 완전한 답이다.

현재 Observer가 게임 세계에서 무엇을 보고, 무엇을 알 수 있고, 무엇을 할 수 있으며, 그 의미가 화면에서 어떤 역할로 표현되어야 하는가?

따라서 기존의:

```text
Observable Contract
+
GameView Specification

```

을 하나로 합친다.

```text
World
    ↓
GameView Specification
    ↓
View

```

GameView Specification은 World와 View 사이의 유일한 Server → Client semantic contract다.

## 5. GameView Specification의 구조

개념적 구조는 다음과 같다.

```text
GameViewSpecification

    identity
    observer
    revision

    scene
    entities
    states
    transitions
    interactions
    hud
    designerObservation

```

예:

```text
GameViewSpecification

    scene
        id
            mining-field

        terrainRole
            outdoor-ground


    entities

        player-01

            role
                player-character

            position
                x: 10
                y: 0
                z: 20

            facing
                ...

            state
                idle


        deposit-01

            role
                resource-deposit

            resourceRole
                stone

            position
                ...

            state
                available


    interactions

        mine-deposit-01

            role
                mine-resource

            actor
                player-01

            target
                deposit-01

            available
                true


    hud

        resource-stone

            role
                owned-resource

            resourceRole
                stone

            amount
                3

```

View는 이 데이터만으로 화면을 구성한다.

## 6. GameView Specification이 포함하지 않는 것

GameView Specification은 Rendering 구현을 결정하지 않는다.

다음은 포함하지 않는다.

```text
Sprite filename
Texture path
Shader
Material instance
Three.js object
DOM element
React component
Animation clip
WebGL buffer
Renderer class
CSS position
Network packet
Database key

```

대신 다음과 같은 Presentation Semantic을 사용한다.

```text
player-character
resource-deposit
hostile-creature
available
depleted
mining
attacking
owned-resource
interaction-target

```

View는 자신의 Asset / Renderer Registry를 통해 이를 실제 표현으로 변환한다.

```text
resource-deposit
        ↓
View Asset Registry
        ↓
stone-deposit.png
        ↓
Billboard Sprite

```

World는 `stone-deposit.png`의 존재를 모른다.

## 7. View의 독립성

View는 다음에 접근할 수 없다.

```text
WorldState
WorldRule
MiningSystem
CombatSystem
Planner
NPC internal state
Database
Server entity object
Server component

```

허용되는 것은:

```text
GameViewSpecification

```

뿐이다.

따라서 View는 World가 실제 Server인지조차 알 필요가 없다.

다음 세 환경은 동일해야 한다.

```text
Test Fixture
    ↓
GameView Specification
    ↓
View

```


```text
Local World
    ↓
GameView Specification
    ↓
View

```


```text
Remote MMORPG Server
    ↓ Network
    ↓
GameView Specification
    ↓
View

```

View 입장에서는 세 경우가 동일하다.

## 8. World의 독립성

World 역시 View 구현을 알지 않는다.

World는 다음을 알 수 없다.

```text
Three.js
WebGL
Sprite
Billboard
Camera implementation
CSS
React
DOM
Shader
Texture

```

World가 아는 것은 Presentation Semantic까지다.

예:

```text
Actor
    role = player-character

Deposit
    role = resource-deposit

Actor.CurrentAction
    role = mining

```

실제 Rendering은 View의 책임이다.

## 9. Client → World 입력

World → View 출력은 반드시:

```text
GameView Specification

```

하나로 제한한다.

반대 방향은 상태 변경이 아니라 `Action Request`다.

```text
View
    ↓
Action Request
    ↓
World Rule

```

예:

```text
{
    action: "mine-resource",
    actor: "player-01",
    target: "deposit-01"
}

```

Client가 다음과 같이 결과를 결정해서는 안 된다.

```text
Stone += 1
DepositAmount -= 1

```

View는 행동을 요청할 뿐이다.

결과는 World가 결정한다.

## 10. Cycle의 정의

Cycle은 하나의 기능 Module이 아니다.

Cycle은 하나의 작은 게임을 완성하는 전체 작업이다.

```text
Cycle Goal

    ↓

Design Workflow

    ↓

World Implementation

    ↓

GameView Specification

    ↓

View Implementation

    ↓

Playable Verification

    ↓

Cycle Complete

```

예:

```text
Cycle Goal

"Player가 광맥에 접근하여
 Pickaxe로 Stone을 채굴할 수 있다."

```

Cycle이 끝났을 때 이 문장을 실제 Client에서 플레이할 수 있어야 한다.

## 11. Cycle 내부 Workflow

기존의 많은 Stage를 다음 8개의 명확한 단계로 단순화한다.

```text
1. Cycle Definition

2. Intent

3. World Semantic

4. GameView Specification

5. Human Semantic Review

6. Implementation

7. Verification

8. Cycle Packaging

```

각 단계는 `Design-Workflow.md`의 의미적 순서를 보존한다.

## 12. Step 1 — Cycle Definition

담당

Human Design

질문

```text
이번 Cycle이 끝나면
Player가 게임 안에서 정확히 무엇을 할 수 있어야 하는가?

```

출력

```text
CYCLE

ID
Goal

Included
Excluded

Existing Capabilities
Expected New Capability

```

예:

```text
CYCLE-002-MINING

Goal

    Player가 Pickaxe를 가지고
    Stone Deposit에 접근하여
    Stone을 얻을 수 있다.


Included

    Deposit 인식
    Deposit 접근
    Mine 실행
    Stone 획득


Excluded

    Crafting
    Trade
    Respawn
    Multiple Resource Types

```

이 결과는 Cycle의 최상위 Source of Truth다.

## 13. Step 2 — Intent

담당

Intent Agent

Cycle Goal을 Goal / Possibility Graph로 구성하고 Intent를 추출한다.

```text
AcquireStone
    │
    └── MineStone

```

↓

```text
INTENT-MINING-001

Stone Deposit을 알고 있고,
Mining 가능한 Tool을 보유하고 있으며,
Deposit에 접근 가능한 Actor는

Mine을 수행하여

Deposit의 Resource를 감소시키고
자신의 Inventory에 Stone을 획득할 수 있다.

```

출력

```text
GOAL / POSSIBILITY

INTENT SET

DESIGN TRACE

```

인간은 이 결과를 보면:

```text
이번 Cycle에서
무엇을 가능하게 만들려는가?

```

를 즉시 이해할 수 있어야 한다.

## 14. Step 3 — World Semantic

담당

World Model Agent

Intent를 실행 가능한 World Semantic으로 닫는다.

내부 순서는 `Design-Workflow.md`를 따른다.

```text
Intent
    ↓
Required World State
    ↓
World Rule
    ↓
Observable Semantic

```

예:

```text
WORLD STATE

Actor
    Position
    Inventory
    Knowledge

Tool
    Capability

Deposit
    Position
    ResourceType
    ResourceAmount

```

그리고:

```text
WORLD RULE

RULE-MINE-001

Preconditions

    knows deposit
    has mining tool
    target in range
    deposit has resource

Transition

    Deposit.ResourceAmount
        -= amount

    Actor.Inventory.Stone
        += amount

```

여기에서 동시에 Authority를 결정한다.

```text
Actor.Inventory
    World Authority

Deposit.ResourceAmount
    World Authority

```

별도의 `Authority Design Stage`를 만들지 않는다.

Authority는 World Semantic의 속성이다.

## 15. Semantic Closure

World Model Agent는 Intent의 모든 문장을 확인한다.

```text
"광맥을 알고 있다"
        ↓
Actor.Knowledge

"도구를 가지고 있다"
        ↓
Actor.Inventory

"채굴 가능한 도구"
        ↓
Tool.Capability

"접근할 수 있다"
        ↓
Position / Interaction Range

"채굴한다"
        ↓
Mine Rule

"Stone을 얻는다"
        ↓
Inventory Transition

```

하나라도 연결되지 않으면 다음 단계로 이동할 수 없다.

이를:

```text
Semantic Closure

```

라고 한다.

## 16. Step 4 — GameView Specification

담당

World Model Agent / Observation Designer 역할

World Semantic에서 특정 Observer에게 필요한 의미를 투영한다.

그 결과를 별도 Observable Contract로 내보내지 않는다.

바로:

```text
GameView Specification

```

으로 만든다.

```text
Authoritative World
        ↓
Observer Projection
        ↓
Presentation Semantic
        ↓
GameView Specification

```

예:

```text
GAMEVIEW SPEC
VIEW-MINING-001

Observer
    Player

Scene
    mining-field

Entities

    Player
        role
            player-character

        position
            source: Actor.Position

        state
            source: Actor.CurrentAction


    Deposit
        role
            resource-deposit

        position
            source: Deposit.Position

        state
            available
                when ResourceAmount > 0

            depleted
                when ResourceAmount == 0


Interactions

    Mine

        role
            mine-resource

        target
            Deposit

        available
            source: MineStone.Availability


HUD

    Stone

        role
            owned-resource

        value
            Actor.Inventory.Stone

```

## 17. Designer Observation도 GameView Specification을 사용한다

Debug용 별도 World 접근 경로를 만들지 않는다.

Designer 역시 Observer다.

```text
World
    ↓
Designer Projection
    ↓
GameView Specification
    ↓
Designer View

```

Designer용 Specification에는 다음과 같은 정보를 포함할 수 있다.

```text
Current Goal
Current Possibility
Availability
Preconditions
Selected Rule
Before State
Input
After State
Failure Reason

```

예:

```text
designerObservation

    goal
        AcquireStone

    possibility
        MineStone

    availability
        false

    preconditions

        knowsDeposit
            true

        hasMiningTool
            true

        inRange
            false

    reason
        target-out-of-range

```

따라서 Designer View 역시 Server 내부 객체를 보지 않는다.

## 18. Step 5 — Human Semantic Review

구현 전에 인간이 한 번만 핵심 의미를 확인한다.

검토 대상은 코딩 구조가 아니다.

```text
Cycle Goal
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / Rule
    ↓
GameView Specification

```

질문은 두 가지다.

```text
1.
이 World가 내가 의도한 게임 의미를 정확히 표현하는가?

2.
이 GameView Specification만 받으면
Player가 그 의미를 충분히 이해하고 플레이할 수 있는가?

```

이 단계가 통과되기 전에는 구현으로 이동하지 않는다.

## 19. Step 6 — Implementation

담당

Implementation Agent

Implementation은 하나의 Agent 단계지만 결과는 물리적으로 두 영역으로 분리한다.

```text
Implementation Agent
        │
        ├── World Implementation
        │       server
        │
        └── View Implementation
                client

```

두 구현은 서로를 import하지 않는다.

## 20. World Implementation

World는 TypeScript 기반 Server Runtime으로 구현한다.

개념 구조:

```text
world/

    semantic/
    rules/
    simulation/
    projection/
    actions/
    capabilities/

```

핵심 흐름:

```text
Action Request
    ↓
World Rule
    ↓
Authoritative State Transition
    ↓
Observer Projection
    ↓
GameView Specification

```

World 테스트는 View 없이 실행 가능해야 한다.

## 21. View Implementation

View는 TypeScript 기반 Web Client로 구현한다.

개념 구조:

```text
view/

    renderer/
    scene/
    sprites/
    terrain/
    camera/
    input/
    hud/
    assets/
    gameview/

```

입력은 오직:

```text
GameView Specification

```

이다.

핵심 흐름:

```text
GameView Specification
    ↓
Presentation Resolver
    ↓
Scene State
    ↓
Renderer

```

## 22. 초기 Rendering Stack

초기 Client 표현 방식은 다음으로 고정한다.

```text
Platform
    Web

Language
    TypeScript

World Rendering
    3D

Terrain
    3D Terrain

Character / NPC / Object
    Sprite Billboard

UI
    Web HUD

```

개념적으로:

```text
                    Camera

                      ▼

        ┌────────────────────────┐
        │      Sprite Actor      │
        │         │              │
        │       Billboard        │
        │                        │
        │   Sprite Resource      │
        │                        │
        │________________________│
        │                        │
        │      3D Terrain        │
        └────────────────────────┘

```

초기에는 복잡한 Character Mesh나 Animation System보다 게임 세계의 Semantic을 빠르게 확인할 수 있는 구조를 우선한다.

## 23. Sprite Billboard의 역할

다음 Semantic Role을 기본적으로 Sprite Billboard로 표현할 수 있다.

```text
player-character
npc
hostile-creature
resource-deposit
item-drop
interactive-object

```

View의 Asset Registry 예:

```text
player-character
    → player.png

resource-deposit:stone
    → stone-deposit.png

hostile-creature:wolf
    → wolf.png

```

GameView Specification은 이 파일명을 알지 않는다.

## 24. 3D Terrain의 역할

World의 Position Semantic은 3차원 좌표를 사용한다.

```text
Position

    x
    y
    z

```

View는 이를 3D Terrain 위에 배치한다.

World 입장에서는:

```text
Actor.Position
Deposit.Position
InteractionRange

```

일 뿐이다.

View 입장에서는:

```text
World Position
    ↓
Terrain Transform
    ↓
Billboard Placement

```

이다.

## 25. Camera는 View의 책임이다

Camera는 World Semantic이 아니다.

따라서 World는:

```text
camera distance
camera angle
zoom
screen resolution

```

을 알지 않는다.

초기 View에서는 예를 들어:

```text
Third-person / Isometric-like Perspective
+
3D Terrain
+
Camera-facing Sprite Billboard

```

형태를 사용할 수 있다.

이는 View 구현 선택이다.

## 26. Step 7 — Verification

담당

Verification Agent

검증 역시 너무 많은 독립 Stage로 나누지 않는다.

하나의 Verification 단계 안에서 네 종류를 검사한다.

```text
Semantic Verification

World Verification

View Verification

Playable Verification

```

## 27. Semantic Verification

검사:

```text
Goal
 ↓
Possibility
 ↓
Intent
 ↓
State / Rule

```

모든 의미가 연결되는가?

즉:

```text
Semantic Closure

```

를 확인한다.

## 28. World Verification

View 없이 테스트한다.

예:

```text
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

그리고 결과로 생성된 GameView Specification을 검사한다.

## 29. View Verification

World 없이 테스트한다.

Fixture로 GameView Specification을 전달한다.

```text
Fixture
    ↓
GameView Specification
    ↓
View

```

예:

```text
Deposit

    state
        depleted

```

를 전달하면 View에서 자원 고갈 상태가 표현되어야 한다.

이 테스트가 가능하면 World와 View가 실제로 독립적이라는 강력한 증거가 된다.

## 30. Playable Verification

마지막으로 실제 Server와 Client를 연결한다.

```text
Input
    ↓
Client
    ↓
Action Request
    ↓
Server
    ↓
World Rule
    ↓
World Transition
    ↓
GameView Specification
    ↓
Client
    ↓
Rendering
    ↓
Human

```

사용자가 실제로 Cycle Goal을 달성할 수 있어야 한다.

## 31. Human Observation

Verification Agent가 통과했다고 Cycle이 자동 완료되는 것은 아니다.

최종적으로 Human이 실행된 Client를 관찰한다.

질문:

```text
실제 게임이
내가 정의한 Cycle Goal과 같은 게임인가?

```

Human Observation은 코드 리뷰가 아니다.

실제 게임 행동 관찰이다.

## 32. Step 8 — Cycle Packaging

완료된 Cycle은 다음 Cycle의 기반이 된다.

Cycle 결과는 크게 네 가지다.

```text
Cycle Result

    1. Design Artifact

    2. World Capability

    3. GameView Capability

    4. Verification Evidence

```

## 33. Cycle Artifact 구조

각 Cycle 디렉터리는 Agent 작업 상태를 직관적으로 보여줘야 한다.

예:

```text
cycles/

    C001-movement/

        cycle.md
        intent.md
        world.md
        gameview.spec.json
        verification.md


    C002-mining/

        cycle.md
        intent.md
        world.md
        gameview.spec.json
        verification.md

```

이 디렉터리는 실제 Runtime Module 자체가 아니라:

```text
왜 이 기능이 존재하는가
무엇을 구현했는가
무엇을 검증했는가

```

를 추적하기 위한 기록이다.

## 34. Cycle Status

각 Cycle에는 최상단에 간단한 상태를 표시한다.

```text
CYCLE C002 — Mining

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[PASS] Implementation
[PASS] Verification

Status
    COMPLETE

```

실패 시:

```text
[PASS] Intent
[FAIL] Semantic Closure

Missing
    Tool.Capability

```

처럼 즉시 원인을 볼 수 있어야 한다.

## 35. Agent Workflow

Cycle 내부 Agent Workflow는 다음 하나의 흐름으로 통일한다.

```text
                  HUMAN
                    │
                    │ Cycle Goal
                    ▼
          ┌───────────────────┐
          │ Human Design      │
          │ Cycle Definition  │
          └─────────┬─────────┘
                    ▼
          ┌───────────────────┐
          │ Intent Agent      │
          │                   │
          │ Goal/Possibility  │
          │ Intent            │
          └─────────┬─────────┘
                    ▼
          ┌───────────────────┐
          │ World Model Agent │
          │                   │
          │ State             │
          │ Rule              │
          │ Observation       │
          │ GameView Spec     │
          └─────────┬─────────┘
                    ▼
             Human Semantic
                 Review
                    │
                    ▼
          ┌───────────────────┐
          │ Implementation    │
          │ Agent             │
          │                   │
          │ World / Server    │
          │ View / Client     │
          └─────────┬─────────┘
                    ▼
          ┌───────────────────┐
          │ Verification      │
          │ Agent             │
          │                   │
          │ Semantic          │
          │ World             │
          │ View              │
          │ Playable          │
          └─────────┬─────────┘
                    ▼
             Human Observation
                    │
                    ▼
              CYCLE COMPLETE
                    │
                    ▼
                NEXT CYCLE

```

이것이 모든 Cycle에서 반복되는 유일한 Agent Workflow다.

## 36. Agent별 직관적 산출물

Human Design

보여야 하는 것:

```text
이번 Cycle에서 무엇을 플레이할 수 있는가?

```

산출물:

```text
cycle.md

```

Intent Agent

보여야 하는 것:

```text
무엇이 가능해야 하는가?
왜 가능한가?

```

산출물:

```text
Goal / Possibility
Intent
Trace

```

World Model Agent

보여야 하는 것:

```text
세계에는 무엇이 존재해야 하는가?
어떤 규칙으로 변하는가?
Player에게 무엇이 보이는가?

```

산출물:

```text
World State
World Rules
Semantic Closure
GameView Specification

```

Implementation Agent

보여야 하는 것:

```text
설계가 실제 실행 가능한 World와 View가 되었는가?

```

산출물:

```text
world/server implementation

view/client implementation

```

Verification Agent

보여야 하는 것:

```text
무엇을 검증했고
무엇이 통과했고
무엇이 실패했는가?

```

산출물:

```text
verification.md

```

## 37. Capability 누적

완료된 Cycle의 World Capability는 하나의 공유 World에 축적된다.

잘못된 구조:

```text
MiningWorld
CraftingWorld
CombatWorld
TradeWorld

```

올바른 구조:

```text
                  WORLD

                    │
       ┌────────────┼────────────┐
       │            │            │
    Mining       Crafting      Combat
       │            │            │
       └────────────┼────────────┘
                    │
                 Actor
                 Item
               Inventory
                Position

```

Capability는 별도의 세계가 아니다.

기존 World에 새로운 가능성을 추가한다.

## 38. 후속 Cycle의 입력

새 Cycle은 이전 Cycle을 다시 구현하지 않는다.

```text
Cycle N Input

    Cycle Goal

    Existing World

    Existing View

    Existing Semantic Registry

    Existing Presentation Roles

```

Agent는 먼저 기존 Capability를 확인한다.

```text
Required Semantic

    Actor
    Inventory
    Position
    Resource
    Recipe

```

기존 World에:

```text
Actor
Inventory
Position
Resource

```

가 있다면 재정의하지 않는다.

새로운 것은:

```text
Recipe
Craft Rule

```

뿐이다.

## 39. Capability 변경 규칙

이전 Cycle 결과는 가능한 한 그대로 유지한다.

새 기능:

```text
Existing Capability
+
Extension

```

형태를 우선한다.

잘못된 경우에만 Version Migration을 수행한다.

```text
Mining v1
    ↓
Mining v2

```

Cycle은 기존 작업을 계속 뜯어고치는 단위가 아니다.

게임의 가능성을 추가하는 단위다.

## 40. World와 View의 Repository Boundary

권장되는 최상위 구조는 단순하게 유지한다.

```text
project/

    world/
        src/

    view/
        src/

    protocol/
        gameview/

    cycles/

    tests/

```

`protocol/gameview`에는 World와 View가 공유할 수 있는 경계 타입만 둔다.

예:

```text
GameViewSpecification
ActionRequest
SemanticIdentifier

```

World의 Domain Type을 넣지 않는다.

View의 Rendering Type도 넣지 않는다.

## 41. Compile-Time Independence

가능하면 구조적으로도 의존을 금지한다.

```text
world
    may import
        protocol

view
    may import
        protocol

world
    MUST NOT import
        view

view
    MUST NOT import
        world

```

즉:

```text
        protocol
        ▲      ▲
        │      │
     world    view

```

이다.

```text
world → view
view → world

```

직접 의존은 존재하지 않는다.

## 42. Local Development와 MMORPG Server

초기 Cycle에서는 개발 편의를 위해 Server와 Client를 같은 개발 환경에서 실행할 수 있다.

하지만 논리 구조는 처음부터 다음이어야 한다.

```text
Browser Client
      │
      │ Action Request
      ▼
World Server
      │
      │ GameView Specification
      ▼
Browser Client

```

초기에는 Transport가:

```text
in-memory

```

일 수 있다.

나중에는:

```text
WebSocket
HTTP
Dedicated Server Transport

```

등으로 바뀔 수 있다.

그러나 World와 View의 의미 구조는 변하지 않는다.

Transport는 구현 세부사항이다.

## 43. MMORPG 확장

Cycle이 쌓여도 Architecture는 변경되지 않는다.

초기:

```text
One Player
One Map
One Deposit

```

후기:

```text
Thousands of Actors
Multiple Zones
Combat
Economy
Guild
Party
Quest
AI
Persistence
Replication

```

에서도 기본 흐름은 동일하다.

```text
Action
    ↓
Authoritative World
    ↓
World Transition
    ↓
Observer Projection
    ↓
GameView Specification
    ↓
Client View

```

Scale이 커지는 것이지 의미 구조가 바뀌는 것이 아니다.

## 44. 첫 번째 Cycle 권장 형태

첫 Cycle에서는 Engine Architecture를 많이 만드는 것이 목적이 아니다.

추천 목표:

```text
Player가 작은 3D 지형 위를 이동할 수 있고
Sprite Billboard Character가 그 위치에 표시된다.

```

이 Cycle로 가장 먼저 검증할 수 있다.

```text
World Position
    ↓
GameView Specification
    ↓
3D Terrain
    +
Sprite Billboard

```

다음 Cycle:

```text
Resource Deposit을 볼 수 있다.

```

다음:

```text
Deposit과 상호작용할 수 있다.

```

다음:

```text
Stone을 획득할 수 있다.

```

이처럼 게임을 실제로 한 단계씩 성장시킨다.

## 45. Cycle Completion Gate

하나의 Cycle은 다음이 모두 참일 때만 완료된다.

```text
[ ] 작은 플레이 가능한 Goal이 정의되어 있다.

[ ] Goal / Possibility가 존재한다.

[ ] Intent가 존재한다.

[ ] Intent의 모든 의미가 State / Rule로 닫혀 있다.

[ ] World State 변화가 World Rule을 통해서만 발생한다.

[ ] World는 Authoritative하다.

[ ] GameView Specification이 존재한다.

[ ] View는 GameView Specification 외 World 정보를 사용하지 않는다.

[ ] World는 View 구현 정보를 사용하지 않는다.

[ ] World를 View 없이 검증할 수 있다.

[ ] View를 World 없이 GameView Fixture로 검증할 수 있다.

[ ] Server와 Client를 연결했을 때 실제 플레이가 가능하다.

[ ] Runtime 결과를 Goal / Possibility / Intent까지 추적할 수 있다.

[ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다.

[ ] 결과를 다음 Cycle에서 그대로 재사용할 수 있다.

```

## 46. 전체 구조

최종 전체 설계는 다음 하나의 그림으로 압축할 수 있다.

```text
══════════════════════════════════════════
                 CYCLE
══════════════════════════════════════════

              Cycle Goal
                  │
                  ▼

           Human Design
                  │
                  ▼
        Goal / Possibility
                  │
                  ▼
               Intent
                  │
                  ▼
       World State / Rules
                  │
                  ▼
        Semantic Closure
                  │
                  ▼
        Observer Projection
                  │
                  ▼
      GameView Specification
                  │
                  ▼
       Human Semantic Review

══════════════════════════════════════════
             IMPLEMENTATION
══════════════════════════════════════════

             protocol
             ▲      ▲
             │      │
          WORLD    VIEW
          Server   Client
             │      │
             │      │
             └──┬───┘
                │
                ▼
             Playable

══════════════════════════════════════════
             VERIFICATION
══════════════════════════════════════════

        Semantic Verification
                ↓
          World Verification
                ↓
           View Verification
                ↓
        Playable Verification
                ↓
         Human Observation

══════════════════════════════════════════
           CYCLE COMPLETE
══════════════════════════════════════════

          Existing MMORPG
                 +
        New Game Possibility
                 │
                 ▼
             Next Cycle

```

## 47. 핵심 Architecture Rules

```text
1.
Cycle은 작은 게임 단위다.

2.
모든 Cycle은 Design-Workflow를 처음부터 끝까지 수행한다.

3.
Agent의 각 단계는 인간이 읽을 수 있는 명시적 Artifact를 만든다.

4.
Goal / Possibility가 게임 의도의 Source of Truth다.

5.
Intent는 세계에서 무엇이 참이어야 하는지를 정의한다.

6.
Intent의 모든 의미는 World State 또는 World Rule로 닫혀야 한다.

7.
World State의 의미 있는 변화는 World Rule을 통해서만 발생한다.

8.
World는 Authoritative Server다.

9.
View는 Client다.

10.
World와 View는 서로의 구현을 참조하지 않는다.

11.
World → View의 공개 결과는 GameView Specification 하나다.

12.
GameView Specification은 Observable Semantic과 Presentation Semantic을 함께 포함한다.

13.
View는 GameView Specification만으로 화면을 구성한다.

14.
실제 Sprite, Mesh, Texture, UI, Renderer 선택은 View의 책임이다.

15.
Client는 상태를 변경하지 않고 Action Request만 전달한다.

16.
Transport는 Semantic에 영향을 주지 않는다.

17.
World는 View 없이 테스트 가능해야 한다.

18.
View는 World 없이 GameView Specification Fixture만으로 테스트 가능해야 한다.

19.
Cycle 결과는 버리지 않고 다음 Cycle에 누적된다.

20.
모든 Cycle은 실제 플레이로 끝난다.

```

## 48. 한 문장 정의

하나의 Cycle은 작은 플레이 목표를 `Goal/Possibility → Intent → World State/Rule → Observable Semantic → GameView Specification`으로 의미적으로 폐쇄하고, 이를 Authoritative TypeScript World Server와 독립적인 TypeScript Web Client로 구현하여, Client가 오직 GameView Specification만으로 3D Terrain과 Sprite Billboard 기반의 게임 화면을 구성하도록 만든 뒤 실제 플레이로 검증하고 그 결과를 다음 Cycle에 누적하는 개발 단위다.
