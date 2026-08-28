# Master-Intent-Graph-Policy.md

Master Intent Graph 구성 정책 — Simplified

> 이 프로젝트의 Workflow 는 **두 층**이다.
>
> ```text
> MASTER   WHY → OPTIONS → NEED → NEXT
>          무엇을 왜 만들지 결정한다.
>
> CYCLE    선택된 NEXT 를 World Semantic 과 Rule 로 폐쇄한다.
>          기존 8 Stage Workflow 를 그대로 사용한다.
> ```
>
> 이 문서는 Master Layer 의 Source of Truth 다.
> Cycle Layer 의 원본은 `Design-CycleWorkflow.md` · `Design-CycleExecution.md` 이다.

---

## 1. 목적

Master Layer 는 한 질문에 답한다.

> **다음 Cycle Goal 은 어디서 오는가?**

Cycle 안에서 Goal 과 Possibility 를 매번 새로 만들면 다음 문제가 생긴다.

```text
Goal 이 세계의 원인과 끊긴다.
같은 Capability 가 Cycle 마다 재발명된다.
한 해결법으로 빨리 수렴해 대안이 사라진다.
설계 원칙이 Cycle 마다 다시 해석된다.
```

Master 는 이를 Cycle 밖에서 관리한다.

핵심 목표는 네 가지다.

```text
WHY       누가 무엇을 왜 원하는가?
OPTIONS   어떤 다른 해결 방법이 있는가?
NEED      각 방법에는 무엇이 필요한가?
NEXT      지금 다음으로 무엇을 만들 것인가?
```

---

## 2. 핵심 원칙

### 2.1 Master 와 Cycle 을 분리한다

```text
MASTER
왜 필요한가 / 어떤 방법이 있는가 / 무엇이 필요한가 / 다음은 무엇인가

CYCLE
선택된 플레이 결과가 실제 World 에서 정확히 어떤 Rule 로 작동하는가
```

### 2.2 Master 의 중심 경로는 하나다

```text
Goal → Possibility → Capability → Frontier → Cycle
```

그 외 개념은 이 경로를 설명하거나 제한한다.

```text
CONTEXT        WorldState / Actor / Knowledge / Belief
DESIGN FILTER  Constraint
OPTIONAL       Conflict / Consequence / Reveal / Reframe / Candidate
```

### 2.3 Constraint 는 Stage 가 아니라 Filter 다

```text
              Constraint
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      Goal    Possibility  Capability
```

Constraint 때문에 새로운 Cycle Stage 를 추가하지 않는다.

### 2.4 Capability 의 필요성은 Possibility 에서 나온다

```text
BAD
Constraint → Combat System → Guard / Break / Counter

GOOD
Goal → Possibility → requires → Capability
Constraint ────────────────► constrains
```

---

## 3. 전체 흐름

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
                 MASTER LAYER
====================================================

1. WHY
World / Actor
       ↓
      Goal
       │
       ▼

2. OPTIONS
Goal
 ├─ Possibility A
 ├─ Possibility B
 └─ Possibility C
       │
       ▼

3. NEED
Possibility
       │ requires
       ▼
Capability
       │
       ▼
Existing World Overlay
IMPLEMENTED / PARTIAL / MISSING
       │
       ▼

4. NEXT
Frontier Candidates
       │
       ▼
Human Selects
       │
       ▼
Cycle Goal

====================================================
                 CYCLE LAYER
====================================================

01-cycle
→ 02-intent
→ 03-world-semantic
→ 04-gameview.spec
→ 05-review
→ 06-world-implementation
→ 07-view-implementation
→ 08-verification
       │
       ▼
