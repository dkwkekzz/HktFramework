# Design-AgentExecution.md

AI Agent Cycle Execution Environment
— Architecture, Skills, Sessions, Artifacts, Orchestration, and Project Bootstrap Guide

이 문서는 Cycle-Based Observable World & GameView Development Workflow
([Design-CycleWorkflow.md](Design-CycleWorkflow.md))를
AI Agent가 실제로 실행할 수 있는 프로젝트 작업 환경으로 변환하기 위한
**최종 운영 및 환경 구축 기준 문서**다.

이 문서의 목적은 단순히 Workflow를 설명하는 것이 아니라,
다른 AI Agent가 이 문서만 읽고 다음을 수행할 수 있게 하는 것이다.

- 프로젝트 Agent 작업 환경을 구축한다.
- Skill / Task / Session / Artifact / Registry 체계를 만든다.
- Cycle Orchestrator를 구성한다.
- 하나의 Cycle을 여러 독립 Agent Session으로 실행한다.
- World / GameView / Integration 경계를 유지한다.
- 검증을 통과한 Capability를 다음 Cycle에서 재사용 가능하게 축적한다.

## 0. 문서의 위치

이 문서는 기존 게임 개발 Workflow를 대체하지 않는다.

기존 Workflow는 다음을 정의한다.

```
WHAT THE GAME DEVELOPMENT PROCESS MEANS

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

본 문서는 그 Workflow 위에 다음 Layer를 추가한다.

```
HOW AI AGENTS EXECUTE THE WORKFLOW

Workflow
    ↓
Agent Execution Layer
    ↓
Skill / Task / Session / Artifact / Verifier / Registry / Orchestrator
```

따라서 관계는 다음과 같다.

```
Game Development Workflow
        =
게임 의미와 개발 공정의 Source of Truth

Agent Execution Environment
        =
그 공정을 AI Agent가 반복 가능하고 검증 가능하게 실행하는 방법
```

## 1. 최종 전체 Architecture

가장 중요한 최종 구조는 다음과 같다.

```
══════════════════════════════════════════════════════════════════
                         HUMAN / USER
══════════════════════════════════════════════════════════════════
                              │
                         Cycle Goal
                              │
                              ▼
╔════════════════════════════════════════════════════════════════╗
║                    AGENT EXECUTION LAYER                       ║
║                                                                ║
║   ┌────────────────────────────────────────────────────────┐   ║
║   │                CYCLE ORCHESTRATOR                      │   ║
║   │                                                        │   ║
║   │  - cycle_state 관리                                    │   ║
║   │  - 다음 Task 결정                                      │   ║
║   │  - Worker Session 생성                                 │   ║
║   │  - Verification Gate 평가                              │   ║
║   │  - Failure Routing                                     │   ║
║   │  - Contract Freeze / Version 관리                      │   ║
║   │  - Cycle Commit                                        │   ║
║   └───────────────────────┬────────────────────────────────┘   ║
║                           │                                    ║
║                     Task Envelope                              ║
║                           │                                    ║
║       ┌───────────────────┼───────────────────┐                ║
║       │                   │                   │                ║
║       ▼                   ▼                   ▼                ║
║   ┌─────────┐        ┌──────────┐       ┌──────────┐           ║
║   │ Skill   │        │ Session  │       │ Verifier │           ║
║   │ Library │        │ Runner   │       │ Runner   │           ║
║   └─────────┘        └──────────┘       └──────────┘           ║
║       │                   │                   │                ║
║       └───────────────────┼───────────────────┘                ║
║                           ▼                                    ║
║                    Artifact Store                              ║
║                           │                                    ║
║                           ▼                                    ║
║                       Registries                               ║
║            Semantic / Module / Contract Registry               ║
╚═══════════════════════════╤════════════════════════════════════╝
                            │
                            ▼
══════════════════════════════════════════════════════════════════
                       WORLD WORKFLOW
══════════════════════════════════════════════════════════════════
Cycle Scope
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / World Rule
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

══════════════════════════════════════════════════════════════════
                       CONTRACT BOUNDARY
══════════════════════════════════════════════════════════════════
              Observable Contract
              GameView Specification
                   [VERSIONED + FROZEN]

                  ┌─────────┴─────────┐
                  ▼                   ▼
════════════════════════       ════════════════════════
     WORLD BRANCH                    GAMEVIEW BRANCH
════════════════════════       ════════════════════════
World Implementation            Specification Resolution
World Verification              Visual Composition
World Capability Module         Asset Resolution
                                Observable Binding
                                GameView Implementation
                                GameView Verification
                                GameView Module

                  └─────────┬─────────┘
                            ▼
══════════════════════════════════════════════════════════════════
                     INTEGRATION WORKFLOW
══════════════════════════════════════════════════════════════════
World Capability Module
        +
GameView Module
        +
World Configuration
        ↓
Playable Composition
        ↓
End-to-End Verification
        ↓
Playable Build
        ↓
Playable Cycle Complete
        ↓
Module / Semantic / Contract Registry Update
        ↓
Next Cycle
```

이 구조가 프로젝트의 최종 기준이다.

## 2. 절대 유지해야 하는 Architecture Rules

Agent는 편의를 위해 아래 규칙을 변경해서는 안 된다.

### Rule 1 - Design Source of Truth

```
Human Design
    ↓
Goal / Possibility
    ↓
Intent
    ↓
World State / World Rule
```

Goal/Possibility와 Intent가 게임 의미의 최상위 Source of Truth다.

### Rule 2 - Semantic Closure

Intent의 모든 의미는 World State 또는 World Rule로 표현되어야 한다.

### Rule 3 - Authoritative World

실제 World Semantic 상태 변화는 Authoritative World Rule을 통해서만 발생한다.

### Rule 4 - Command Boundary

Client는 상태 변경 결과를 보내지 않는다.

```
WRONG
Client: Stone += 1

RIGHT
Client: Mine(Player01, Deposit01)
```

Client는 행동 의도만 전달한다.

### Rule 5 - Observer Projection

Player / Designer / AI 등의 Observer는 World 내부 구현을 직접 읽지 않는다.

```
Authoritative World
        ↓
Observer Projection
        ↓
Observable World
```

### Rule 6 - Observable is Semantic

Observable은 Network Packet이나 Serialization Format이 아니다.

```
Observable Semantic ≠ Replication Representation
```

### Rule 7 - GameView Isolation

GameView가 소비할 수 있는 World 정보는 오직 다음이다.

- Observable Contract
- GameView Specification

### Rule 8 - Presentation Independence

GameView Specification은 다음을 정의하지 않는다.

- Mesh / Animation Clip / Shader / Material
- Widget Framework / UI Pixel Position
- Asset Path / Renderer

### Rule 9 - Integration Independence

World와 GameView의 실제 결합은 별도 Integration Workflow가 담당한다.

### Rule 10 - Module Reuse

완료된 Module은 후속 Cycle에서 다시 구현하지 않는다.

### Rule 11 - Shared World Semantic

Capability별 별도 World Semantic을 만들지 않는다.

```
WRONG
MiningInventory / CraftingInventory / TradeInventory

