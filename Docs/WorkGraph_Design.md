# WorkGraph — AI Agent 작업 흐름 관리 시스템 설계

> AI agent가 진행한 작업의 히스토리, 진행도, 결과, TODO를 그래프 구조로 관리하고 시각화하는 도구.

---

## 0. 목적과 핵심 아이디어

### 해결하려는 문제

AI agent가 자율적으로 작업하면서 다음과 같은 정보가 휘발됨:

- 무엇을 하려 했는지(intent)
- 어디까지 했는지(progress)
- 왜 그렇게 결정했는지(rationale)
- 다음에 뭘 해야 하는지(next)
- 작업 중 어떤 문제가 파생됐는지(spawned issues)

### 핵심 아이디어

작업을 **노드(Node)**, "이게 저걸 낳았다"의 인과 관계를 **엣지(Edge)** 로 보는 **DAG(방향 비순환 그래프)** 로 모델링한다.

- 일감이 분기하면 새 노드가 생긴다.
- 문제가 발생하면 새 노드(PROBLEM)가 생기고 원인 노드와 엣지로 연결된다.
- 완료된 서브트리는 시각적으로/물리적으로 압축된다.
- 그래프는 시간 축으로 재생 가능하다 (이벤트 로그 기반).

### 구현 원칙

1. **파일 시스템이 source of truth** — DB 없이 시작. JSON/Markdown 기반.
2. **Append-only 이벤트 로그** — 모든 변경은 이벤트로 기록, 시간 재생 가능.
3. **CLI-first** — 시각화는 나중. CLI + mermaid 출력만으로도 80% 효용.
4. **Agent와의 명시적 계약** — AGENTS.md에 프로토콜을 박아 강제.

### 기술 스택 결정

- **CLI / 코어**: **Rust**
  - 빠르고 단단한 단일 바이너리, 어디서나 실행 가능.
  - serde(YAML/JSON), clap(CLI), tokio(비동기), notify(파일 watcher).
- **웹 시각화 백엔드**: Rust (axum)로 통일하되, 빠른 프로토타이핑 단계에서는 Python(FastAPI)로 시작 가능.
- **웹 시각화 프론트엔드**: Vanilla TS + Vite + Cytoscape.js (+ dagre layout).
- **데스크탑 래핑(옵션)**: Tauri.

---

## 1. 도메인 모델

### 1.1 노드 타입

| 타입 | 용도 | 예시 |
|---|---|---|
| `GOAL` | 프로젝트 최상위 목적 | "히키토의 대모험" |
| `MILESTONE` | 큰 덩어리, 여러 TASK를 묶음 | "VFX 파이프라인 구축" |
| `TASK` | 실제 일감, agent가 수행하는 단위 | "Niagara SubUV 자동 바인딩" |
| `PROBLEM` | 작업 중 발견된 문제, 원인 노드에서 파생 | "Subtype 클래스 누락" |
| `DECISION` | 의사결정 분기점 (ADR) | "Blender 대신 UE5 Geometry Script 채택" |

### 1.2 엣지 타입

| 타입 | 의미 | 시각적 표현 |
|---|---|---|
| `SPAWNS` | A가 B를 만들었다 (부모-자식) | 실선, 굵게 |
| `BLOCKS` | A가 끝나야 B가 시작 가능 (선행조건) | 실선, 빨강 |
| `DERIVED_FROM` | B는 A의 문제로부터 파생됨 | 점선, 빨강 |
| `SUPERSEDES` | B가 A를 대체함 (재시도, 방향 전환) | 곡선, 회색 |

### 1.3 노드 스키마 (`nodes/<id>/node.yaml`)

```yaml
# 정체성
id: nd_01HXXXYYZZAABBCC               # ULID, 26자, 시간 정렬됨
type: TASK                             # GOAL | MILESTONE | TASK | PROBLEM | DECISION
title: "Niagara SubUV 자동 바인딩"
slug: niagara-subuv-binding            # URL-safe

# 상태
status: in_progress                    # pending | in_progress | done | blocked | abandoned | superseded
priority: P1                           # P0 | P1 | P2 | P3
estimated_effort: M                    # XS | S | M | L | XL

# 시간
created_at: 2026-04-29T10:30:00Z
started_at: 2026-04-29T11:00:00Z
completed_at: null
last_touched_at: 2026-04-29T11:45:00Z

# 관계 (edges.jsonl과 일관성 유지되는 캐시)
parents: [nd_01HVVV...]                # SPAWNS edge sources
blockers: []                           # BLOCKS edge sources
derived_from: null                     # PROBLEM이면 원인 노드
supersedes: null                       # 재시도라면 이전 노드

# 분류
tags: [vfx, niagara, ue5]
project: hkt                           # 멀티 프로젝트 지원
flow: script_runtime                   # 히키토 전용: script_authoring | script_runtime
owner: agent                           # human | agent | hybrid

# Agent 실행 이력
agent_runs:
  - run_id: run_2026-04-29-1100
    agent: claude-opus-4.7
    started_at: 2026-04-29T11:00:00Z
    ended_at: null
    status: running

# 결과 (commit 시 채워짐)
result:
  outcome: null                        # success | partial | failed | abandoned
  summary_ref: result.md
  artifacts: []
  discoveries: []
  spawned_node_ids: []

# 압축 관련
compressed: false
compressed_at: null
compression_summary_ref: null
```

