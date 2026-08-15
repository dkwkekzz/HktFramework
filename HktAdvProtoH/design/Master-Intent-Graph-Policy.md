# Master-Intent-Graph-Policy.md

Master Intent Graph 구성 정책 — Constraint 통합

> 이 프로젝트의 Workflow 를 **두 층**으로 나눈다.
>
> ```text
> MASTER LAYER   무엇을 왜 만들 것인가 · 어떤 다른 방법이 있는가 · 어떤 Constraint 아래인가
>                → 지속적으로 자라는 하나의 Graph
>
> CYCLE LAYER    이미 선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다
>                → 기존 8 Stage Cycle Workflow. 변경하지 않는다
> ```
>
> 이 문서는 Master Layer 의 **Source of Truth 정책**이다.
> Cycle Layer 의 원본은 `Design-CycleWorkflow.md` · `Design-CycleExecution.md` 이며
> 이 문서는 그것을 대체하지 않고 **앞에 붙는다**.

---

## 1. 문서 목적

1. 기존 `Goal / Possibility → Intent → World Semantic → Runtime` 구조를 유지한다.
2. Master Design 단계에서 World Cause, Actor, Knowledge/Belief, Goal, Possibility,
   Capability 를 하나의 Typed Graph 로 관리한다.
3. 시스템 목록에서 출발하지 않고 **Actor 의 목적과 가능한 해결 방법에서** 필요한
   Capability 를 발견한다.
4. 게임 전체 또는 특정 영역에 적용되는 **Design Constraint** 를 1급 설계 개념으로 관리한다.
5. Constraint 가 Goal / Possibility / Capability 의 설계 공간을 제한하도록 한다.
6. 반대로 Graph 에서 반복 발견되는 설계 패턴을 Constraint Candidate 로 승격할 수 있게 한다.
7. Human 이 현재 구현 상태를 기준으로 Frontier 를 선택하면 **기존 Cycle Workflow 를 그대로**
   사용한다.
8. Runtime 결과를 World Cause / Actor Motivation / Goal / Possibility / Capability 뿐 아니라
   그 형태를 결정한 Constraint 까지 역추적할 수 있게 한다.

### 왜 이 층이 필요한가

현재 Cycle Workflow 는 Cycle Goal 이 주어진 다음부터 완결적이다.
그러나 **Cycle Goal 자체가 어디서 오는가**에 대한 답이 없다.

Goal 과 Possibility 를 Cycle 안에서 매번 새로 세우면 다음이 일어난다.

```text
Goal 이 Cycle 범위 안에서만 정의된다      → 세계의 원인과 끊어진다
같은 Capability 가 Cycle 마다 재발명된다  → 재사용이 우연에 맡겨진다
Possibility 탐색이 한 방법으로 수렴한다   → 대안이 사라지고 시스템 목록이 된다
설계 원칙이 Cycle 마다 암묵적으로 재해석  → 게임의 정체성이 흔들린다
```

Master Layer 는 이 넷을 Cycle 바깥에 둔다.

---

## 2. 한 문장 정의

> **Master Intent Graph 는 Human 이 정의한 Root Goal, World Premise 와 Design Constraint
> 아래에서 세계의 원인과 상태, Actor 의 지식·믿음·욕망, Actor-owned Goal, Goal 을 달성하는
> 대안적 Possibility, Possibility 가 요구하는 재사용 가능한 Capability, 그리고 선택으로
> 발생하는 World State 변화와 새로운 Knowledge/Goal 을 하나의 Typed Graph 로 연결하는
> 최상위 Design Source of Truth 다.**
>
> **Constraint 는 이 설계 공간에서 무엇이 요구되고, 금지되며, 선호되는지를 정의하고
> Goal/Possibility/Capability 의 생성과 선택을 제한한다. 반대로 Master Graph 에서 반복적으로
> 발견되는 설계 패턴은 Constraint Candidate 가 될 수 있으며 Human 승인 후 상위 설계 원칙으로
> 승격된다.**

---

## 3. 전체 설계 구조

```text
====================================================
                   HUMAN DESIGN
====================================================

Root Game Goal
World Premise
Design Constraints
       │
       ▼

====================================================
              MASTER INTENT GRAPH
                  master/
====================================================

                  CONSTRAINT
                /     |      \
               ▼      ▼       ▼
           Goal   Possibility  Capability
             ▲        │           ▲
             │        │           │
World Cause → Actor → Goal ──OR── Possibility
     │          ▲                  │
     │          │                  │ requires
     ▼          │                  ▼
Knowledge / Belief            Capability
                                  │
                                  ▼
                        Existing World Overlay
                          master/overlay.md
                                  │
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
             IMPLEMENTED       PARTIAL          MISSING
                                                   │
                                                   ▼
                                           Frontier Candidate
                                          master/frontier.md

====================================================
                  HUMAN DECISION
====================================================

                    Cycle Goal

====================================================
             EXISTING CYCLE WORKFLOW
                    cycles/
====================================================

01-cycle.md              Cycle Definition   ← MASTER TRACE 로 위층과 이어진다
02-intent.md             Cycle-local Goal / Possibility → Intent
03-world-semantic.md     World State / World Rule / Observable
04-gameview.spec.yaml    GameView Specification
05-review.md             Human Semantic Review
06-world-implementation.md
07-view-implementation.md
08-verification.md       Verification        → MASTER FEEDBACK 으로 위층에 되돌린다

====================================================
                     FEEDBACK
====================================================

Capability Overlay Update
        ↓
master/overlay.md

Recurring Design Pattern
        ↓
master/candidates/*.md
        ↓
Human Review / Approval
        ↓
master/constraints/DC-*.yaml
```

Master Design 과 Cycle Implementation 을 분리한다.

- **Master Design** — 무엇을 왜 만들 것인지, 어떤 다른 방법이 있는지,
  어떤 Constraint 아래 존재해야 하는지를 결정한다.
- **Cycle** — 이미 선택된 하나의 플레이 결과를 실제 World Semantic 과 Rule 로 폐쇄한다.

**Constraint 도입 때문에 기존 Cycle Workflow 에 새로운 필수 Stage 를 추가하지 않는다.**
8 Stage 는 그대로다. 늘어나는 것은 `01-cycle.md` 의 `MASTER TRACE` 항목과
`08-verification.md` 의 `MASTER FEEDBACK` 항목뿐이다.

---

## 4. 책임 경계

### 4.1 Human

Human 은 다음을 소유한다.