RIGHT
                  WORLD
                    │
        ┌───────────┼───────────┐
        │           │           │
      Mining     Crafting     Trade
        │           │           │
        └───────────┼───────────┘
                    │
                 Inventory
```

### Rule 12 - Transport Independence

Local Call / IPC / Network / Serialization / Replication은
World Semantic을 변경하지 않는 Implementation Detail이다.

### Rule 13 - Playable Verification

모든 Cycle은 실제 Cycle Goal을 플레이 가능한 형태로 검증하고 종료한다.

## 3. Agent Execution의 핵심 개념

Agent 환경에서는 다음 개념을 엄격히 분리한다.

| 개념 | 정의 |
|---|---|
| Cycle | 하나의 작은 플레이 목표를 완성하는 전체 상태 머신 |
| Stage | 원본 Development Workflow의 의미적 단계 |
| Task | Stage를 실행하기 위해 Orchestrator가 만든 구체 작업 단위 |
| Skill | 특정 종류의 Task를 수행하는 재사용 가능한 HOW |
| Session | 하나의 Task를 처리하는 격리된 실행 Context |
| Artifact | Session이 생성하는 공식 결과물 |
| Verifier | Artifact / Runtime 결과가 Gate를 통과하는지 평가 |
| Registry | Cycle을 넘어 유지되는 프로젝트 Source of Truth |
| Orchestrator | 위 요소들을 연결하는 Control Plane |

압축하면:

```
Stage
  ↓
Task
  ↓
Skill + Inputs + Permissions
  ↓
Isolated Session
  ↓
Artifact
  ↓
Verification Gate
  ↓
PASS
  ↓
Next Stage
```

## 4. Skill의 의미

Skill은 Agent 자체가 아니다.

Skill은 다음 질문에 답한다.

> "이 종류의 작업은 어떻게 수행해야 하는가?"

예: `world-semantic-design`

Skill은 World Semantic Design 작업을 수행할 때의
입력 / 절차 / 금지사항 / 출력 / 검증 기준 / 필요한 Reference / 필요한 Script를 정의한다.

Skill은 현재 Cycle 상태를 기억하지 않는다.

```
Skill = HOW
Task  = WHAT
State = WHERE
```

## 5. Skill과 Session의 관계

예:

```
Skill:   world-semantic-design
Task:    C001-SEMANTIC-001
Session: SESSION-C001-SEMANTIC-001

Input:
  intent.yaml
  semantics.yaml
  modules.yaml

Output:
  semantic_delta.yaml
  world_rules.yaml
  intent_trace.yaml
```

관계:

```
                  reusable
          ┌─────────────────────┐
          │ world-semantic-design
          │       Skill
          └──────────┬──────────┘
                     │ apply
                     ▼
          ┌─────────────────────┐
          │ Task C001-SEMANTIC
          └──────────┬──────────┘
                     │ execute
                     ▼
          ┌─────────────────────┐
          │ Isolated Session
          └──────────┬──────────┘
                     │
                     ▼
                  Artifacts
```

하나의 Skill은 여러 Cycle에서 반복 사용된다.

## 6. Session 모델

### 6.1 기본 원칙

**One Session = One Task Transaction**

- Session은 가능하면 하나의 책임만 가진다.
- Session이 끝난 뒤 대화 Context는 버릴 수 있어야 한다.

남겨야 하는 것은:

- Task
- Artifact
- Verification Result
- Handoff Result
- Runtime Evidence

다음 Session이 이전 Session의 대화 기록을 필요로 해서는 안 된다.

### 6.2 Coding Session

Coding Task에서는 하나의 Session 내부에서 다음은 가능하다.

```
inspect → edit → build → test → fix → re-test
```

하지만 다음은 불가능하다.

- World Engineer가 Intent 변경
- GameView Engineer가 Observable Contract 변경
- Verifier가 구현을 편의상 수정
- Integration Agent가 World Rule 변경

Task Boundary를 넘는 변경은 새로운 Task를 생성해야 한다.

## 7. Orchestrator 모델

Orchestrator는 장기 Cycle Context를 관리한다.
그러나 게임 설계를 직접 하지 않는다.

### Orchestrator 책임

```
START_CYCLE
READ cycle_state
SELECT next Task
RESOLVE required Skill
BUILD Task Envelope
START isolated Session
WAIT for Task Result
RUN Verification
CLASSIFY PASS / FAIL
ROUTE Failure
FREEZE Contract
COMMIT Artifacts
REGISTER Modules
COMPLETE Cycle
```

### Orchestrator가 하면 안 되는 것

- Intent 직접 설계
- World Rule 직접 설계
- GameView Visual 설계
- Worker 결과를 임의로 PASS
- Registry 내용을 대화 기억으로 추정
- Contract Gap을 World 접근으로 우회
- Frozen Module을 직접 수정

## 8. 원본 17 Stage와 Agent Task 대응

원본 Workflow의 Stage를 삭제하지 않는다.
Agent Layer에서는 각 Stage를 다음 Task로 실행한다.

| Original Stage | Agent Task / Skill | Primary Output | Gate |
|---|---|---|---|
| Stage 1 Cycle Scope | `cycle-scope` | cycle_scope.yaml | Scope Gate |
| Stage 2 Intent Design | `intent-design` | Goal/Possibility, Intent | Intent Gate |
| Stage 3 World Semantic Design | `world-semantic-design` | Semantic Delta, State, Rules | Semantic Closure |
| Stage 4 Authority Design | `authority-design` | Authority / Command Contract | Authority Closure |
| Stage 5 Observation Design | `observation-design` | Observable Contract | Observable Closure |
| Stage 6 GameView Specification | `gameview-spec-design` | GameView Spec | Contract Gate |
| Stage 7 World Implementation | `world-implement` | World Runtime Code | Build/Test |
| Stage 8 World Verification | `world-verify` | World Verification Result | World Complete |
| Stage 9 Specification Resolution | `gameview-spec-resolve` | Visual Requirements | Spec Resolution |
| Stage 10 Visual Composition | `gameview-composition` | Composition | Composition Gate |
| Stage 11 Asset Resolution | `gameview-asset-resolve` | Asset Bindings | Asset Gate |
| Stage 12 Observable Binding | `gameview-binding` | Observable Bindings | Binding Gate |
| Stage 13 GameView Implementation | `gameview-implement` | Renderer Implementation | Build/Test |
| Stage 14 GameView Verification | `gameview-verify` | View Verification | GameView Complete |
| Stage 15 Integration | `integration` | Playable Composition | Integration Gate |
| Stage 16 Playable Verification | `playable-verify` | E2E Result | Playable Complete |
| Stage 17 Module Packaging | `module-package` | Frozen Modules / Registry | Cycle Commit |

실제 초기 구현에서는 여러 Stage를 한 Agent가 담당할 수 있다.
그러나 Artifact와 Gate는 유지한다.

예:

```
World Design Agent
    ├─ Stage 1
    ├─ Stage 2
    ├─ Stage 3
    ├─ Stage 4
    ├─ Stage 5
    └─ Stage 6
