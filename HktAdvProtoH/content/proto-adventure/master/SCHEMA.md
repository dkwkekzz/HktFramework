# master/ 파일 형식

Master Layer 산출물의 골격. 항목 이름은 유지하고 내용만 채운다.
값이 없는 항목은 지우지 말고 `없음` 또는 사유를 적는다.

의미의 원본은 [design/Master-Intent-Graph-Policy.md](../../../design/Master-Intent-Graph-Policy.md) 다.
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
CK-*    Combat Knowledge Definition                        (growth/knowledge/ — CK · HISTORY Q72)
GBC-*   Growth Balance Contract                            (growth/balance/ — GB §31)
```

`II-*`(Item Instance)는 **Runtime World ID 다** — Master Registry 의 정적 Node 로
만들지 않는다 (GR §29 · §37). GR = `design/Master-Intent-Graph-Growth.md`.

Cycle-local 표기(`GOAL-*` `POSSIBILITY-*` `INTENT-*` `RULE-*`)는 기존 그대로다.
Cycle ID 는 `C-<TRACK>-NNN-<name>` — 번호공간이 트랙 소유다 (frontier/README.md 병렬 규칙).
`C###-<name>`(C001~C023)은 트랙 도입 전의 옛 번호공간이다.
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
`rationale` 은 아래 **"읽히게 쓴다"** 규칙을 따른다 — 한 줄 요약이 아니라
지켜서 얻은 것과 어겼을 때 잃는 것을 실물 근거로 적는다.

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

### 모든 Node 공통 — 주소와 판정 기준

Graph 는 **의미의 저장소가 아니라 전달 계층**이다. 의미의 전문은 `source` 가 가리키는
기획서(`content/<pack>/design/`)가 소유하고, 노드는 그 의미의 **주소 + 구조(간선) +
상태**만 지닌다. 사람이 노드를 읽고 이해하는 것이 목표가 아니다 — 기획의 정보가
Frontier 후보를 거쳐 Cycle 에 정확히 전달되는 것이 목표다. 모든 Node 는 **두 겹 + 주소**다.

```text
① 한 줄     무엇인가         statement / desired_state / semantic / meaningful_difference
② 세계에서  world_shape:     이 노드가 "세계에 실제로 있다" 를 무엇으로 확인하는가
   주소     source:          의미의 전문이 사는 곳 — 기획서 약어 §번호 (파일 머리 인용표)
```

`source` 규칙 — 여기가 의미의 소유를 책임진다.

```text
필수다. 의미의 깊이가 필요한 작업(NEXT · Inject · Cycle)은 이 주소의 기획서 §를 연다.
grounded: false 노드는 "(이름만)" + 이름을 댄 문서 §를 적는다.
기획서에 없는 정밀화(닫힌 Q 의 결과 등)는 노드 산문으로 돌아오지 않는다 —
  경위는 HISTORY, 결과는 ①/world_shape 반영, Cycle 전달 형태는 Frontier 후보가 싣는다.
detail 필드는 폐기되었다 — "왜 그런가 · 무엇이 뒤따르는가" 는 기획서와
  Goal/Possibility 경로(간선)가 답한다. 새로 쓰지 않는다.
```

`world_shape` 규칙 — 여기가 구현 정합을 책임진다. **의미 산문 중 유일하게 노드에
남는 것**이다 — 사람용 설명이 아니라 overlay 판정의 수락 기준(master ↔ 08-verification
계약)이기 때문이다.

```text
관찰 가능한 조건으로 쓴다 — "플레이어가 X 하면 Y 가 보인다".
구현 모듈명·파일명·함수명을 쓰지 않는다 (그것은 Cycle 소유다).
수치·공식을 쓰지 않는다 (Cycle 의 03-world-semantic.md 소유다).
이 칸이 비면 그 노드는 Cycle 이 받아 갈 수 없다 — 사유를 적는다.
Cycle 은 이 칸을 만족시켰는지로 08-verification 을 쓰고, 그 결과가 overlay 로 돌아온다.
```

`implemented:` 는 그 `world_shape` 가 지금 `world/` `view/` 에 있는가다.

```text
PRESENT | PARTIAL | ABSENT       근거는 overlay.md 가 소유한다 (여기에는 값만)
```

Capability 의 기존 `overlay:` 필드가 같은 역할을 한다 — Capability 는 `overlay:` 를
쓰고 나머지 Node 는 `implemented:` 를 쓴다. 두 이름을 통일하지 않는 이유는
`overlay:` 가 이미 닫힌 Cycle 13 개의 피드백 경로에 쓰이고 있어서다.

### graph/world-state.yaml — MW-

