# Design-CycleExecution.md

AI Agent Cycle Execution Workflow

## 1. 목적

이 문서는 AI Agent가 전체 `Design-Workflow.md`, `Design-CycleWorkflow.md`를 매 세션마다 다시 읽지 않고도
동일한 개발 원칙에 따라 Cycle 작업을 이어갈 수 있도록 **실제 실행 방식**을 정의한다.

핵심 원칙은 단순하다.

```text
이전 단계 Artifact
        ↓
현재 단계 Agent 작업
        ↓
현재 단계 Artifact
        ↓
다음 단계 Agent
```

Agent 간의 작업 전달은 대화 History가 아니라 Artifact를 통해 이루어진다.

## 2. Agent가 읽는 Context

각 Agent는 기본적으로 다음 세 가지만 읽는다.

```text
1. CLAUDE.md              프로젝트 전체 공통 규칙
2. 현재 Stage Guide        해당 단계에서 어떻게 작업해야 하는가
3. 현재 Cycle의 입력 Artifact  실제 작업 대상
```

필요한 경우에만 관련 Existing Capability Artifact 또는 기존 코드를 추가로 확인한다.

예:

```text
CLAUDE.md
+
guides/world-semantic.md
+
cycles/C012/02-intent.md
+
관련 Inventory Semantic / Rule
```

전체 Design 문서는 일반적인 작업 Context가 아니다.

> 원문에서는 이 역할을 `AGENTS.md`가 맡았다. 이 저장소는 진입 문서를 하나로 두기 위해
> 동일한 내용을 `CLAUDE.md`에 통합했다. 역할과 규칙은 같다.

## 3. 문서 구조

```text
HktAdvProtoH/
├── CLAUDE.md
│
├── design/                     공정·기반 원본 — 팩이 바뀌어도 참인 것만
│   ├── Design-Workflow.md
│   ├── Design-CycleWorkflow.md
│   └── Design-CycleExecution.md
│
├── guides/
│   ├── cycle-definition.md
│   ├── intent.md
│   ├── world-semantic.md
│   ├── gameview-spec.md
│   ├── world-implementation.md
│   ├── view-implementation.md
│   └── verification.md
│
├── engine/                     기반 커널 — 컨텐츠 작업에서 편집하지 않는다
│
├── content/<pack>/             컨텐츠 팩 = 교체 단위
│   ├── design/                 그 팩의 컨텐츠 기획 원본
│   ├── master/
│   ├── cycles/
│   │   ├── C001-movement/
│   │   ├── C002-inventory/
│   │   └── C003-mining/
│   ├── world/
│   ├── view/
│   └── protocol/
│
└── scripts/                    실행 스크립트 (run · scan-motions)
```

Cycle Artifact 와 구현(`world/` `view/` `protocol/`)은 **활성 팩 안**에 있다.
팩을 갈아 끼우면 함께 교체되고, 그 위의 `design/` `guides/` `engine/` 은 그대로다.

각 문서의 역할은 다음과 같다.

```text
Design Documents   전체 Architecture와 Workflow의 원본 설계 (루트 design/)
컨텐츠 기획 원본   그 팩의 세계·전투·아이템·UX 설계 (content/<pack>/design/)
CLAUDE.md          모든 Agent가 반드시 지켜야 하는 공통 규칙
Stage Guide        해당 단계의 작업 방법과 완료 조건
Cycle Artifact     현재 Cycle에서 실제로 결정된 내용
<pack>/world/      실제 Authoritative World 구현
<pack>/view/       실제 Client View 구현
```

## 4. 공통 규칙 문서의 역할

공통 규칙 문서에는 Workflow 전체 설명을 복사하지 않는다.
Agent가 모든 작업에서 지켜야 할 불변 규칙만 둔다.

### Development Model

이 프로젝트는 작은 플레이 가능한 게임 단위인 Cycle을 반복하여
하나의 MMORPG World와 View를 계속 발전시킨다.
모든 Agent 작업은 현재 Cycle의 일부다.