```

Agent가 하나여도 각 Stage 결과는 독립 Artifact로 남긴다.

## 9. Mature Agent 구성

Workflow가 안정된 이후 권장 구성:

```
                         USER
                          │
                     Cycle Goal
                          │
                          ▼
                ┌───────────────────┐
                │ Cycle Orchestrator│
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │ A1 Scope Agent    │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ A2 Intent Agent   │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ A3 Semantic Agent │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ Semantic Verifier │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ A4 Authority Agent│
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │A5 Observation Ag. │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ A6 GV Spec Agent  │
                └─────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ Contract Verifier │
                └─────────┬─────────┘
                          │
                    CONTRACT FREEZE
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
    ┌───────────────────┐    ┌────────────────────┐
    │ A7 World Engineer │    │ A9 GameView Design │
    └─────────┬─────────┘    └──────────┬─────────┘
              ▼                         ▼
    ┌───────────────────┐    ┌────────────────────┐
    │ A8 World Verifier │    │A10 GameView Engineer│
    └─────────┬─────────┘    └──────────┬─────────┘
              │                         ▼
              │              ┌────────────────────┐
              │              │A11 GameView Verifier│
              │              └──────────┬─────────┘
              └──────────────┬──────────┘
                             ▼
                   ┌───────────────────┐
                   │ A12 Integration   │
                   └─────────┬─────────┘
                             ▼
                   ┌───────────────────┐
                   │ A13 Playable QA   │
                   └─────────┬─────────┘
                             ▼
                   ┌───────────────────┐
                   │ A14 Packager      │
                   └─────────┬─────────┘
                             ▼
                      Module Registry
                             │
                         Next Cycle
```

## 10. Minimum Viable Agent 구성

처음부터 모든 Agent를 분리할 필요는 없다.

초기 구성:

1. Cycle Orchestrator
2. World Design Agent (Scope / Intent / Semantic / Authority / Observation / GameView Spec)
3. World Engineer
4. World Verifier
5. GameView Agent (Design / Asset / Binding / Implementation)
6. Integration / Playable Verifier

단 다음은 초기에도 분리할 것을 권장한다.

```
Generator ≠ Verifier
```

## 11. Repository 최종 구조

```
/project
│
├─ README.md
│
├─ design/
│   ├─ architecture-rules/
│   │   ├─ world.md
│   │   ├─ authority.md
│   │   ├─ observation.md
│   │   ├─ gameview.md
│   │   └─ integration.md
│   └─ goals/
│
├─ orchestration/
│   ├─ schemas/
│   │   ├─ cycle_state.schema.yaml
│   │   ├─ task.schema.yaml
│   │   ├─ verification_result.schema.yaml
│   │   ├─ handoff_result.schema.yaml
│   │   ├─ contract_gap.schema.yaml
│   │   └─ migration_request.schema.yaml
│   ├─ runner/
│   │   ├─ orchestrator.*
│   │   ├─ session_runner.*
│   │   └─ verifier_runner.*
│   └─ routing/
│       └─ failure_routes.yaml
│
├─ skills/
│   ├─ cycle-scope/
│   ├─ intent-design/
│   ├─ world-semantic-design/
│   ├─ semantic-closure-verify/
│   ├─ authority-design/
│   ├─ observation-design/
│   ├─ gameview-spec-design/
│   ├─ contract-verify/
│   ├─ world-implement/
│   ├─ world-verify/
│   ├─ gameview-spec-resolve/
│   ├─ gameview-composition/
│   ├─ gameview-asset-resolve/
│   ├─ gameview-binding/
│   ├─ gameview-implement/
│   ├─ gameview-verify/
│   ├─ integration/
│   ├─ playable-verify/
│   └─ module-package/
│
├─ registry/
│   ├─ semantics.yaml
│   ├─ modules.yaml
│   └─ contracts.yaml
│
├─ contracts/
│   ├─ commands/
│   ├─ observable/
│   └─ gameview-spec/
│
├─ modules/
│   ├─ world/
│   │   ├─ core/
│   │   ├─ mining/
│   │   │   └─ v1/
│   │   └─ ...
│   └─ gameview/
│       ├─ mining/
│       │   └─ v1/
│       └─ ...
│
├─ cycles/
│   ├─ CYCLE-001/
│   │   ├─ cycle_state.yaml
│   │   ├─ goal.yaml
│   │   ├─ tasks/
│   │   ├─ artifacts/
│   │   │   ├─ scope/
│   │   │   ├─ intent/
│   │   │   ├─ world-design/
│   │   │   ├─ contracts/
│   │   │   └─ verification/
│   │   ├─ world/
│   │   │   ├─ implementation_package.yaml
│   │   │   └─ verification_result.yaml
│   │   ├─ gameview/
│   │   │   ├─ visual_requirements.yaml
│   │   │   ├─ composition.yaml
│   │   │   ├─ asset_bindings.yaml
│   │   │   ├─ observable_bindings.yaml
│   │   │   └─ verification_result.yaml
│   │   ├─ integration/
│   │   │   ├─ composition.yaml
│   │   │   ├─ e2e_trace.yaml
│   │   │   └─ verification_result.yaml
│   │   └─ logs/
│   │       └─ session-index.yaml
│   └─ ...
│
├─ scripts/
│   ├─ validation/
│   ├─ build/
│   └─ test/
│
└─ source/
    └─ actual game source / engine project
```

`cycles/<id>`는 해당 Cycle을 대화 기록 없이 재개할 수 있는 실행 로그다.

## 12. Registry 구조

세 Registry를 분리한다.

- Semantic Registry
- Module Registry
- Contract Registry

### 12.1 Semantic Registry

World 의미의 전역 Source of Truth.

```yaml
semantics:
  Actor:
    kind: ENTITY
    status: ACTIVE
    defined_by: core-world
  Position:
    kind: STATE
    status: ACTIVE
    defined_by: core-world
  Inventory:
    kind: STATE
    status: ACTIVE
    defined_by: core-world
  Knowledge:
    kind: STATE
    status: ACTIVE
    defined_by: core-world
```

World Semantic Agent는 새 의미를 정의하기 전에 반드시 이 Registry를 검색한다.

```
Required Semantic
       ↓
Semantic Registry Query
       ↓
Exists?
  ┌────┴────┐
 YES        NO
  │          │
Reuse    Semantic Delta
```

### 12.2 Module Registry

완료된 Capability를 Cycle 사이에서 공유한다.

```yaml
modules:
  mining-world-v1:
    type: WORLD_CAPABILITY
    version: 1
    status: FROZEN
    requires:
      - Actor
      - Position
      - Inventory
      - Knowledge
      - Tool
      - ResourceDeposit
    provides:
      possibilities:
        - MineResource
      rules:
        - RULE-MINE-001
      observables:
        - MineAvailability
        - ResourceTransition

  mining-view-v1:
    type: GAMEVIEW
    version: 1
    status: FROZEN
    consumes:
      - OBS-MINING-V1
    implements:
      - VIEW-MINING-001
