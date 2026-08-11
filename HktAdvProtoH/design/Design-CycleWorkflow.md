# Design-CycleWorkflow.md

Observable World — Progressive Cycle Workflow Specification

> 이 문서는 이 프로젝트의 **운영 헌법(원본)** 이다.
> RULE 12 에 따라 이 문서는 **기본 Context 가 아니라 fallback reference** 다.
> Agent 의 기본 입력은 `context/TARGET-HORIZON.md` + 현재 Cycle Contract +
> 관련 World Baseline 부분집합 + 현재 Stage Artifact + 현재 Stage Guide 다.

---

## 1. 목적

이 프로젝트의 최종 목표는 Goal / Possibility 기반의 Observable World 구조를 이용해
점진적으로 완전한 Open World MMORPG 를 구축하는 것이다.

처음부터 MMORPG 전체의 Goal Graph, Possibility Graph, World State, World Rule 을
정의하거나 구현하지 않는다.
대신 작은 범위의 세계 기능을 하나씩 선택하고 다음 전체 경로를 끝까지 완성한다.

```text
Intent
→ World State
→ World Rule
→ Runtime Transition
→ Observable World State
→ Human Verification
```

이 완결된 개발 단위를 Cycle 이라 한다.

예를 들어 첫 Cycle 은 `광석 채굴` 이라는 매우 작은 기능만 다룰 수 있다.
그러나 중요한 원칙은 다음과 같다.

Cycle 1 의 목표는 "광석 캐기 미니게임" 을 만드는 것이 아니다.
최종 Open World MMORPG 가 사용할 세계 구조의 첫 번째 작은 영역을 `광석 채굴` 을 통해
완성하고 검증하는 것이다.

따라서 현재 Cycle 의 구현 범위는 작아도, 그 Cycle 에서 정의하는 세계 의미가
최종 시스템의 확장을 구조적으로 막아서는 안 된다.

## 2. 전체 개발 모델

프로젝트는 여러 개의 Evolution Cycle 이 누적되는 방식으로 진행한다.

```text
TARGET HORIZON
Open World MMORPG
        │
        ▼
┌───────────────────┐
│ Cycle 001         │
│ Mining            │
└─────────┬─────────┘
          ▼
   World Baseline 1
          │
          ▼
┌───────────────────┐
│ Cycle 002         │
│ Crafting          │
└─────────┬─────────┘
          ▼
   World Baseline 2
          │
          ▼
┌───────────────────┐
│ Cycle 003         │
│ Combat / Survival │
└─────────┬─────────┘
          ▼
          ...
          │
          ▼
Open World MMORPG
```

각 Cycle 은 독립된 작은 게임을 추가하는 것이 아니다.

```text
잘못된 모델

Mining Game
+
Crafting Game
+
Combat Game
+
Trading Game
```

대신 하나의 World Baseline 을 계속 확장한다.

```text
올바른 모델

World Baseline 0
      │
      + Mining Semantic
      ▼
World Baseline 1
      │
      + Crafting Semantic
      ▼
World Baseline 2
      │
      + Combat Semantic
      ▼
World Baseline 3
      │
      ...
```

즉 각 Cycle 은 기존 세계에 새로운 의미 영역을 추가하는 과정이다.

## 3. Stage 와 Cycle 을 구분한다

`Stage` 와 `Cycle` 은 서로 다른 개념이다.

**Stage** — 하나의 Agent 가 한 번에 수행하는 작업 단위다.

```text
Intent
World Model
Human Semantic Review
Implementation
Verification
```

**Cycle** — 하나의 작은 World Capability 를 설계부터 Runtime 검증까지 완성하는
상위 작업 단위다.

```text
Cycle
│
├─ Scope Definition
├─ Intent Stage
├─ World Model Stage
├─ Human Semantic Review
├─ Implementation Stage
├─ Verification Stage
├─ Evolution Compatibility Review
└─ World Baseline Merge
```

따라서:

```text
Stage   = Agent 실행 단위
Cycle   = World Capability 완성 단위
Project = Cycle 의 누적
```

이다.

