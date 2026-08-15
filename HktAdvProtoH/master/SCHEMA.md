# master/ 파일 형식

Master Layer 산출물의 골격. 항목 이름은 유지하고 내용만 채운다.
값이 없는 항목은 지우지 말고 `없음` 또는 사유를 적는다.

의미의 원본은 [../design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md) 다.
여기는 **형식**만 정한다.

---

## ID Namespace

```text
DC-*    Design Constraint       MG-*    Master Goal
MW-*    Master WorldState       MP-*    Master Possibility
MA-*    Master Actor            MC-*    Master Capability
MK-*    Master Knowledge        FR-*    Frontier Candidate
MB-*    Master Belief           CC-*    Constraint Candidate
```

Cycle-local 표기(`GOAL-*` `POSSIBILITY-*` `INTENT-*` `RULE-*` `C###-<name>`)는 기존 그대로다.
Master 와 Cycle-local 을 같은 Prefix 로 섞지 않는다.

표기는 대문자 + 하이픈 (`MC-PERFECT-GUARD`) — 기존 `RULE-MINE-001` 표기와 같은 계열이다.

---

## root.md

```markdown
# Root

## ROOT GAME GOAL
    <이 게임이 최종적으로 무엇이 되어야 하는가 — 한 문단>

## WORLD PREMISE
    <세계가 언제나 참이라고 전제하는 것들. 상태가 아니라 성질이다>

## OPEN QUESTIONS
    <아직 Human 이 결정하지 않은 것>
```

`root.md` 는 Human 소유다. Agent 가 임의로 바꾸지 않는다.

---

## constraints/DC-*.yaml

```yaml
id: DC-COMBAT-PLAYER-CAUSALITY
type: constraint

statement: >
  한 문장. 무엇이 참이어야 하는가.
rationale: >
  왜 그래야 하는가. 설명할 수 없으면 취향이지 Constraint 가 아니다.

scope:
  - COMBAT              # GLOBAL | COMBAT | ECONOMY | WORLD_TRAVEL | PLAYER_DEATH | ...

requires:  []           # 반드시 만족해야 하는 설계 조건
prohibits: []           # 허용하지 않는 설계 형태
prefers:   []           # 가능하면 우선하는 방향

status: DRAFT           # DRAFT | APPROVED | REVISED | REJECTED | SUPERSEDED
provenance:
  - HUMAN_DESIGN        # 또는 CANDIDATE:CC-* / CYCLE:C###

relations:
  supports: []          # SUPPORTS_CONSTRAINT
  conflicts_with: []    # CONFLICTS_WITH — 해결하지 말고 노출한다
```

수치·상수·판정 공식을 넣지 않는다 (`0.20 sec` 는 Cycle 소유).
특정 구현 모듈을 이유 없이 강제하지 않는다.

---

## graph/*.yaml

각 파일은 같은 골격을 쓴다. Node 파일은 `nodes:`, `edges.yaml` 은 `edges:` 아래에 항목을 둔다.

```yaml
# <파일 설명>
version: 1
nodes:
  - id: ...
  - id: ...
```

아래 절의 예시는 그 `nodes:` 아래에 들어가는 **항목 하나**의 형태다.

### graph/world-state.yaml — MW-

```yaml
- id: MW-FOREST-CORRUPTED
  type: world_state
  statement: Forest 가 Corrupted 상태다
  causes: [MG-...]            # 이 상태가 발생시키는 Goal
  changed_by: [MP-...]        # 이 상태를 바꾸는 Possibility
```

### graph/actors.yaml — MA-

```yaml
- id: MA-VILLAGE-HUNTER
  type: actor
  kind: NPC                   # PLAYER | NPC | CREATURE | FACTION | GUILD | SETTLEMENT
  perspective: >
    이 주체가 세계를 어떻게 보는가 · 무엇을 이해관계로 삼는가
  wants: [MG-...]
  knows:    [MK-...]
  believes: [MB-...]
```

### graph/knowledge.yaml — MK- / MB-

```yaml
- id: MK-BLACKHORN-TERRITORY
  type: knowledge             # knowledge | belief
  holder: [MA-...]
  statement: >
    확보한 정보(knowledge) 또는 사실이라 믿는 것(belief)
  contradicts: []             # belief 인 경우 어긋나는 MW-*
  revealed_by: [MP-...]
```

### graph/goals.yaml — MG-

```yaml
- id: MG-DEFEAT-ANCIENT-KNIGHT
  type: goal
  owner: MA-PLAYER
  desired_state: <원하는 세계의 상태>
  motivation: [MG-...]        # 왜 원하는가 — 상위 Goal 또는 서술
  belief_context: [MB-...]
  stakes: [<실패하면 잃는 것>]
  caused_by: [MW-...]
  constraints: [DC-...]
```

### graph/possibilities.yaml — MP-