```

### 12.3 Contract Registry

```yaml
contracts:
  CMD-MINE-V1:
    type: COMMAND
    version: 1
    status: FROZEN
  OBS-MINING-V1:
    type: OBSERVABLE
    version: 1
    status: FROZEN
    path: contracts/observable/OBS-MINING-V1.yaml
  VIEW-MINING-001:
    type: GAMEVIEW_SPEC
    version: 1
    status: FROZEN
    path: contracts/gameview-spec/VIEW-MINING-001.yaml
```

## 13. Skill Directory

Generic Agent Runtime에서 권장하는 구조:

```
skills/world-semantic-design/
├─ SKILL.md
├─ references/
│  ├─ semantic-rules.md
│  ├─ world-state-vs-implementation.md
│  └─ examples.md
└─ scripts/
   └─ validate_semantic_trace.*
```

실제 Skill Runtime 형태로 패키징할 경우에는 해당 Skill Runtime의 필수 metadata 구조를 추가한다.

핵심 원칙은 동일하다.

```
SKILL.md     = Control Plane
references/  = 필요할 때만 읽는 상세 지식
scripts/     = deterministic 작업
assets/      = 출력용 정적 자산
```

Skill은 Context를 작게 유지하기 위해 필요한 자료만 점진적으로 로드한다.

## 14. Skill 작성 규칙

예: `world-semantic-design/SKILL.md`

```markdown
# World Semantic Design

## Purpose
Resolve Cycle Intent into shared World State and World Rules.

## Required Inputs
- Intent Artifact
- Semantic Registry
- Module Registry

## Procedure
1. Read the Intent.
2. Extract every semantic statement.
3. Query Semantic Registry for each required semantic.
4. Reuse existing semantic whenever possible.
5. Add only missing semantics as Semantic Delta.
6. Define World State only for world facts.
7. Define World Rule as allowed semantic state transitions.
8. Build Intent -> State / Rule trace.

## Never
- create capability-specific duplicates
- place cache/thread/network state into World State
- modify Intent for implementation convenience
- inspect GameView internals

## Required Outputs
- semantic_dependencies.yaml
- semantic_delta.yaml
- world_state.yaml
- world_rules.yaml
- intent_trace.yaml

## Completion
Every Intent semantic must resolve to State or Rule.
```

## 15. Task Envelope

모든 Worker Session은 반드시 Task Envelope로 시작한다.

```yaml
task:
  id: C001-SEMANTIC-001
  cycle_id: C001
  stage: WORLD_SEMANTIC_DESIGN
  skill: world-semantic-design
  objective: >
    Resolve Cycle Intent into shared World State and World Rules.
  allowed_inputs:
    - cycles/C001/artifacts/intent/intent.yaml
    - registry/semantics.yaml
    - registry/modules.yaml
  read_scope:
    - registry/
    - cycles/C001/artifacts/intent/
    - modules/world/*/public-contract/
  write_scope:
    - cycles/C001/artifacts/world-design/
  forbidden_scope:
    - modules/gameview/
    - source/gameview/
    - modules/*/*/FROZEN
  required_outputs:
    - semantic_dependencies.yaml
    - semantic_delta.yaml
    - world_state.yaml
    - world_rules.yaml
    - intent_trace.yaml
  completion_gate:
    type: semantic-closure-verify
  routing:
    pass: AUTHORITY_DESIGN
    fail: WORLD_SEMANTIC_REWORK
```

항상 다음 6개가 존재해야 한다.

```
Skill + Task + Input + Permission + Output + Completion Gate
```

## 16. Session Command Protocol

Agent Runner가 어떤 기술을 사용하든 논리적 명령은 동일하다.

### 16.1 Cycle 명령

`START_CYCLE / RESUME_CYCLE / ADVANCE_CYCLE / PAUSE_CYCLE / COMPLETE_CYCLE`

### 16.2 Task 명령

`CREATE_TASK / RUN_SKILL / RETRY_TASK / CANCEL_TASK`

### 16.3 Contract 명령

`PROPOSE_CONTRACT / VERIFY_CONTRACT / FREEZE_CONTRACT / REQUEST_CONTRACT_CHANGE / VERSION_CONTRACT`

### 16.4 Registry 명령

`QUERY_SEMANTIC / QUERY_MODULE / QUERY_CONTRACT / REGISTER_SEMANTIC / REGISTER_MODULE / REGISTER_CONTRACT`

### 16.5 Module 명령

`FREEZE_MODULE / REQUEST_EXTENSION / REQUEST_VERSION_MIGRATION`

## 17. Abstract RUN_SKILL 명령

```
RUN_SKILL world-semantic-design

TASK_ID:   C001-SEMANTIC-001
CYCLE_ID:  C001

OBJECTIVE:
  Resolve Cycle Intent into shared World State and World Rules.

INPUT:
  - intent.yaml
  - registry/semantics.yaml
  - registry/modules.yaml

READ_SCOPE:
  - approved world design artifacts
  - module public contracts

WRITE_SCOPE:
  - cycles/C001/artifacts/world-design/

FORBIDDEN:
  - GameView source
  - frozen module modification
  - Intent modification

OUTPUT:
  - semantic_dependencies.yaml
  - semantic_delta.yaml
  - world_state.yaml
  - world_rules.yaml
  - intent_trace.yaml

COMPLETE_WHEN:
  semantic-closure verifier passes
```

구현 기술에 따라 CLI / API 등 다양한 형태가 될 수 있다.
중요한 것은 명령 형식이 아니라 **Task Contract**다.

## 18. cycle_state.yaml

Cycle의 현재 상태는 대화가 아니라 파일로 유지한다.

```yaml
cycle:
  id: C001
  goal: >
    Player with a Pickaxe can approach a Stone Deposit
    and obtain Stone by mining.
  status: IN_PROGRESS
  current_stage: WORLD_SEMANTIC_DESIGN
  contract:
    version: null
    frozen: false
  stage_status:
    scope:
      status: PASS
      task: C001-SCOPE-001
    intent:
      status: PASS
      task: C001-INTENT-001
    world_semantic:
      status: IN_PROGRESS
      task: C001-SEMANTIC-001
    authority:
      status: NOT_STARTED
    observation:
      status: NOT_STARTED
    gameview_spec:
      status: NOT_STARTED
    world_implementation:
      status: NOT_STARTED
    world_verification:
      status: NOT_STARTED
    gameview:
      status: NOT_STARTED
    integration:
      status: NOT_STARTED
    playable_verification:
      status: NOT_STARTED
    packaging:
      status: NOT_STARTED
  committed_artifacts:
    - goal.yaml
    - scope.yaml
    - intent.yaml
  pending_failures: []
```

다른 Agent는 cycle_state.yaml만 읽어도 어디서 재개할지 판단할 수 있어야 한다.

## 19. Artifact 원칙

Artifact는 Session 간 공식 통신 수단이다.

```
Session A → Official Artifact → Session B
```

다음은 허용하지 않는다.

```
Session A의 대화 Context → 그대로 Session B에 전달
```

Artifact는 가능하면 Machine-readable 구조로 만든다.
권장: YAML / JSON / source code / test result / trace

## 20. Generator / Verifier 분리

설계나 구현을 만든 Agent가 자기 결과를 최종 승인하지 않는다.

```
Generator Session
        ↓