### Artifact Handoff

각 단계는 이전 단계 Artifact를 입력으로 사용하고
자신의 결과를 다음 단계가 사용할 Artifact로 남긴다.
대화 History를 Source of Truth로 사용하지 않는다.

### Follow Stage Guide

모든 Agent는 다음을 기준으로 작업한다.

```text
1. 공통 규칙 문서
2. 현재 Stage Guide
3. 현재 Cycle의 입력 Artifact
```

전체 Design 문서는 특별히 필요한 경우에만 참조한다.

### Preserve Design Meaning

이전 단계에서 확정된 의미를 구현 편의를 위해 임의로 변경하지 않는다.

Intent 변경이 필요하면 Intent 단계로 반환한다.
World Semantic 변경이 필요하면 World Semantic 단계로 반환한다.
GameView Specification에 정보가 부족하면
View가 World 내부를 직접 읽지 않고 Specification 변경을 요청한다.

### Cycle Is a Game Delta

Cycle은 현재 게임에 하나의 플레이 가능한 변화 Delta를 추가한다.

Cycle은:

- 새로운 Capability를 추가할 수 있다.
- 기존 Capability를 확장할 수 있다.
- 기존 Capability를 고도화할 수 있다.
- 필요하면 기존 Semantic이나 Rule을 변경할 수 있다.

무엇이 기존이고 무엇이 변경되었는지는 Artifact에 명확히 기록한다.

### Shared World

각 Cycle은 별도의 World를 만들지 않는다.
모든 Cycle은 동일한 공유 World를 발전시킨다.
기존 Actor, Inventory, Item, Position 등의 Semantic이 있다면
중복 생성하지 않고 재사용한다.

### World / View Boundary

World는 Authoritative Server다.
View는 Client다.
World와 View는 서로의 내부 구현을 직접 참조하지 않는다.
World → View의 공개 계약은 GameView Specification이다.
View는 GameView Specification만으로 화면을 구성할 수 있어야 한다.

### World Authority

Client는 World State를 직접 변경하지 않는다.
Client는 Action을 요청한다.
World가 World Rule을 통해 상태 변화를 결정한다.

### Traceability

다음 연결은 추적 가능해야 한다.

```text
Cycle Goal
→ Goal / Possibility
→ Intent
→ World State / Rule
→ GameView Specification
→ Implementation
→ Verification
```

### Existing Capability Changes

기존 Capability 수정은 허용된다.
단, 모든 Semantic 변경은 현재 Cycle Goal에서 유래해야 한다.
기존 코드의 단순 리팩터링과 게임 의미의 변경을 구분한다.

### Gap Handling

현재 단계의 입력으로 올바른 결과를 만들 수 없다면
필요한 의미를 임의로 만들어내지 않는다.
부족한 내용을 명시하고 그 의미를 책임지는 이전 단계로 반환한다.

### Completion

코드가 실행되는 것만으로 Cycle은 완료되지 않는다.

Cycle Goal이:

- World Semantic으로 존재하고
- World Rule로 실행되며
- GameView Specification으로 표현되고
- View에서 확인되고
- 실제 플레이로 검증되어야 한다.

## 5. Stage Guide의 기본 형식

각 Stage Guide는 짧고 직접적이어야 한다.

공통 구조:

```text
ROLE
INPUT
DO
OUTPUT
MUST
MUST NOT
DONE WHEN
```

Guide가 해당 Stage에 필요한 Design-Workflow 규칙을 압축해서 제공한다.

## 6. Cycle 전체 실행 흐름

```text
Human
  │
  │ Cycle Goal
  ▼
Cycle Definition
  │
  │ 01-cycle.md
  ▼
Intent Agent
  │
  │ 02-intent.md
  ▼
World Model Agent
  │
  │ 03-world-semantic.md
  ▼
GameView Specification Agent
  │
  │ 04-gameview.spec.yaml
  ▼
Human Semantic Review
  │
  ▼
World Implementation Agent
  │
  ▼
View Implementation Agent
  │
  ▼
Verification Agent
  │
  │ 08-verification.md
  ▼
Human Play
  │
  ▼
Cycle Complete
```