- Root Game Goal
- 핵심 World Premise
- 중요한 Design Constraint 의 승인/변경
- Constraint 간 충돌에 대한 최종 Trade-off
- 다음 Cycle 에서 구현할 Frontier / Cycle Goal 선택
- Master Graph 의 의미 변경 승인

Agent 는 Human 승인 없이 핵심 Constraint 를 임의로 추가·삭제·완화하지 않는다.

### 4.2 Master Design Agent

- World Cause 와 Actor Motivation 확장
- Actor-owned Goal 생성/보완
- Goal 의 대안 Possibility 탐색
- Possibility Requirements 도출
- 기존 Goal / Capability 재사용 탐색
- Active Constraint 적용 및 위반 검사
- Actor Conflict / Consequence / Reveal / Reframe 탐색
- Existing World Capability Overlay 갱신
- Frontier 후보 생성
- 반복되는 설계 패턴에서 Constraint Candidate 제안

Master Design Agent 는 `world/` `view/` 코드를 **쓰지 않는다**. 읽기만 한다 (Overlay 판정 목적).

### 4.3 Cycle Agent

Human 이 Cycle Goal 을 확정한 이후에는 기존 Workflow 를 따른다.

```text
Cycle Goal → 01-cycle → 02-intent → 03-world-semantic → 04-gameview.spec
           → 05-review → 06-world-impl → 07-view-impl → 08-verification
```

Cycle Agent 는 구현 편의를 이유로 상위 Goal, Possibility, Capability 또는 Constraint 의
의미를 변경하지 않는다. 필요하면 Master 로 반환한다 (§20).

---

## 5. Design Plane 과 Intent / World Plane

Constraint 는 다른 Graph Node 와 성격이 다르므로 논리적으로 두 Plane 을 구분한다.

```text
DESIGN PLANE
────────────────────────────
Constraint


INTENT / WORLD PLANE
────────────────────────────
WorldState
Actor
Knowledge / Belief
Goal
Possibility
Capability
```

두 Plane 은 동일한 Master Design System 안에 존재한다.
Constraint 는 Intent / World Plane 의 Node 와 관계를 제한하거나 방향짓는다.

---

## 6. Node Type

### 6.1 Constraint

Constraint 는 게임의 Goal/Possibility/Capability/World Rule 이 **어떤 형태로 존재할 수 있는지
제한하거나 방향짓는 Human-owned Design Intent** 다. Constraint 는 Actor Goal 이 아니다.

```text
Goal        Actor 가 어떤 이유로 원하는 Desired State
Constraint  그 Goal 과 해결 방법이 어떤 설계 원칙 안에서 만들어져야 하는지를 정의
```

Schema — `master/constraints/<id>.yaml`

```yaml
id: DC-COMBAT-PLAYER-CAUSALITY
type: constraint
statement: >
  Major combat outcomes must result from observable world state and player decisions.
rationale: >
  Player 는 왜 그 결과가 나왔는지 이해할 수 있어야 한다.
scope:
  - COMBAT
requires:
  - observable_cause
  - explainable_result
  - deterministic_resolution_under_same_state
prohibits:
  - random_hit
  - random_evade
  - random_critical
  - random_damage
prefers: []
status: APPROVED          # DRAFT | APPROVED | REVISED | REJECTED | SUPERSEDED
provenance:
  - HUMAN_DESIGN          # 또는 CANDIDATE:<후보 파일> / CYCLE:<CycleId>
relations:
  supports: []
  conflicts_with: []
```

의미:

- `requires` — 반드시 만족해야 하는 설계 조건
- `prohibits` — 허용하지 않는 설계 형태
- `prefers` — 가능하면 우선하는 설계 방향

Scope 는 적용 범위다. 예:

```text
GLOBAL   COMBAT   ECONOMY   WORLD_TRAVEL   PLAYER_DEATH   MAGIC   SOCIAL   CONTENT_REGION
```

Scope 를 고정된 문자열 목록으로 강제하지는 않지만, 어떤 Node 에 이 Constraint 가 적용되는지
Agent 가 **판정할 수 있어야** 한다.

### 6.2 WorldState (MW-)

World 에서 현재 참인 의미 있는 상태다. 단순 배경이 아니라 Goal 과 Possibility 를 발생시키는
실제 원인이 될 수 있다.

```text
MW-FOREST-CORRUPTED         Forest 가 Corrupted 상태다
MW-DEER-MIGRATION-NORTH     Deer 가 북쪽으로 Migration 중이다
MW-VILLAGE-FOOD-SHORTAGE    Village 의 Food Supply 가 부족하다
```

Master 의 WorldState 는 **세계의 사실**이지 `world/` 의 자료구조가 아니다.
자료구조는 Cycle 의 `03-world-semantic.md` 가 소유한다.

### 6.3 Actor (MA-)

자기 관점, 이해관계, Goal 을 가질 수 있는 주체다.

```text
Player   NPC   Creature   Faction   Guild   Settlement   Organization
```

### 6.4 Knowledge / Belief (MK- / MB-)

- **Knowledge** — Actor 가 확보한 정보
- **Belief** — Actor 가 사실이라고 믿지만 틀릴 수도 있는 정보

Belief 와 객관적 WorldState 의 차이가 Mystery, Investigation, Reversal 을 만든다.

### 6.5 Goal (MG-)

특정 Actor 가 어떤 이유로 원하는 Desired State 다.

```yaml
id: MG-DEFEAT-ANCIENT-KNIGHT
type: goal
owner: MA-PLAYER
desired_state: AncientKnightNoLongerBlocksFortress
motivation: [MG-ENTER-FORTRESS]
belief_context: []
stakes: [FortressAccess]
caused_by: [MW-FORTRESS-SEALED]
```

상위 Goal 은 가능한 한 다음에 답해야 한다.

```text
누가 원하는가?
왜 원하는가?
어떤 World State 때문에 생겼는가?
어떤 Knowledge/Belief 에 기반하는가?
실패하면 무엇을 잃는가?
```

답할 수 없다면 Goal 이 아니라 Capability 이거나 Motivation Context 가 부족한지 검사한다.

### 6.6 Possibility (MP-)

Goal 을 달성하거나 진전시키는 **의미 있게 다른 후보 방법**이다.

```yaml
id: MP-BREAK-KNIGHT-DEFENSE
type: possibility
achieves: [MG-DEFEAT-ANCIENT-KNIGHT]
requires:
  capabilities: [MC-COMBAT-ATTACK, MC-BREAK]
  knowledge: []
  world_state: []
  relationship: []
  resource: []
supports: []
opposes: []
changes: [AncientKnightCombatState]
reveals: []
creates_goal: []
constraints: [DC-COMBAT-PLAYER-CAUSALITY]
constraint_evaluation:
  DC-COMBAT-PLAYER-CAUSALITY: SATISFIED
```

