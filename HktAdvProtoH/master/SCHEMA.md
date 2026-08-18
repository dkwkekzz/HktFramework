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

CL-*    Class Definition        IT-*    Item Type          (growth/ — GR §37)
IP-*    Item Property           IM-*    Item Modifier
```

`II-*`(Item Instance)는 **Runtime World ID 다** — Master Registry 의 정적 Node 로
만들지 않는다 (GR §29 · §37). GR = `design/Master-Intent-Graph-Growth.md`.

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
id: DC-<NAME>
type: constraint

statement: >
  한 문장. 무엇이 참이어야 하는가.
rationale: >
  왜 그래야 하는가. 설명할 수 없으면 취향이지 Constraint 가 아니다.

scope:
  - <SCOPE>             # GLOBAL | COMBAT | ECONOMY | WORLD_TRAVEL | PLAYER_DEATH | ...

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
- from: DC-<NAME>
  type: CONSTRAINS            # CAUSES MOTIVATES WANTS BELIEVES KNOWS ACHIEVES REQUIRES
  to:   MC-<NAME>             # SUPPORTS OPPOSES CHANGES REVEALS REFRAMES CREATES_GOAL
  note: ''                    # CONSTRAINS SUPPORTS_CONSTRAINT CONFLICTS_WITH
```

---

## growth/ — Growth Graph (Class · Item Definition)

Capability 를 "세계에서 어떻게 얻는가"의 획득 경로 **Definition** 이다
(원본: GR = `design/Master-Intent-Graph-Growth.md`).
Definition 만 여기 둔다 — Runtime 에 실제로 생성된 Item Instance(`II-*`)와
모든 조합 결과의 사전 생성은 Master 에 오지 않는다 (GR §28~§29 · §31~§32).

```text
growth/
├── classes/          CL-*.yaml   (파일 하나 = Class 하나)
├── items/
│   ├── types/        IT-*.yaml
│   ├── properties/   IP-*.yaml
│   └── modifiers/    IM-*.yaml
└── growth-graph.md   Growth Overlay — Capability 획득 경로 판정
```

디렉터리는 첫 노드가 생길 때 만든다 (GR §40).
CL/IT/IP/IM 노드는 생성·변경 시 **GR §41 Growth Quality Gate** 를 통과해야 한다 —
체크리스트는 가이드에 복사하지 않고 원본을 직접 참조한다.

### growth/classes/CL-*.yaml

```yaml
id: CL-<NAME>
type: class

semantic: >
  이 Class 가 어떤 의미 있는 성장 상태인가.
  Skill 목록을 담는 Container 가 아니다 (GR §24.1)

origin_trace:               # 필수 — Class 는 세계와 Actor 가 상호작용한 결과다 (GR §24.2)
  world_state: [MW-...]
  goal:        [MG-...]
  possibility: [MP-...]

requires: [MC-...]          # 되기 전에 갖춰야 하는 것 — MC / MW / 관계 / Item (GR §26)
grants:   [MC-...]          # 되고 나서 쓸 수 있게 되는 것 — 기존 MC-* 를 가리킨다.
                            # Source 별 Capability 복제 금지 (GR §33)
transitions_to:             # Class Change — Tree 일 필요 없다. 진입 경로 복수 허용 (GR §25)
  - to: CL-<NAME>
    requires: [...]         # MC / MW / Item / 관계 / 기존 Class

constraints: [DC-...]
constraint_evaluation:
  DC-...: UNRESOLVED
```

### growth/items/ — IT- / IP- / IM-

```yaml
# types/IT-*.yaml — 아이템의 기본 의미 (GR §28.1)
id: IT-<NAME>
type: item_type
semantic: >
  <이 종류의 아이템이 세계에서 무엇인가>

# properties/IP-*.yaml — 세계적 성질만. 수치 옵션은 Node 가 아니다 (GR §28.2~§28.3)
id: IP-<NAME>
type: item_property
semantic: >
  <세계에서 의미를 가지는 성질 — Fire / Cursed / Living …>

# modifiers/IM-*.yaml — 행동·Capability 를 의미 있게 바꾸는 조합 요소 (GR §28.3)
id: IM-<NAME>
type: item_modifier
requires: [IP-...]
grants:   [MC-...]
```