```yaml
- id: MW-FOREST-CORRUPTED
  type: world_state
  statement: Forest 가 Corrupted 상태다
  source: BW §12              # 의미의 주소 — 전문은 기획서 소유
  world_shape: >
    <이 상태가 세계에 있다는 것을 무엇으로 확인하는가>
  implemented: ABSENT         # PRESENT | PARTIAL | ABSENT — 근거는 overlay.md
  arises_from: [MW-...]       # 이 상태를 낳은 상위 세계 상태 (World → World 인과)
  causes: [MG-...]            # 이 상태가 발생시키는 Goal
  changed_by: [MP-...]        # 이 상태를 바꾸는 Possibility
  demands: [MC-...]           # 이곳에서 살아남거나 일하려면 갖춰야 하는 Capability
```

`demands` 는 **장소가 요구하는 것**이다. Possibility 의 `requires` 와 헷갈리면 안 된다.

```text
requires   이 방법을 쓰려면 무엇이 필요한가      — 방법의 조건
demands    이곳을 감당하려면 무엇이 필요한가      — 장소의 조건
```

둘을 섞으면 "그 지역에 들어간다" 가 Possibility 로 올라온다. 장소는 방법이 아니다 —
같은 장소를 여러 방법으로 감당할 수 있어야 Possibility 가 OR 갈래로 성립한다.
Capability 쪽 거울은 `demanded_by` 다 (`required_by` 와 같은 방식의 쌍).

`arises_from` 이 세계의 인과 척추다. 어떤 상태가 왜 존재하는지를 **간선으로** 남긴다 —
`statement` 안에 한국어로 "A 때문에 B" 라고 써 두는 것으로 대신하지 않는다. 그렇게 하면
그래프가 아니라 주석 달린 목록이 된다. 최상위 전제만 `arises_from: []` 이다.

### graph/actors.yaml — MA-

```yaml
- id: MA-VILLAGE-HUNTER
  type: actor
  kind: NPC                   # PLAYER | NPC | CREATURE | FACTION | GUILD | SETTLEMENT
  perspective: >
    이 주체가 세계를 어떻게 보는가 · 무엇을 이해관계로 삼는가
  source: BW §22
  world_shape: >
    <이 주체가 세계에 있다는 것을 무엇으로 확인하는가>
  implemented: ABSENT         # PRESENT | PARTIAL | ABSENT
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
  source: CK §3
  world_shape: >
    <이 정보가 세계에 있다는 것을 무엇으로 확인하는가 —
     모를 때 무엇이 가려져 있고 알고 나면 무엇이 보이는가>
  implemented: ABSENT         # PRESENT | PARTIAL | ABSENT
  contradicts: []             # belief 인 경우 어긋나는 MW-*
  revealed_by: [MP-...]
```

### graph/goals.yaml — MG-

```yaml
- id: MG-DEFEAT-ANCIENT-KNIGHT
  type: goal
  owner: MA-PLAYER
  desired_state: <원하는 세계의 상태>
  source: BW §30
  world_shape: >
    <이 Goal 이 세계에서 성립한다는 것을 무엇으로 확인하는가 — 달성 판정의 관찰 조건>
  implemented: ABSENT         # PRESENT | PARTIAL | ABSENT
  motivation: [MG-...]        # 왜 원하는가 — 상위 Goal 또는 서술. 여러 개를 병렬로 둔다.
                              # 하나로 고정하지 않는다는 것은 0 개로 둔다는 뜻이 아니다
  belief_context: [MB-...]
  stakes: [<실패하면 잃는 것>]
  caused_by: [MW-...]
  constraints: [DC-...]
```

`stakes` 가 비면 Goal 이 아니다 — 잃을 것이 없으면 아무도 그것을 원하지 않는다.
채울 수 없으면 그 노드는 Goal 이 아니라 Capability 인지 다시 검사한다.

### graph/possibilities.yaml — MP-