Possibility 는 단순 Action 이름이나 동의어가 아니다.
Gameplay, Cost, Risk, Relationship, Consequence 중 **하나 이상이 실질적으로 달라야**
별도 Possibility 로 취급한다.

Goal → Possibility 는 **OR** 관계다.

```text
MG: Village Food Problem 을 해결한다
├─ MP: Blackhorn 을 죽인다
├─ MP: 진짜 원인을 조사한다
├─ MP: 다른 Hunting Ground 를 찾는다
├─ MP: Fishing 으로 대체 식량을 확보한다
├─ MP: Caravan 으로 공급한다
└─ MP: Forest Corruption 을 정화한다
```

Possibility → Requirements 는 **AND** 관계다. Requirement Type:

```text
Goal   Capability   Knowledge / Belief   WorldState   Actor Relationship   Resource / Ownership
```

### 6.7 Capability (MC-)

여러 Goal/Possibility 가 공통으로 재사용하는 **플레이 또는 World 의 의미 있는 능력**이다.
구현 모듈명이 아니다.

```yaml
id: MC-TRACK
type: capability
semantic: >
  Player 는 세계에 남은 흔적을 살펴 대상의 이동 방향을 추론할 수 있다.
required_by: [MP-TRACK-BLACKHORN]
constraints: [DC-COMBAT-PLAYER-CAUSALITY]
overlay: MISSING          # IMPLEMENTED | PARTIAL | MISSING — 근거는 overlay.md
```

Capability 는 **왜 필요한지를 설명하지 않는다**. 왜 지금 그것이 필요한지는
Goal / Possibility 경로가 설명한다.

---

## 7. Constraint 가 Master Graph 에 작용하는 방식

Constraint 는 문서 상단의 주석이 아니다. Graph Expansion 과 Frontier 생성에 실제 영향을 준다.

```text
Constraint
   ├─ constrains Goal
   ├─ constrains Possibility
   ├─ constrains Capability
   ├─ constrains World Semantic / Rule realization
   └─ constrains Frontier
```

핵심 원칙:

> Constraint 가 Capability 를 직접 "필요하게" 만들지는 않는다.
> Capability 의 필요성은 Goal / Possibility 에서 발생한다.
> Constraint 는 그 Goal/Possibility/Capability 가 **어떤 형태로 존재할 수 있는지** 제한한다.

```text
BAD                          GOOD

Constraint                   Constraint
    ↓                             │ constrains
Combat System                     ▼
                             Goal → Possibility
                                       │ requires
                                       ▼
                                    Capability
```

이 원칙이 시스템 목록 중심 설계로의 회귀를 막는다.

---

## 8. Constraint 가 Possibility 공간을 바꾼다

```text
MG: 강한 적에게 큰 피해를 준다
```

Constraint 가 없다면:

```text
P1 Critical Chance 를 올린다
P2 Weak Point 를 공격한다
P3 Rear Attack 한다
P4 Counter 한다
P5 Break 시킨다
```

`DC-COMBAT-PLAYER-CAUSALITY` (prohibits: random_critical …) 아래에서는:

```text
P1 → VIOLATED
P2 → SATISFIED
P3 → SATISFIED
P4 → SATISFIED
P5 → SATISFIED
```

따라서 Graph Expansion 은 개념적으로 다음 순서를 가진다.

```text
Goal → Candidate Possibilities → Constraint Evaluation → Valid Possibility Space
```

---

## 9. Constraint 가 Capability 설계에 작용하는 방식

```text
Need: Player 가 공격을 피할 수 있어야 한다

MC-EVADE-CHANCE      일정 확률로 피격을 무효화한다      → VIOLATED
MC-PHYSICAL-EVADE    실제로 몸을 이동하여 충돌을 피한다  → SATISFIED
```

Capability 의 **필요성**은 Possibility 에서 나왔지만,
Capability 의 **최종 형태**는 Constraint 의 영향을 받는다.

---

## 10. Constraint 와 World Premise

Constraint 는 Gameplay 철학에만 한정되지 않는다.
World Premise 가 반복적인 World Rule 을 요구한다면 Constraint 로 표현할 수 있다.

```text
World Premise
    Magic always requires equivalent sacrifice.
        ↓
DC-MAGIC-EQUIVALENT-COST
        ↓ constrains
Magic Possibilities / Capabilities / Rules
```

단, World 의 **현재 상태 자체**는 Constraint 가 아니다.

```text
"Forest is corrupted"                     → WorldState (MW-)
"Magic always requires equivalent cost"   → World Premise / Constraint 후보
```

---

## 11. Constraint Discovery

Constraint 를 Human 이 처음부터 모두 작성할 필요는 없다.
Graph 를 확장하거나 Cycle 을 돌면서 반복적인 설계 패턴이 발견될 수 있다.

```text
P1 정확한 순간 Guard 하여 공격권을 가져온다
P2 적이 공격에 집중한 순간 Counter 한다
P3 약점을 직접 공격해 큰 피해를 만든다
P4 Break 를 축적해 Burst Window 를 만든다

공통 원칙
    중요한 전투 결과는 Player 가 이해하고 의도적으로 만든 조건에서 발생한다.
```

처리 경로:

```text
Recurring Design Pattern
        ↓
master/candidates/<id>.md          Constraint Candidate
        ↓
Human Review
        ↓
APPROVED / REJECTED / REVISED
        ↓
master/constraints/DC-*.yaml
```

Agent 는 반복 패턴을 발견했다고 자동으로 Constraint 로 승격하지 않는다.
승격은 Design 의미 변경이므로 Human 승인이 필요하다.

---

## 12. Constraint 간 관계와 충돌

최소 관계:

```text
SUPPORTS_CONSTRAINT
CONFLICTS_WITH
```

```text
DC-COMBAT-READABILITY     SUPPORTS_CONSTRAINT   DC-COMBAT-PLAYER-CAUSALITY
DC-COMBAT-DETERMINISTIC   CONFLICTS_WITH        DC-COMBAT-RANDOM-VARIANCE
```

Agent 는 Constraint 충돌을 임의로 해결하지 않는다. 다음을 제시한다.

```text
Conflict   Affected Nodes   Possible Trade-offs   Expected Consequences
```

최종 우선순위와 의미 변경은 Human 이 결정한다.