Artifact
        ↓
Independent Verifier Session
        ↓
PASS / FAIL
```

Verifier에는 Generator의 내부 reasoning을 제공하지 않는다.

Verifier 입력:

- Official Artifacts
- Runtime Evidence
- Test Results
- Expected Contract

### Deterministic 검증 우선

AI 판단이 필요 없는 것은 Script로 검증한다.

예: Schema validation / Build / Unit test / File existence / Trace completeness /
Forbidden import check / Contract reference check / Frozen path write check

Semantic 판단이 필요한 경우만 LLM Verifier를 사용한다.

## 21. Semantic Closure Verification

예:

```
Intent: "Deposit을 알고 있다"
    ↓ Actor.Knowledge                      PASS

"Mining 가능한 도구를 보유한다"
    ↓ Actor.Inventory / Tool.Capability   PASS

"Deposit에 접근 가능하다"
    ↓ Actor.Position / Deposit.Position / InteractionRange   PASS

"Mine 한다"
    ↓ RULE-MINE-001                        PASS

"Stone을 획득한다"
    ↓ Inventory Transition                 PASS
```

하나라도 연결되지 않으면 `SEMANTIC_CLOSURE = FAIL`.

## 22. Authority Closure Verification

모든 Semantic Transition에 대해:

```
Input
  ↓
Authoritative Rule
  ↓
Precondition Result
  ↓
Authoritative Transition
```

을 추적할 수 있어야 한다.

Client가 직접 World State를 변경하면 FAIL이다.

## 23. Observable Closure Verification

Rule 판단과 결과를 이해하기 위해 필요한 World 의미가
적절한 Observer에게 제공되는지 검사한다.

특히 Designer Observer는 다음을 볼 수 있어야 한다.

- Current Goal / Current Possibility / Possibility Availability
- Preconditions / Selected Rule
- Before State / Input / After State
- Failure Reason

단 Designer도 World 내부 객체를 직접 읽지 않는다.

## 24. Contract Boundary

Stage 6 이후 다음 두 Artifact가 공식 Boundary가 된다.

- Observable Contract
- GameView Specification

Contract 검증 PASS 후 **CONTRACT FREEZE**를 수행한다.

예:

```yaml
contract:
  id: CONTRACT-MINING-C001
  version: 1
  observable:
    id: OBS-MINING-V1
  gameview_spec:
    id: VIEW-MINING-001
  status: FROZEN
```

## 25. Contract Freeze 이후 병렬 실행

Contract가 Freeze되면 World와 GameView가 동일한 Version을 기준으로 병렬 진행할 수 있다.

```
               Frozen Contract C001-v1
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
 World Implementation           GameView Workflow
          │                           │
          ▼                           ▼
 World Verification            GameView Verification
          │                           │
          ▼                           ▼
 World Capability Module        GameView Module
          └─────────────┬─────────────┘
                        ▼
                    Integration
```

Contract가 Freeze되기 전에는 병렬 Branch를 시작하지 않는다.

## 26. World Implementation Session

World Coding Agent는 전체 설계 History를 받지 않는다.
다음 Implementation Package만 전달한다.

```
WORLD IMPLEMENTATION PACKAGE
1. Cycle Scope
2. Goal / Possibility
3. Intent
4. Existing Module Dependencies
5. World Semantic Delta
6. World State
7. World Rules
8. Authority Contract
9. Observable Contract
10. Traceability
11. Completion Conditions
```

Coding Skill의 원칙:

```
DO
- inspect allowed dependency module contracts
- implement Semantic Delta
- implement World Rules
- implement Observable Projection
- add tests
- build / test / fix / re-test

DO NOT
- change Intent
- invent undocumented World Semantic
- change Frozen Contract
- implement GameView
- rewrite Frozen Module
```

## 27. World Implementation Handoff

Session 종료 시:

```yaml
implementation_result:
  task_id: C001-WORLD-IMPLEMENT-001
  status: COMPLETE
  changed_files:
    - source/world/MiningRule.*
    - source/world/ResourceDeposit.*
    - source/observation/MiningProjection.*
  implemented_rules:
    - RULE-MINE-001
  implemented_observables:
    - MineAvailability
    - ResourceAmount
    - ActorInventoryStone
    - CurrentAction
  tests:
    passed: 14
    failed: 0
  unresolved: []
```

World Verifier는 이 결과와 공식 Contract를 사용해 독립 검증한다.

## 28. GameView Session 권한

GameView Design Agent 입력:

- Observable Contract
- GameView Specification
- Existing GameView Modules
- Asset Catalog
- GameView Conventions

GameView Agent가 보면 안 되는 것:

- Goal Graph internal structure
- Intent implementation
- World Rule implementation
- Server State / Database / Planner
- Simulation internal objects

GameView Binding은 반드시:

```
Observable Semantic → Rendering State
```

형태여야 한다.

금지:

```
GameView -> MiningSystem.CurrentTarget
GameView -> WorldState.InternalInventory
GameView -> Planner.CurrentNode
```

## 29. GameView Contract Gap Protocol

GameView 작업 중 필요한 Observable이 없다면
World 내부를 읽어 우회해서는 안 된다.

예:

```
Required Visual:
  Actor must face the Deposit currently being mined.

현재 Observable:
  Actor.CurrentAction = Mine   (target이 없다)
```

GameView Session은 작업을 BLOCKED로 종료하고 Proposal을 생성한다.

```yaml
contract_gap:
  id: GAP-C001-GV-001
  source_task: C001-GAMEVIEW-DESIGN-001
  required_visual: >
    Actor faces the Deposit currently being mined.
  missing_observable: Actor.CurrentActionTarget
  reason: >
    CurrentAction identifies Mine but does not identify target.
  blocking: true
```

Routing:

```
GameView
    ↓
CONTRACT_GAP
    ↓
Observation / Contract Review Session
    ↓
Is it valid World Semantic?
        │
   ┌────┴────┐
  YES        NO
   │          │
Extend      Reject /
Observable  Redesign Presentation
   │
Version Contract
   │
Verify
   │
Re-Freeze
   │
Resume GameView
```

## 30. Integration Session

Integration Agent 입력:

- World Capability Module
- GameView Module
- Observable Contract
- GameView Specification
- World Configuration

Integration은 다음 Trace를 검증한다.

```
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

예:

```
Player presses Mine
        ↓
Mine(Player, Deposit)
        ↓
RULE-MINE-001
        ↓
Player.Stone   0 -> 1
Deposit.Amount 10 -> 9
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

Integration 결과로 E2E Trace를 Artifact로 남긴다.

## 31. Playable Verification

Unit Test 통과가 Cycle Complete를 의미하지 않는다.
최종 검증은 Cycle Goal 자체다.

예:

```yaml
scenario:
  id: PLAY-MINING-001
  goal: >
    Player obtains Stone from a Stone Deposit using a Pickaxe.
  setup:
    player:
      inventory:
        Pickaxe: 1
        Stone: 0
    deposit:
      resource:
        Stone: 10
  steps:
    - move_player_to_deposit
    - execute_mine
  expected:
    world:
      player_stone: 1
      deposit_stone: 9
    observable:
      stone_amount: 1
      deposit_amount: 9
    gameview:
      stone_counter: 1
      mining_visual: visible