```yaml
- id: MP-READ-AND-COUNTER
  type: possibility
  achieves: [MG-...]          # OR — 같은 Goal 의 대안 중 하나
  meaningful_difference: >
    다른 Possibility 와 Gameplay/Cost/Risk/Relationship/Consequence 중
    무엇이 실질적으로 다른가. 답할 수 없으면 동의어이지 대안이 아니다
  source: R1 §9
  world_shape: >
    <이 경로가 세계에서 열려 있다는 것을 무엇으로 확인하는가>
  implemented: ABSENT         # PRESENT | PARTIAL | ABSENT
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
    재사용 가능한 플레이 의미 한두 문장. 왜 필요한지는 쓰지 않는다 —
    그것은 Goal/Possibility 경로가 설명한다
  source: R1 §7 · BW §20      # 의미의 주소 — 전문·이유·구분은 기획서 소유
  world_shape: >
    <이 능력이 세계에 있다는 것을 무엇으로 확인하는가 — Cycle 이 이 칸을 닫는다>
  part_of:                    # 이 조각이 속한 전체 — 노드가 목록으로 뽑혀도 자리가 보이게 한다
    grounded: true            # false = 근거 문서가 이름만 댔다 — semantic 은 Agent 의 잠정
                              # 번역이며, 그 전체의 설계 문서가 서면 개정한다
    memberships:              # 하나 이상 — 첫 항목이 주 소속. 여러 시스템·여러 자리 허용
      - system: MS-<NAME>     # graph/systems.yaml 의 시스템 ID — 지어내지 않는다
        segment: <SEG-ID>     # 그 시스템 안의 자리 (층·칸). 자리가 없으면 생략
        source: <이 소속의 근거 문서·절. 이름만이면 "(이름만)">
        role: <선택 — 이 시스템에서 맡는 몫이 소속만으로 안 읽힐 때 한 구절>
  required_by:  [MP-...]      # 이 능력을 요구하는 방법
  demanded_by:  [MW-...]      # 이 능력을 요구하는 장소
  constraints: [DC-...]
  constraint_evaluation:
    DC-...: UNRESOLVED        # 판정 값만 — 사유·실측 서사는 08-verification 소유
  overlay: MISSING            # IMPLEMENTED | PARTIAL | MISSING
  overlay_evidence: C010 08-verification   # 주소만 — Cycle ID / 코드 실측 포인터.
                              # 무엇이 어떻게 닫혔는지를 여기 재서술하지 않는다
  overlay_gap: <PARTIAL 일 때 — 남은 것 한두 줄>
```

구현 모듈명(`world/combat/guard.ts`)을 `semantic` 에 쓰지 않는다.

`part_of` 규칙 — 여기가 "이게 왜 있는지" 의 이해를 책임진다.

```text
required_by/demanded_by 는 누가 요구하는가(필요)를 답하고, part_of 는 어떤 전체의
조각인가(자리)를 답한다 — 둘은 다른 질문이다. 목록·Frontier 로 뽑힌 노드가 홀로
읽혀도 part_of 만으로 자리가 보여야 한다.
시스템과 자리의 단일 출처는 graph/systems.yaml 이다 — part_of 에서 지어내지 않는다.
소속은 여럿일 수 있다 (한 조각이 두 시스템, 또는 한 시스템의 두 자리에 속한다 —
  MC-BREAK · MC-DISCOVER-WEAKNESS 가 실례다). 첫 항목이 주 소속이다.
깊이는 두 단계(system → segment)로 고정한다 — 더 깊은 계보가 실제 근거 문서에서
  나타나기 전에는 층을 만들지 않는다 (지어내지 않는다). 그때가 오면 segment 경로를
  늘리는 것이 아니라 **레지스트리의 시스템에 parent: MS-* 를 더해 시스템 쪽을
  중첩한다** — 소속(membership)의 형태는 그대로 남고, 검증·시각화도 레지스트리
  한 곳만 확장하면 된다.
grounded 는 노드에 하나다 — 소속마다 갈리면 "어디서든 확정이면 true" 가 아니라
  semantic 문안이 확정 근거(문서 문장 또는 닫힌 Cycle)를 가졌는가로 판정한다.
grounded: false 노드는 Frontier 후보의 Target 으로 세우지 않는다 — 그 전체의 설계
문서가 먼저다 (MC-PREDICT 보류가 이 규칙의 선례다 — HISTORY).
정합은 도구가 강제한다 — 없는 시스템·자리 참조는 master:graph ERROR 다.
```

### graph/systems.yaml — MS- (시스템 레지스트리)

`part_of` 가 가리키는 "전체" 의 목록 — 척추의 단일 출처다.

```yaml
version: 1
systems:
  - id: MS-<NAME>
    name: <사람이 부르는 이름>
    source: <이 전체를 정의하는 문서·절>
    status: DEFINED           # DEFINED | DRAFT(초안 — Human 승인 대기) | PLANNED(이름만)
    semantic: >
      <이 시스템이 무엇인가 한 문단>
    segments:                 # 순서 있는 자리 — 아래에서 위로, 첫 항목이 바닥.
      - { id: <SEG-ID>, name: <자리 이름> }   # 순서가 없으면 segments 생략
```

시스템은 근거 문서가 이미 가진 구조(층·사슬·게이트)만 등록한다 — 레지스트리가
분류 체계를 발명하는 순간 Constraint 로 시스템 목록을 만드는 것과 같은 잘못이 된다.
status: DRAFT/PLANNED 시스템은 "문서를 기다리는 전체" 를 그래프에 보이게 하는 자리다 —
그 시스템에 결손의 반쪽을 맡긴 노드는 grounded: false 로 남는다.