```yaml
- id: MP-READ-AND-COUNTER
  type: possibility
  achieves: [MG-...]          # OR — 같은 Goal 의 대안 중 하나
  meaningful_difference: >
    다른 Possibility 와 Gameplay/Cost/Risk/Relationship/Consequence 중
    무엇이 실질적으로 다른가. 답할 수 없으면 동의어이지 대안이 아니다
  requires:                   # AND
    goals: []
    capabilities: [MC-...]
    knowledge: []
    world_state: []
    relationship: []
    resource: []
  supports: []                # 누구의 Goal 을 돕는가
  opposes:  []                # 누구의 Goal 을 방해하는가
  changes:  []                # 성공 시 바뀌는 MW-* / 관계 / 자원
  reveals:  []                # 새로 드러나는 MK-*
  creates_goal: []            # 새로 생기는 MG-*
  constraints: [DC-...]
  constraint_evaluation:
    DC-...: UNRESOLVED        # SATISFIED | VIOLATED | NOT_APPLICABLE | UNRESOLVED
```

### graph/capabilities.yaml — MC-

```yaml
- id: MC-PERFECT-GUARD
  type: capability
  semantic: >
    재사용 가능한 플레이 의미 한 문단. 왜 필요한지는 쓰지 않는다 —
    그것은 Goal/Possibility 경로가 설명한다
  required_by: [MP-...]
  constraints: [DC-...]
  constraint_evaluation:
    DC-...: UNRESOLVED
  overlay: MISSING            # IMPLEMENTED | PARTIAL | MISSING — 근거는 overlay.md
```

구현 모듈명(`world/combat/guard.ts`)을 `semantic` 에 쓰지 않는다.

### graph/edges.yaml

노드 안에서 표현되지 않는 관계만 여기에 둔다. 같은 관계를 양쪽에 중복 기록하지 않는다.

```yaml
- from: DC-COMBAT-PLAYER-CAUSALITY
  type: CONSTRAINS            # CAUSES MOTIVATES WANTS BELIEVES KNOWS ACHIEVES REQUIRES
  to:   MC-PERFECT-GUARD      # SUPPORTS OPPOSES CHANGES REVEALS REFRAMES CREATES_GOAL
  note: ''                    # CONSTRAINS SUPPORTS_CONSTRAINT CONFLICTS_WITH
```

---

## overlay.md

```markdown
# Capability Overlay

기준 시점: <갱신한 Cycle 또는 날짜>

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-PERFECT-GUARD | MISSING | — | 세계에 타이밍 방어 의미가 없다 |
| MC-GUARD | IMPLEMENTED | C007 08-verification | — |
| MC-COUNTER | PARTIAL | C007 (공격권 개념만) | 반격 전이 · 노출 상태 |

## 판정 기준
    IMPLEMENTED  그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
    PARTIAL      일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
    MISSING      세계에 그 의미가 없다

## 이번 갱신
    <MASTER FEEDBACK 에서 반영한 변화 · 없으면 `없음`>
```

근거 칸에 Cycle 또는 실측을 적는다. **주장만 적지 않는다.**

---

## frontier.md

```markdown
# Frontier

## 후보

### FR-PERFECT-GUARD-OPENING
    Playable Result      Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고
                         상대를 노출 상태로 만들 수 있다
    Source Goal          MG-DEFEAT-ANCIENT-KNIGHT
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PERFECT-GUARD (MISSING)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 성공 조건이 관찰 가능한 Timing 이다
    Observable Result    무엇을 보고 성공/실패를 아는가
    Why one Cycle        왜 한 Cycle 안에서 닫히는가
    Status               PROPOSED       # PROPOSED | SELECTED | DEFERRED | DROPPED

## 선택 기록
    | Frontier | 결정 | Cycle | 비고 |
    |---|---|---|---|
    | FR-... | SELECTED | C010-perfect-guard | |
```

`VIOLATED` 후보를 여기에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
Agent 는 후보와 근거를 제공하되 우선순위를 확정하지 않는다.

---

## candidates/CC-*.md

```markdown
# CC-COMBAT-PLAYER-CAUSALITY

## CANDIDATE STATEMENT
    <Constraint 로 승격하려는 원칙 한 문장>

## OBSERVED REPEATING PATTERN
    <어디서 몇 번 반복되었는가 — MP-* / MC-* / Cycle ID 로>

## AFFECTED NODES
## EXPECTED SCOPE
## REQUIRES
## PROHIBITS
## PREFERS
## POTENTIAL CONFLICTS
    <기존 DC-* 와의 충돌 · 없으면 `없음`>

## WHY THIS SHOULD BECOME A CONSTRAINT

## HUMAN DECISION
    PENDING        # PENDING | APPROVED | REJECTED | REVISED
    Reason
```

승인되면 `constraints/DC-*.yaml` 로 옮기고 `provenance` 에 `CANDIDATE:CC-*` 를 남긴다.
후보 파일은 지우지 않는다 — 그 원칙이 어디서 왔는지의 기록이다.