```

## 32. 세 종류의 Completion

완료 상태를 하나로 합치지 않는다.

```
World Complete
  Intent / State / Rule / Authority / Observable
  Traceability / World Runtime Verification

GameView Complete
  Specification / Composition / Asset Binding
  Observable Binding / Rendering / View Verification

Playable Cycle Complete
  World Complete
  + GameView Complete
  + Integration Verification
  + Playable Goal Verification
```

## 33. Failure Routing

실패 시 단순 retry하지 않는다.
Failure Type을 분류하고 책임 Stage로 Routing한다.

| Failure | Route |
|---|---|
| SCOPE_TOO_LARGE | Cycle Scope |
| INTENT_AMBIGUOUS | Intent Design |
| SEMANTIC_GAP | World Semantic Design |
| SEMANTIC_DUPLICATION | World Semantic Design |
| AUTHORITY_VIOLATION | Authority Design / World Implementation |
| OBSERVABLE_GAP | Observation Design |
| CONTRACT_GAP | Contract Review |
| WORLD_IMPLEMENTATION_BUG | World Engineer |
| WORLD_VERIFICATION_FAIL | World Engineer or Design owner |
| VIEW_SPEC_GAP | GameView Specification |
| VIEW_BINDING_BUG | GameView Engineer |
| GAMEVIEW_VERIFICATION_FAIL | GameView Engineer |
| INTEGRATION_FAILURE | Integration |
| PLAYABLE_GOAL_FAIL | owning Stage based on E2E trace |
| REGRESSION | Module Owner / Migration Workflow |

Correction Flow:

```
FAIL
  ↓
Classify Failure
  ↓
Create Correction Task
  ↓
New Isolated Session
  ↓
Produce Updated Artifact / Implementation
  ↓
Run Relevant Verifier Again
  ↓
PASS
```

## 34. Frozen Module 정책

Cycle Complete 후:

```
World Capability Module = FROZEN
GameView Module         = FROZEN
```

후속 Cycle은 Requires / Provides만 사용한다.

```
New Capability
      ↓
Module Registry Query
      ↓
Existing Provides?
   ┌──────┴──────┐
  YES            NO
   │              │
Reuse        New Capability
```

후속 Cycle에서 Frozen Module 직접 수정은 기본적으로 금지한다.

새 의미가 필요한 경우:

1. New Capability Module
2. Extension Module

을 우선한다.

기존 Semantic 자체가 잘못된 경우에만 `VERSION_MIGRATION_REQUEST`를 생성한다.

```
Mining v1 → explicit migration → Mining v2
```

## 35. Context Permission Matrix

| Agent | Allowed Context | Forbidden / Restricted |
|---|---|---|
| Scope | Cycle Goal, capability summary | source code |
| Intent | Goal, Scope | implementation detail |
| Semantic | Intent, Semantic Registry, Module Registry | GameView internals |
| Authority | World State/Rule | renderer implementation |
| Observation | World Semantic, Observer requirements | network packet detail |
| GV Spec | Observable meaning, Cycle Goal | concrete renderer assets |
| World Engineer | World Implementation Package | GameView source |
| World Verifier | World artifacts, runtime evidence | GameView correctness |
| GV Designer | Observable + GV Spec + asset catalog | World internals |
| GV Engineer | composition, asset binding, observable binding | World internals |
| GV Verifier | Observable fixture, expected visual | World Rule correctness |
| Integration | module contracts, configuration | avoid internals |
| Playable QA | playable build + Cycle Goal | design mutation |
| Packager | verified artifacts | unverified artifacts |

이 Permission은 Prompt 규칙만으로 끝내지 않는다.
가능하면 실제 filesystem read/write scope, tool permission, connector permission으로 강제한다.

## 36. Session Index

Cycle에는 모든 Session 실행 기록을 남긴다.

```yaml
sessions:
  - id: S001
    task: C001-SCOPE-001
    skill: cycle-scope
    result: PASS
  - id: S002
    task: C001-INTENT-001
    skill: intent-design
    result: PASS
  - id: S003
    task: C001-SEMANTIC-001
    skill: world-semantic-design
    result: PASS
  - id: S004
    task: C001-SEMANTIC-VERIFY-001
    skill: semantic-closure-verify
    result: PASS
```

이 기록은 Audit 및 재현성 용도다.

## 37. 하나의 Cycle Session Graph

실제 하나의 Cycle은 다음 형태로 실행된다.

```
CYCLE C001
Goal: Player with Pickaxe mines Stone Deposit.
────────────────────────────────────────────────────────────
S001  cycle-scope             C001-SCOPE-001      PASS  cycle_scope.yaml
S002  intent-design           C001-INTENT-001     PASS  goal_possibility / intent / design_trace
S003  world-semantic-design   C001-SEMANTIC-001   GENERATED
S004  semantic-closure-verify C001-SEMANTIC-VERIFY-001  PASS
S005  authority-design                            PASS
S006  observation-design                          PASS
S007  gameview-spec-design                        PASS
S008  contract-verify                             PASS
EVENT CONTRACT C001-v1 FROZEN
────────────────────────────────────────────────────────────
             PARALLEL BRANCH
WORLD                                  GAMEVIEW
S009 world-implement                   S011 gameview-spec-resolve
S010 world-verify PASS                 S012 gameview-composition
                                       S013 gameview-asset-resolve
                                       S014 gameview-binding
                                       S015 gameview-implement
                                       S016 gameview-verify PASS
WORLD COMPLETE                         GAMEVIEW COMPLETE
             └────────────┬────────────┘
                          ▼
S017 integration      PASS
S018 playable-verify  PASS
S019 module-package   → Mining World Module v1 / MiningView Module v1
EVENT CYCLE C001 COMMITTED → Registry Update → Next Cycle
```

초기 Agent 수가 적은 경우 S011~S016은 한 GameView Session 또는 몇 개 Session으로 묶을 수 있지만,
**논리적 Artifact 경계는 유지한다.**

## 38. Mining C001 상세 실행 예

### User Input

```
Cycle Goal:
Pickaxe를 가진 Player가 Stone Deposit에 접근하여
Mine을 수행하고 Stone을 획득할 수 있다.
```

### Orchestrator

`START_CYCLE C001` → 생성: `cycles/C001/goal.yaml`, `cycle_state.yaml`

### S001 - Scope

```yaml
scope:
  included:
    - movement
    - approach_deposit
    - execute_mine
    - stone_acquisition
  excluded:
    - crafting
    - trade
    - deposit_respawn
    - multiple_resource_types