`overlay:` / `implemented:` 에는 **값만** 둔다 — 근거·정정 경위·날짜를 노드 주석으로
쌓지 않는다. 근거는 `overlay.md`, 경위는 `HISTORY.md` 소유다 (CLAUDE.md 원칙 20).

`required_by` 와 `demanded_by` 가 **둘 다 비면** 그 Capability 는 노드가 아니다 —
아무도 요구하지 않는 능력은 세계가 필요로 하지 않는 것이다. 어느 쪽이든 하나는
차 있어야 하고, 그것이 "필요가 먼저" 를 지키는 검사점이다
(DC-GROWTH-NEED-FROM-POSSIBILITY — Item 의 `grants` 도 이 둘 중 하나가 찬 MC-* 만 가리킨다).

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
├── knowledge/        CK-*.yaml   (파일 하나 = 전투법 하나)
├── balance/          GBC-*.yaml  (파일 하나 = 성장 하나)
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
detail: >
  <풀어서 — 이 형태로 노는 사람이 실제로 무엇을 반복하는가 ·
   다른 형태와 무엇으로 갈리는가>
world_shape: >
  <이 형태가 세계에 있다는 것을 무엇으로 확인하는가>

origin_trace:               # 필수 — Class 는 세계와 Actor 가 상호작용한 결과다 (GR §24.2)
  world_state: [MW-...]
  goal:        [MG-...]
  possibility: [MP-...]

requires: [MC-...]          # 되기 전에 갖춰야 하는 것 — MC / MW / 관계 / Item (GR §26)
grants:   [MC-...]          # 되고 나서 쓸 수 있게 되는 것 — 기존 MC-* 를 가리킨다.
                            # Source 별 Capability 복제 금지 (GR §33)
grants_note: >              # 가리킬 기존 MC-* 가 없어 적지 못한 것과 그 사유 (없으면 생략)
transitions_to:             # Class Change — Tree 일 필요 없다. 진입 경로 복수 허용 (GR §25).
  - to: CL-<NAME>           # **한 칸에 여러 형태가 설 수 있다** (Human 결정 — HISTORY Q69(b))
    requires: [...]         # MC / MW / Item / 관계 / 기존 Class

# ── 관문 넷 — 이 Class 가 닫혔는지를 값으로 대조하는 자리 (Human 결정 — HISTORY Q70(c))
response: >                 # 맞는 순간의 그 하나뿐인 자리에 이 Class 는 무엇을 끼우는가
                            #   DC-GROWTH-CLASS-OWNS-THE-RESPONSE
counterplay: []             # 상대가 이 형태를 어떻게 막는가 — 하나 이상, 세계에서 발견 가능해야 한다
                            #   DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY
cannot_yet: []              # 이 층이 아직 할 수 없는 것 — 다음 Layer 의 출발점이다
                            #   DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS
extends_toward: >           # 원리가 하나 더해지면 어디로 넓어지는가 — 방향 하나면 된다.
                            #   상위 Class 를 미리 설계하는 자리가 아니다
                            #   DC-GROWTH-CLASS-CLOSES-BEFORE-THE-NEXT-LAYER

constraints: [DC-...]
constraint_evaluation:
  DC-...: UNRESOLVED
```

`response` · `counterplay` · `cannot_yet` · `extends_toward` 는 **비면 그 Class 는 닫히지
않은 것이다** — `npm run master:graph` 가 경고한다. FC §12 는 Class 하나에 열두 질문을
요구하지만 칸이 된 것은 그중 넷뿐이다 (Human 결정 — HISTORY Q70(c)): 나머지 여덟(원리 ·
판타지 · 반복 행동 · Aura · 피해 외 세계 변화 · 탐험 쓰임 · 숙련 행동 · 실루엣)은 다른
DC 가 값으로 요구하지 않으므로 `semantic` · `detail` · `world_shape` 산문에 남는다.

### growth/items/ — IT- / IP- / IM-

```yaml
# properties/IP-*.yaml — 세계적 성질만. 수치 옵션은 Node 가 아니다 (GR §28.2~§28.3)
id: IP-<NAME>
type: item_property
semantic: >
  <세계에서 의미를 가지는 성질 — Fire / Cursed / Living …>
detail: >
  <풀어서 — 비슷한 다른 성질과 무엇으로 갈리는가>
world_shape: >
  <이 성질이 있다는 것을 무엇으로 확인하는가>