---

## 13. Constraint Evaluation

Constraint 가 적용되는 Node 는 평가할 수 있어야 한다.

```text
SATISFIED   VIOLATED   NOT_APPLICABLE   UNRESOLVED
```

`SATISFIED` 를 영구 Graph Edge 로 저장할 필요는 없다.
관계(`CONSTRAINS`)를 저장하고 평가 결과는 계산 가능한 값으로 둔다.

```text
DC-COMBAT-PLAYER-CAUSALITY --CONSTRAINS--> MC-PERFECT-GUARD
Evaluation: SATISFIED
```

`UNRESOLVED` 는 현재 정보만으로 판정할 수 없을 때 쓴다.
Agent 는 `UNRESOLVED` 를 임의로 `SATISFIED` 로 간주하지 않는다.

---

## 14. Edge Type

```text
기본
    CAUSES   MOTIVATES   WANTS   BELIEVES   KNOWS
    ACHIEVES   REQUIRES
    SUPPORTS   OPPOSES
    CHANGES   REVEALS   REFRAMES   CREATES_GOAL

Constraint 관련
    CONSTRAINS   SUPPORTS_CONSTRAINT   CONFLICTS_WITH
```

Edge 의미를 혼용하지 않는다.

```text
REQUIRES     Possibility 가 성립하기 위해 필요한 것
CONSTRAINS   해당 Node 가 어떤 설계 원칙 아래 존재해야 하는지
```

---

## 15. Narrative 의 정의

Narrative 는 별도 Graph 가 아니다.

```text
World Cause
    ↓
Actor 가 상황을 인식하거나 오해
    ↓
Actor Goal 생성
    ↓
Goal Conflict
    ↓
Player 가 Possibility 선택
    ↓
World State / Relationship 변화
    ↓
새로운 Knowledge
    ↓
Goal 생성 또는 Reframe
```

이 인과적 진행 자체가 Narrative 다.
Constraint 는 Narrative 를 대체하지 않고, 필요할 때 그 구현 형태를 제한한다.

```text
DC-PLAYER-CHOICE-HAS-CONSEQUENCE
requires: Major player choice changes observable WorldState or Relationship
```

---

## 16. Design Possibility 와 Runtime Availability

Master Graph 에는 설계상 존재하는 주요 Possibility 를 포함할 수 있다.
Runtime 에서는 다음 이유로 지금 사용 불가능할 수 있다.

```text
Capability 부족   Knowledge 부족   WorldState 불충족
Actor Relationship 부족   Resource 부족   이전 선택의 결과
```

혼동하지 않는다.

```text
Constraint Violation   설계 자체가 현재 정책과 양립하지 않음
Runtime Unavailable    유효한 설계지만 현재 World State 에서 사용할 수 없음
```

---

## 17. Existing World Capability Overlay

각 Capability 는 현재 `world/` `view/` 구현 상태와 Overlay 된다.

```text
IMPLEMENTED   PARTIAL   MISSING
```

이 프로젝트에서 Overlay 판정 근거는 **주장이 아니라 Cycle 기록**이다.

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부가 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

```text
MP: 공격을 읽고 반격하여 Knight 를 돌파한다
requires
    MC-GUARD            IMPLEMENTED   C007
    MC-COMBAT-BASIC     IMPLEMENTED   C007
    MC-PERFECT-GUARD    MISSING
    MC-COUNTER          MISSING
    MC-BREAK            MISSING
```

이 Overlay 로 Frontier 후보를 생성한다.

---

## 18. Frontier

Frontier 는 절대적인 Graph Leaf 가 아니다.

> **현재 Existing World 에는 아직 없지만, 하나 이상의 상위 Goal/Possibility 를 실제로
> 전진시키고, Client 에서 직접 플레이하여 명확한 결과를 검증할 수 있으며, 하나의 Cycle 안에서
> 의미적으로 폐쇄 가능한 가장 작은 새로운 World/Game Capability 단위다.**

후보 조건:

1. Existing World 에서 아직 완전히 제공되지 않는다.
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시킨다.
3. Client 에서 직접 플레이하고 결과를 확인할 수 있다.
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능하다.
5. 단순 코드 Task 가 아니라 새로운 World/Game Capability 다.
6. 적용되는 Active Constraint 와 양립한다.
7. 완료 후 Existing World 에 재사용 가능한 Capability 로 누적할 수 있다.

```text
BAD    Perfect Guard 시스템 구현

GOOD   Player 가 적의 공격 직전에 Guard 하여
       피해를 받지 않고 상대를 노출 상태로 만들 수 있다.
```

Frontier 조건 3·4 는 `guides/cycle-definition.md` 의 Cycle Goal 조건과 같다 —
**Frontier 가 곧 다음 Cycle 의 Goal 후보**이기 때문이다.

Agent 는 Frontier 후보를 제공하지만 개발 우선순위를 자동 확정하지 않는다.
Human 이 다음 Cycle Goal 을 선택한다.

---

## 19. Master Goal/Possibility 와 Cycle-local Goal/Possibility

같은 용어를 쓰지만 목적이 다르다. **이것이 이 문서의 핵심 구분이다.**

| | Master (`master/graph/`) | Cycle-local (`cycles/<Id>/02-intent.md`) |
|---|---|---|
| 질문 | 게임에 어떤 경험과 가능성을 만들 것인가? | 이미 결정된 하나의 플레이 결과가 성립하려면 무엇이 가능해야 하는가? |
| 수명 | 지속 — 계속 자란다 | Cycle 종료 시 History 로 고정 |
| ID | `MG-` `MP-` | `GOAL-*` `POSSIBILITY-*` (기존 표기 유지) |
| 목적 | Idea Space 확장 · 대안 탐색 · 재사용 Capability 발견 · Constraint 적용 · Frontier 생성 | Cycle Goal 의 Semantic Decomposition · Intent 추출 · 구현 조건 폐쇄 |
| 소유 | Master Design Agent + Human | Cycle Intent Agent |

Cycle 단계에서 Master Story 를 다시 확장하거나 새로운 Constraint 를 임의로 생성하지 않는다.
Cycle 과정에서 중요한 반복 원칙을 발견했다면 Constraint Candidate 로 보고한다 (§20).

---

## 20. Constraint 와 Cycle 의 관계

Constraint 를 도입해도 Cycle Workflow 는 변경하지 않는다.
Constraint 는 Cycle Goal 과 Capability 의 **상위 Design Provenance** 다.