Artifact 자체가 Workflow의 진행 기록이 된다.

## 7. Cycle Artifact 구조

```text
cycles/
    C012-inventory-capacity/
        01-cycle.md
        02-intent.md
        03-world-semantic.md
        04-gameview.spec.yaml
        05-review.md
        06-world-implementation.md
        07-view-implementation.md
        08-verification.md
```

과거 Cycle Artifact는 당시의 설계와 결과를 기록하는 History이므로
이후 Cycle에서 수정하지 않는다.

실제 `world/`, `view/` 구현은 이후 Cycle에서 계속 발전할 수 있다.

## 8. Stage 1 — Cycle Definition

Cycle에서 새롭게 가능해질 플레이 경험을 고정한다.

Input

```text
Human Cycle Goal
Relevant Existing Capability
```

Output

```text
01-cycle.md
```

예:

```text
CYCLE
    C012 Inventory Capacity
TYPE
    Existing Capability Enhancement
TARGET CAPABILITY
    Inventory
GOAL
    Inventory에는 저장 가능한 한계가 있고
    공간이 부족하면 Item을 추가로 획득할 수 없다.
INCLUDED
    Inventory Capacity
    Capacity Check
    Acquisition Failure
EXCLUDED
    Weight
    Equipment Slot
    Item Durability
RELATED EXISTING CAPABILITY
    Inventory
    Item Acquisition
```

## 9. Stage 2 — Intent

Guide 예시:

```markdown
# Intent Stage Guide
## Role
Cycle Goal을 Goal / Possibility와 Intent로 변환한다.
## Input
- 01-cycle.md
- 필요한 Existing Capability 의미
## Do
1. Goal을 정의한다.
2. Goal을 달성하는 Possibility를 정의한다.
3. Intent를 추출한다.
4. Intent를 Source Goal / Possibility와 연결한다.
## Output
02-intent.md
## Must
Intent는 세계에서 무엇이 가능하고 무엇이 참이어야 하는지를 표현한다.
## Must Not
클래스, 함수, 서비스, Rendering 등의 구현 방법을 결정하지 않는다.
## Done When
Cycle Goal의 의미가 Goal / Possibility / Intent로 충분히 표현되어 있다.
```

## 10. Stage 3 — World Semantic

World Model Agent는 Intent를 실행 가능한 World Semantic으로 변환한다.

Input

```text
02-intent.md
관련 Existing World Semantic / Rule
```

작업

```text
Intent
    ↓
Existing Semantic 확인
    ↓
World State
    ↓
World Rule
    ↓
Authority
    ↓
Observable Semantic
    ↓
Semantic Closure
```

Output

```text
03-world-semantic.md
```

특히 후속 Cycle에서는 다음 네 구분을 명확히 한다.

```text
REUSED     기존에서 그대로 사용하는 Semantic
ADDED      이번 Cycle에서 새로 추가되는 Semantic
CHANGED    기존 Semantic / Rule 중 변경되는 것
AFFECTED   이번 변경으로 영향을 받는 기존 기능
```

## 11. Stage 4 — GameView Specification

GameView Specification Agent는 World Semantic을 Player Observer에게 필요한 표현 계약으로 변환한다.

Input

```text
03-world-semantic.md
```

Output

```text
04-gameview.spec.yaml
```

GameView Specification에는:

```text
Entity Representation
State Representation
Interaction
HUD
Player에게 공개되는 Observable 의미
```

가 포함될 수 있다.

하지만 다음은 포함하지 않는다.

```text
Sprite filename
Texture path
Three.js object
CSS
React component
Shader
Mesh
Renderer 구현
```

World → View 경계는 GameView Specification 하나다.

## 12. Human Semantic Review

구현 전에 Human은 다음 연결만 확인한다.