`intent.md`와 `result.md`는 자유로운 Markdown 형식. 첫 줄은 한 줄 요약을 강제 (시각화 미리보기용).

### 1.4 엣지 스키마 (`edges.jsonl` 한 줄)

```json
{"id":"ed_01H...","type":"SPAWNS","src":"nd_01HVVV...","dst":"nd_01HXXX...","created_at":"2026-04-29T10:30:00Z","reason":"VFX 파이프라인 작업 중 별도 분리 필요"}
```

`reason` 필드가 핵심. "왜 이 둘을 연결했는가"가 그래프 가치의 절반. 특히 `SUPERSEDES`와 `DERIVED_FROM`은 reason 필수.

---

## 2. 저장소 구조

```
.workgraph/
├── config.yaml                  # 프로젝트 설정 (flows 정의 등)
├── graph.jsonl                  # 노드 이벤트 로그 (append-only)
├── edges.jsonl                  # 엣지 이벤트 로그 (append-only)
├── index.json                   # 빠른 조회용 캐시 (재생성 가능)
├── nodes/
│   └── nd_01HXXX.../
│       ├── node.yaml            # 현재 상태 스냅샷
│       ├── intent.md            # 사람이 읽는 의도
│       ├── result.md            # 사람이 읽는 결과
│       └── runs/
│           ├── run_2026-04-29-1100.jsonl     # transcript (raw)
│           └── run_2026-04-29-1100.summary.md
├── snapshots/
│   └── 2026-04-29.json          # 일일 그래프 전체 덤프
└── compressed/
    └── nd_01HVVV..._summary.md  # 압축된 서브트리 요약
```

### 이중 저장의 이유

- `graph.jsonl` / `edges.jsonl` = 이벤트 로그. 모든 변경 이력. Git diff 잘 잡힘. 시간 재생 가능.
- `nodes/<id>/` = 현재 상태 + 사람이 읽는 텍스트. Agent가 작업할 때 이걸 읽음.
- 충돌 시 jsonl이 진실. `workgraph rebuild`로 jsonl에서 nodes/ 재생성.

### 2.1 이벤트 로그 형식 (`graph.jsonl`)

```json
{"ts":"2026-04-29T10:30:00Z","op":"create","node_id":"nd_01HXXX...","data":{...}}
{"ts":"2026-04-29T11:00:00Z","op":"claim","node_id":"nd_01HXXX...","run_id":"run_..."}
{"ts":"2026-04-29T11:30:00Z","op":"spawn","node_id":"nd_01HXXX...","child_id":"nd_01HYYY...","edge_type":"DERIVED_FROM"}
{"ts":"2026-04-29T11:45:00Z","op":"update","node_id":"nd_01HXXX...","fields":{"status":"blocked"}}
{"ts":"2026-04-29T12:30:00Z","op":"commit","node_id":"nd_01HXXX...","outcome":"success"}
{"ts":"2026-04-29T13:00:00Z","op":"compress","root_id":"nd_01HVVV...","node_count":12}
```

이벤트 op 7종: `create`, `update`, `claim`, `spawn`, `link`, `commit`, `compress`.

### 핵심 invariant

- jsonl은 절대 수정/삭제하지 않음. 잘못된 노드도 `op: update`로 `status: abandoned`.
- 모든 작업은 이벤트로 표현 가능해야 함 → 시간 재생 보장.

---

## 3. 히키토 프로젝트 듀얼 플로우 적용

히키토의 대모험 프로젝트는 **두 개의 독립된 작업 흐름**으로 분리하여 관리한다.

### 3.1 Flow A — Script Authoring (스크립트 제작)

게임 내 콘텐츠/로직 스크립트를 제작하는 작업 흐름.

- **대상**: 퀘스트 스크립트, 컷씬 스크립트, NPC 대화 트리, 이벤트 트리거, 밸런스 데이터 등.
- **산출물 형태**: DataAsset, JSON/YAML 데이터, Blueprint 그래프, 텍스트 스크립트.
- **작업 성격**: 콘텐츠 중심, 반복 생산, 디자이너/AI 주도.
- **태그 prefix**: `flow: script_authoring`

### 3.2 Flow B — Script Runtime (스크립트 재생 모듈)

위 스크립트를 해석하고 실행하는 엔진/모듈을 제작하는 작업 흐름.

- **대상**: 스크립트 파서, 인터프리터, 런타임 디스패처, ECS/Mass 시스템 통합, UI 바인더.
- **산출물 형태**: C++ 코드, UE5 모듈, 플러그인 시스템.
- **작업 성격**: 엔지니어링 중심, 아키텍처/성능 고려, 코어 시스템.
- **태그 prefix**: `flow: script_runtime`