Master Feedback
```

Master 와 Cycle 의 접합점은 정확히 둘이다.

```text
아래로   Frontier → Cycle Goal
위로     Verification → Master Feedback
```

---

## 4. 책임

### Human

Human 은 다음을 소유한다.

- Root Game Goal
- 핵심 World Premise
- 핵심 Design Constraint 승인 / 변경
- Constraint Conflict 의 최종 Trade-off
- 다음 Frontier / Cycle Goal 선택
- Master 의 상위 의미 변경 승인

### Master Design Agent

Master Agent 는 기본적으로 네 단계만 수행한다.

```text
WHY      Goal 의 원인과 주체를 확인한다.
OPTIONS  의미 있게 다른 Possibility 를 찾는다.
NEED     필요한 Capability 와 구현 상태를 확인한다.
NEXT     Frontier 후보를 제안한다.
```

필요한 경우에만 다음을 추가한다.

- Knowledge / Belief
- Actor Conflict
- Consequence
- Reveal / Reframe / New Goal
- Constraint Conflict
- Constraint Candidate

Master Agent 는 `world/` 와 `view/` 를 쓰지 않는다.
Overlay 확인을 위해 읽을 수는 있다.

### Cycle Agent

Human 이 Cycle Goal 을 선택한 뒤에는 기존 8 Stage 를 그대로 따른다.

Cycle Agent 는 구현 편의를 이유로 상위 Goal / Possibility / Capability / Constraint 의미를 바꾸지 않는다.
필요하면 Master 로 반환한다.

---

# 5. WHY — 왜 필요한가

WHY 는 Goal 의 이유를 만든다.

## 5.1 WorldState (`MW-*`)

현재 World 에서 참인 의미 있는 상태다.
Goal 을 발생시키는 원인이 될 수 있다.

```text
MW-FOREST-CORRUPTED
MW-DEER-MIGRATION-NORTH
MW-VILLAGE-FOOD-SHORTAGE
```

Master 의 WorldState 는 세계의 의미다.
구체적인 자료구조와 Rule 은 Cycle 이 소유한다.

## 5.2 Actor (`MA-*`)

자기 관점과 이해관계, Goal 을 가질 수 있는 주체다.

```text
Player / NPC / Creature / Faction / Guild / Settlement / Organization
```

## 5.3 Knowledge / Belief (`MK-*` / `MB-*`)

```text
Knowledge  Actor 가 알고 있는 정보
Belief     Actor 가 사실이라고 믿지만 틀릴 수도 있는 정보
```

항상 만드는 필수 Node 가 아니다.
Goal 또는 Possibility 를 설명하는 데 실제로 필요할 때만 만든다.

## 5.4 Goal (`MG-*`)

특정 Actor 가 원하는 Desired State 다.

```yaml
id: MG-DEFEAT-ANCIENT-KNIGHT
type: goal
owner: MA-PLAYER
desired_state: AncientKnightNoLongerBlocksFortress
motivation: [MG-ENTER-FORTRESS]
caused_by: [MW-FORTRESS-SEALED]
```

Goal 은 최소한 다음에 답한다.

```text
누가 원하는가?
왜 원하는가?
무엇이 달라지기를 원하는가?
```

필요한 경우에만 추가한다.

```text
어떤 WorldState 때문에 생겼는가?
어떤 Knowledge / Belief 에 기반하는가?
실패하면 무엇을 잃는가?
```

---

# 6. OPTIONS — 어떤 다른 방법이 있는가

Possibility (`MP-*`) 는 Goal 을 달성하거나 의미 있게 진전시키는 후보 방법이다.

Goal → Possibility 는 **OR 관계**다.

```text
MG: Village Food Problem 을 해결한다
├─ MP: Blackhorn 을 죽인다
├─ MP: 진짜 원인을 조사한다
├─ MP: 다른 Hunting Ground 를 찾는다
├─ MP: Fishing 으로 대체 식량을 확보한다
├─ MP: Caravan 으로 공급한다
└─ MP: Forest Corruption 을 정화한다
```

별도 Possibility 로 취급하려면 다음 중 하나 이상이 실질적으로 달라야 한다.

```text
Gameplay / Cost / Risk / Relationship / Consequence
```

단순 Action 이름이나 동의어는 별도 Possibility 가 아니다.

기본 규칙:

1. 하나의 해결법으로 바로 수렴하지 않는다.
2. 의미 있게 다른 대안이 있는지 먼저 본다.
3. 숫자를 맞추기 위해 억지 후보를 만들지 않는다.
4. Active Constraint 를 적용한다.
5. 명백히 `VIOLATED` 인 후보는 정상 경로에서 제거한다.

Constraint 적용은 별도 Stage 가 아니다.

```text
Goal
  ↓
Candidate Possibilities
  ↓
Constraint Filter
  ↓
Valid Possibilities
```

예:

```text
MG: 강한 적에게 큰 피해를 준다