```text
Cycle Goal
    ↓
Intent
    ↓
World Semantic
    ↓
GameView Specification
```

검토 질문:

```text
1. 이 World가 내가 원하는 게임 의미를 정확히 표현하는가?
2. 이 GameView Specification만으로
   Player가 그 의미를 이해하고 플레이할 수 있는가?
```

승인 결과:

```text
05-review.md
```

## 13. World Implementation

World Implementation Agent는 `03-world-semantic.md`를 기준으로 실제 Authoritative World를 구현한다.

입력

```text
03-world-semantic.md
관련 기존 World 구현
```

작업 원칙

```text
World State
World Rule
Authority
Projection
```

을 구현한다.

View 구현은 하지 않는다.

결과:

```text
world/ 실제 코드
+
06-world-implementation.md
```

## 14. View Implementation

View Agent에게 World Semantic을 전달하지 않는다.

주요 계약 입력은:

```text
04-gameview.spec.yaml
```

이다.

작업 원칙

```text
GameView Specification
        ↓
Presentation
        ↓
3D Terrain
Sprite Billboard
HUD
Interaction
```

기본 기술 환경:

```text
TypeScript
Web
3D Terrain
Sprite Billboard
```

View가 World 내부 정보가 필요하다고 판단하면 직접 접근하지 않는다.
GameView Specification Gap으로 반환한다.

## 15. Verification

Verification Agent는 다음을 확인한다.

```text
1. Semantic Closure
2. World Rule 실행
3. World → GameView Specification Projection
4. View Binding
5. 현재 Cycle Goal의 실제 플레이
6. 영향을 받은 기존 기능의 Regression
```

출력:

```text
08-verification.md
```

## 16. Cycle은 새로운 기능만 추가하는 것이 아니다

Cycle은 현재 게임에 하나의 플레이 가능한 Delta를 적용하는 단위다.

따라서 두 종류 모두 가능하다.

```text
New Capability              Capability Enhancement
    Mining                      Inventory → Capacity
    Crafting                    Inventory → Stacking
    Trade                       Combat    → Blocking
                                Combat    → Status Effects
```

두 경우 모두 동일한 Workflow를 사용한다.

## 17. 기존 Capability 고도화

이전 Cycle에서 기본 Inventory가 구현되어 있다고 하자.

```text
C005 — Basic Inventory
Actor.Inventory
Inventory.Items
RULE-ADD-ITEM
RULE-REMOVE-ITEM
```

새 Cycle:

```text
C012 — Inventory Capacity
```

Cycle Goal:

```text
Inventory에는 저장 가능한 한계가 있으며
공간이 없으면 Item을 추가할 수 없다.
```

이 경우 새로운 Inventory를 만들지 않는다. 현재 Inventory를 발전시킨다.

```text
Existing Inventory
        +
Capacity Semantic
        +
Capacity Rule
```

## 18. Enhancement Cycle의 Semantic Delta

```text
REUSED
    Actor.Inventory
    Inventory.Items
ADDED
    Inventory.Capacity
    Inventory.UsedCapacity
CHANGED
    RULE-ADD-ITEM
NEW PRECONDITION
    Inventory has sufficient capacity
```

이전 기능의 구현을 수정하는 것은 허용된다.
다만 변경이 현재 Cycle의 Intent에서 추적 가능해야 한다.

## 19. 기존 기능에 미치는 영향도 추적한다

Inventory Capacity를 추가하면 기존 Mining Rule도 영향을 받을 수 있다.

기존:

```text
Mine
    ↓
Actor.Inventory.Stone += 1
```

Capacity가 생긴 이후에는 Inventory에 공간이 없는 경우를 처리해야 한다.

따라서:

```text
AFFECTED EXISTING RULES
    RULE-MINE-001
    RULE-PICKUP-001
    RULE-TRADE-RECEIVE-001
```

처럼 기록한다.