### 3.3 분리 원칙

1. **별도 GOAL 노드** — 각 플로우는 독립된 GOAL을 가진다.
   - `GOAL: 히키토 콘텐츠 스크립트 시스템 (authoring)`
   - `GOAL: 히키토 스크립트 런타임 모듈 (runtime)`
2. **플로우 간 연결은 BLOCKS 엣지로 명시** — 런타임이 특정 스크립트 기능을 지원해야 authoring 작업이 시작 가능한 경우 명시적 의존성으로 표현.
3. **시각화에서 색상 구분** — Authoring은 c-pink 계열, Runtime은 c-blue 계열 등으로 즉시 식별 가능.
4. **필터 기본값으로 플로우 선택** — 웹 UI 좌측 필터에 "Flow" 섹션, 한 번에 한 플로우만 보는 것을 디폴트로.
5. **압축은 플로우 단위로** — 한 플로우 내에서만 서브트리 압축 수행. 플로우를 넘는 압축은 금지.

### 3.4 `config.yaml` 예시

```yaml
project:
  id: hkt
  name: "히키토의 대모험"

flows:
  - id: script_authoring
    name: "스크립트 제작"
    color: pink
    description: "게임 내 콘텐츠/로직 스크립트 제작"
  - id: script_runtime
    name: "스크립트 재생 모듈"
    color: blue
    description: "스크립트 해석/실행 엔진 모듈"

defaults:
  flow: script_runtime
  owner: agent

compression:
  min_subtree_size: 10
  min_age_days: 30
  per_flow: true                  # 플로우를 넘지 않음
```

### 3.5 플로우 간 인터페이스 노드

두 플로우가 합의해야 하는 지점은 `DECISION` 노드로 명시:

- 예: "스크립트 DSL 문법 v1 확정" — 양쪽 플로우의 GOAL에서 SPAWNS 엣지로 연결됨.
- 양쪽 모두에서 보임. 한쪽이 변경하면 다른 쪽이 알아챌 수 있음.

---

## 4. CLI 명령어 (Rust 구현 기준)

```bash
# 초기화
workgraph init [--project hkt]
workgraph flow add <flow-id> --name "..." --color pink

# 노드 생성
workgraph add --type TASK --title "..." [--parent <id>] [--flow script_runtime] [--tags ue5,vfx]
workgraph add --type GOAL --title "히키토 스크립트 런타임 모듈" --flow script_runtime
workgraph add --type PROBLEM --derived-from <id> --title "..." --reason "..."
workgraph add --type DECISION --title "..." --parents <id1>,<id2>

# 작업 사이클
workgraph claim <id>                    # in_progress 전환, run_id 발급
workgraph spawn --from <id> --type TASK --title "..."
workgraph link <src> <dst> --type BLOCKS --reason "..."
workgraph commit <id> --outcome {success|partial|failed|abandoned} [--message "..."]

# 조회
workgraph list [--status pending] [--flow script_authoring] [--tag vfx]
workgraph show <id>                     # node.yaml + intent.md + result.md
workgraph next [--flow <flow-id>]       # blocker 없는 pending 노드들
workgraph trace <id>                    # 이 노드의 ancestors 체인
workgraph descendants <id>              # 파생된 모든 것

# 시각화 (Phase 1: 텍스트만)
workgraph render --format mermaid > graph.md
workgraph render --format dot > graph.dot
workgraph render --format ascii
workgraph render --format mermaid --flow script_runtime    # 플로우별 출력

# 유지보수
workgraph rebuild                       # jsonl → nodes/ 재생성
workgraph snapshot                      # snapshots/ 에 오늘자 덤프
workgraph compress --root <id>          # 수동 압축 트리거
workgraph validate                      # 무결성 체크 (orphan, cycle 등)
```

### 일상 사용에서 가장 중요한 명령

- `workgraph next --flow <flow>` — "지금 뭘 할 수 있지?"의 답.
- `workgraph trace <id>` — "이게 왜 만들어졌지?"의 답.

---

## 5. Agent 계약 (AGENTS.md 추가분)

```markdown
## WorkGraph Protocol

모든 의미 있는 작업은 WorkGraph 노드 단위로 진행한다.

### 작업 시작
1. `workgraph next --flow <flow>` 또는 사용자가 노드 ID 지정
2. `workgraph show <id>`로 intent.md 정독
3. `workgraph claim <id>`로 클레임 — 이 시점부터 transcript 자동 기록

### 작업 중
- 새로운 별도 작업 발견:
  `workgraph spawn --from <current> --type TASK --title "..."`
- 문제 발견:
  `workgraph spawn --from <current> --type PROBLEM --reason "..."`
  필요 시 현재 노드는 `workgraph commit <id> --outcome blocked`
- 아키텍처 결정 발생:
  `workgraph spawn --from <current> --type DECISION --title "..."`
  decision 노드의 result.md는 ADR 형식으로

### 작업 종료
1. `result.md` 작성 — 무엇을 했고, 무엇이 안 됐고, 무엇을 알게 됐나
2. `workgraph commit <id> --outcome {success|partial|failed|abandoned}`

### 플로우 경계
- 작업 중 다른 플로우의 노드를 spawn하지 않는다.
- 다른 플로우와의 의존성이 발견되면 DECISION 노드로 표시하고 사람이 결정.

종료 프로토콜 누락 시 작업은 미완료로 간주된다.
```