P1 Critical Chance 를 올린다   → VIOLATED
P2 Weak Point 를 공격한다      → SATISFIED
P3 Rear Attack 한다            → SATISFIED
P4 Counter 한다                → SATISFIED
P5 Break 시킨다                → SATISFIED
```

---

# 7. NEED — 무엇이 필요한가

Possibility → Requirement 는 **AND 관계**다.

Requirement 는 필요한 것만 기록한다.

```text
Capability
Knowledge / Belief
WorldState
Actor Relationship
Resource / Ownership
다른 Goal
```

## 7.1 Capability (`MC-*`)

Capability 는 여러 Goal / Possibility 에서 재사용할 수 있는 **플레이 또는 World 의 의미 있는 능력**이다.
구현 모듈명이 아니다.

```yaml
id: MC-TRACK
type: capability
semantic: >
  Player 는 세계에 남은 흔적을 살펴 대상의 이동 방향을 추론할 수 있다.
required_by: [MP-TRACK-BLACKHORN]
overlay: MISSING
```

Capability 는 왜 필요한지 혼자 설명하지 않는다.
그 이유는 상위 Goal / Possibility 경로가 설명한다.

```text
Goal
  ↓
Possibility
  ↓ requires
Capability
```

## 7.2 Master Capability 와 Cycle Rule 을 분리한다

```text
MASTER
MC-PERFECT-GUARD
정확한 타이밍의 방어로 피해를 막고 공격권을 뒤집을 수 있다.

CYCLE / WORLD RULE
PERFECT_GUARD_WINDOW = 0.20 sec
Damage = 0
Attacker → EXPOSED
```

수치와 판정 공식은 Master 에 올리지 않는다.

## 7.3 Existing World Overlay

Capability 는 현재 World 와 Overlay 한다.

```text
IMPLEMENTED
PARTIAL
MISSING
```

판정 근거는 Cycle Verification 이다.

```text
IMPLEMENTED
해당 의미를 닫은 Cycle 이 있고 08-verification 이 통과했다.

PARTIAL
일부 의미만 있거나 현재 Possibility 가 요구하는 수준에 못 미친다.

MISSING
World 에 그 의미가 없다.
```

예:

```text
MP: 공격을 읽고 반격하여 Knight 를 돌파한다

MC-GUARD            IMPLEMENTED   C007
MC-COMBAT-BASIC     IMPLEMENTED   C007
MC-PERFECT-GUARD    MISSING
MC-COUNTER          MISSING
MC-BREAK            MISSING
```

Overlay 의 목적은 하나다.

> **다음에 새로 만들어야 할 Capability 를 찾는다.**

---

# 8. NEXT — 다음에 무엇을 만들까

Frontier (`FR-*`) 는 Graph 의 절대 Leaf 가 아니다.

> **현재 World 에는 아직 없지만 상위 Goal / Possibility 를 전진시키고,
> Client 에서 직접 플레이하여 검증할 수 있으며,
> 하나의 Cycle 안에서 의미적으로 닫을 수 있는 가장 작은 새로운 Capability 단위다.**

Frontier 는 다음만 확인한다.

1. `MISSING` 또는 필요한 수준에 못 미치는 `PARTIAL` 인가?
2. 상위 Goal / Possibility 를 실제로 전진시키는가?
3. Client 에서 직접 플레이하고 결과를 확인할 수 있는가?
4. 하나의 Cycle 안에서 닫을 수 있는가?
5. 코드 Task 가 아니라 World / Game Capability 인가?
6. Active Constraint 와 양립하는가?
7. 완료 후 재사용 가능한 Capability 로 누적되는가?

```text
BAD
Perfect Guard 시스템 구현