## 4. 가장 중요한 실행 원칙

**ONE INVOCATION = ONE STAGE**

하나의 Agent invocation 또는 하나의 작업 세션에서 여러 Stage 를 연속으로 처리하지 않는다.

```text
요청
 ↓
Stage Router
 ↓
현재 Stage 식별
 ↓
현재 Stage Guide
+
필요한 Handoff Artifact
 ↓
현재 Stage 수행
 ↓
다음 Artifact 생성
 ↓
STOP
```

다음 Stage 는 별도의 invocation 에서 시작한다.
다음 Stage 의 Agent 는 이전 Agent 의 reasoning 이나 전체 conversation 을
전달받을 필요가 없다.
전달되는 것은 정규화된 Artifact 다.

```text
Conversation History   X
Previous Reasoning     X
전체 설계 문서          X

Handoff Artifact       O
Stage Guide            O
필요한 Reference       O
```

## 5. Stage Router 의 책임

기존에 `Orchestrator` 라고 표현했던 역할은 실제로 Workflow 전체를 실행하는
Orchestrator 가 아니다.
정확한 책임은 Stage Router 다.

Stage Router 는 다음만 수행한다.

```text
1. 현재 요청의 Stage 를 식별한다.
2. 필요한 Stage Guide 를 선택한다.
3. 필요한 입력 Artifact 가 존재하는지 확인한다.
4. 해당 Stage 에서 허용된 Reference 만 선택한다.
5. 현재 Stage 를 수행하게 한다.
```

Stage Router 는 다음을 하지 않는다.

```text
다음 Stage 자동 실행
여러 Stage 연속 실행
Workflow 전체 자동 완료
이전 Agent reasoning 유지
전체 원본 문서 자동 로드
Human Review 자동 통과
```

## 6. Cycle 의 시작: Cycle Contract

모든 Cycle 은 구현보다 먼저 `Cycle Contract` 를 정의한다.
Cycle Contract 는 현재 Cycle 이 세계에 어떤 의미를 추가하는지 제한한다.

기본 구조:

```text
CYCLE CONTRACT

Cycle ID:
    CYCLE-XXX

Target Horizon:
    Persistent Open World MMORPG

Capability Added:
    이번 Cycle 에서 추가할 세계 능력

Existing Semantics Used:
    기존 World Baseline 에서 재사용하는 의미

New Semantics:
    이번 Cycle 에서 새롭게 추가할 의미

Goal / Possibility Scope:
    이번 Cycle 에서 다룰 Goal / Possibility

Observable Proof:
    인간이 완료를 어떻게 확인할 것인가

Explicitly Deferred:
    이번 Cycle 에서는 구현하지 않는 것

Evolution Questions:
    현재 설계가 미래 확장을 막는지 검사할 질문
```

## 7. Target Horizon

모든 Cycle 은 동일한 장기 방향을 공유한다.
Target Horizon 은 구현 명세가 아니라 장기적인 구조적 방향이다.

```text
TARGET HORIZON

Persistent Open World MMORPG

- 다수의 Player / AI Actor 가 존재한다.
- Actor 는 하나의 공유 World 안에서 행동한다.
- World State 는 지속적으로 변화한다.
- 다양한 Goal / Possibility 가 연결된다.
- Actor 마다 Knowledge / Skill / Experience / Preference 가 다를 수 있다.
- Resource / Crafting / Combat / Economy / Social / Ecology 등으로 확장한다.
- World Semantic 은 Runtime 에서 Observable 해야 한다.
- Runtime Transition 은 설계 Intent 까지 역추적할 수 있어야 한다.
```

Target Horizon 때문에 미래 기능을 미리 구현하지 않는다.
Target Horizon 은 현재 Cycle 에서 잘못된 구조적 결정을 하지 않기 위한 방향성이다.

## 8. Permanent Semantic Foundation 과 Deferred Capability

초기 Cycle 에서 모든 MMORPG 기능을 구현해서는 안 된다.
대신 다음 둘을 구분한다.