```text
DC-COMBAT-PLAYER-CAUSALITY
전투의 중요한 결과는 Player 가 만들어야 한다
        ↓ constrains
MP-READ-AND-COUNTER
상대의 공격을 읽고 반격한다
        ↓ requires
MC-PERFECT-GUARD
Perfect Guard 를 통해 공격권을 뒤집을 수 있다
        ↓ implemented / refined by
CYCLE GOAL (01-cycle.md)
Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고 상대를 노출시킬 수 있다
        ↓
INTENT (02-intent.md)
Guard 시작 직후 일정 시간 내 충돌하면 PERFECT_GUARD 가 발생한다
        ↓
WORLD RULE (03-world-semantic.md)
window = 0.20 sec / damage = 0 / cpCost = 0 / attacker → EXPOSED
```

**수치와 세부 판정 공식은 Master 에 올리지 않는다.**
`0.20 sec` 를 `0.17 sec` 로 바꿔도 상위 Constraint 와 Capability 의미가 유지되면
Master Graph 변경이 아니다.

### Cycle → Master 반환

Cycle 실행 중 상위 의미가 어긋나면 지어내지 않고 반환한다.
기존 Gap Handling 규칙에 Master 방향이 하나 더해진다.

```text
View 정보 부족                    → GameView Specification
Spec 정보 부족                    → World Semantic
Semantic 정보 부족                → Intent
Intent 가 Cycle Goal 과 불일치     → Cycle Definition (Human)
Cycle Goal 이 상위 Possibility/Constraint 와 어긋남 → MASTER (Human)
```

```text
MASTER GAP
Frontier     <Frontier ID>
Conflict     무엇이 상위 의미와 어긋나는가
Affected     MG-* / MP-* / MC-* / DC-*
Options      가능한 Trade-off
Decision By  Human
```

---

## 21. Combat Constraint Canonical Example

현재 Combat 설계를 다음 Constraint 로 해석할 수 있다.

```yaml
id: DC-COMBAT-PLAYER-CAUSALITY
type: constraint
statement: >
  Major combat outcomes must result from observable world state and player decisions.
rationale: >
  Player 는 왜 그 중요한 전투 결과가 일어났는지 이해할 수 있어야 한다.
scope: [COMBAT]
requires: [observable_cause, explainable_result, deterministic_resolution_under_same_state]
prohibits: [random_hit, random_evade, random_critical, random_damage]
status: APPROVED
```

이 Constraint 아래에서 다음 Capability 가 존재할 수 있다.

```text
MC-GUARD   MC-PERFECT-GUARD   MC-EVADE   MC-COUNTER   MC-COMBAT-FLOW
MC-BREAK   MC-ATTACK-ARMOR-MATCHUP   MC-WEAK-POINT   MC-REAR-ATTACK   MC-VOW
```

**중요** — 이 Capability 들이 `DC-COMBAT-PLAYER-CAUSALITY` 때문에 자동으로 필요한 것은 아니다.
각각의 필요성은 실제 Master Possibility 에서 나온다.

```text
MG: Ancient Knight 를 돌파한다
├─ MP: 공격을 읽고 반격한다        requires MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER
├─ MP: 방어를 압박해 무너뜨린다     requires MC-BREAK
├─ MP: 회피 후 후방을 잡는다        requires MC-EVADE · MC-REAR-ATTACK
└─ MP: 큰 위험을 받아들이고 결정타   requires MC-VOW · MC-BREAK
```

그리고 Constraint 가 이 Possibility/Capability 들의 **설계 형태**를 제한한다.

---

## 22. Master Capability 와 Cycle Realization

전투 항목(Attack Type · Defense · Flow · Guard · Perfect Guard · Evade · Counter · Break ·
Weak Point · Rear Attack · Restriction · Vow)은 두 종류로 나뉜다.

```text
MASTER CAPABILITY — 재사용 가능한 플레이 의미
    MC-PERFECT-GUARD   정확한 타이밍의 방어로 피해를 막고 공격권을 뒤집을 수 있다
    MC-BREAK           압박을 지속해 상대 방어 구조를 일시적으로 무너뜨리고 Burst 기회를 만든다
    MC-EVADE           실제 위치를 변경하여 공격 충돌을 피할 수 있다

CYCLE REALIZATION — 구체적 판정과 수치 (03-world-semantic.md 소유)
    PERFECT_GUARD_WINDOW   BREAK_DECAY_RATE   BROKEN_DURATION
    COUNTER_DAMAGE_BONUS   AttackType × ArmorType table
    Damage Formula   Strike Resolution Order
```

Master 에는 Capability 의 **의미**를, Cycle/World Rule 에는 **수치와 공식**을 둔다.

---

## 23. Traceability

기존 Traceability 를 위쪽으로 확장한다.

Forward Trace:

```text
World Cause / Actor / Belief          master/graph/
        ↓
Master Goal (MG-)
        ↓
Master Possibility (MP-)
        ↓
Master Capability (MC-)
        ↓
Frontier                              master/frontier.md
        ↓
Cycle Goal                            01-cycle.md      ← MASTER TRACE
        ↓
Intent                                02-intent.md
        ↓
World State / Rule                    03-world-semantic.md
        ↓
Runtime Transition                    world/
        ↓
Observable                            04-gameview.spec.yaml
```

Constraint 영향을 받은 경우:

```text
Constraint --constrains--> Goal / Possibility / Capability → Cycle Goal → Intent → Rule → Runtime
```

Reverse Trace:

```text
Observed Runtime Event → World Rule → Intent → Cycle Goal
    → Capability → Possibility → Goal → Actor Motivation / World Cause
    → (해당되면) Constraint
```

모든 Runtime Event 가 Constraint 까지 연결될 필요는 없다.
**Constraint 가 그 설계 형태에 실제 영향을 준 경우에만** Trace 를 가진다.

---

## 24. Agent Graph Generation Policy

Agent 가 Root Goal 또는 Content Region 을 확장할 때 다음 순서를 따른다.
각 Step 의 실행 방법은 `guides/master-*.md` 가 담당한다.

**Step 0. Active Constraint 확인** — GLOBAL / Domain Scope / Content-specific 중 무엇이
적용되는가. 각 Constraint 의 `requires / prohibits / prefers` 를 확인한다.

**Step 1. Goal Owner / Motivation 확인**

```text
누가 원하는가?  왜 원하는가?  어떤 World State 때문에 생겼는가?
어떤 Knowledge/Belief 에 기반하는가?
```

**Step 2. Possibility 를 폭으로 확장** — 의미가 다른 여러 방법을 탐색한다.