GOOD
Player 가 적의 공격 직전에 Guard 하여
피해를 받지 않고 상대를 노출 상태로 만들 수 있다.
```

Agent 는 Frontier 후보와 근거를 제시한다.
Human 이 하나를 선택하면 Cycle Goal 이 된다.

---

## 9. Master 운영 절차

Master 작업은 이 네 단계만 기본 절차로 사용한다.

### Step 1 — WHY

```text
누가 원하는가?
왜 원하는가?
무엇이 달라지기를 원하는가?
```

필요한 경우에만 WorldState / Knowledge / Belief 를 추가한다.

### Step 2 — OPTIONS

같은 Goal 을 달성하는 의미 있게 다른 Possibility 를 찾는다.
Active Constraint 에 명백히 어긋나는 후보는 제거한다.

### Step 3 — NEED

각 유효한 Possibility 가 실제로 요구하는 Requirement 를 찾는다.
재사용 가능한 플레이 의미는 Capability 로 만든다.
Existing World Overlay 는 노드 필드(`overlay*` · `implemented*`)의 현재 값으로 확인한다 —
새 판정과 갱신은 단계가 아니라 **Feedback(실측 반영) · Inject(초기 판정)의 절차**다.
관찰은 GRAPH.md 의 Capability Overlay 절이 렌더한다.

### Step 4 — NEXT

`MISSING / PARTIAL` 중 플레이 가능한 가장 작은 단위를 Frontier 로 제안한다.
Human 이 선택하면 Cycle 로 넘긴다.

```text
WHY → OPTIONS → NEED → NEXT → Human Select → Cycle
```

이것이 Master 의 전체 기본 Workflow 다.

---

## 10. Constraint 정책

Constraint (`DC-*`) 는 Human-owned Design Intent 다.
Actor Goal 이 아니다.

```text
Goal        Actor 가 원하는 Desired State
Constraint  Goal / Possibility / Capability 가 따라야 하는 설계 원칙
```

Schema 예시:

```yaml
id: DC-COMBAT-PLAYER-CAUSALITY
type: constraint
statement: >
  Major combat outcomes must result from observable world state and player decisions.
rationale: >
  Player 는 왜 중요한 전투 결과가 일어났는지 이해할 수 있어야 한다.
scope: [COMBAT]
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
status: APPROVED
```

```text
requires   반드시 만족해야 하는 조건
prohibits  허용하지 않는 형태
prefers    가능하면 우선하는 방향
```

Constraint 는 Capability 를 직접 필요하게 만들지 않는다.
Capability 의 필요성은 Possibility 에서 나온다.

Constraint 는 최종 형태를 제한한다.

```text
Need: Player 가 공격을 피할 수 있어야 한다

MC-EVADE-CHANCE
확률로 피격을 무효화한다
→ VIOLATED

MC-PHYSICAL-EVADE
실제 위치를 이동하여 충돌을 피한다
→ SATISFIED
```

필요할 때만 다음 값으로 평가한다.

```text
SATISFIED / VIOLATED / NOT_APPLICABLE / UNRESOLVED
```

모든 Node 에 Constraint 를 기계적으로 연결하지 않는다.
실제 설계 형태에 영향을 주는 경우에만 연결한다.

---

## 11. 보조 규칙 — 필요할 때만 사용한다

다음은 중요한 개념이지만 Master 의 필수 Step 이 아니다.
**실제 설계 결정에 영향을 줄 때만 사용한다.**

### Actor Conflict

Possibility 가 다른 Actor Goal 을 실제로 돕거나 방해할 때 기록한다.

```text
SUPPORTS / OPPOSES
```

### Consequence

선택이 중요한 WorldState / Relationship / Resource 를 바꿀 때 기록한다.

```text
CHANGES
```

### Reveal / Reframe / New Goal

새 정보가 후속 선택을 바꿀 때 기록한다.

```text
REVEALS / REFRAMES / CREATES_GOAL
```

### Narrative

Narrative 는 별도 Graph 가 아니다.
필요하면 다음 인과 경로로 표현한다.

```text
World Cause
→ Actor 인식 / 오해
→ Goal
→ Player Possibility
→ World 변화
→ 새로운 Knowledge
→ Goal 생성 / Reframe
```

### Constraint Candidate

여러 Goal / Possibility / Capability 에서 같은 설계 원칙이 반복될 때만 Candidate 를 제안한다.

```text
Repeated Pattern
→ Constraint Candidate
→ Human Review
→ APPROVED / REJECTED / REVISED
```

Agent 는 Candidate 를 자동 승인하지 않는다.

### Constraint Conflict

실제 선택에서 Constraint 가 충돌할 때만 Human 에게 올린다.

```text
Conflict
Affected Nodes
Possible Trade-offs
Expected Consequences
Decision By Human
```

---

## 12. Master ↔ Cycle 접합

접합점은 정확히 둘이다.

### 12.1 Frontier → Cycle Goal

Human 이 Frontier 를 선택하면 `01-cycle.md` 가 받는다.

```text
## MASTER TRACE
Frontier            FR-PERFECT-GUARD-OPENING
Source Goal         MG-DEFEAT-ANCIENT-KNIGHT
Source Possibility  MP-READ-AND-COUNTER
Target Capability   MC-PERFECT-GUARD
Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
```

Constraint 가 실제 설계 형태에 영향을 준 경우에만 Note 를 추가한다.

```text
Constraint Note
성공 조건은 확률이 아니라 관찰 가능한 Timing 이어야 한다.
```

Frontier 에서 출발하지 않은 Cycle 은 `없음` 과 사유를 적는다.

### 12.2 Verification → Master Feedback

Cycle 이 닫히면 `08-verification.md` 에 Master 로 돌려줄 사실만 기록한다.

```text
## MASTER FEEDBACK