---

## 6. 시각화 웹 앱 (Phase 2)

### 6.1 화면 구조

- **상단 탭**: Graph / Timeline / Live / Search
- **좌측 사이드바**: 필터 (Status, Flow, Tags, Project, 압축 표시 여부)
- **중앙**: 메인 뷰
- **우측**: 노드 디테일 패널 (클릭 시 슬라이드인)
- **하단**: 명령 입력 바 (CLI 명령을 GUI에서 실행)

### 6.2 4개 뷰

#### Graph View (메인)
- DAG 레이아웃, 위→아래 흐름.
- 노드 색상 = status, 모양 = type, 테두리 = flow.
- GOAL: 큰 둥근 사각형 / MILESTONE: 중간 둥근 사각형 / TASK: 사각형 / PROBLEM: 마름모 / DECISION: 육각형.
- 압축 서브트리: 점선 테두리 + "+12" 자식 개수. 더블클릭 펼침.
- 줌 아웃 시 LOD(Level of Detail)로 자동 클러스터링.

#### Timeline View
- 가로축 시간, 세로축 노드. 간트 차트 변형.
- 의존성(BLOCKS) 화살표로 표시.
- 막대 클릭 → Graph View로 점프.

#### Live View
- `in_progress` 상태 노드 카드.
- 진행 시간, 마지막 transcript 줄(실시간 tail), spawn한 자식 수.
- Agent가 지금 뭘 하고 있는지 한눈에.

#### Search/Filter View
- intent + result 풀텍스트 (ripgrep 기반).
- 태그/상태/플로우/기간 조합.

### 6.3 노드 디테일 패널
- 메타데이터, intent.md, result.md 렌더링.
- agent_runs 리스트 (transcript 펼침 가능).
- 부모/자식 노드 점프, "Spawn child", "Mark blocked", "Commit" 액션 버튼.

### 6.4 SSE 실시간 갱신

```
Frontend (EventSource) ← /events ← Rust 서버 ← notify(.workgraph/)
```

이벤트: `node.created`, `node.updated`, `node.claimed`, `node.committed`, `edge.added`, `transcript.appended`.

프론트는 받아서 Cytoscape 노드/엣지 추가·갱신만 함. 전체 리로드 불필요.

---

## 7. Phase 3 — 인터랙션 강화

### 7.1 그래프 직접 편집
- 드래그로 엣지 그리기 → 엣지 타입 선택 모달.
- 노드 인라인 편집 (title, status, tags).
- 다중 선택 → 일괄 commit/압축/태그.
- 레이아웃 저장 (수동 배치 위치 기억).

### 7.2 명령 팔레트 (Cmd+K)
- CLI 명령의 GUI 슈퍼셋. 키보드 위주 사용자에게 필수.

### 7.3 "Run agent on this node" 통합
- **Claude Code로 실행**: 노드 컨텍스트(intent.md + ancestors) 자동 주입.
- **Plan**: Planner agent에게만 보내 자식 TASK들로 분해.
- **Evaluate**: Evaluator agent로 result.md 검증.

### 7.4 압축 워크플로우
- 서브트리 루트 우클릭 → "Compress subtree".
- Compaction agent가 자손 result들을 종합 요약.
- 미리보기 → 승인 → 실행. 원본은 `compressed/`에 보존.

### 7.5 동시 작업 충돌 처리
- 노드별 lease 메커니즘 (claim 시 30분 lease, heartbeat 갱신).
- lease 만료 시 자동으로 pending 복귀, 이전 run은 `interrupted`.
- jsonl append 시 file lock (Rust의 fs2 또는 fd-lock 크레이트).

---

## 8. Phase 4 — Harness 통합

### 8.1 Planner Agent
- **입력**: GOAL 또는 큰 MILESTONE.
- **동작**: 자식 TASK 노드 N개 자동 spawn (BLOCKS 엣지 포함), 각 intent.md 작성.
- **계약**: `workgraph plan <id> [--max-children 8] [--dry-run]`.

### 8.2 Generator Agent
- pending이고 blocker 없는 TASK를 자동 claim.
- intent + ancestors의 result를 컨텍스트로 작업 수행.
- 작업 중 발견한 문제는 자동 spawn (PROBLEM).
- 종료 시 result.md 작성 + commit.

### 8.3 Evaluator Agent
- commit 직전 hook으로 자동 실행.
- result.md가 intent.md 목표를 달성했는지, artifacts가 실재하는지 검증.
- 실패 시 commit 차단 + reason과 함께 PROBLEM 노드 spawn.

### 8.4 GC / Compaction Agent
- 매일 새벽: `workgraph snapshot`.
- 주 1회: 압축 후보 식별 → 사용자 승인 대기.
- 30일+ 된 transcript: 압축(gzip) + 핵심 부분 summary 추출.