```text
Direct action   Combat   Exploration   Economy   Craft   Social cooperation
Faction / diplomacy   Knowledge / investigation   World manipulation
Alternative supply / substitution
```

숫자를 맞추기 위해 억지 Possibility 를 생성하지 않는다.

**Step 3. Constraint Evaluation** — 후보마다 판정한다.

```text
어떤 Constraint 가 적용되는가 / 무엇을 요구·금지·선호하는가
SATISFIED / VIOLATED / UNRESOLVED 중 무엇인가
Constraint 때문에 후보의 형태를 수정해야 하는가
```

`VIOLATED` 후보를 정상 Frontier 로 전달하지 않는다.
단, 의도적인 Constraint 변경/예외가 필요하다는 Design Conflict 로 Human 에게 제시할 수 있다.

**Step 4. Requirements 도출** — Goal / Capability / Knowledge / WorldState / Relationship /
Resource.

**Step 5. Existing Registry 중복 검사** — 새 Node 를 만들기 전 기존 Graph 를 검색한다.
동일 의미 Node 를 새 이름으로 복제하지 않는다.

**Step 6. Actor Conflict 검사** — 누구의 Goal 을 지원/방해하는가. 누가 이 선택을 좋아하거나
싫어하는가.

**Step 7. Consequence 정의** — 성공하면 하나 이상의 의미 있는 State 가 변해야 한다.

```text
WorldState   Actor Relationship   Knowledge   Resource Availability
Access   Entity State   Territory   Economy   Population / Ecology
```

**Step 8. Reveal / Reframe / New Goal 검사**

```text
무엇을 새로 알게 되는가 / 기존 Belief 가 틀렸음이 드러나는가
새 Goal 이 생기는가 / 새 Possibility 가 열리는가 / 기존 Possibility 가 닫히는가
```

**Step 9. Constraint Discovery** — 반복 패턴을 탐색한다. 다음을 만족하면 Candidate 를 제안한다.

```text
여러 Goal/Possibility/Capability 에서 반복된다
설계 선택을 실제로 제한한다
게임의 정체성 또는 World Premise 와 관련 있다
앞으로도 반복 적용할 가치가 있다
```

Agent 는 Candidate 를 자동 승인하지 않는다.

**Step 10. Existing World Capability Overlay** — Requirement 별로 IMPLEMENTED / PARTIAL /
MISSING 을 판정하고 근거 Cycle 을 적는다.

**Step 11. Frontier 후보 생성** — Missing/Partial 중 플레이 가능하고, Cycle 안에서 닫히며,
상위 Possibility 를 전진시키고, Active Constraint 와 양립하는 단위.

**Step 12. Human Selection** — Agent 는 추천과 근거를 제공하되 최종 Cycle Goal 을 자동
확정하지 않는다.

---

## 25. Quality Gates

### 25.1 Constraint

- [ ] 단순 취향이 아니라 반복적인 설계 결정을 실제로 제한하는가?
- [ ] Statement 가 명확한가?
- [ ] Rationale 이 설명 가능한가?
- [ ] Scope 가 명확한가?
- [ ] `requires / prohibits / prefers` 의 의미가 구분되는가?
- [ ] 영향을 받는 Goal/Possibility/Capability 를 추적할 수 있는가?
- [ ] 평가 결과를 판정할 근거가 있는가?
- [ ] 다른 Constraint 와 충돌하는지 검사했는가?
- [ ] 충돌 시 Human 승인 없이 임의 해결하지 않았는가?
- [ ] 구현 세부 수치가 Constraint 에 들어가 있지 않은가?
- [ ] 특정 구현 모듈을 이유 없이 강제하지 않는가?
- [ ] Graph 에서 발견된 원칙이라면 Human 이 승격을 승인했는가?

### 25.2 Goal

- [ ] Owner 가 명확한가?
- [ ] Desired State 가 명확한가?
- [ ] Motivation 이 존재하는가?
- [ ] 필요한 Belief/Knowledge Context 가 있는가?
- [ ] Stakes 가 이해 가능한가?
- [ ] 사실 Capability 인데 Goal 로 잘못 표현하지 않았는가?

### 25.3 Possibility

- [ ] 같은 Goal 의 다른 실질적 방법을 탐색했는가?
- [ ] Gameplay/Cost/Risk/Relationship/Consequence 차이가 있는가?
- [ ] Requirements 가 명시되어 있는가?
- [ ] Supports/Opposes 를 검토했는가?
- [ ] 의미 있는 State Change 가 있는가?
- [ ] 단순 동의어를 중복 생성하지 않았는가?
- [ ] Active Constraint 를 평가했는가?

### 25.4 Narrative

- [ ] 사건의 World Cause 가 존재하는가?
- [ ] 주요 Actor 가 서로 다른 Goal/관점을 가지는가?
- [ ] Belief 와 객관적 WorldState 가 다를 가능성이 있는가?
- [ ] Player 가 개입할 이유가 Goal 로 표현되는가?
- [ ] Player 선택이 실제 State/Relationship 을 바꾸는가?
- [ ] Knowledge Reveal 이 후속 Goal/Possibility 에 영향을 주는가?
- [ ] 하나의 해결법만 강제하고 있지 않은가?
- [ ] 필요하다면 Local Story 가 더 큰 World Cause 로 역추적되는가?

### 25.5 DAG / Reuse

- [ ] 동일 Goal 을 Branch 마다 복제하지 않았는가?
- [ ] 동일 Capability 를 Content 마다 새 이름으로 만들지 않았는가?
- [ ] Shared World Capability 를 재사용하는가?
- [ ] 한 Capability 가 여러 상위 Possibility 에 기여하는 연결이 보이는가?

### 25.6 Frontier

- [ ] Existing World 에서 아직 완전히 제공되지 않는가?
- [ ] 상위 Goal/Possibility 를 실제로 전진시키는가?
- [ ] Client 에서 플레이 가능한가?
- [ ] 한 Cycle 에서 명확한 결과를 검증할 수 있는가?
- [ ] 단순 코드 Task 가 아닌 World/Game Capability 인가?
- [ ] Active Constraint 와 양립하는가?
- [ ] 완료 후 Existing World 에 누적 가능한가?

Cycle 자체의 완료 판정 15항은 `guides/verification.md` 의 DONE WHEN 이 단일 출처다.
여기에 복제하지 않는다.

---

## 26. Anti-patterns

**26.1 Constraint 에서 시스템 목록을 직접 생성** — Constraint 는 시스템 Backlog 가 아니다.