Capability Overlay
MC-PERFECT-GUARD    MISSING → IMPLEMENTED    C010

Constraint Evaluation
DC-COMBAT-PLAYER-CAUSALITY  SATISFIED

Constraint Candidate
없음

Master Gap
없음
```

Cycle Agent 는 `master/` 를 직접 편집하지 않는다.
Master Feedback 을 근거로 Master 를 갱신한다.

### Cycle → Master Gap

상위 의미가 맞지 않으면 지어내지 않고 반환한다.

```text
View 부족             → GameView Specification
Spec 부족             → World Semantic
Semantic 부족         → Intent
Intent ≠ Cycle Goal   → Cycle Definition / Human
Cycle Goal ≠ Master   → MASTER / Human
```

Master 로 반환할 때:

```text
MASTER GAP
Frontier   <Frontier ID>
Conflict   무엇이 어긋나는가
Affected   MG-* / MP-* / MC-* / DC-*
Options    가능한 Trade-off
Decision   Human
```

---

## 13. Master 와 Cycle-local 의미 구분

| | Master | Cycle-local |
|---|---|---|
| 질문 | 왜 필요하고 어떤 다른 방법이 있는가? | 선택된 결과가 정확히 어떻게 성립하는가? |
| 수명 | 지속 | Cycle 종료 후 History |
| Goal ID | `MG-*` | `GOAL-*` |
| Possibility ID | `MP-*` | `POSSIBILITY-*` |
| 목적 | 대안 / 재사용 / Constraint / Frontier | Intent / Semantic / Rule 폐쇄 |
| 소유 | Master Agent + Human | Cycle Agent |

Cycle 안에서 Master Story 를 다시 확장하지 않는다.
새 Constraint 를 임의로 확정하지 않는다.
필요하면 Master Feedback 으로 반환한다.

---

## 14. Traceability

기본 Forward Trace:

```text
World / Actor
→ Goal
→ Possibility
→ Capability
→ Frontier
→ Cycle Goal
→ Intent
→ World Rule
→ Runtime
```

Constraint 가 실제 형태에 영향을 준 경우만 옆에서 연결한다.

```text
Constraint ──constrains──► Goal / Possibility / Capability
```

Reverse Trace:

```text
Runtime
→ World Rule
→ Intent
→ Cycle Goal
→ Capability
→ Possibility
→ Goal
→ Actor / World Cause
→ 필요한 경우 Constraint
```

모든 Runtime Event 가 Constraint 까지 연결될 필요는 없다.

---

## 15. Quality Gate

### WHY

- [ ] Goal Owner 가 명확한가?
- [ ] 왜 원하는지 설명할 수 있는가?
- [ ] Desired State 가 명확한가?
- [ ] 사실 Capability 를 Goal 로 표현한 것은 아닌가?

### OPTIONS

- [ ] 의미 있게 다른 방법을 탐색했는가?
- [ ] 동의어나 Action 이름을 중복하지 않았는가?
- [ ] Active Constraint 에 명백히 위반하는 후보를 제거했는가?

### NEED

- [ ] 실제 Requirement 가 명확한가?
- [ ] 재사용 가능한 플레이 의미는 Capability 인가?
- [ ] 기존 Goal / Capability 를 중복 생성하지 않았는가?
- [ ] Overlay 근거가 Verification 인가?

### NEXT

- [ ] 상위 Goal / Possibility 를 전진시키는가?
- [ ] Client 에서 플레이 가능한가?
- [ ] 한 Cycle 안에서 검증 가능한가?
- [ ] 코드 Task 가 아닌가?
- [ ] Constraint 와 양립하는가?
- [ ] 완료 후 재사용 가능한 Capability 로 남는가?

Optional 항목은 해당될 때만 검사한다.

```text
Actor Conflict
Consequence
Reveal / Reframe
Constraint Candidate
Constraint Conflict
```

Cycle 완료 판정은 `guides/verification.md` 를 단일 출처로 사용한다.

---

## 16. Anti-pattern

### Constraint 에서 시스템 목록을 만든다

```text
BAD
Constraint → Combat System → Guard / Break / Counter

