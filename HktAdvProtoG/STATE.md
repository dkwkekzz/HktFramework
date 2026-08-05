# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

### 문서

| 문서 | 상태 |
|---|---|
| [AGENTS.md](AGENTS.md) — 부트스트랩 (Skill 라우팅 + 공통 불변 규칙) | 작성 완료 |
| [docs/Design-ModulePlan-CycleWorkflow.md](docs/Design-ModulePlan-CycleWorkflow.md) — 최상위 설계·구현 기준 (헌법) | 작성 완료 |
| [docs/Design-MasterPlan.md](docs/Design-MasterPlan.md) — 세계 설계도 (원문) | 작성 완료 |
| [docs/Design-ModulePlan.md](docs/Design-ModulePlan.md) — 모듈 분할 및 점진적 구현 계획 (원문) | 작성 완료 |

구 `WORKFLOW.md` 는 폐기 — 내용은 Design-ModulePlan-CycleWorkflow.md 에 통합됨
(§4.2 우회 구현 금지 2항, §6.3 완료 판정 순서, §11 계획 산출물 6종).

### 스킬 (작업 방식 단위 — `.claude/skills/advprotog-*`)

| 스킬 | 상태 |
|---|---|
| `advprotog-cycle-planner` — 다음 Cycle 설계 (계획 전용) | 등록 완료 |
| `advprotog-step-implementer` — Module Step 구현 | 등록 완료 |
| `advprotog-scenario-verifier` — Scenario·완료 증거 검증 | 등록 완료 |
| `advprotog-cycle-integrator` — Cycle 통합·VERIFIED 판정 | 등록 완료 |
| `advprotog-workflow-maintainer` — Workflow·Skill 구조 변경 | 등록 완료 |

구 `advprotog-cycle-plan` 스킬은 `advprotog-cycle-planner` 로 대체·폐기.

### Cycle

| Cycle | 상태 |
|---|---|
| — | 아직 없음 (Foundation 미착수) |

## TODO

- [ ] **Foundation (Phase 0)** — V0~V4 검증 기반 + Cycle/Situation/Scenario/Step 스키마 + 리플레이 저장소 +
      단일 프로세스 권위 서버 껍질. Foundation 은 게임 Cycle 로 세지 않는다
      (docs/Design-ModulePlan-CycleWorkflow.md §9 Phase 0).
- [ ] **Cycle 1 설계** — Foundation 완료 후 `advprotog-cycle-planner` 로 착수.
      기준선이 없는 최초 Cycle 이므로 조사 단계의 "마지막 VERIFIED Cycle" 은 "없음"으로 적는다.
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