**Permanent Semantic Foundation** — 초기부터 잘못 정의하면 이후 모든 Cycle 에
영향을 주는 세계 의미다.

```text
Entity Identity
Actor
World State
World Rule
Position
Inventory
Ownership
Knowledge
Goal
Possibility
Semantic Transition
Observable Projection
```

이러한 개념은 작은 Cycle 에서도 최종 World Model 과 호환되는 의미로 정의한다.

**Deferred Capability** — 현재 Cycle 에 필요하지 않은 미래 기능이다.

```text
대규모 동시 접속
서버 샤딩
길드
경매장
지역 경제
레이드
정치
생태계
Resource Respawn
Network Authority
```

이것들은 필요해질 때까지 구현하지 않는다.

원칙:

> 미래 기능을 미리 구현하지 않는다.
> 단, 현재 설계가 미래 기능을 구조적으로 불가능하게 만들지는 않는지 확인한다.

## 9. Cycle 내부 Workflow

각 Cycle 은 다음 순서로 진행한다.

```text
Cycle Contract
      ↓
Intent Stage
      ↓
Intent Package
      ↓
World Model Stage
      ↓
World Definition Package
      ↓
Human Semantic Review
      ↓
APPROVED World Definition
      ↓
Implementation Stage
      ↓
Implementation Result
      ↓
Verification Stage
      ↓
Verification Report
      ↓
Evolution Compatibility Review
      ↓
World Baseline Merge
```

## 10. Stage 1 — Intent

입력:

```text
Current Cycle Contract
Relevant Goal / Possibility Design
Relevant World Baseline
```

출력:

```text
Intent Package
```

Intent 는 구현 구조가 아니다.

잘못된 예:

```text
MiningComponent 를 만든다.
Mine() 메서드를 추가한다.
InventoryService 를 호출한다.
```

올바른 예:

```text
광맥을 알고 있으며,
적절한 채굴 도구를 가지고 있고,
광맥에 접근 가능한 Actor 는

Mine 을 통해

광맥의 Resource 를 감소시키고
자신의 Inventory 에 Resource 를 획득할 수 있다.
```

Intent 는 원본 Goal / Possibility 까지 추적 가능해야 한다.

```text
Goal
 ↓
Possibility
 ↓
Intent
```

## 11. Stage 2 — World Model

입력:

```text
Intent Package
Current World Baseline
Cycle Contract
```

출력:

```text
World Definition Package
```

World Model Agent 는 Intent 의 모든 의미를 다음으로 폐쇄한다.

```text
Intent
 ↓
Required World State
+
Required World Rule
+
Required Observable
```

예:

```text
"Actor 가 광맥을 알고 있다"

→ Actor.Knowledge
→ Deposit.Identity
```

```text
"채굴 도구를 가지고 있다"

→ Actor.Inventory
→ Item.ToolCapability
```

```text
"광맥에 접근 가능하다"

→ Actor.Position
→ Deposit.Position
→ InteractionRange
```

Intent 의 의미가 World Definition 에 연결되지 않으면 Semantic Closure 실패다.

## 12. Stage 3 — Human Semantic Review

World Model 이후 Implementation 으로 자동 진행하지 않는다.
반드시 Human Semantic Review Gate 를 통과한다.

Human 은 다음 질문을 검토한다.

```text
이 World State / World Rule 이
내가 정의한 Intent 를 정확하게 표현하는가?
```

결과:

```text
APPROVED
```

또는:

```text
REJECTED

Reason:
...

Required Change:
...
```

`APPROVED` 되지 않은 World Definition 은 Implementation 에 전달할 수 없다.

## 13. Stage 4 — Implementation

입력:

```text
APPROVED World Definition Package
Repository
Implementation Stage Guide
```

Implementation Agent 는 일반적으로 원래의 거대한 설계 문서를 다시 읽지 않는다.
Coding Agent 에 넘기는 작업 단위는 전체 설계 문서가 아니라 `Implementation Package` 다.

Implementation Agent 가 결정할 수 있는 것:

```text
클래스 구조
자료구조
파일 구조
함수 구조
캐싱
코드 추상화
Implementation Mechanism
```

