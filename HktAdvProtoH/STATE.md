# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 `artifacts/` 의 Handoff Artifact 에 남는다.

## 구현 현황 (핵심)

### 문서

| 문서 | 상태 |
|---|---|
| [design/Design-Concept.md](design/Design-Concept.md) — 세계 의미론 (원문) | 작성 완료 |
| [design/Design-Workflow.md](design/Design-Workflow.md) — 구현 Workflow (원문) | 작성 완료 |
| [design/graph/README.md](design/graph/README.md) — Human Design 그래프 양식 | 작성 완료 (내용 그래프는 미작성) |

### 작업 환경 (Observable World Agent Workflow)

| 구성물 | 상태 |
|---|---|
| `observable-world-workflow` Skill — Stage Router | 구성 완료 |
| Stage Guide 5종 (`references/*-agent.md`, `semantic-review.md`) | 구성 완료 |
| `common-invariants.md` · `artifact-contracts.md` | 구성 완료 |
| `source-index.md` + 원본 절 지도 2종 | 구성 완료 |
| Stage subagent 4종 (`.claude/agents/ow-*.md`) | 구성 완료 |
| `artifacts/` 저장소 + `REGISTRY.md` | 구성 완료 (비어 있음) |

### 세계 구현

아직 없음. 코드 없음.

## TODO

1. **Human Design 작성** — `design/graph/<domain>.md` 에 첫 Goal / Possibility Graph 를 쓴다.
   Agent 가 아니라 인간이 하는 일이다. Workflow 는 여기서만 시작할 수 있다.
2. 첫 도메인이 정해지면 `observable-world-workflow` 로 **Stage 1 (Intent)** 를 호출한다.
3. 이후 Stage 2 → Human Review → Stage 4 → Stage 5 를 **각각 별도 호출**로 진행한다.

## 열린 이슈

| # | 내용 | 상태 |
|---|---|---|
| 1 | Human Design 그래프가 아직 없어 Workflow 를 실제로 굴려보지 못했다 — 첫 도메인 확정 필요 | OPEN |
| 2 | 런타임 코드베이스(언어·실행 환경)가 미정 — Stage 4 이전에 결정 필요 | OPEN |
