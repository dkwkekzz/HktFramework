# Cycle-Based Observable World Development Workflow

## 1. 목적

이 Workflow는 최종적으로 Open World MMORPG를 구축하기 위해, 사용자가 제시하는 **작고 플레이 가능한 목표 하나를 하나의 Cycle로 완성하고**, 그 결과를 다음 Cycle에서 재사용 가능한 World Capability Module로 축적하는 개발 공정을 정의한다.

하나의 Cycle은 다음 질문에서 시작한다.

> 이번 Cycle이 끝났을 때 사용자가 실제 게임을 실행하여 무엇을 할 수 있어야 하는가?

예:

```text
곡괭이를 가진 Actor가
광맥에 접근하여
Stone을 채굴할 수 있다.
```

이 목표를 대상으로 설계부터 Runtime 검증까지 전체 Workflow를 한 번 완주한다.

```text
Cycle Goal
    ↓
Design Scope
    ↓
Intent
    ↓
World Semantic
    ↓
Authority
    ↓
Observation
    ↓
Implementation
    ↓
Playable Composition
    ↓
Verification
    ↓
Capability Module
```

Cycle의 결과는 버려지는 Prototype이 아니다.

완성된 Capability는 다음 Cycle에서 다시 구현하지 않고 그대로 사용한다.

```text
Cycle 1 → Mining Module
Cycle 2
    Mining Module 사용
    + Crafting Module 생성
Cycle 3
    Mining Module 사용
    + Crafting Module 사용
    + Trade Module 생성
```

최종 MMORPG는 이러한 Capability의 누적으로 만들어진다.

---

## 2. 전체 Source of Truth 구조

전체 의미 흐름은 다음과 같다.

```text
Human Design
    │
    ▼
Goal / Possibility
    │
    ▼
Intent
    │
    ▼
World Definition
    │
    ├── World State
    └── World Rule
            │
            ▼
    Authoritative World
            │
            ▼
    Observer Projection
            │
            ▼
    Observable World
            │
            ▼
    Client / Designer View
```

Goal/Possibility가 게임 의도의 Source of Truth이며, Intent를 통해 World State와 World Rule로 구체화한다는 기존 원칙은 유지한다.

여기에 서버/클라이언트 구조를 위해 두 개의 의미 계층을 명시적으로 추가한다.

```text
Authority
Observation
```

즉:

* World에서 무엇이 참인지는 Authority가 결정한다.
* 각각의 Observer가 무엇을 알 수 있는지는 Observation이 결정한다.
* Client는 World 자체가 아니라 Observation 결과를 표현한다.

---

## 3. 하나의 Cycle 전체 구조

하나의 Cycle은 다음 8단계로 고정한다.

```text
Stage 1  Cycle Scope
Stage 2  Intent Design
Stage 3  World Semantic Design
Stage 4  Authority Design
Stage 5  Observation Design
Stage 6  Implementation
Stage 7  Playable Composition
Stage 8  Verification & Packaging
```

각 단계는 서로 다른 질문에 답한다.

```text
Cycle Scope
    무엇을 이번 Cycle에서 완성하는가?
Intent
    세계에서 무엇이 가능해야 하는가?
World Semantic
    그것이 참이려면 세계에 무엇이 존재해야 하는가?
Authority
    누가 어떤 Input으로 어떤 상태 변화를 확정하는가?
Observation
    각각의 Observer는 그 세계를 어떻게 볼 수 있는가?
Implementation
    이 의미를 실제 프로그램으로 어떻게 구현하는가?
Playable Composition
    지금까지의 Module을 어떻게 게임으로 조립하는가?
Verification
    설계한 세계가 실제로 그렇게 동작하는가?
```

이 순서를 Cycle마다 동일하게 반복한다.

---

## 4. Stage 1 — Cycle Scope

### 역할

이번 Cycle에서 완성할 **최소 플레이 경험**을 고정한다.

여기에서는 World State나 클래스 구조를 설계하지 않는다.

오직:

> 이번 Cycle 종료 시 플레이어가 무엇을 직접 할 수 있어야 하는가?

를 결정한다.

---

### 입력

```text
User Cycle Goal
Previous Capability Modules
```

예:

```text
User Goal
Player가 Pickaxe를 이용하여
Stone Deposit에서 Stone을 채굴한다.
Existing Modules
없음
```

후속 Cycle이라면:

```text
User Goal
획득한 Resource를 사용하여
Pickaxe를 제작한다.
Existing Modules
Mining Module v1
```

---

### 작업

Cycle Goal을 작은 플레이 Scenario로 제한한다.

예:

```text
Actor가 움직인다.
    ↓
Deposit에 접근한다.
    ↓
Mine을 수행한다.
    ↓
Stone을 획득한다.
```

다음과 같은 기술적 목표로 바꾸지 않는다.

```text
MiningComponent 구현
Inventory 구현
UI 구현
```

---

### 출력

```text
CYCLE SCOPE
Playable Goal
Included Scenario
Existing Module Dependencies
Out of Scope
```

예:

```text
CYCLE-MINING-001
Playable Goal
    Player가 Pickaxe를 이용해
    Stone Deposit에서 Stone을 획득한다.
Existing Modules
    None
Out of Scope
    Crafting
    Trading
    NPC
    Respawn
    Multiple Resource Types
```

---

### 완료 조건

Cycle Goal을 하나의 작은 게임으로 직접 실행해 확인할 수 있어야 한다.

---

## 5. Stage 2 — Intent Design

### 역할

Cycle Goal을 **세계에서 성립해야 하는 의미**로 변환한다.

구현 방법은 결정하지 않는다.

기존 Workflow에서 Intent는 클래스나 함수가 아니라 세계에서 무엇이 참이어야 하는지를 정의한다.

---

### 입력

```text
Cycle Scope
Goal / Possibility
```

---

### 작업

Cycle Goal을 Goal/Possibility로 표현한다.

```text
AcquireStone
    │
    └── MineStone
```

그리고 Intent를 추출한다.

```text
INTENT-MINING-001
Stone Deposit을 알고 있고,
Mining 가능한 Tool을 보유하고 있으며,
Deposit에 접근 가능한 Actor는
Mine을 수행하여
Deposit의 Resource를 감소시키고
자신의 Inventory에 Resource를 획득할 수 있다.
```

---

### 출력

```text
Goal / Possibility
Intent Set
Design Trace
```

Trace는 반드시 유지한다.

```text
AcquireStone
    ↓
MineStone
    ↓
INTENT-MINING-001
```

---

### 완료 조건

Cycle Goal의 모든 플레이 의미가 하나 이상의 Intent로 표현되어 있어야 한다.

Implementation 개념이 Intent에 들어가서는 안 된다.

---

## 6. Stage 3 — World Semantic Design

### 역할

Intent가 실제 세계에서 참이기 위해 필요한 **World State와 World Rule**을 정의한다.

이 단계에서 처음으로 World가 만들어진다.

---

### 입력

```text
Intent Set
Existing World Semantics
```

---

### 작업 A — 기존 Semantic 재사용

새 Cycle에서 필요한 의미가 기존 Module에 이미 존재하는지 먼저 확인한다.

예:

```text
Required
Actor
Inventory
Resource
Position
Recipe
Craft
```

기존 Module이:

```text
Mining Module
Provides / Uses
Actor
Inventory
Resource
Position
```

을 이미 사용하고 있다면 다시 만들지 않는다.

이번 Cycle에서 새롭게 필요한 것은:

```text
Recipe
Craft Rule
```

뿐이다.

---

### 작업 B — World State 도출

Mining Intent라면:

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

가 필요하다.

World State에는 세계의 사실만 존재한다.

기존 Workflow에서도 프로그램 내부 구현 상태와 World State를 명확하게 분리한다.

---

### 작업 C — World Rule 도출

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

World Rule은 코드 함수 정의가 아니다.

> 세계에서 허용되는 Semantic State Transition이다.

세계의 의미 있는 상태 변화는 반드시 World Rule에 귀속되어야 한다.

---

### 출력

```text
World Semantic Delta
Required Existing Semantic
New World State
New World Rules
Intent → State / Rule Trace
```

---

### 완료 조건 — Semantic Closure

Intent에 등장하는 모든 의미가 World State 또는 World Rule에 존재해야 한다.

