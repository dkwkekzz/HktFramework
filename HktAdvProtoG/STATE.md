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

### 스킬 (작업 방식 단위 — `.claude/skills/advprotog-*`)

| 스킬 | 상태 |
|---|---|
| `advprotog-cycle-planner` — 다음 Cycle 설계 (계획 전용) | 등록 완료 |
| `advprotog-step-implementer` — Module Step 구현 | 등록 완료 |
| `advprotog-scenario-verifier` — Scenario·완료 증거 검증 | 등록 완료 |
| `advprotog-cycle-integrator` — Cycle 통합·VERIFIED 판정 | 등록 완료 |
| `advprotog-workflow-maintainer` — Workflow·Skill 구조 변경 | 등록 완료 |

### Cycle

| Cycle | 상태 |
|---|---|
| [C01 — 국경 협곡 사냥터](cycles/C01-border-canyon/CYCLE.md) | **PLANNED** (사냥 중심 재설계 — 신·국가·밀수는 후속 Cycle 이월, 구현은 Foundation 완료 후) |

## TODO

- [ ] **Foundation (Phase 0)** — V0~V4 검증 기반 + Cycle/Situation/Scenario/Step 스키마 + 리플레이 저장소 +
      단일 프로세스 권위 서버 껍질. Foundation 은 게임 Cycle 로 세지 않는다
      (docs/Design-ModulePlan-CycleWorkflow.md §9 Phase 0).
      **C01 구현(구간 1~7)의 선행 게이트** — cycles/C01-border-canyon/STEPS.md 구간 0 참조.
- [ ] **C01 구현** — Foundation 완료 후 `advprotog-step-implementer` 로
      cycles/C01-border-canyon/STEPS.md 의 구간 1 (C01-V-S01 → D-S02) 부터 착수.
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