origin_trace:                 # 필수 — BW §11 · §33 · DC-WORLD-RESOURCE-ADAPTATION-TRACE
  world_state: [MW-...]       # 어느 세계 상태에서 나왔는가
  pressure: >
    <그곳의 무엇이 물질을 몰아붙였는가. 없으면 "없음" 과 그 사유>
  why_it_remains: >
    <왜 이것만 남았는가 — 물질은 살아남는 것이 아니라 잔존하는 것이다>
  human_value: >
    <문명권에서는 불가능한 어떤 문제를 푸는가>

# types/IT-*.yaml — 아이템의 기본 의미 (GR §28.1)
id: IT-<NAME>
type: item_type
semantic: >
  <이 종류의 아이템이 세계에서 무엇인가>
detail: >
  <풀어서>
world_shape: >
  <이것이 세계에 있다는 것을 무엇으로 확인하는가>
origin_trace:
  world_state: [MW-...]
  property:    [IP-...]       # 어느 성질에서 이 쓸모가 나왔는가
  human_value: >
    <왜 값진가>

# modifiers/IM-*.yaml — 행동·Capability 를 의미 있게 바꾸는 조합 요소 (GR §28.3)
id: IM-<NAME>
type: item_modifier
semantic: >
  <이 조합 요소가 무엇인가>
detail: >
  <풀어서>
requires: [IP-...]
grants:   [MC-...]            # 반드시 **기존** MC-* 를 가리킨다
```

`grants` 규칙 — 여기가 Growth 의 방향을 지킨다.

```text
grants 는 이미 어떤 Possibility 가 요구하고 있는 MC-* 만 가리킨다.
이 Item 을 정당화하려고 새 MC-* 를 만들지 않는다 (DC-GROWTH-NEED-FROM-POSSIBILITY · BW §18).
가리킬 기존 MC-* 가 없으면 grants 를 비우고 `grants_note` 에 그 사유를 적는다 —
성질만 있고 능력을 열지 않는 자원은 정상이다. 세계압은 가능성을 늘릴 뿐
Loot 를 보장하지 않는다 (BW §12).
같은 의미의 MC-* 를 Source 별로 복제하지 않는다 (DC-GROWTH-NO-CAPABILITY-DUPLICATION).
```

`origin_trace` 가 비면 그 Item 은 "좋은 것을 위험한 곳에 배치한" 것이 된다 —
BW §11 · §34 가 금지하는 바로 그 방향이다 (DC-WORLD-RESOURCE-ADAPTATION-TRACE).

구체 수치(공격력 +13 등)는 Cycle / World Rule 이 소유한다 (GR §28.2 · §39 — 정책 §7.2 와 동일).

### growth/knowledge/CK-*.yaml — 전투법 정의

전투법(Combat Knowledge — CK = `content/proto-adventure/design/Design-Combat-Knowledge-Extension-R0.md`)의
**Definition** 이다. 전투법은 앎이 아니라 획득·보유·장착·깊이·전수의 형태를 가진 정의라서
아이템 정의와 같은 자리(growth/)에 산다 (HISTORY Q72). 경계는 CK §4 · §5 다 —

```text
MK-*  (graph/knowledge.yaml)   사실 — 누가 아는가 · 무엇과 어긋나는가 · 무엇이 드러내는가
CK-*  (growth/knowledge/)      전투법 — 그 사실을 운용으로 바꾼 완성된 판단법의 정의
```

디렉터리는 첫 노드가 생길 때 만든다 (GR §40 과 같다). 개별 전투법을 그래프 노드로
복제하지 않는다 — graph 에는 전투법 층을 여는 Capability(MC-LEARN/CARRY/CONDUCT/…)만 있다.

```yaml
id: CK-<NAME>
type: combat_knowledge

semantic: >
  이 전투법이 어떤 완성된 판단법인가 — 내부 규칙이 아니라 의미로 적는다 (CK §2 · §30)
detail: >
  <풀어서 — 이것을 지닌 몸과 지니지 않은 몸이 같은 상황에서 무엇이 갈리는가>
world_shape: >
  <이 전투법이 세계에 있다는 것을 무엇으로 확인하는가 —
   지녔을 때 행동이 어떻게 달라지고, 그 판단이 무엇으로 읽히는가>

kind: RESPONSE | AURA | ENEMY | ABILITY    # CK §7 의 네 계열

required_knowledge: [MK-...]  # 이 전투법이 전제하는 사실 (CK §6) — 없으면 []
acquired_from: >              # 세계 안의 획득 원인 (CK §8 — DC-KNOWLEDGE-HAS-A-WORLD-CAUSE).
                              # 비면 그 전투법은 메뉴의 Perk 다 — 만들지 않는다
conducts: [MC-...]            # 이 판단법이 운용하는 **기존** Capability —
                              # 없는 Capability 를 만들어내지 않는다 (CK §12 ·
                              # DC-KNOWLEDGE-RUNS-CAPABILITY-NEVER-CREATES-IT)