변경할 수 없는 것:

```text
Goal 의미
Possibility 의미
Intent 의미
World Rule 의미
Required World State
Observable Contract
```

## 14. Design Gap 처리

Agent 가 필요한 의미가 정의되지 않았음을 발견하면 임의로 결정하지 않는다.

예:

```text
Mine 가능 여부를 판단하려면
ToolCapability 가 필요한데
World Definition 에 존재하지 않는다.
```

이 경우:

```text
DESIGN GAP

Affected Intent:
    INTENT-MINING-001

Missing Semantic:
    ToolCapability

Why Required:
    Mining 가능 여부를 표현할 Semantic State 가 없음.

Proposal:
    Item.ToolCapability

Blocking:
    yes
```

를 생성하고 현재 Stage 를 중단한다.
Agent 는 설계 변경을 직접 수행하지 않는다.

## 15. Stage 5 — Verification

Verification 은 단순한 코드 테스트가 아니다.
다음을 모두 검사한다.

**Semantic Closure** — Intent 의 모든 의미가 State / Rule 로 표현되었는가?

**Observable Closure** — Rule 의 판단과 결과를 이해하는 데 필요한 의미가 Observable 한가?

**Runtime Closure** — 실제로:

```text
Before
Input
Rule
After
```

의 Semantic Transition 이 발생하는가?
State 뿐 아니라 Transition 자체도 Observable 해야 한다.

**Traceability** — 다음 연결이 유지되는가?

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

## 16. Evolution Compatibility Gate

각 Cycle 에는 기존 Workflow 의 Closure 검사 외에 추가 Gate 를 둔다.

```text
1. Semantic Closure
2. Observable Closure
3. Runtime Closure
4. Evolution Compatibility
```

Evolution Compatibility 가 묻는 것은:

> 현재 Cycle 에서 만든 구조가 최종 Open World MMORPG 방향을 불필요하게 제한하는가?

이다. 미래 기능이 구현되어 있는지를 검사하는 것이 아니다.

예를 들어 Cycle 1 에 Actor 가 한 명만 존재하는 것은 문제없다.
하지만 다음과 같은 구조는 문제다.

```text
World.playerInventory
World.playerPosition
World.playerStoneCount
```

이는 World 가 Player 한 명만 존재한다고 의미적으로 가정한다.

대신:

```text
Actor01.Inventory
Actor01.Position

Deposit01.ResourceAmount
```

처럼 Actor / Entity 단위 의미로 표현해야 한다.
현재 Runtime 에 Actor01 하나밖에 없어도 Actor02 를 같은 의미 모델에 추가할 수 있어야 한다.

## 17. 과도한 미래 추상화도 금지한다

확장성을 고려한다는 이유로 미래 구현을 예측해서는 안 된다.
Cycle 1 에서 다음과 같은 구현 추상화를 만들 필요는 없다.

```text
UniversalResourceProviderFactory
DistributedInteractionOrchestrator
GenericMMORPGCapabilityResolver
```

원칙:

```text
일반화해야 하는 것
    → World Semantic

미리 일반화할 필요가 없는 것
    → Implementation Mechanism
```

예:

```text
Actor
Entity
ResourceType
World Rule
Position
Inventory
```

는 의미적으로 확장 가능해야 한다.

그러나:

```text
ECS 사용 여부
DB 구조
Shard 전략
Network Replication
Cache 방식
```

등은 실제 필요가 생길 때 결정할 수 있다.

## 18. Semantic Overlap 원칙

Cycle 들이 독립적인 Feature Island 가 되어서는 안 된다.

잘못된 구조:

```text
Mining System

Crafting System

Combat System

Economy System
```

새로운 Cycle 은 가능한 한 기존 World Semantic 을 실제로 재사용하고 연결해야 한다.

```text
Cycle 001
Mine Stone

Cycle 002
Mine Stone
→ Craft Pickaxe

Cycle 003
Mine Stone
→ Craft Dagger
→ Fight Wolf

Cycle 004
Mine Stone
→ Sell Stone
→ Buy Food
→ Survive
```