### 8.5 MCP Bridge

외부에서 그래프 조작할 수 있도록 MCP 서버 노출:

```yaml
mcp_tools:
  - workgraph_add
  - workgraph_spawn
  - workgraph_show
  - workgraph_next
  - workgraph_commit
  - workgraph_search
```

→ Claude Code 세션에서 직접 그래프를 만지면서 작업 가능.

### 8.6 AiR (Redmine) 양방향 동기화 (선택)
- WorkGraph 노드 ↔ Redmine 이슈 매핑 (양쪽에 ID 저장).
- 한쪽 status 변경 시 다른 쪽도 갱신.

### 8.7 자동 사이클 (이상)

```
[사용자가 GOAL 작성, flow 지정]
   ↓
Planner spawn → MILESTONE×3 + 의존성
   ↓
각 MILESTONE에 대해 Planner → TASK×N
   ↓
Generator가 next() 폴링, 가능한 TASK 자동 claim
   ↓
작업 중 PROBLEM 발견 → 자동 spawn → blocker 자동 설정
   ↓
Evaluator가 commit 직전 검증
   ↓
사람은 시각화 보면서 [개입 / 승인 / 방향 전환]
   ↓
GC가 완료된 서브트리 압축 (플로우 단위)
```

사람의 역할: GOAL 정의, 분기점 결정, Evaluator 이슈 처리. 나머진 그래프가 알아서 자라고 정리됨.

---

## 9. 구현 로드맵

| 주차 | 단계 | 산출물 |
|---|---|---|
| W1 | Phase 1.1~1.4 | Rust 크레이트 구조, jsonl 읽기/쓰기, 도메인 모델, lease/audit 기초 |
| W2 | Phase 1.5~1.6 + MCP | `workgraph` CLI 전체, **MCP 서버**, mermaid 출력, AGENTS.md 통합 |
| W3 | Phase 2.1~2.3 | axum HTTP API + Cytoscape.js 정적 페이지, Graph View |
| W4 | Phase 2.4~2.5 | SSE 실시간 갱신, 4개 뷰 완성, Tailscale 배포 |
| W5 | Phase 3 | 그래프 인터랙션, agent run 통합, 모바일 PWA |
| W6 | Phase 4 | Planner/Evaluator/GC, MCP 툴 카탈로그 완성 |

**MVP 정의**: W2 끝. CLI + MCP + mermaid 출력만으로 일상 사용 + Claude Code 통합 가능.

---

## 10. Rust 크레이트 구조 (제안)

```
workgraph/
├── Cargo.toml                 # workspace
├── crates/
│   ├── workgraph-core/        # 도메인 모델, jsonl I/O, 인덱스, lease/audit
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── node.rs        # Node, NodeType, Status
│   │       ├── edge.rs        # Edge, EdgeType
│   │       ├── store.rs       # 파일 시스템 I/O
│   │       ├── event.rs       # 이벤트 로그 처리
│   │       ├── lease.rs       # 작업 점유 / heartbeat
│   │       ├── audit.rs       # 감사 로그
│   │       └── query.rs       # ancestors, descendants, next 등
│   ├── workgraph-cli/         # clap 기반 CLI (Phase 1)
│   │   └── src/
│   │       ├── main.rs
│   │       └── cmd/
│   │           ├── add.rs
│   │           ├── claim.rs
│   │           ├── spawn.rs
│   │           ├── commit.rs
│   │           ├── render.rs
│   │           └── ...
│   ├── workgraph-mcp/         # MCP 서버 (Phase 1, CLI와 동시)
│   │   └── src/
│   │       ├── main.rs        # workgraph mcp 서브명령으로 통합 가능
│   │       └── tools.rs       # workgraph_show, _claim, _spawn 등
│   ├── workgraph-server/      # axum HTTP + SSE 서버 (Phase 2)
│   │   └── src/
│   │       ├── main.rs
│   │       ├── api.rs
│   │       ├── auth.rs        # token / mTLS / Tailscale
│   │       └── sse.rs
│   └── workgraph-render/      # mermaid/dot/ascii 출력
└── frontend/                  # Vite + TS + Cytoscape.js (Phase 2)
    └── ...
```

### 주요 의존성

```toml
[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_yaml = "0.9"
serde_json = "1"
clap = { version = "4", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
axum = "0.7"
notify = "6"
ulid = "1"
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "1"
fs2 = "0.4"                    # 파일 락
```

---

## 11. Agent 접근 레이어

**WorkGraph는 사람보다 AI agent가 더 많이 호출하는 시스템이다.** Agent가 본인이 한 작업을 기록하고, 다른 작업의 결과를 참조하고, 새 작업을 파생시키는 1급 사용자다. 이 장은 agent가 그래프와 통신하는 모든 인터페이스를 정의한다.

### 11.1 통신 시나리오 3종