constraints: [DC-...]
constraint_evaluation:
  DC-...: UNRESOLVED
```

여기에 두지 않는 것 — 내부 판단 규칙·우선순위 값·상황 판정 조건·깊이 문턱 수치.
그것은 이 층을 세우는 Cycle 의 `03-world-semantic.md` 소유다 (정책 §7.2).
깊이 단계(CK §18)가 갈리면 단계마다 **무엇을 새로 헤아리는지**까지만 `detail` 이 적는다.

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

### growth/balance/GBC-*.yaml — Growth Balance Contract

성장 하나가 **치른 것과 준 것이 맞는가**를 적는 자리다 (원본: GB =
`content/proto-adventure/design/Design-Growth-Balance-R0.md` §31).
파일 하나 = 성장 하나. Human 결정으로 이 세 번째 자리가 섰다 (HISTORY Q58(c)).

세 자리가 축이 다르다 — 헷갈리면 안 된다.

```text
overlay.md          그 의미가 세계에 구현되어 있는가          있는가 / 없는가
growth-graph.md     그것을 세계 안에서 얻는 경로가 있는가      가질 수 있는가 / 없는가
growth/balance/     그 값이 치른 것과 맞는가                  값이 맞는가 / 어긋나는가
```

```yaml
id: GBC-<NAME>
type: growth_balance_contract

grants:   [MC-...]            # 이 성장이 여는 Capability — 반드시 기존 노드
route: >
  세계 안에서 이것을 얻는 방법 한 문장 (어느 Cycle · 어느 획득 경로인가)
tier: GT0 | GT1 | GT2 | GT3 | GT4 | GT5      # graph/systems.yaml 의 MS-GROWTH-TIER 자리

cost_profile:                 # 1 매우 낮음 ~ 5 매우 높음 (GB §5)
  time: 0                     # **세계의 수치가 아니다** — 다른 성장과 견주기 위한 상대 단위다
  risk: 0
  skill: 0
  knowledge: 0
  resource: 0
  opportunity: 0
  repeatability: 0            # 쉽게 반복할수록 낮다

reward_profile:               # 1 ~ 5 (GB §6~§13)
  vertical_power: 0           # 하던 것을 얼마나 세게 하는가
  survivability: 0
  capability_access: 0        # **없던 것을 가능하게 하는가** — GB 가 가장 중요하다고 한 항
  applicability: 0            # 얼마나 넓은 상황에 걸리는가
  reliability: 0              # 얼마나 쉽게 발동하는가
  permanence: 0
  economic_utility: 0

power_envelope:               # 무엇을 얼마나 바꿀 작정인가 (GB §25) — 실측이 대조할 선언
  <상황>: <의도한 변화>

capability_reach:             # 통하는 것 · 부분적인 것 · 통하지 않는 것 (GB §23 · DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS)
  effective:   []
  partial:     []
  ineffective: []

gate_coverage: []             # 이 성장이 여는 관문 (GB §24) — 비면 "관문을 열지 않는다"

constraints: [DC-...]
validation:
  static: PENDING | PASS | FAIL          # 비교 집합 안에서 Dominance·Tier·Envelope 검사 (GB §30 Phase 1)
  benchmark: N/A | PENDING | PASS | FAIL # 전/후 실행 대조 — **Cycle 08 이 돌리고 결과만 여기 적는다**
  human_review: REQUIRED | DONE          # 마지막 판단은 사람이다 (GB §30 Phase 3)
```

여기에 두지 않는 것 — Benchmark 장면과 측정 항목, 실패 상태 코드, 세계의 수치·공식.
같은 조건을 전후로 굴려 재는 일은 Cycle 의 `08-verification.md` 와 검증 도구가 소유하고,
이 파일은 **무엇을 선언했는가와 그 결과가 무엇이었는가**만 담는다 (정책 §7.2).

`cost_profile` · `reward_profile` 의 값은 **비교 단위이지 세계의 수치가 아니다** (GB §5) —
피해량·경험치·요구 개수 같은 것은 여전히 Cycle 의 `03-world-semantic.md` 소유다.
비교 집합이 하나뿐이면 `static: PENDING` 이다 — 견줄 상대가 없으면 Dominance 를 잴 수 없다.

### Growth Edge 규칙

`grants` · `transitions_to` · `requires` 는 노드 안 필드로 표현한다 — `edges.yaml` 에
중복하지 않는다. `obtained_from` · `composed_from` · `owned_by` · `equips` 는
Runtime Instance 의 관계이며 Master 에 오지 않는다 (GR §38).

---

## overlay.md — 생성물

`overlay.md` 는 GRAPH.md 처럼 **생성물이다. 손으로 고치지 않는다** —
`npm run master:graph` 가 아래 원본에서 만든다.

```text
표의 값 (노드 필드가 소유)
  capabilities.yaml     overlay: IMPLEMENTED | PARTIAL | MISSING
                        overlay_evidence: >-   근거 — Cycle ID 또는 코드 실측. 주장만 적지 않는다
                        overlay_gap: >-        부족한 것 — PARTIAL/MISSING 이면 반드시 채운다
  possibilities.yaml    overlay_missing: >-    이 경로의 요구 중 없는 것
                        overlay_note: >-       비고 — 경로가 지금 어디까지 닫혔는가
  world-state/actors/   implemented: PRESENT | PARTIAL | ABSENT
  knowledge.yaml        implemented_note: >-   지금 세계에 있는 것 / 없는 것