즉:

```text
Existing Semantic
       +
New Semantic
       ↓
New Interaction
```

이 발생해야 한다. 이를 Semantic Overlap 원칙으로 둔다.

## 19. Cycle 완료 후 World Baseline 갱신

검증된 Cycle 은 현재 World Baseline 에 병합한다.
World Baseline 은 실제로 구현되고 검증된 세계 의미만 포함한다.

```text
WORLD BASELINE v3

Supported State:
- Actor
- Position
- Knowledge
- Inventory
- ResourceDeposit
- ToolCapability

Supported Rules:
- Move
- Mine
- Craft

Supported Goals:
- AcquireResource
- AcquireTool

Supported Possibilities:
- MineResource
- CraftTool

Observable:
- Current Goal
- Current Possibility
- Preconditions
- Selected Rule
- Before State
- Input
- After State
```

다음 Cycle 은 이 Baseline 위에서 시작한다.

## 20. Evolution Backlog

아직 구현하지 않았지만 장기적으로 필요할 가능성이 있는 의미는 별도로 기록한다.

```text
EVOLUTION BACKLOG

- Multiple Actor contention
- Resource ownership
- Resource regeneration
- Persistence
- Network authority
- Regional simulation
- Economy
- Guild
- Social relationship
- Ecology
```

Backlog 에 존재한다는 이유로 현재 World State 에 placeholder 나 dummy field 를 만들지 않는다.

## 21. Cycle 001 예시 — Mining

Cycle Contract:

```text
Cycle ID:
    CYCLE-001

Capability Added:
    Resource Extraction

Target Horizon:
    Persistent Open World MMORPG

Goal:
    AcquireStone

Possibility:
    MineStone
```

Intent:

```text
광맥을 알고 있고,
Mining Capability 를 가진 Tool 을 가지고 있으며,
광맥에 접근 가능한 Actor 는

Mine 을 실행하여

Deposit 의 Stone 을 감소시키고
자신의 Inventory 에 Stone 을 획득할 수 있다.
```

필요한 World Semantic:

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

Runtime instance 는 작아도 된다.

```text
Arin
Pickaxe01
StoneDeposit01
```

그러나 Semantic Model 은 Arin 전용이나 Stone 전용으로 설계하지 않는다.

## 22. Cycle 001 Observable Proof

Cycle 1 의 완료 여부는 Designer 가 다음을 직관적으로 볼 수 있어야 한다.

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

이 Observable Proof 가 존재해야 인간이:

```text
AcquireStone
→ MineStone
→ Mine Rule
→ World Transition
```

이 실제로 성립했음을 확인할 수 있다.

## 23. Cycle 001 Evolution Compatibility 질문

첫 Cycle 완료 전 최소한 다음을 확인한다.

```text
다른 Actor 도 동일한 Mine Rule 을 사용할 수 있는가?

다른 ResourceType 도 같은 Resource 모델을 사용할 수 있는가?

다른 Tool 이 Mining Capability 를 제공할 수 있는가?

두 Actor 가 같은 Deposit 과 상호작용하는 기능을
추가할 때 기존 Semantic 을 폐기해야 하는가?

Persistence 나 Network Authority 를 추가할 때
Mine 의 세계 의미 자체를 다시 정의해야 하는가?
```

답이 구조적으로 막혀 있다면 Cycle 은 완료되지 않은 것이다.
답을 실제로 구현할 필요는 없다.

## 24. 프로젝트 장기 Context

Agent 가 매번 전체 원본 문서를 읽지 않도록 프로젝트 장기 Context 를 최소화한다.
핵심 문서는 세 개다.

**TARGET-HORIZON** — 최종 방향과 절대적인 구조적 원칙. 변경 빈도가 매우 낮아야 한다.

**WORLD-BASELINE** — 현재까지 실제 구현 및 검증된 World Semantic. Cycle 종료마다 갱신한다.

**CURRENT-CYCLE** — 현재 Cycle 의 Scope 와 Contract. Cycle 종료 후 새로운 Cycle Contract 로 교체한다.

