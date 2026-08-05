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

### Foundation (Phase 0)

| 구성 | 상태 |
|---|---|
| V1 결정적 실행 (`packages/verification/src/deterministic.js`) | 완료 — Seeded Random·결정적 ID·Stable Sort·State Hash·Tick |
| V0 모듈 계약 (`contracts.js`) + Cycle 레지스트리 (`cycleRegistry.js`) | 완료 — 고정 순서·의존성 검사·cycle:lint 골격 |
| V2 Scenario Runner (`scenarioRunner.js`) | 완료 — 해시 궤적·최초 차이 지점 보고 |
| V4 완료 증거 (`evidence.js`) | 완료 |
| 이벤트 로그·리플레이 저장소 (`packages/events/`) | 완료 — 재생=재현, 저장·로드 왕복 |
| 권위 서버 껍질 (`packages/server/`) | 완료 — 명령 제출·충돌 1회 확정·사건 경유 상태 변경 |
| V3 Lab (`apps/lab/index.html`) | 최소판 — 실행 보고 로드·해시 궤적 비교·이벤트 표 |
| 완료 조건 7항 (`npm run foundation:check`) | **7/7 통과** — [evidence/foundation/phase0.json](evidence/foundation/phase0.json) |

잔여: V3 Lab 고도화, 3D 앱·Lab 공통 상태 연결(X 구간에서), CYCLE.yaml→JSON 수동 동기화(scripts/build-cycle-json.py).

### Cycle

| Cycle | 상태 |
|---|---|
| [C01 — 국경 협곡 사냥터](cycles/C01-border-canyon/CYCLE.md) | **IMPLEMENTING** — 구간 1 진행 중. V-S01·O-S01 완료 ([증거](cycles/C01-border-canyon/evidence/)) |

### 완료 Step

| Step | 증거 | 비고 |
|---|---|---|
| C01-V-S01 | [C01-V-S01.json](cycles/C01-border-canyon/evidence/C01-V-S01.json) | C01 등록·lint 0 오류, 검증 세션 통과 |
| C01-O-S01 | [C01-O-S01.json](cycles/C01-border-canyon/evidence/C01-O-S01.json) | 공리 5종 (`packages/ontology/`), 실패 Scenario 5종 통과, registryHash `111573ec9f3760b5` |
| C01-O-S02 | [C01-O-S02.json](cycles/C01-border-canyon/evidence/C01-O-S02.json) | 존재론 카탈로그(장소6·경로3·주체6·역할4·자원6·제작물4·사건타입9) + 상태 스키마 v1, ontologyHash `41841aa70a7dd1ea` |
| C01-S-S01 | [C01-S-S01.json](cycles/C01-border-canyon/evidence/C01-S-S01.json) | 원형 프로필 6종+역할 4종 (`packages/subjects/`), 표준 배역 8주체 결정적 생성, castHash `2af9d14732bde51a` |

## TODO

- [ ] **C01-D-S01** — 의존 그래프 6계열(먹이·안전·부산물·치료·서식지·평판) + 충족도 평가·충돌 탐지
      (`advprotog-step-implementer`, 구간 1 마지막 Step)
- [ ] 구간 1 종료 조건: D 출력이 5개 Situation 충돌 구조를 모두 표현 (STEPS.md)
- [ ] (권장) V-S01~D-S01 묶음 검증 세션 (`advprotog-scenario-verifier`) — 구간 1 종료 시
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