편집 산문 (graph/overlay-notes.yaml 이 소유)
  header · 섹션 구성(제목·intro·행 순서·묶인 행) · 가장 큰 구멍 절
  "층이 요구하는 것" 표는 어디에도 적지 않는다 — demands × overlay 에서 계산된다
```

값이 없는 근거/부족 칸은 필드를 생략한다 — 생성물에 `—` 로 나온다.
새 Capability 는 노드 필드와 함께 `overlay-notes.yaml` 의 해당 섹션 행에 올린다 —
빠뜨리면 생성 시 경고가 난다. 판정 경위는 `feedback/<CycleId>.md` 소유다.

---

## frontier/ — 트랙별 파일

Frontier 는 디렉터리다 — 트랙(도메인)마다 한 파일, 그리고 인덱스 하나.

```text
frontier/README.md      트랙 목록 표 · 병렬 규칙 · 트랙 간 순서 · 트랙 밖 "지금 열 수 없는 것"
frontier/<트랙>.md      그 트랙의 후보 · 추천 순서 · SELECTED · 지금 열 수 없는 것 — 네 절뿐
```

트랙 파일의 후보 키는 **FR-ID** 다 — 위치 번호(1..N)를 매기지 않고, 후보가 줄어도
남은 후보를 다시 매기지 않는다. `SELECTED` 는 트랙마다 하나다.

```markdown
# Frontier — ITEM 트랙

## 한눈에 보기 — 추천 순서대로

| 순위 | FR | 기능 | 세계에 없는 것 | 크기 | 추천 사유 (한 줄) |
|---|---|---|---|---|---|

## 후보

### FR-PERFECT-GUARD-OPENING — 완벽한 막기
    무엇               방어의 성패가 시작 시각과 공격이 닿은 시각의 관계로 갈린다
    세계에 생기는 것    ① 방어에 시작 시각이 남는다 ② 그 시각과 타격 시각의 관계로
                       결과가 갈린다 ③ 관찰: 무엇이 왜 그렇게 판정되었는가
    아닌 것            되받아치기가 아니다 · 무적이 아니다 · 확률이 아니다
    이미 있는 것        막기 행동과 정면 판정 (코드 대조 — world/rules/guard.ts)
    결과               Playable    Player 가 적의 공격 직전에 Guard 하여 피해를 받지
                                   않고 상대를 노출 상태로 만든다
                       Observable  무엇을 보고 성공/실패를 아는가
    Trace              MG-DEFEAT-ANCIENT-KNIGHT / MP-READ-AND-COUNTER ·
                       Target MC-PERFECT-GUARD (MISSING) · 근거 R1 §N
    Constraints        DC-<NAME> — Eval 은 형태를 실제로 좁힐 때만 한 줄
    판정               한 Cycle: <왜 한 Cycle 안에서 닫히는가 한 줄> ·
                       7조건: 약함·위반 항목만 (없으면 `전부 충족`) ·
                       의존: <FR-ID 또는 없음> · Status: PROPOSED