구체 수치(공격력 +13 등)는 Cycle / World Rule 이 소유한다 (GR §28.2 · §39 — 정책 §7.2 와 동일).

### growth/growth-graph.md — Growth Overlay

```markdown
# Growth Overlay

기준 시점: <갱신한 시점>

| Capability | 획득 경로 (grants 하는 CL-* / IT-* / MA-*) | 근거 | 부족한 것 |
|---|---|---|---|
| MC-... | 없음 | ... | ... |
```

기존 `overlay.md`(그 의미가 세계에 **구현되어 있는가**)와 축이 다르다 —
여기는 그 Capability 를 세계 안에서 **얻는 경로가 존재하는가**다 (GR §22.1 · §39).
Growth 는 별도 Master Stage 가 아니다 — NEED 에서 발견된 Capability 위의 Overlay 다.

### Growth Edge 규칙

`grants` · `transitions_to` · `requires` 는 노드 안 필드로 표현한다 — `edges.yaml` 에
중복하지 않는다. `obtained_from` · `composed_from` · `owned_by` · `equips` 는
Runtime Instance 의 관계이며 Master 에 오지 않는다 (GR §38).

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

```

근거 칸에 Cycle 또는 실측을 적는다. **주장만 적지 않는다.**
이 파일에는 **현재 상태만** 둔다 — 무엇이 언제 바뀌었는지는 `HISTORY.md` 가 소유한다.

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
    Active Constraints   DC-<NAME>
    Constraint Eval      SATISFIED | UNRESOLVED — 판정 근거
    Observable Result    무엇을 보고 성공/실패를 아는가
    Why one Cycle        왜 한 Cycle 안에서 닫히는가
    Status               PROPOSED       # PROPOSED | SELECTED | DEFERRED | DROPPED
```

이 파일에는 **지금 고를 수 있는 후보만** 둔다. Cycle 이 닫히면 그 `FR-*` 를 지우고
결과를 `HISTORY.md` 에 적는다.

`VIOLATED` 후보를 여기에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
Agent 는 후보와 근거를 제공하되 우선순위를 확정하지 않는다.

---

## open-questions.md

Agent 가 임의로 결정하지 않고 남긴 것 — Constraint 승인 대기 · Constraint 충돌 ·
설계 공백 · Trade-off 가 모인다. Agent 가 쓰고 Human 이 `DECISION` 줄에 답한다.

```markdown
## Q<번호>. <한 줄 질문> — OPEN | CLOSED [· 차단]

    무엇          <무엇이 결정되지 않았는가>
    영향          <결정되지 않아 지금 무엇이 막히거나 흔들리는가>
    선택지        (a) ... → 그 결과
                  (b) ... → 그 결과
    DECISION      <PENDING>
```

`차단` 표시는 이것이 답해지기 전에는 다음 단계로 갈 수 없다는 뜻이다.
답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 `DECISION` 을 담아
`HISTORY.md` 로 옮긴다.** 기록은 남기되 여기에는 아직 답이 없는 것만 둔다.

---

## HISTORY.md

닫힌 것들의 보관소다. 살아 있는 문서가 가벼워야 매번 읽는 비용이 낮으므로,
무언가 닫히면 그 자리에서 지우고 여기로 옮긴다. Agent 는 평소 이 파일을 읽지 않는다.

```text
닫힌 Open Question      DECISION 을 그대로 옮긴다
Frontier 선택 기록       어떤 FR-* 가 어느 Cycle 로 닫혔는가 · 거기서 배운 것
Overlay 갱신 이력        무엇이 언제 승격·삭제되었는가와 그 근거
Constraint 반영 이력     신설·재작성·삭제와 그 사유
```

Agent 는 여기에 질문을 남길 뿐 스스로 답하지 않는다.
특히 Constraint 충돌은 해결하지 말고 Conflict · Affected Nodes · Trade-off ·
Expected Consequences 를 적어 노출한다.

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