#### 시나리오 A — 로컬 Agent (가장 흔함)
유사장님이 본인 PC에서 Claude Code로 히키토 작업할 때.
```
[Claude Code 세션]
   ├─ MCP stdio  ──▶  workgraph MCP 서버  ──▶  .workgraph/
   └─ bash 호출  ──▶  workgraph CLI       ──▶  .workgraph/
```

#### 시나리오 B — 원격 Agent
다른 머신/CI에서 워크그래프에 접근.
```
[원격 Agent]  ──▶  HTTPS + Bearer Token  ──▶  workgraph serve  ──▶  .workgraph/
```

#### 시나리오 C — 멀티 에이전트 협업
Planner / Generator×N / Evaluator가 같은 그래프를 동시에 만짐. Lease + Lock 메커니즘 필수.

### 11.2 4개 인터페이스 (모두 동일한 코어 위에)

```
                    ┌───────────────────────────────────┐
                    │     workgraph-core (Rust)         │
                    │   도메인 모델, 저장소, 쿼리, 락    │
                    └─────────────┬─────────────────────┘
                                  │
        ┌────────────┬────────────┼────────────┬───────────┐
        ▼            ▼            ▼            ▼           ▼
   [A] CLI      [B] MCP      [C] HTTP      [D] SDK     [E] WebUI
   (사람/bash)  (stdio)      (REST/SSE)    (crate)     (Phase 2)
```

#### A. CLI 바이너리
- 대상: 사람, 그리고 bash로 호출하는 agent
- 형식: stdin/stdout, exit code, JSON 출력 옵션 (`--json`)
- 호출: `workgraph add ...`, `workgraph claim <id>` 등 (4장 참조)

#### B. MCP 서버 (stdio)
- 대상: 같은 머신의 Claude Code/Claude Desktop
- 실행: `workgraph mcp` (Claude Code의 mcp 설정에 등록)
- 형식: MCP 표준 protocol, stdio
- **Phase 1 단계에서도 만든다** (CLI와 동시에). agent가 매 작업마다 bash 우회하는 건 비효율.

#### C. HTTP REST API + SSE
- 대상: 원격 agent, 웹 UI, 외부 통합
- 실행: `workgraph serve --port 3000 --auth <token-file>`
- 형식: JSON over HTTPS, 변경 이벤트는 SSE로 푸시
- 인증: Bearer token (단순), 또는 mTLS (강력)

#### D. SDK 라이브러리
- 대상: 워크그래프 위에 도구를 만들고 싶은 사람
- 형식: `workgraph-core` 크레이트를 직접 import (Rust)
- 옵션: Python binding (`pyo3`)으로 Python에서도 사용 가능 (Phase 4)

### 11.3 MCP 툴 카탈로그 (Agent가 실제로 부르는 것)

#### 작업 흐름 툴 (모든 agent가 자주 사용)

| 툴 이름 | 용도 | 핵심 입력 | 핵심 출력 |
|---|---|---|---|
| `workgraph_next` | 시작 가능한 노드 후보 | flow, limit | 노드 ID 리스트 + 미리보기 |
| `workgraph_show` | 작업용 컨텍스트 한 번에 조회 | node_id | intent + ancestors + 형제 result + 관련 DECISION |
| `workgraph_claim` | 작업 시작, lease 발급 | node_id, agent_id | run_id, lease_expires_at |
| `workgraph_spawn` | 작업 중 새 노드 파생 | from, type, title, reason | 새 node_id |
| `workgraph_log` | 작업 중 메모/heartbeat | node_id, message | ack |
| `workgraph_commit` | 작업 종료 | node_id, outcome, result_md | ack |

#### 조회/탐색 툴

| 툴 이름 | 용도 |
|---|---|
| `workgraph_search` | intent/result 풀텍스트 검색 |
| `workgraph_trace` | ancestors 체인 (이게 왜 만들어졌나) |
| `workgraph_descendants` | 이 노드에서 파생된 모든 것 |
| `workgraph_list` | 필터 기반 노드 목록 |

### 11.4 `workgraph_show`가 똑똑해야 한다

이 툴이 agent의 작업 시작점이다. node_id 하나 주면 **agent가 작업하는 데 필요한 모든 컨텍스트를 한 번에 반환**:

```yaml
# workgraph_show <id> 응답 예시
node:
  id: nd_01HXXX...
  title: "Niagara SubUV 자동 바인딩"
  type: TASK
  status: pending
  intent: |
    (intent.md 본문)
  flow: script_runtime
  tags: [vfx, niagara, ue5]

ancestors:                      # 부모 체인 (왜 이 작업이 생겼나)
  - id: nd_01HVVV...
    title: "VFX 파이프라인 구축"
    type: MILESTONE
    intent_summary: "..."       # 첫 줄만
  - id: nd_01HUUU...
    title: "히키토 스크립트 런타임 모듈"
    type: GOAL
    intent_summary: "..."

siblings:                       # 형제 노드 (옆에서 뭐 했나)
  - id: nd_01HWWW...
    title: "Flipbook export"
    status: done
    result_summary: "..."

related_decisions:              # 같은 flow의 최근 DECISION
  - id: nd_01HSSS...
    title: "Blender 대신 UE5 Geometry Script 채택"
    summary: "..."

active_blockers: []             # 시작을 막는 노드들 (있다면 차단됨)
```