```

`Status` 는 PROPOSED | SELECTED | DEFERRED | DROPPED.
Capability 노드를 목표로 삼지 않는 후보는 `Trace` 의 Target 자리에 그 사유를 한 줄로 적는다.

트랙 파일에는 **지금 고를 수 있는 후보만** 둔다. Cycle 이 닫히면 그 `FR-*` 를 지우고
결과를 `feedback/<CycleId>.md` 에 적는다.

후보 하나는 **세계가 갖게 되는 개념 하나**다. 앞의 네 칸(무엇 · 세계에 생기는 것 ·
아닌 것 · 이미 있는 것)이 그 개념의 경계를 정한다 — 특히 `아닌 것` 이 비면 후보가
아니라 소원이다 (guides/master-frontier.md).

추천 순서의 자리는 **한눈에 보기 표 하나**다 — 순위 열과 사유 한 줄이 그 전부이며,
별도의 순서 다이어그램·후보별 추천 산문 블록을 두지 않는다 (근거의 상세는 각 후보의
`판정` 칸 소유). `SELECTED` 절은 현재 상태만 담는다 — 닫힌 후보의 경위·배운 것은
`feedback/<CycleId>.md` 소유이며 여기 다시 적지 않는다 (CLAUDE.md 원칙 20).

`VIOLATED` 후보를 여기에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
Agent 는 후보와 근거를 제공하되 우선순위를 확정하지 않는다.

구 골격(16필드 · 순서 다이어그램 · 추천 산문 블록)으로 남아 있는 트랙 파일은
다음 NEXT / Feedback 작업이 그 파일을 고치는 김에 이 골격으로 이행한다 —
이행만을 위한 별도 세션을 세우지 않는다.

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

## feedback/ — Cycle 반영 경위

닫힌 Cycle 하나의 Master 반영 경위다 — **한 Cycle = 한 파일.** Feedback 작업이 만들고,
한번 쓰이면 수정하지 않는다 (보관소). Cycle 마다 자기 파일이므로 병렬 갈래가 충돌하지 않는다.

```markdown
# Feedback — C-ITEM-001-one-slot-one-item

    반영 시점    main <머리 커밋> 위에서
    근거         cycles/C-ITEM-001-one-slot-one-item/08-verification.md

## Overlay
    MC-EQUIP-ITEM   PARTIAL → IMPLEMENTED   근거 08-verification PLAYABLE ④

## Frontier (자기 트랙만)
    지웠다   FR-ONE-SLOT-ONE-ITEM → 이 Cycle 로 닫혔다. 배운 것: <한두 줄>
    새 후보  <있으면 FR-ID 와 한 줄 사유 · 없으면 없음>

## Constraint Evaluation
    <갱신한 판정 · 없으면 없음>

## Candidates
    <제출한 CC-* · 없으면 없음>

## Master Gap
    <보고된 Gap 과 Human 제시 내용 · 없으면 없음>
```

## HISTORY.md

**Master 층 자체의** 닫힌 것들의 보관소다. 살아 있는 문서가 가벼워야 매번 읽는 비용이
낮으므로, 무언가 닫히면 그 자리에서 지우고 여기로 옮긴다. Agent 는 평소 이 파일을 읽지 않는다.
Cycle Feedback 의 경위(Frontier 소진 · Overlay 갱신)는 여기가 아니라
`feedback/<CycleId>.md` 소유다.

```text
닫힌 Open Question      DECISION 을 그대로 옮긴다
Constraint 반영 이력     신설·재작성·삭제와 그 사유
Master 작업 경위         Inject · Graph 확장·정정처럼 Cycle 에 매이지 않는 변경의 이유
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

## 무엇을 말하는가 (예시)
    <필수. 아래 "읽히게 쓴다" 규칙을 따른다 — 원칙 문장만으로는 읽히지 않는다>

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

---

## 읽히게 쓴다 — CC · DC 공통 규칙

Constraint 문안은 압축될수록 정확해지지만 동시에 **읽히지 않게 된다.** 읽히지 않는
원칙은 지켜지지 않고, 지켜지지 않는 원칙은 없는 것과 같다. 그래서 CC 의
`무엇을 말하는가 (예시)` 절과 DC 의 `rationale` 은 아래를 지킨다.

```text
1. 나쁜 방식을 먼저 보인다      "❌ 이렇게 하지 않았다" 로 흔한 구현을 한 줄 적고,
                                실제로 한 것을 그 옆에 둔다. 대비가 정의보다 빠르다
2. 실물 코드를 인용한다          경로와 식별자를 그대로 — 지어낸 의사코드로 대체하지 않는다
3. "무엇이 달라지나" 를 적는다   이 원칙을 지켜서 얻은 것 · 어겼을 때 잃는 것을
                                시나리오로. 추상 명사("유지보수성")로 적지 않는다
4. 가장 안 읽히는 조각을 지목한다 여러 조각이면 그중 하나는 반드시 설명이 필요하다 —
                                "가장 중요한데 가장 안 읽힌다" 를 명시하고 풀어 쓴다
5. 경계를 긋는다                "이건 이 원칙이 아니다" 를 함께 적는다.
                                경계 없는 원칙은 과적용되어 세계를 얕게 만든다
```

실례: `candidates/CC-WORLD-OWNS-THE-CHANCE.md` · `CC-CONDITION-OPENS-WITHOUT-RECORDING.md`.
길어지는 것을 비용으로 치지 않는다 — Constraint 는 자주 읽히고 오래 산다.
반대로 `statement` / `requires` / `prohibits` / `prefers` 는 **압축을 유지한다.**
그 넷은 판정용이고, 설명은 위 두 자리가 진다.