```text
BAD    Constraint → Combat System → Guard / Break / Counter / ...
GOOD   Constraint --constrains--> Goal → Possibility --requires--> Capability
```

**26.2 모든 전투 철학을 Goal 로 표현** — "전투는 확률적이지 않아야 한다" 는 Goal 이 아니다.
Actor-owned Desired State 가 아니라면 Constraint 인지 검사한다.

**26.3 구현 수치를 Constraint 에 저장**

```text
BAD    Perfect Guard 는 반드시 0.20초여야 한다
GOOD   Perfect Guard 의 성공은 확률이 아니라 관찰 가능한 Timing 조건으로 결정되어야 한다
```

`0.20 sec` 는 Cycle / World Rule / Data 가 소유한다.

**26.4 Constraint 를 모든 Node 에 무조건 연결** — 실제 영향을 주는 Node 에만 연결한다.

**26.5 Runtime Availability 와 Constraint Violation 혼동** (§16)

**26.6 Agent 가 Constraint 를 자동 확정** — 승격은 Human 이 승인한다.

**26.7 Constraint 충돌을 숨김** — Trade-off 로 노출한다.

**26.8 Master Graph 에 Cycle Rule 을 과도하게 복사** (§22)

**26.9 Master 를 Cycle 안에서 확장** — Cycle Agent 가 `master/` 를 편집하지 않는다.
예외는 `08-verification.md` 의 MASTER FEEDBACK 을 통한 Overlay 갱신과 Candidate 제출뿐이다.

**26.10 Frontier 없이 Cycle 을 시작** — 가능하다. 다만 `01-cycle.md` 의 MASTER TRACE 에
`없음` 과 그 사유를 적는다. 조용히 비워 두지 않는다.

---

## 27. ID / Registry 정책

Master 와 Cycle 의 Goal/Possibility 를 혼동하지 않도록 Namespace 를 분리한다.

```text
DC-*         Design Constraint
MW-*         Master WorldState
MA-*         Master Actor
MK-*         Master Knowledge
MB-*         Master Belief
MG-*         Master Goal
MP-*         Master Possibility
MC-*         Master Capability
FR-*         Frontier Candidate
CC-*         Constraint Candidate

GOAL-*       Cycle-local Goal          (기존 표기 유지)
POSSIBILITY-*  Cycle-local Possibility (기존 표기 유지)
INTENT-*     Cycle Intent              (기존 표기 유지)
RULE-*       World Rule                (기존 표기 유지)
C###-<name>  Cycle                     (기존 표기 유지)
```

기존 프로젝트 ID 를 강제 Migration 하지 않는다.
중요한 것은 Prefix 자체가 아니라 **Master 의미와 Cycle-local 의미가 구분되는 것**이다.

---

## 28. 이 저장소에서의 배치

```text
HktAdvProtoH/
├── design/
│   └── Master-Intent-Graph-Policy.md      이 문서 — Master Layer 정책 원본
│
├── guides/
│   ├── master-constraint.md               M1
│   ├── master-graph.md                    M2
│   ├── master-overlay.md                  M3
│   ├── master-frontier.md                 M4
│   ├── master-feedback.md                 MF
│   ├── cycle-definition.md ~ verification.md   기존 8 Stage — 변경 없음
│
├── master/                                Master Layer 산출물 (현재 게임 · 계속 자란다)
│   ├── README.md
│   ├── SCHEMA.md                          파일 형식 단일 출처
│   ├── root.md                            Root Game Goal · World Premise (Human 소유)
│   ├── constraints/                       DC-*.yaml
│   ├── graph/                             MW / MA / MK / MB / MG / MP / MC / edges
│   ├── overlay.md                         Capability × 구현 상태
│   ├── frontier.md                        FR-* 후보 + Human 선택 기록
│   └── candidates/                        CC-*.md — 미승인 Constraint Candidate
│
└── cycles/                                Cycle Layer — History
```

`master/` 는 `cycles/` 와 달리 **History 가 아니라 현재 상태**다.
`world/` `view/` 처럼 계속 갱신된다. 과거 판정을 남기고 싶으면 Node 의 `status` 와
Cycle 참조로 남기고, 파일을 복제하지 않는다.

Master Stage 실행은 **`advprotoh-master` 스킬**이 담당한다.
Cycle Stage 실행은 기존 `advprotoh-cycle` 스킬 그대로다.

---

## 29. 두 층의 접합점

접합점은 정확히 **둘**이다. 그 외의 경로로 두 층이 서로를 건드리지 않는다.

### 29.1 아래로 — Frontier → Cycle Goal

Human 이 `master/frontier.md` 에서 하나를 선택하면 Cycle Definition 이 그것을 받는다.
`01-cycle.md` 에 다음 항목이 더해진다.

```text
## MASTER TRACE
    Frontier            FR-PERFECT-GUARD-OPENING
    Source Goal         MG-DEFEAT-ANCIENT-KNIGHT
    Source Possibility  MP-READ-AND-COUNTER
    Target Capability   MC-PERFECT-GUARD          (overlay: MISSING)
    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
    Constraint Note     성공 조건은 확률이 아니라 관찰 가능한 Timing 이어야 한다
```

Frontier 에서 출발하지 않은 Cycle 은 `없음` + 사유를 적는다.

### 29.2 위로 — Verification → Master Feedback

Cycle 이 닫히면 `08-verification.md` 에 다음 항목이 더해진다.

```text
## MASTER FEEDBACK
    Capability Overlay
        MC-PERFECT-GUARD    MISSING → IMPLEMENTED    근거 C010 08-verification
    Constraint Evaluation
        DC-COMBAT-PLAYER-CAUSALITY   SATISFIED   판정 근거: 결정적 Timing 판정, 난수 없음
    Constraint Candidate
        없음   (또는 CC-*.md 로 제출한 후보와 관찰된 반복 패턴)
    Master Gap
        없음   (또는 §20 의 MASTER GAP 블록)
```

이 기록을 근거로 Master 의 Overlay 갱신(MF Stage)이 수행된다.
**Cycle Agent 가 `master/` 파일을 직접 편집하지 않는다** — 보고까지가 Cycle 의 책임이다.

---

## 30. 운영 원칙 요약