```text
"광맥을 안다"
    → Knowledge
"도구를 가지고 있다"
    → Inventory
"Mining 가능한 도구"
    → Tool Capability
"가까이 있다"
    → Position / Interaction Range
"채굴한다"
    → Mine Rule
"Resource를 얻는다"
    → Inventory Transition
```

연결되지 않는 의미가 존재하면 다음 단계로 이동하지 않는다.

기존 Workflow의 Semantic Closure 원칙을 그대로 사용한다.

---

## 7. Stage 4 — Authority Design

### 역할

정의된 World State와 World Rule을 **누가 소유하고 누가 변경할 수 있는지** 결정한다.

MMORPG 구조에서는 Authoritative World가 서버에 존재한다.

```text
Server
    =
Authoritative Semantic World
```

Client는 World의 결과를 직접 변경하지 않는다.

---

### 입력

```text
World State
World Rules
```

---

### 작업 A — Authority 지정

각 Semantic State에 대해 Authority를 명확하게 한다.

예:

```text
Actor.Inventory
    Server Authority
Deposit.ResourceAmount
    Server Authority
Actor.Knowledge
    Server Authority
Tool.Capability
    Server Authority
```

---

### 작업 B — Command 정의

Client가 보내는 것은 결과가 아니라 **행동 요청**이다.

잘못된 방식:

```text
Client
Stone += 1
```

올바른 방식:

```text
Client
Mine(
    Actor01,
    Deposit01
)
```

---

### 작업 C — Server Transition 정의

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
New Authoritative World State
```

예:

```text
Mine(Player01, Deposit01)
        ↓
RULE-MINE-001
        ↓
KnowsDeposit?
HasMiningTool?
InRange?
DepositAvailable?
        ↓
World Transition
        ↓
Player01.Stone
    0 → 1
Deposit01.Resource
    10 → 9
```

---

### 출력

```text
Authority Contract
Client Commands
Server Rule Execution Contract
Authoritative Transition Contract
```

---

### 완료 조건 — Authority Closure

모든 Semantic State 변경에 대해 다음 질문에 답할 수 있어야 한다.

```text
어떤 Input이 들어왔는가?
어떤 World Rule이 판단했는가?
누가 상태 변경을 확정했는가?
어떤 Transition이 발생했는가?
```

모든 World Semantic Transition은 Authoritative World Rule을 통해서만 발생해야 한다.

---

## 8. Stage 5 — Observation Design

### 역할

Authoritative World를 각각의 Observer가 볼 수 있는 **Observable World**로 투영한다.

Observation은 Rendering이나 Network Packet 설계가 아니다.

Observation은 World Semantic의 일부이다.

질문은 다음과 같다.

> 이 Observer는 현재 World의 어떤 의미를 알 수 있어야 하는가?

---

### 입력

```text
Authoritative World
Intent
World Rules
Observer Types
```

---

### 작업 A — Observer 정의

예:

```text
Player Observer
Designer Observer
```

필요하면 이후:

```text
Party Observer
GM Observer
Spectator Observer
AI Observer
```

등이 추가될 수 있다.

---

### 작업 B — Semantic Projection 정의

```text
ObservableWorld
    =
Projection(
        AuthoritativeWorld,
        ObserverContext
    )
```

Player에게는:

```text
Player.Position
Player.Inventory
Visible Deposit
Known Resource
Mine Availability
Mine Result
```

등을 제공할 수 있다.

하지만:

```text
Unknown Resource Location
Other Player Private Goal
Hidden NPC Knowledge
```

등은 제공하지 않을 수 있다.

---

### 작업 C — Designer Projection 정의

Designer는 게임 설계를 검증해야 하므로 더 많은 Semantic을 관찰한다.

```text
Current Goal
Current Possibility
Possibility Availability
All Preconditions
World Rule
Before State
Input
After State
Failure Reason
```

Designer View 역시 World 내부 구현에 직접 접근하지 않는다.

Designer 전용 Observer Projection을 사용한다.

기존 Workflow의 View가 World 내부 구현을 직접 읽지 않고 Observable World State만 읽어야 한다는 원칙을 유지한다.

---

### 출력

```text
Observer Definitions
Player Observable Contract
Designer Observable Contract
Observable Transition Contract
```

---

### 완료 조건 — Observable Closure

World Rule의 판단 및 결과에 필요한 설계 의미가 적절한 Observer에게 모두 관찰 가능해야 한다.

예:

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
    Actor is outside Interaction Range.
```