새 Cycle은 단순히 새 코드를 옆에 붙이는 것이 아니라,
새로운 Semantic을 공유 World에 적용하고
그 의미의 영향을 받는 기존 Rule도 함께 발전시킬 수 있다.

## 20. 과거 Cycle과 현재 World의 차이

```text
Cycle Artifact History     과거 기록      변경하지 않는다
Current World / View       현재 게임      후속 Cycle을 통해 계속 변경된다
```

예:

```text
C005 Basic Inventory
        ↓
C012 Inventory Capacity
        ↓
C018 Inventory Equipment
        ↓
C024 Inventory Weight
```

과거 Cycle 디렉터리는 그대로 유지된다.
하지만 실제 구현은 하나다.

```text
world/
    inventory/
```

이 구현은 여러 Cycle을 거치며 계속 발전한다.

## 21. 기존 Capability 탐색

후속 Cycle Agent는 모든 과거 Cycle을 읽을 필요가 없다.
현재 Cycle과 관계있는 기존 Semantic과 Rule만 확인한다.

예:

```text
C012 World Model Agent
읽는 것:
    공통 규칙 문서
    guides/world-semantic.md
    C012/02-intent.md
관련 Existing Semantic:
    Inventory
관련 Rules:
    AddItem
    Mine
    Pickup
```

작업 중 추가 영향 관계를 발견하면 필요한 관련 Artifact나 코드를 추가로 확인한다.

## 22. GameView도 Delta로 발전한다

기존:

```text
Inventory Items
```

새 Capacity Cycle:

```text
REUSED
    Inventory Item Representation
ADDED
    Inventory Capacity Representation
```

예:

```yaml
inventory:
  items:
    source: Actor.Inventory.Items
  capacity:
    used:
      source: Actor.Inventory.UsedCapacity
    maximum:
      source: Actor.Inventory.Capacity
```

View Agent는 기존 Inventory View를 이 명세에 맞게 확장한다.

## 23. View 변경이 필요 없는 Cycle

모든 Cycle이 반드시 View 코드를 변경할 필요는 없다.

GameView Specification에 변화가 없다면:

```text
GAMEVIEW CHANGE
    NONE
```

으로 명시할 수 있다.

마찬가지로:

```text
World
    changed
View
    unchanged
```

도 정상적인 Cycle 결과다.

중요한 것은 현재 Cycle Goal이 실제 플레이에서 검증되는 것이다.

## 24. Regression

후속 Cycle에서 기존 Rule을 변경하면 영향받는 기존 기능도 검증해야 한다.

Inventory Capacity 예:

```text
NEW BEHAVIOR
Inventory has room
    → Item acquisition succeeds
Inventory full
    → Item acquisition fails
```

그리고:

```text
REGRESSION
Mining with available capacity
    → still succeeds
Pickup with available capacity
    → still succeeds
Trade receive with available capacity
    → still succeeds
```

과거 Cycle Verification Scenario는 후속 Cycle에서 Regression Scenario의 기반으로 사용할 수 있다.

## 25. Design Gap

Agent가 현재 Artifact로 올바른 다음 결과를 만들 수 없다면 임의로 의미를 생성하지 않는다.

예:

```text
GAMEVIEW GAP
Required
    현재 Mining 대상 방향을 표현해야 함
Missing
    CurrentActionTarget
Reason
    CurrentAction은 있지만 대상 정보를 알 수 없음
```

그러면 해당 의미를 책임지는 이전 단계로 반환한다.

```text
View
    ↓ Gap
GameView Specification
    ↓
필요하면 World Semantic
```

마찬가지로 World Implementation 중 Semantic이 부족하면 World Model 단계로 반환한다.

## 26. 실제 Agent 명령 형태

Intent Agent:

```text
공통 규칙 문서와 guides/intent.md를 읽어라.
cycles/C012/01-cycle.md를 입력으로 사용한다.
Intent 단계를 수행하고
cycles/C012/02-intent.md를 작성하라.
```

World Model Agent:

```text
공통 규칙 문서와 guides/world-semantic.md를 읽어라.
cycles/C012/02-intent.md와
관련 Existing World Semantic을 확인한다.
World Semantic 단계를 수행하고
cycles/C012/03-world-semantic.md를 작성하라.
```

View Agent:

```text
공통 규칙 문서와 guides/view-implementation.md를 읽어라.
cycles/C012/04-gameview.spec.yaml을
World 계약으로 사용한다.
View를 구현하라.
World 내부 구현을 계약의 대체 수단으로 사용하지 않는다.
```

이 정도면 충분하다.

## 27. 최종 Agent 실행 모델

```text
                  공통 규칙 문서
                        │
                 공통 작업 규칙
                        │
                        ▼
Stage Guide ──────→ Current Agent
                        ▲
                        │
                Previous Artifact
                        │
                        ▼
                  Agent Work
                        │
                        ▼
                   New Artifact
                        │
                        ▼
                    Next Agent
```

Cycle 누적은 다음과 같다.

```text
C001 Movement            → Shared World
C002 Inventory           → Shared World + Inventory
C003 Mining              → Shared World + Inventory + Mining
C012 Inventory Capacity  → Shared World + Evolved Inventory
                           + Capacity-aware Mining
```

## 28. 핵심 원칙

```text
 1. AI Agent는 전체 설계 문서를 매번 읽지 않는다.
 2. 공통 규칙 문서는 프로젝트 전체 공통 불변 규칙을 제공한다.
 3. 각 Stage Guide는 해당 단계의 작업 방법만 제공한다.
 4. 각 Agent는 이전 Artifact를 입력받아 다음 Artifact를 만든다.
 5. Artifact가 Agent 간 Context 전달 수단이다.
 6. Cycle은 기능 Module이 아니라 하나의 플레이 가능한 Game Delta다.
 7. 새 Cycle은 기존 Capability를 재사용하거나 확장하거나 변경할 수 있다.
 8. 과거 Cycle Artifact는 History로 보존한다.
 9. 현재 World와 View는 Cycle을 거치며 계속 발전한다.
10. 기존 Semantic 변경 시 REUSED / ADDED / CHANGED / AFFECTED를 명시한다.
11. 영향을 받는 기존 Rule과 플레이 Scenario도 함께 검증한다.
12. World는 Authoritative Server이고 View는 독립적인 Client다.
13. World → View 계약은 GameView Specification이다.
14. View는 GameView Specification만으로 동작할 수 있어야 한다.
15. 최종 완료 조건은 코드 작성이 아니라 실제 Cycle Goal의 플레이 가능성이다.
```

한 문장으로 정의하면:

각 AI Agent는 공통 규칙 문서와 자기 단계의 짧은 Guide, 이전 단계 Artifact만을 읽고
현재 Cycle의 Game Delta를 설계·구현한 뒤 다음 단계가 사용할 Artifact를 남기며,
이러한 Cycle을 반복하여 하나의 공유 World와 독립적인 View를 지속적으로 발전시킨다.

## 부록. 선행 Design 문서와의 관계

이 문서는 `Design-Workflow.md`와 `Design-CycleWorkflow.md`의 **실행 방식**을 정의한다.
공정의 의미는 그 두 문서가 원본이지만, 다음 두 항목은 이 문서가 대체한다.

| 항목 | Design-CycleWorkflow.md | 이 문서 (적용) |
|---|---|---|
| Cycle Artifact 이름 | §33 — `cycle.md` `intent.md` `world.md` `gameview.spec.json` `verification.md` (5종) | §7 — `01-cycle.md` ~ `08-verification.md` (8종) |
| Implementation 단계 | §19 — Implementation Agent 하나가 world/view 양쪽 산출 | §13·§14 — World Implementation / View Implementation 두 단계, `06` · `07` 분리 |

그 외 항목(Semantic Closure, Observable Closure, Cycle Completion Gate, Architecture Rules)은
`Design-CycleWorkflow.md`가 원본이며 이 문서와 충돌하지 않는다.
