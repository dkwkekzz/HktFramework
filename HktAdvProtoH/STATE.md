# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

### 문서

| 문서 | 상태 |
|---|---|
| [design/Design-Concept.md](design/Design-Concept.md) — 게임 개념 지도 (원문) | 작성 완료 |
| [design/Design-Workflow.md](design/Design-Workflow.md) — 게임 전체 구현 지도 (원문) | 작성 완료 |
| [workflow/WORKFLOW-OPS.md](workflow/WORKFLOW-OPS.md) — Agent Workflow 운영 가이드 | 작성 완료 |
| workflow/templates/ — Package 단계별 템플릿 7종 | 작성 완료 |
| `.claude/skills/advprotoh-{intent,world-model,implement,verify}` — 단계별 Skill 4종 | 작성 완료 |

### Package 진행 상황

| Package | Status | 비고 |
|---|---|---|
| (없음) | — | 첫 Graph 작성 후 `/advprotoh-intent` 로 개시 |

## TODO

- [ ] **인간**: 첫 도메인 Graph 작성 (`design/graphs/<도메인>.md`, 템플릿: `workflow/templates/graph.md`) — 후보: mining (문서 예시와 일치)
- [ ] 첫 Package 파이프라인 1바퀴 돌려 Workflow 검증 (intent → world → review → implement → verify)
- [ ] 1바퀴 후 운영 규칙 회고 — WORKFLOW-OPS.md / Skill 보정