기존 Observable Closure 원칙을 그대로 적용한다.

---

## 9. Stage 6 — Implementation

### 역할

지금까지 확정된 Semantic Contract를 실제 코드로 구현한다.

Implementation은 의미를 결정하는 단계가 아니다.

이미 결정된 의미를 프로그램으로 실현한다.

---

### 입력

하나의 Implementation Package를 사용한다.

```text
IMPLEMENTATION PACKAGE
1. Cycle Scope
2. Source Goal / Possibility
3. Intent
4. Required Existing Modules
5. World Semantic Delta
6. World Rules
7. Authority Contract
8. Observation Contract
9. Required Views
10. Completion Conditions
```

기존 Workflow에서 Implementation Agent에게 Intent, State, Rule, Observable, View 등을 하나의 Package로 제공한다는 구조를 유지한다.

---

### 구현 구조

초기 Cycle에서는 실제 Dedicated Server를 만들 필요가 없다.

예:

```text
One Process
┌───────────────────────────────────┐
│                                   │
│   Authoritative World             │
│          ▲                        │
│          │ Command                │
│          │                        │
│   Client Simulation/View          │
│                                   │
└───────────────────────────────────┘
```

그러나 논리적 Boundary는 유지한다.

```text
Client
    ↓ Command
Authority
    ↓ Transition
Observation
    ↓ Observable
Client
```

후에 실제 네트워크가 필요해지면:

```text
Client
    ↓
Network
    ↓
Server
```

로 Transport만 교체할 수 있어야 한다.

---

### Transport의 위치

Network는 World Semantic 계층이 아니다.

```text
Authoritative World
        ↓
Observable Projection
        ↓
Replication Representation
        ↓
Transport
        ↓
Client Replica
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

World State에 포함하지 않는다.

---

### 출력

```text
Implemented Capability
Command Handler
Authoritative Runtime
Observable Projector
Client Observable Replica
Views
```

---

### 완료 조건

Client가 World 내부 구현을 직접 접근하지 않아야 한다.

Client는 다음 두 Contract만 알아야 한다.

```text
Client → World
    Command
World → Client
    Observable
```

---

## 10. Stage 7 — Playable Composition

### 역할

새 Capability를 이전 Cycle Module과 조합하여 **현재 버전의 게임**을 만든다.

이 단계는 새로운 World Semantic을 설계하는 단계가 아니다.

완성된 Module들을 실제 플레이 가능한 World로 조립하는 단계다.

---

### 입력

```text
Existing Capability Modules
New Capability Module
Minimal World Configuration
```

---

### 예

Cycle 1:

```text
Mining Module
+
Minimal Map
+
Player
+
Deposit
```

Cycle 2:

```text
Mining Module
+
Crafting Module
+
Minimal Map
```

Cycle 3:

```text
Mining
+
Crafting
+
Trade
+
Merchant
+
Minimal Map
```

---

### 중요한 원칙

이전 Cycle의 Module을 다시 구현하지 않는다.

```text
Cycle 2
Mining Module
    그대로 사용
Crafting Module
    새로 구현
```

Module 내부를 직접 접근하여 기능을 연결하지 않는다.

공유 World Semantic과 Module Contract를 통해 연결한다.

예:

```text
Mining
    ↓
Actor.Inventory에 Stone 생성
Crafting
    ↓
Actor.Inventory의 Stone 소비
```

Mining과 Crafting은 서로의 내부 구현을 알 필요가 없다.

---

### 출력

```text
Playable World N
```

즉 현재까지 완성된 Capability를 실제로 사용하는 현재 Game Build다.

---

## 11. Stage 8 — Verification & Packaging

### 역할

이번 Cycle이 설계한 Capability가 실제 World에서 정확하게 동작하는지 검증하고, 다음 Cycle에서 사용할 Module로 확정한다.

---

### Verification 1 — Positive Scenario

Mining 예:

```text
Initial
Player.Stone = 0
Deposit.Stone = 10
HasMiningTool = true
InRange = true
```

Input:

```text
Mine(Player, Deposit)
```

Result:

```text
Player.Stone
    0 → 1