GOOD
Goal → Possibility → Capability
Constraint ───────────────► constrains
```

### 모든 Context 를 필수로 만든다

```text
BAD
모든 Goal 에 WorldState / Knowledge / Belief 를 강제 생성

GOOD
Goal 을 이해하거나 선택을 바꾸는 Context 만 추가
```

### Possibility 숫자를 맞춘다

후보 수보다 의미 차이가 중요하다.

### 모든 Possibility 에 Conflict / Reveal / Reframe 를 채운다

실제 결정을 바꾸지 않으면 생략한다.

### Constraint 를 별도 Workflow Stage 로 만든다

Constraint 는 Filter 다.

### 구현 수치를 Master 에 저장한다

```text
BAD
Perfect Guard 는 반드시 0.20초다.

GOOD
Perfect Guard 는 확률이 아니라 관찰 가능한 Timing 조건으로 성공한다.
```

### Runtime Availability 와 Constraint Violation 을 혼동한다

```text
Constraint Violation  설계 자체가 정책과 양립하지 않는다.
Runtime Unavailable   유효한 설계지만 현재 World 에서 사용할 수 없다.
```

### Master 를 Cycle 안에서 확장한다

Cycle 은 Feedback 만 반환한다.

---

## 17. ID / Registry / 저장소

### ID

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

GOAL-*       Cycle-local Goal
POSSIBILITY-*  Cycle-local Possibility
INTENT-*     Cycle Intent
RULE-*       World Rule
C###-*       Cycle
```

기존 ID 를 강제 Migration 하지 않는다.
중요한 것은 Master 와 Cycle-local 의미를 구분하는 것이다.

새 Node 를 만들기 전에 Existing Registry 를 검색한다.
같은 Goal / Capability 를 이름만 바꿔 복제하지 않는다.

### 저장소

```text
HktAdvProtoH/
├── design/                    # 공정·기반 원본 — 팩 무관
│   └── Master-Intent-Graph-Policy.md
│
├── guides/
│   ├── master-graph.md
│   ├── master-frontier.md
│   ├── master-feedback.md
│   └── cycle-definition.md ~ verification.md
│
└── content/<pack>/            # 활성 팩 = 교체 단위
    ├── design/                # 그 팩의 컨텐츠 기획 원본 — 주입(Inject)의 입력
    ├── master/
    │   ├── README.md
    │   ├── SCHEMA.md
    │   ├── root.md
    │   ├── constraints/
    │   ├── graph/
    │   ├── frontier/          # 트랙(도메인)별 후보 파일 + README 인덱스
    │   ├── feedback/          # Cycle 반영 경위 — 한 Cycle = 한 파일
    │   └── candidates/
    │
    └── cycles/
```

`master/` 와 `cycles/` 는 **활성 팩 안**에 있다 — 팩을 갈아 끼우면 Graph 도 함께 바뀐다.
`master/` 는 History 가 아니라 현재 상태다.
`cycles/` 는 완료된 Cycle History 다.

Constraint 관련 별도 Guide 가 존재하더라도 기본 실행 순서에는 넣지 않는다.
Master 실행은 항상 `WHY → OPTIONS → NEED → NEXT` 로 표현한다.

---

## 18. 운영 원칙 요약