Agent 가 기본적으로 읽는 Context:

```text
TARGET-HORIZON
+
Current Cycle Contract
+
Relevant World Baseline Subset
+
Current Stage Artifact
+
Current Stage Guide
```

전체 World Design 원본 문서는 기본 Context 가 아니다.
필요한 의미를 기존 Artifact 와 Baseline 만으로 판단할 수 없을 때만 fallback reference 로 사용한다.

## 25. Artifact 기반 Handoff

Stage 간 전달은 다음 Artifact Chain 을 따른다.

```text
Cycle Contract
      ↓
Intent Package
      ↓
World Definition Package
      ↓
Semantic Review Result
      ↓
APPROVED World Definition
      ↓
Implementation Result
      ↓
Verification Report
      ↓
Evolution Compatibility Result
      ↓
World Baseline Update
```

Artifact 가 Stage 사이의 API 다.
Agent 가 이전 Stage 의 대화를 알아야 정상 작동한다면 Workflow 설계가 잘못된 것이다.

## 26. Cycle 완료 정의

Cycle 은 코드가 동작한다고 완료되는 것이 아니다.
다음이 모두 참이어야 한다.

```text
[ ] Cycle Scope 가 명확하다.
[ ] Goal / Possibility Trace 가 존재한다.
[ ] Intent 가 명확하다.
[ ] Intent 의 모든 의미가 World State / Rule 에 존재한다.
[ ] World Rule 에 의한 실제 Transition 이 발생한다.
[ ] Transition 이 Observable 하다.
[ ] 인간이 설계 언어로 결과를 확인할 수 있다.
[ ] Runtime 에서 Design 까지 역추적할 수 있다.
[ ] 새로운 Semantic 이 기존 Baseline 과 연결된다.
[ ] 현재 구현이 Target Horizon 을 구조적으로 막지 않는다.
[ ] 검증된 결과가 World Baseline 에 병합되었다.
```

하나라도 실패하면 Cycle 은 완료되지 않는다.

## 27. Agent 가 반드시 지켜야 하는 규칙

```text
RULE 1
ONE INVOCATION = ONE STAGE.

RULE 2
다음 Stage 를 자동으로 실행하지 않는다.

RULE 3
Agent 사이에는 reasoning 이 아니라 Artifact 를 전달한다.

RULE 4
Human Semantic Review 없이 Implementation 으로 진행하지 않는다.

RULE 5
설계 의미가 부족하면 추측하지 않고 DESIGN GAP 을 만든다.

RULE 6
현재 Cycle 에 필요하지 않은 미래 기능을 구현하지 않는다.

RULE 7
현재 Cycle 의 편의를 위해 최종 World Model 을 막는
특수한 의미 가정을 만들지 않는다.

RULE 8
확장성을 이유로 미래의 Implementation Mechanism 을
과도하게 추상화하지 않는다.

RULE 9
새 Cycle 은 가능하면 기존 Semantic 을 실제로 재사용한다.

RULE 10
Cycle 완료는 State → Rule → Transition → Observable 이
하나의 닫힌 의미 단위로 검증된 상태를 의미한다.

RULE 11
검증된 Semantic 만 World Baseline 에 추가한다.

RULE 12
전체 원본 문서는 기본 입력이 아니라 fallback reference 다.
```

## 28. 최종 정의

이 프로젝트의 개발 방식은 다음 한 문장으로 정의한다.

> Open World MMORPG 라는 장기 Target Horizon 을 유지하면서, 매 Cycle 마다 최소한의
> World Capability 를 선택하고 이를
> `Goal/Possibility → Intent → World State → World Rule → Runtime Transition → Observable Verification`
> 까지 완전히 닫아 검증한 뒤 World Baseline 에 누적한다.
> 각 Cycle 은 작게 구현하되 현재의 의미 모델이 미래 확장을 구조적으로 막지 않는지
> Evolution Compatibility 를 검사하며, 각 Stage 는 독립적인 Agent 작업으로 수행하고
> Stage 간에는 대화가 아니라 명시적인 Artifact 만 전달한다.