Deposit.Stone
    10 → 9
```

---

### Verification 2 — Negative Scenario

각 Precondition을 하나씩 실패시킨다.

```text
No Tool
    → Mine unavailable
Unknown Deposit
    → Mine unavailable
Out of Range
    → Mine unavailable
Empty Deposit
    → Mine unavailable
```

실패 이유 역시 Observable해야 한다.

---

### Verification 3 — Traceability

Runtime에서 설계까지 역추적한다.

```text
Transition
    ↓
World Rule
    ↓
Intent
    ↓
Possibility
    ↓
Goal
```

그리고 설계에서 Runtime까지 내려갈 수도 있어야 한다.

기존 Workflow에서 양방향 Traceability를 요구한다.

---

### Verification 4 — Authority Closure

```text
모든 Semantic Transition이
Authoritative World Rule을 통해 발생했는가?
```

---

### Verification 5 — Observable Closure

```text
Player가 플레이를 위해 알아야 할 의미가
Player Observable에 존재하는가?
Designer가 설계를 검증하기 위해 알아야 할 의미가
Designer Observable에 존재하는가?
```

---

### Verification 6 — Module Independence

```text
다음 Cycle이 이 Capability의 내부 구현을 몰라도
Requires / Provides Contract만으로 사용할 수 있는가?
```

---

## 12. Cycle Output

모든 Verification을 통과하면 Cycle을 완료한다.

Cycle의 공식 결과는 두 개다.

```text
1. World Capability Module
2. Playable World
```

Capability Module은 다음 정보를 포함한다.

```text
CAPABILITY MODULE
Identity
Version
Requires
Provides
Intent
World Semantic
World Rules
Authority Contract
Observation Contract
Traceability
Verification Scenarios
```

---

## 13. 다음 Cycle로의 연결

다음 Cycle은 이전 Cycle의 결과를 입력으로 사용한다.

```text
                  Cycle 1
              Mining Goal
                   ↓
             Full Workflow
                   ↓
             Mining Module
                   │
                   │
                   ▼
                  Cycle 2
           Crafting Goal
                   +
             Mining Module
                   ↓
             Full Workflow
                   ↓
           Crafting Module
                   │
                   ▼
                  Cycle 3
             Trade Goal
                   +
             Mining Module
                   +
           Crafting Module
                   ↓
             Full Workflow
                   ↓
             Trade Module
```

게임은 다음처럼 성장한다.

```text
Game 1
    Mining
Game 2
    Mining
    + Crafting
Game 3
    Mining
    + Crafting
    + Trade
Game 4
    Mining
    + Crafting
    + Trade
    + Combat
...
Open World MMORPG
```

---

## 14. Cycle 전체 역할 분리

전체 책임을 요약하면 다음과 같다.

| Stage          | 결정하는 것                            | 결정하지 않는 것        |
| -------------- | --------------------------------- | ---------------- |
| Cycle Scope    | 이번 Cycle의 플레이 목표                  | 구현 구조            |
| Intent Design  | 세계에서 무엇이 가능해야 하는가                 | State 구조         |
| World Semantic | 어떤 State와 Rule이 필요한가              | 서버 구현 방식         |
| Authority      | 누가 World Truth를 변경하는가             | Rendering        |
| Observation    | Observer가 무엇을 볼 수 있는가             | Network Encoding |
| Implementation | Semantic을 어떻게 코드로 구현하는가           | 게임 의미 변경         |
| Composition    | Module들을 어떻게 플레이 가능한 World로 조립하는가 | Module 의미 재정의    |
| Verification   | 설계와 Runtime이 일치하는가                | 새로운 기능 설계        |

단계 간 책임을 섞지 않는 것이 중요하다.

---

## 15. 전체 Pipeline

최종적으로 하나의 Cycle은 다음 구조로 고정한다.

```text
══════════════════════════════════════════
              USER CYCLE GOAL
══════════════════════════════════════════
                    │
                    ▼