```

Verifier PASS.

### S002 - Intent

```yaml
goal: AcquireStone
possibility: MineStone
intent:
  id: INTENT-MINING-001
  meaning: >
    Actor that knows a ResourceDeposit,
    owns a Mining-capable Tool,
    and can interact with the Deposit
    may execute Mine.
  result:
    - Deposit resource decreases
    - Actor inventory increases
```

### S003 - Semantic Design

먼저 Registry Query:

```
QUERY_SEMANTIC Actor / Position / Inventory / Knowledge / Tool.Capability / ResourceDeposit
```

결과에 따라 Existing과 Delta를 분리한다.

Rule:

```yaml
rule:
  id: RULE-MINE-001
  input:
    - Actor
    - ResourceDeposit
  preconditions:
    - Actor knows Deposit
    - Actor owns Mining-capable Tool
    - Actor in InteractionRange
    - Deposit ResourceAmount > 0
  transition:
    - Deposit.ResourceAmount -= ExtractAmount
    - Actor.Inventory[ResourceType] += ExtractAmount
```

### S004 - Semantic Closure

모든 Intent 의미를 State/Rule로 추적한다. PASS 후 다음 Stage.

### S005 - Authority

```yaml
authority:
  Actor.Inventory:
    owner: AuthoritativeWorld
    mutable_by:
      - WorldRule
  ResourceDeposit.ResourceAmount:
    owner: AuthoritativeWorld
    mutable_by:
      - WorldRule
```

Command:

```yaml
command:
  id: CMD-MINE-V1
  input:
    - ActorId
    - DepositId
  prohibited_fields:
    - inventory_delta
    - resulting_resource_amount
```

### S006 - Observation

Player Observable:

```
Actor.Position / Actor.Inventory.Stone / Actor.CurrentAction
Visible Deposit / Deposit.ResourceAmount / Mine Availability / Action Result
```

Designer Observable:

```
Current Goal / Current Possibility / Preconditions / Selected Rule
Before State / Input / After State / Failure Reason
```

### S007 - GameView Specification

```
Actor
  Visual Role: Character
  Placement: WorldSpace
  Position Source: Actor.Position

Deposit
  Visual Role: ResourceNode
  Placement: WorldSpace
  Position Source: Deposit.Position

Actor.CurrentAction == Mine        → Visual Meaning: Mining
Deposit.ResourceAmount == 0        → Visual Meaning: Depleted Resource
Actor.Inventory.Stone              → Visual Meaning: Owned Stone Amount
MineStone.Availability == AVAILABLE → Visual Meaning: Interactable Target
```

### S008 - Contract Verify

```
Semantic Closure     PASS
Authority Closure    PASS
Observable Closure   PASS
GV Specification     PASS
```

Event: `FREEZE_CONTRACT C001 v1`

### S009/S010 - World Branch

World Implementation Package를 생성한다.
World Engineer가 구현/빌드/테스트.
World Verifier가 독립 검증. World Complete.

### S011~S016 - GameView Branch

입력은 오직: Observable Contract / GameView Specification / Existing GameView Modules / Asset Catalog

Visual Requirements → Composition → Asset → Binding → Implementation → Verify.
GameView Complete.

### S017 - Integration

E2E:

```
Mine Input → CMD-MINE-V1 → RULE-MINE-001 → World Transition
→ Observer Projection → OBS-MINING-V1 → GameView Binding → Mining Rendering
```

### S018 - Playable Verify

실제 사용자 Goal이 수행 가능한지 확인.

### S019 - Package

등록:

```
Mining World Module v1
MiningView Module v1
CMD-MINE-V1
OBS-MINING-V1
VIEW-MINING-001
new Semantic Delta if any
```

Cycle Complete.

## 39. Orchestrator State Machine

```
START_CYCLE
    ↓
SCOPE → SCOPE_VERIFY
    ↓
INTENT → INTENT_VERIFY
    ↓
WORLD_SEMANTIC → SEMANTIC_VERIFY
    ↓
AUTHORITY → AUTHORITY_VERIFY
    ↓
OBSERVATION → OBSERVABLE_VERIFY
    ↓
GAMEVIEW_SPEC → CONTRACT_VERIFY
    ↓
FREEZE_CONTRACT
    ↓
┌──────────────────────┐
│                      │
▼                      ▼
WORLD_BRANCH       GAMEVIEW_BRANCH
│                      │
WORLD_VERIFY       GAMEVIEW_VERIFY
│                      │
└──────────┬───────────┘
           ▼
       INTEGRATION
           ↓
  INTEGRATION_VERIFY
           ↓
   PLAYABLE_VERIFY
           ↓
    MODULE_PACKAGE
           ↓
    REGISTRY_COMMIT
           ↓
    COMPLETE_CYCLE
```

FAIL 시:

```
FAIL → CLASSIFY → ROUTE TO OWNER → CREATE CORRECTION TASK → NEW SESSION → REVERIFY
```

## 40. Orchestrator Pseudocode

```
function run_cycle(cycle_id):
    state = load_cycle_state(cycle_id)

    while state.status != COMPLETE:
        stage = resolve_next_stage(state)
        task = create_task_for_stage(stage, state)
        validate_task_permissions(task)

        session_result = run_isolated_session(task)
        persist_session_result(session_result)

        if session_result.status == BLOCKED:
            route_blocker(session_result)
            continue

        verification = run_stage_verifier(stage, session_result)
        persist_verification(verification)

        if verification.result == FAIL:
            failure = classify_failure(verification)
            create_correction_task(failure)
            continue

        commit_stage_artifacts(stage)

        if should_freeze_contract(state):
            freeze_contract()

        if world_and_gameview_complete(state):
            advance_to_integration()

        update_cycle_state()

    package_modules()
    update_registries()
    freeze_modules()
    commit_cycle()