이렇게 묶어서 한 번에 주면 agent가 다른 툴 부르지 않고 바로 작업 가능. **토큰 효율도 좋고 일관성도 좋음.**

### 11.5 안전장치

#### Lease (작업 점유)
- `claim` 시 노드에 30분짜리 lease + agent identifier 기록
- 작업 중 `workgraph_log` 또는 `workgraph_spawn` 호출이 자동 heartbeat
- lease 만료 시 자동으로 `pending` 복귀, 이전 run은 `interrupted`로 마킹
- 다른 agent가 already-claimed 노드 claim 시도 시 → 명확한 에러 + 현재 점유자 정보

#### Idempotency
- 같은 작업 중복 호출 안전:
  - `claim`을 두 번 부르면 두 번째는 에러 (이미 claimed by self → 무해, by other → 에러)
  - `commit` 후 다시 `commit` 금지
- spawn에는 client-side idempotency key 옵션 (네트워크 재시도 시 중복 생성 방지)

#### Authorization (멀티 agent 시)
- 각 agent에 token 발급 (`.workgraph/tokens/`)
- token에 권한 레벨:
  - `read` — 조회만 (대시보드, 외부 모니터링)
  - `write` — 일반 작업 (Generator agent)
  - `admin` — commit 차단/강제 압축/lease 강제 해제 (Evaluator, 사람)
- 토큰별 audit log

#### Audit Log
- `audit.jsonl`에 모든 API 호출 기록:
  ```json
  {"ts":"...","agent_id":"generator-1","action":"workgraph_claim","node_id":"...","result":"ok"}
  ```
- 나중에 "이 노드 누가 이상하게 만들었지?" 추적 가능
- jsonl과 분리되어 있어 audit log 자체는 변조해도 그래프 무결성에 영향 없음

### 11.6 Agent 행동 규약 (AGENTS.md 강화판)

5장 프로토콜에 더해, agent가 따라야 하는 행동:

1. **모든 의미 있는 작업 시작 전 `workgraph_claim` 호출.** claim 안 한 작업은 그래프에 흔적이 안 남음 → 협업 깨짐.
2. **작업 중 큰 결정/문제 발생 시 즉시 spawn.** "이 작업 끝나고 정리하자" 안 됨. 결정/문제는 그 시점에 노드로 박아야 함.
3. **`workgraph_log`로 진행 상황 주기 기록** (예: 10분마다 또는 의미 있는 단계마다). lease heartbeat 겸 사람용 progress 표시.
4. **commit 시 result.md는 반드시 다음을 포함**:
   - 무엇을 했나 (행동)
   - 무엇이 됐나 (결과/artifact)
   - 무엇이 안 됐나 (실패/한계)
   - 무엇을 알게 됐나 (discovery)
5. **다른 flow의 노드를 spawn하지 않는다.** 플로우 경계 발견 시 `DECISION` 노드 + 사람 호출.

### 11.7 멀티 에이전트 동시성 시나리오

```
시나리오: Generator-1이 노드 A 작업 중, Generator-2가 next() 폴링

Generator-2: workgraph_next() 호출
  → 서버: A는 claimed 상태, B는 A에 BLOCKS, C는 free
  → 응답: [C]

Generator-2: workgraph_claim(C)
  → 서버: lease 발급, run_id_2 부여

Generator-1과 Generator-2가 각각 A와 C 작업 진행
  → 서로 간섭 없음

Generator-1이 작업 중 PROBLEM 발견:
  → workgraph_spawn(from=A, type=PROBLEM, title=...)
  → 서버: 새 노드 P 생성, A→P DERIVED_FROM 엣지 추가
  → A의 status를 blocked로 자동 전환 (P가 해결되어야 A 재개)

이때 C가 B를 BLOCKS 하고 있었다면:
  → C 완료 후에도 B는 여전히 A 때문에 대기
```

이 모든 동작이 jsonl append 단일 트랜잭션 + file lock으로 일관성 보장.

---

## 12. 외부 환경 접근 (Tailscale 기반)

### 12.1 결정

**Tailscale을 디폴트 외부 접근 방식으로 채택.**

이유:
- 본인 디바이스 네트워크에만 노출 (공개 인터넷 노출 없음)
- 인증/HTTPS 별도 설정 불필요 (Tailscale이 처리)
- PC, 노트북, 휴대폰, VPS 어디든 동일 네트워크처럼 동작
- 무료 플랜으로 개인 사용 충분
- 향후 회사 동료 협업이 필요해지면 Tailscale share 기능으로 확장 가능

### 12.2 구성

```
┌─ 본인 PC (Suwon) ────────────┐
│  workgraph serve --bind      │
│   100.x.x.x:3000             │ ← Tailscale 가상 IP
│  .workgraph/ 폴더 (마스터)    │
└──────────────┬───────────────┘
               │ Tailscale 사설 네트워크
               │
   ┌───────────┼────────────┐
   ▼           ▼            ▼
[휴대폰]   [노트북]      [VPS의 외부 agent]
 브라우저   브라우저      Claude Code 세션
 → 100.x.x.x:3000 으로 접근
```