1. CYCLE SCOPE
   플레이 가능한 최소 목표 고정
                    │
                    ▼
2. INTENT DESIGN
   Goal / Possibility
   → World Meaning
                    │
                    ▼
3. WORLD SEMANTIC DESIGN
   Intent
   → State / Rule
   → Semantic Closure
                    │
                    ▼
4. AUTHORITY DESIGN
   Command
   → Server Rule
   → Authoritative Transition
                    │
                    ▼
5. OBSERVATION DESIGN
   World
   → Observer Projection
   → Player / Designer Observable
                    │
                    ▼
6. IMPLEMENTATION
   Semantic Contract
   → Runtime Implementation
   → Client / Server Boundary
                    │
                    ▼
7. PLAYABLE COMPOSITION
   Previous Modules
   + New Module
   → Current Game
                    │
                    ▼
8. VERIFICATION
   Positive Scenario
   Negative Scenario
   Semantic Closure
   Authority Closure
   Observable Closure
   Traceability
   Module Independence
                    │
                    ▼
══════════════════════════════════════════
               CYCLE COMPLETE
══════════════════════════════════════════
         Capability Module N
                  +
          Playable World N
                    │
                    ▼
                NEXT CYCLE
```

---

## 16. 최종 완료 기준

하나의 Cycle은 다음이 모두 성립할 때 완료된다.

```text
Cycle Goal
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / Rule
    ↓
Authoritative Transition
    ↓
Observer Projection
    ↓
Observable World
    ↓
Client Presentation
```

그리고 이 전체 연결이 실제 플레이를 통해 확인 가능해야 한다.

단순히:

```text
코드가 동작한다.
```

는 완료가 아니다.

완료란:

> **사용자가 지정한 작은 플레이 목표가 World Semantic으로 정의되고, Authoritative Rule에 의해 실제 상태 변화로 실행되며, 각 Observer에게 올바르게 투영되고, Client에서 게임으로 표현되어 인간이 직접 확인할 수 있으며, 그 전체 Capability가 다음 Cycle에서 재사용 가능한 Module로 남는 상태이다.**

---

## 17. 핵심 Architecture Rule

전체 구조를 유지하기 위한 최상위 Rule은 다음과 같다.

### Rule 1 — Design Authority

Goal/Possibility와 Intent가 게임 의미의 Source of Truth이다.

### Rule 2 — Semantic Closure

Intent의 모든 의미는 World State 또는 World Rule로 표현되어야 한다.

### Rule 3 — Server Authority

World Semantic의 실제 상태 변화는 Authoritative World Rule을 통해서만 발생한다.

### Rule 4 — Command Boundary

Client는 World State를 변경하지 않고 행동 Command만 전달한다.

### Rule 5 — Observer Projection

Client와 Designer는 World 내부를 직접 읽지 않고 Observer별 Observable World를 사용한다.

### Rule 6 — Semantic Observation

Observable은 Network Packet이 아니라 World의 Semantic Projection이다.

### Rule 7 — Transport Independence

Local 호출, IPC, Network는 Semantic Workflow를 변경하지 않는 Implementation Mechanism이어야 한다.

### Rule 8 — Module Reuse

이전 Cycle에서 완료된 Capability는 후속 Cycle에서 재구현하지 않고 Module Contract를 통해 사용한다.

### Rule 9 — Shared World

Module마다 별개의 World State를 만들지 않는다. 모든 Capability는 동일한 World Semantic 위에서 상호작용한다.

### Rule 10 — Playable Verification

모든 Cycle은 실제 작은 게임으로 실행하여 인간이 결과를 직접 확인할 수 있어야 한다.

---

## 18. 한 문장 정의

> **각 Cycle은 사용자가 제시한 작은 플레이 목표를 Intent → World Semantic → Authority → Observation → Implementation → Playable Composition → Verification의 고정된 단계로 완성하고, 그 결과를 다음 Cycle에서 그대로 조립해 사용할 수 있는 World Capability Module로 축적하는 공정이다.**

더 압축하면:

> **World의 의미를 정의하고, Server가 그것을 실행하며, Observer에게 투영하고, Client가 표현하며, 검증된 Capability를 다음 Cycle에 재사용한다.**