```

## 41. Bootstrap 순서

새 Setup Agent는 다음 순서대로 환경을 만든다.

### Step 1 - Existing Project Inspection

확인: Project root / Engine / Build commands / Test commands / Source layout /
Existing modules / Existing shared semantic concepts / Existing UI/GameView layout /
Version control / CI

### Step 2 - Architecture Rules 고정

기존 Workflow의 Architecture Rules를 `design/architecture-rules/`에 기록한다.

### Step 3 - Repository Control Structure 생성

생성: `orchestration/ skills/ registry/ contracts/ cycles/ modules/`

### Step 4 - Registry 초기화

`semantics.yaml / modules.yaml / contracts.yaml`

기존 프로젝트의 재사용 가능한 공개 Semantic / Capability를 등록한다.
**추정해서 등록하지 않는다.**

### Step 5 - Schema 생성

최소: cycle_state / task / verification_result / handoff_result / contract_gap / migration_request

### Step 6 - Minimum Skill Set 생성

최소:

```
cycle-scope
intent-design
world-semantic-design
semantic-closure-verify
contract-design
contract-verify
world-implement
world-verify
gameview-design
gameview-implement
gameview-verify
integration
playable-verify
module-package
```

이후 필요하면 Original Stage 단위로 더 세분화한다.

### Step 7 - Session Runner

구현: Task Envelope loading / Skill loading / Context assembly /
Filesystem permission / Tool permission / Output enforcement / Session result persistence

### Step 8 - Deterministic Verification

가능한 검증을 Script화한다.

Schema / Build / Unit Test / Static rule / Trace completeness /
Forbidden dependency / Frozen path protection

### Step 9 - Orchestrator

구현: State transition / Task creation / Session spawn / Verifier invoke /
Failure routing / Contract freeze / Cycle completion

### Step 10 - Frozen Protection

Frozen Contract write protection / Frozen Module write protection

### Step 11 - Mining C001 Dry Run

본 문서의 Mining 예로 전체 Pipeline을 Dry Run한다.

### Step 12 - Environment Verification

다음이 모두 가능해야 한다.

- Cycle resume without chat
- Task execution from artifact only
- World/GameView context isolation
- Independent verification
- Contract freeze
- Failure routing
- Module reuse
- Registry update

그 후 실제 Cycle을 시작한다.

## 42. Environment Definition of Done

1. Cycle Goal 하나로 새 Cycle을 생성할 수 있다.
2. cycle_state.yaml만으로 현재 진행 상태를 복구할 수 있다.
3. 모든 Worker Session에는 Task Envelope가 있다.
4. 모든 Skill은 재사용 가능하고 stateless하다.
5. Skill은 HOW만 포함하고 현재 Cycle 상태를 포함하지 않는다.
6. Session 사이에는 Chat Transcript가 아니라 Artifact가 전달된다.
7. 모든 World Semantic Design은 Registry lookup-first다.
8. Shared Semantic duplicate 생성이 방지된다.
9. Generator와 Verifier가 분리된다.
10. deterministic 검증은 가능한 한 Script가 담당한다.
11. Authority Closure를 검사할 수 있다.
12. Observable Closure를 검사할 수 있다.
13. Observable Contract와 GameView Specification을 version/freeze할 수 있다.
14. Contract Freeze 후 World와 GameView를 병렬 실행할 수 있다.
15. GameView Session은 World 내부 구현을 읽을 수 없다.
16. Contract Gap이 Proposal → Review → Version → Re-Freeze로 처리된다.
17. World Coding Agent는 Implementation Package만으로 작업할 수 있다.
18. Frozen Module 직접 수정이 차단된다.
19. Version Migration은 명시적 요청으로만 가능하다.
20. Integration은 Contract 기반 E2E Trace를 남긴다.
21. Playable Verification이 실제 Cycle Goal을 검사한다.
22. Cycle Complete 시 Module / Semantic / Contract Registry가 갱신된다.
23. 다음 Cycle이 Requires / Provides로 기존 Module을 재사용한다.
24. Cycle 전체를 대화 기록 없이 재현/감사할 수 있다.

## 43. 다른 Agent에게 주는 최종 Bootstrap 명령

다른 Agent가 이 환경을 구성해야 한다면 다음과 같이 지시한다.

> 이 문서를 프로젝트의 Agent Execution Architecture Source of Truth로 사용한다.
>
> 1. 먼저 현재 프로젝트 구조, build/test 방법, 기존 World/GameView 코드를 조사한다.
> 2. 기존 코드를 즉시 대규모로 리팩터링하지 않는다.
> 3. design/orchestration/skills/registry/contracts/cycles/modules 구조를 만든다.
> 4. 기존 프로젝트에서 확인 가능한 Shared Semantic과 Capability를 Registry에 등록한다.
> 5. Task / Cycle State / Verification / Contract Gap Schema를 만든다.
> 6. Minimum Skill Set을 만든다.
> 7. Session Runner와 Permission Boundary를 만든다.
> 8. Orchestrator State Machine을 구현한다.
> 9. Contract Freeze와 Frozen Module Protection을 구현한다.
> 10. Mining C001을 Dry Run하여 모든 Stage, Session, Artifact, Gate, Registry Update를 검증한다.
> 11. 실패가 발생하면 임시 우회 코드를 만들지 말고 Failure Type에 따라 책임 Stage로 Routing한다.
> 12. 환경 Definition of Done을 모두 통과하기 전에는 실제 장기 Cycle 개발을 시작하지 않는다.

## 44. 최종 운영 모델

전체 구조를 가장 압축하면 다음과 같다.

```
                     USER
                      │
                 Cycle Goal
                      │
                      ▼
               ORCHESTRATOR
                      │
                      ▼
                 Stage / Task
                      │
          ┌───────────┼───────────┐
          │           │           │
        Skill      Inputs     Permissions
          │           │           │
          └───────────┼───────────┘
                      ▼
              Isolated Session
                      │
                      ▼
                  Artifact
                      │
                      ▼
                 Verifier
                ┌─────┴─────┐
              FAIL          PASS
                │             │
                ▼             ▼
        Failure Routing   Stage Commit
                │             │
                └──────┬──────┘
                       ▼
                  Cycle State
                       │
                       ▼
                   Next Task
                       │
                       ▼
                ... repeat ...
                       │
                       ▼
               Playable Verify
                       │
                       ▼
                  Module Pack
                       │
                       ▼
                    Registry
                       │
                       ▼
                  Next Cycle
```

World / GameView 관점:

```
Cycle Goal
    ↓
WORLD DESIGN
    ↓
Observable Contract + GameView Specification
    ↓
CONTRACT FREEZE
    ↓
┌───────────────────────────────┐
│                               │
▼                               ▼
WORLD                         GAMEVIEW
Implementation               Design
Verification                 Implementation
Capability Module            Verification
│                               │
└───────────────┬───────────────┘
                ▼
            Integration
                ↓
        Playable Verification
                ↓
          Cycle Commit
                ↓
             Registry
```

Session 관점:

```
Cycle    = Task Transaction Chain
Task     = Skill applied to concrete Inputs under explicit Permissions
Session  = isolated context executing one Task
Artifact = official memory between Sessions
Registry = official memory between Cycles
```

## 45. 최종 원칙

이 프로젝트에서 AI Agent Workflow의 핵심은
"하나의 똑똑한 Agent에게 모든 것을 맡기는 것"이 아니다.

핵심은 다음이다.

```
Small Task
+ Explicit Skill
+ Restricted Context
+ Formal Artifact
+ Independent Verification
+ Deterministic Routing
+ Versioned Contract
+ Reusable Module
```

하나의 Cycle은 여러 독립 Session으로 이루어진 Transaction Chain이다.

각 Session은 재사용 가능한 Skill을
명시된 Input과 Permission 안에서 실행하고,
공식 Artifact를 생성한다.

검증을 통과한 Artifact만 다음 Stage로 Commit된다.

World와 GameView는 Frozen Contract를 경계로 독립적으로 작업한다.
Integration은 두 Module을 Contract로만 연결한다.

Playable Verification을 통과한 결과만
Module Registry에 등록되어 다음 Cycle의 기반이 된다.

이 구조를 유지하면 AI Agent가 장기간 프로젝트를 수행하더라도
대화 기억에 의존하지 않고,
각 작업을 재현하고 검증하고 교체할 수 있으며,
완성된 Capability를 누적하여 최종 Open World MMORPG로 확장할 수 있다.
