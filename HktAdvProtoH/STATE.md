# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 각 Cycle 의
> `cycles/<cycle-id>/` Artifact 에 남는다.

## 현재 위치

| 항목 | 값 |
|---|---|
| 진행 모델 | Observable World — Progressive Cycle Workflow |
| World Baseline | `v0` (비어 있음 — 검증된 Semantic 없음) |
| 현재 Cycle | `CYCLE-001` Mining — Resource Extraction |
| 현재 Stage | Stage 0 — Cycle Contract **DRAFT**, 인간 확정 대기 |
| 코드 | 없음 (기술 스택은 Stage 4 에서 결정) |

상세: [context/CURRENT-CYCLE.md](context/CURRENT-CYCLE.md)

## 구현 현황 (핵심)

### 운영 환경

| 항목 | 상태 |
|---|---|
| [CLAUDE.md](CLAUDE.md) — Stage Router 부트스트랩 + 문서 인덱스 | 구성 완료 |
| [context/](context/) — 장기 Context 4종 | 구성 완료 (Baseline v0 비어 있음) |
| [stages/](stages/) — Stage Guide 8종 | 구성 완료 |
| [templates/](templates/) — Artifact 서식 9종 | 구성 완료 |
| [cycles/CYCLE-001-mining/](cycles/CYCLE-001-mining/) | Contract DRAFT 만 존재 |
| `.claude/skills/advprotoh-stage-router` | 구성 완료 |

### 문서

| 문서 | 상태 |
|---|---|
| [design/Design-Concept.md](design/Design-Concept.md) — 세계·주체 개념 (원문) | 작성 완료 |
| [design/Design-Workflow.md](design/Design-Workflow.md) — Observable World Workflow (원문) | 작성 완료 |
| [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) — Progressive Cycle Workflow (운영 헌법) | 작성 완료 |

### World Baseline

```text
v0 — Supported State / Rules / Goals / Possibilities / Observable 모두 없음
```

검증된 Cycle 이 아직 없다.

## TODO

- [ ] **인간**: `cycles/CYCLE-001-mining/00-CYCLE-CONTRACT.md` 확정 또는 수정
      (씨앗 초안은 Workflow 명세 §21–§23 의 Cycle 001 예시를 옮긴 것)
- [ ] Stage 1 — Intent Package 작성 (별도 invocation)
- [ ] Stage 2 — World Definition Package 작성 (별도 invocation)
- [ ] Stage 3 — Human Semantic Review (인간 Gate)
- [ ] Stage 4 — Implementation (여기서 런타임 기술 스택을 처음 결정)
- [ ] Stage 5 — Verification (Semantic / Observable / Runtime Closure + Traceability)
- [ ] Stage 6 — Evolution Compatibility
- [ ] Stage 7 — Baseline Merge → v1

## 열린 이슈

| # | 이슈 | 상태 |
|---|---|---|
| 1 | 런타임 기술 스택 미결정 — Stage 4 의 결정 사항이므로 의도적으로 비워 둠 (RULE 8) | 정상 |
| 2 | Goal / Possibility Graph 원본이 `design/Design-Concept.md` 산문 안에 있음. Cycle 이 늘면 ID 체계(`GOAL-*`, `POSSIBILITY-*`)를 별도 문서로 뽑을 필요가 생길 수 있음 | 관찰 |