### 12.3 설정 단계

```bash
# 1. PC에 Tailscale 설치 + 로그인
# (Windows/Mac/Linux 다 됨)

# 2. 본인의 다른 디바이스(휴대폰, 노트북)에도 Tailscale 설치 + 같은 계정 로그인

# 3. PC에서 워크그래프 서버 띄움
workgraph serve --bind 0.0.0.0:3000 --auth tailscale

# 4. 휴대폰/노트북에서 Tailscale로 PC의 IP 확인
#    예: 100.64.12.34
#    브라우저에서 http://100.64.12.34:3000 접속
```

### 12.4 인증 모드

CLI 옵션으로 인증 강도 선택:

| 모드 | 설명 | 언제 |
|---|---|---|
| `--auth none` | 인증 없음. Tailscale 네트워크 안에서만 접근 가능 | 개인 사용, 본인 디바이스만 |
| `--auth tailscale` | Tailscale identity 헤더 검증 (TS 기능) | 공유받은 사람 식별 필요 시 |
| `--auth token` | Bearer token | 비-Tailscale 디바이스도 접근 |
| `--auth mtls` | 클라이언트 인증서 | 외부 agent 강하게 식별 |

### 12.5 모바일 경험

Cytoscape.js는 터치 인터랙션 지원. 추가로:
- **반응형 레이아웃**: 좁은 화면에서는 사이드바 collapsed, 디테일 패널 풀스크린 모달
- **PWA manifest** 추가: 휴대폰 홈 화면에 추가 시 네이티브 앱처럼 동작
- **모바일 우선 액션**: read + commit + 우선순위 변경. 본격 그래프 편집은 PC.

### 12.6 데이터 동기화 (단일 마스터)

**기본 가정**: PC 한 대가 마스터. `.workgraph/` 폴더가 거기에만 존재.
- 외부 디바이스는 워크그래프 서버 API를 통해서만 접근. 로컬 복사본 없음.
- PC가 꺼져 있으면 외부에서 못 봄 (의도된 trade-off).

**24/7 접근이 필요해지면**:
- VPS 한 대 띄우고 `.workgraph/` Git 동기화 (PC ↔ VPS)
- 또는 VPS를 마스터로 옮기고 PC도 클라이언트가 됨
- 인터페이스는 그대로 (HTTP API 기반이므로 마이그레이션 부담 적음)

### 12.7 보안 체크리스트

- [ ] `.workgraph/` 폴더 권한 600 (본인만 읽기/쓰기)
- [ ] `audit.jsonl`은 별도 백업 (Git 또는 외부 백업)
- [ ] VPS 사용 시 SSH key only, password 로그인 차단
- [ ] 토큰은 환경 변수 또는 OS keyring에 저장 (config 파일에 평문 금지)
- [ ] 정기적으로 lease 만료 노드 확인 (좀비 lease 방지)

---

## 13. 결정 요약

| 항목 | 결정 |
|---|---|
| 구현 언어 | **Rust** (CLI/코어/서버/MCP 전부) |
| 1차 타겟 | 히키토 프로젝트, **두 플로우 분리 관리** |
| Flow A | Script Authoring (콘텐츠 스크립트 제작) |
| Flow B | Script Runtime (스크립트 재생 모듈) |
| 플로우 간 결합 | DECISION 노드 + BLOCKS 엣지로 명시 |
| 저장 방식 | 파일 시스템 (jsonl + nodes/), DB 없음 |
| 그래프 라이브러리 (FE) | Cytoscape.js + dagre |
| Agent 인터페이스 | **CLI / MCP / HTTP / SDK 4개 어댑터** |
| MCP 우선순위 | **Phase 1에서 CLI와 동시 구현** |
| 외부 접근 | **Tailscale** (사설 네트워크) |
| 동시성 제어 | Lease + heartbeat + audit log |
| MVP 시점 | W2 끝 (CLI + MCP + mermaid 출력) |

---

## 14. 미결정 / 추후 검토

- AiR(Redmine) 통합 여부 — 히키토 프로젝트는 별도이므로 우선순위 낮음, 회사 일감 통합 시 재검토.
- 임베딩 기반 의미 검색 — Phase 3 끝나고 그래프가 충분히 커진 후.
- 데스크탑 앱(Tauri) 래핑 — 웹 버전 안정화 후 결정.
- VPS 상주 전환 — 24/7 접근 필요 시점에 검토. 인터페이스는 변경 없음.
- 멀티 사용자(팀 협업) — Tailscale share로 시작, 본격적이면 SaaS화 검토.
- Python SDK binding — 다른 도구와 통합 필요 시 (예: Jupyter 분석).

---

*작성: 2026-04-29 / Rust 기반, 히키토 듀얼 플로우, Agent 1급 시민, Tailscale 외부 접근*