1. Master 와 Cycle 은 분리한다.
2. Master 의 기본 Workflow 는 `WHY → OPTIONS → NEED → NEXT` 네 단계뿐이다.
3. Goal 은 Actor 가 원하는 Desired State 다.
4. 하나의 Goal 에서 의미 있게 다른 Possibility 를 탐색한다.
5. Possibility 는 필요한 Requirement 를 가진다.
6. 재사용 가능한 플레이 의미는 Capability 로 둔다.
7. Capability 의 필요성은 Goal / Possibility 에서 나온다.
8. Constraint 는 별도 Stage 가 아니라 설계 Filter 다.
9. Constraint 는 Goal / Possibility / Capability 의 형태와 유효한 설계 공간을 제한한다.
10. Knowledge / Belief / Conflict / Consequence / Reveal / Reframe 은 필요할 때만 사용한다.
11. Overlay 는 `IMPLEMENTED / PARTIAL / MISSING` 으로 본다.
12. Frontier 는 Missing / Partial 중 플레이 가능한 가장 작은 다음 Capability 다.
13. Human 이 Frontier 중 Cycle Goal 을 선택한다.
14. Cycle 은 기존 8 Stage 를 변경하지 않는다.
15. Master 와 Cycle 의 접합점은 두 개뿐이다.
16. 아래로는 `Frontier → Cycle Goal` 이다.
17. 위로는 `Verification → Master Feedback` 이다.
18. 수치와 공식은 Master 가 아니라 Cycle / World Rule 이 소유한다.
19. 반복되는 Design Pattern 은 Candidate 로만 제안하고 Human 이 승인한다.
20. Runtime 은 가능한 한 `WHY → OPTION → NEED → CYCLE → RULE → RUNTIME` 으로 역추적 가능해야 한다.

---

## 19. Agent 최종 질문

Master Agent 는 아래 여덟 질문에 답할 수 있으면 된다.

```text
1. 누가 무엇을 왜 원하는가?
2. 같은 Goal 을 달성하는 의미 있게 다른 방법은 무엇인가?
3. Constraint 때문에 제거되거나 형태가 달라지는 방법이 있는가?
4. 각 유효한 Possibility 에 실제로 필요한 Capability 는 무엇인가?
5. 그 Capability 는 이미 존재하는가?
6. Missing / Partial 중 다음 Cycle 로 만들 가장 작은 Frontier 는 무엇인가?
7. 선택된 Frontier 를 Cycle 에 정확히 Trace 할 수 있는가?
8. Cycle 완료 후 어떤 Capability 가 Existing World 에 누적되는가?
```

필요할 때만 추가로 묻는다.

```text
누구의 Goal 과 충돌하는가?
무슨 WorldState 가 변하는가?
새로운 Knowledge 가 생기는가?
Goal 이 Reframe 되는가?
반복되는 Design Pattern 이 Constraint Candidate 인가?
```

---

## 20. 최종 정의

```text
WHY       왜 필요한가?
OPTIONS   어떤 방법들이 있는가?
NEED      그 방법을 가능하게 하려면 무엇이 필요한가?
NEXT      다음에 무엇을 만들까?
```

> **Master 는 Why / Options / Need / Next 를 결정한다.**
>
> **Cycle 은 선택된 Next 가 실제 World 에서 어떤 Rule 로 작동하는지 닫는다.**
>
> **Constraint 는 과정이 아니라 설계 선택을 제한하는 Filter 다.**

---

## 부록. 기존 정책에서 달라진 점

| 기존 | 변경 |
|---|---|
| Master Agent 절차가 세부 Step 다수로 이어짐 | `WHY → OPTIONS → NEED → NEXT` 4 Step 으로 통합 |
| Constraint Evaluation 이 독립적인 절차처럼 보임 | 각 선택 지점에서 적용하는 Filter 로 통합 |
| Actor Conflict / Consequence / Reveal / Reframe 가 기본 순서에 포함 | 필요할 때만 수행하는 보조 규칙으로 이동 |
| Constraint Discovery 가 기본 흐름에 포함 | 반복 Pattern 이 있을 때만 Candidate 제안 |
| 많은 Node Type 이 동일한 중요도로 보임 | Core / Context / Filter / Optional 로 우선순위 구분 |
| Master 운영과 Graph Schema 설명이 섞임 | 실제 사용 순서 중심으로 재배치 |
| Cycle 과의 관계가 여러 곳에서 반복 설명됨 | 접합점을 `Frontier → Cycle`, `Verification → Feedback` 두 개로 고정 |

기존 Cycle 8 Stage, Cycle Artifact, Completion Gate 는 변경하지 않는다.
