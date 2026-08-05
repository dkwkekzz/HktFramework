# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

### 문서

| 문서 | 상태 |
|---|---|
| [design/Design-MasterPlan.md](design/Design-MasterPlan.md) — 세계 설계도 (원문) | 작성 완료 |
| [design/Design-ModulePlan.md](design/Design-ModulePlan.md) — 모듈 분할 및 점진적 구현 계획 (원문) | 작성 완료 |
| [design/Design-CycleModulePlan.md](design/Design-CycleModulePlan.md) — MMORPG Cycle 기반 2차원 점진 구현 WORKFLOW (최상위 구현 기준) | 작성 완료 |
| [WORKFLOW.md](WORKFLOW.md) — 상시 운영 규정 (모듈 순서·Cycle 정의·Step 규칙·완료 판정) | 작성 완료 |

### 스킬

| 스킬 | 상태 |
|---|---|
| `/advprotog-cycle-plan` — 다음 Cycle 설계 (계획 전용) | 등록 완료 |

### Cycle

| Cycle | 상태 |
|---|---|
| — | 아직 없음 (Foundation 미착수) |

## TODO

- [ ] **Foundation (Phase 0)** — V0~V4 검증 기반 + Cycle/Situation/Scenario/Step 스키마 + 리플레이 저장소 +
      단일 프로세스 권위 서버 껍질. Foundation 은 게임 Cycle 로 세지 않는다
      (design/Design-CycleModulePlan.md §9 Phase 0).
- [ ] **Cycle 1 설계** — Foundation 완료 후 `/advprotog-cycle-plan` 으로 착수.
      기준선이 없는 최초 Cycle 이므로 조사 단계의 "마지막 VERIFIED Cycle" 은 "없음"으로 적는다.