1. Root Goal, World Premise 와 핵심 Constraint 는 Human 이 소유한다.
2. Master Graph 는 시스템 목록이 아니라 World Cause, Actor Goal 과 Possibility 에서 출발한다.
3. 상위 Goal 은 가능한 한 Actor-owned Goal 로 표현한다.
4. Goal 에서는 하나의 해법으로 내려가기 전에 의미 있게 다른 Possibility 를 탐색한다.
5. Possibility 는 AND Requirements 를 가진다.
6. 재사용 가능한 저수준 플레이 의미는 Goal 이 아니라 Capability 다.
7. 동일 Goal/Capability 는 복제하지 않고 Graph 에서 재사용한다.
8. Narrative 는 별도 Layer 가 아니라 인과 경로다.
9. Constraint 는 Design Plane 의 1급 개념이다.
10. Constraint 는 Capability 의 필요성을 직접 만들지 않는다.
11. Constraint 는 Goal/Possibility/Capability 의 **형태와 유효한 설계 공간**을 제한한다.
12. Constraint 는 `scope / requires / prohibits / prefers` 로 적용 의미를 명확히 한다.
13. Constraint 위반과 Runtime Availability 부족을 구분한다.
14. Graph 에서 반복 발견되는 설계 패턴은 Constraint Candidate 가 될 수 있다.
15. Candidate 의 승격과 핵심 Constraint 변경은 Human 이 승인한다.
16. Constraint 간 충돌은 숨기지 않고 Human 에게 Trade-off 로 노출한다.
17. Master Graph 의 절대 Leaf 를 찾지 않고 Existing World 기준 Frontier 를 찾는다.
18. Frontier 는 Active Constraint 와 양립해야 한다.
19. Human 이 Frontier 중 다음 Cycle Goal 을 선택한다.
20. Cycle Goal 확정 이후에는 기존 Cycle Workflow 를 변경 없이 사용한다.
21. Constraint 를 Cycle 내부의 새로운 필수 구현 Stage 로 추가하지 않는다.
22. Master Capability 에는 플레이 가능한 의미를, 수치/공식은 Cycle/World Rule 에 둔다.
23. 완료된 Capability 는 공유 World 에 누적하고 Master Overlay 를 갱신한다.
24. 모든 중요한 Runtime 의미는 World Cause / Actor Motivation → Goal → Possibility →
    Capability → Cycle Goal → Intent → Rule → Runtime 까지 추적한다.
25. Constraint 가 실제 설계 형태에 영향을 주었다면 Runtime/Capability 에서 Constraint 까지도
    역추적 가능하게 한다.

---

## 31. 최종 Agent 판단 질문

Master Graph 를 생성하거나 수정하는 Agent 는 작업 전후에 다음에 답할 수 있어야 한다.

```text
이 Goal 은 누가 왜 원하는가?
어떤 World State 와 Knowledge/Belief 때문에 생겼는가?
같은 Goal 을 달성하는 의미 있게 다른 Possibility 는 무엇인가?
각 Possibility 는 누구를 돕고 누구를 방해하는가?
각 Possibility 는 어떤 World State 를 바꾸는가?
어떤 Knowledge 를 새로 공개하거나 Goal 을 Reframe 하는가?
어떤 Capability 가 필요한가?
그 Capability 는 이미 존재하는가?
현재 영역에 어떤 Constraint 가 적용되는가?
이 Possibility/Capability 는 Constraint 를 만족하는가?
Constraint 때문에 제거되거나 다른 형태로 설계되어야 하는 후보가 있는가?
여러 Node 에서 반복되는 새로운 설계 원칙이 있는가?
그 원칙은 Constraint Candidate 로 승격할 가치가 있는가?
현재 Missing/Partial Capability 중 실제 Client 에서 플레이 가능한 Frontier 는 무엇인가?
그 Frontier 는 상위 Goal/Possibility 와 Constraint 까지 추적되는가?
Cycle 완료 후 어떤 Capability 가 Existing World 에 추가되는가?
Runtime 결과에서 왜 이 기능이 존재하고, 왜 이런 형태로 구현되었는지 역추적할 수 있는가?
```

이 질문들에 일관되게 답할 수 있는 상태를 Master Intent Graph System 의 완성 기준으로 삼는다.

---

## 32. 최종 구조 요약

```text
                         HUMAN
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         Root Goal    World Premise   Constraint
             └─────────────┼─────────────┘
                           ▼
                 MASTER INTENT GRAPH

World Cause
    ↓
Actor / Knowledge / Belief
    ↓
Actor-owned Goal
    ↓ OR
Possibility ◄──────── Constraint
    ↓ requires             │
Capability ◄───────────────┘
    ↓
Existing World Overlay
    ↓
Frontier Candidates
    ↓
Human selects
    ↓
Cycle Goal

================ CYCLE BOUNDARY ================

01-cycle → 02-intent → 03-world-semantic → 04-gameview.spec
    → 05-review → 06-world-impl → 07-view-impl → 08-verification
    ↓
Capability accumulated
    ↓
Master Overlay Update

================ DESIGN FEEDBACK ===============

Repeated Pattern → Constraint Candidate → Human Approval → Constraint
    → Future Graph Expansion
```

핵심은 네 질문을 서로 다른 층이 담당하는 것이다.

```text
Constraint                  어떤 게임이어야 하는가?
Master Goal / Possibility   누가 왜 무엇을 하며 어떤 다른 방법이 존재하는가?
Capability                  그 방법을 가능하게 하는 재사용 가능한 플레이 능력은 무엇인가?
Cycle Intent / World Rule   그 능력이 실제 세계에서 정확히 어떤 규칙으로 작동하는가?
```

이 경계를 유지한다.

---

## 부록. 선행 Design 문서와의 관계

| 항목 | 원본 | 이 문서 |
|---|---|---|
| Cycle 8 Stage · Artifact 이름 · Agent 실행 방식 | `Design-CycleExecution.md` | 변경하지 않는다 |
| Cycle Completion Gate 15항 | `guides/verification.md` | 복제하지 않는다 |
| Cycle 공정과 게임 의미 | `Design-Workflow.md` · `Design-CycleWorkflow.md` | 변경하지 않는다 |
| Cycle Goal 의 출처 | 없었음 (Human 이 직접) | **이 문서 — Master Layer 가 Frontier 로 공급** |
| Goal / Possibility 의 수명과 범위 | Cycle 안에서만 | **Master(지속) / Cycle-local(1회) 로 분리 (§19)** |
| Design Constraint | 없었음 | **이 문서 — Design Plane 1급 개념** |

충돌 시 우선순위:

```text
Master Layer 의 의미·절차            → 이 문서
Cycle 8 Stage · Artifact · 실행 방식 → Design-CycleExecution.md
그 외 공정과 게임 의미               → Design-Workflow / Design-CycleWorkflow
```
