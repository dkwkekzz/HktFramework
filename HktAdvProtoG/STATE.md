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
| C01-O-S02 | [C01-O-S02.json](cycles/C01-border-canyon/evidence/C01-O-S02.json) | 존재론 카탈로그(장소6·경로3·주체7=원형6+player·역할4·자원6·제작물4·사건타입9) + 상태 스키마 v1, ontologyHash `ad1590bf20bcaffb` |
| C01-S-S01 | [C01-S-S01.json](cycles/C01-border-canyon/evidence/C01-S-S01.json) | 원형 프로필 6종+역할 4종 (`packages/subjects/`), 표준 배역 8주체 결정적 생성, castHash `2af9d14732bde51a` |
| C01-D-S01 | [C01-D-S01.json](cycles/C01-border-canyon/evidence/C01-D-S01.json) | 의존 6계열·의존 21건·경합 대상 14종 (`packages/dependencies/`), 기준 장면 압력 0·충돌 0, pressureHash `bce1764b284c89db` |

**구간 1 (주체와 압력) 종료 조건 충족** — 5개 Situation 의 경합 자원이 전부 D5 충돌로 표현됨
(`node scripts/check-C01-D-S01.mjs` 4번째 점검). 전체 재현: `npm run check:all`.
검증 세션(2026-08-05) 통과 — 시드 25종 x Situation 5종 = 125 판정 전부 성립.

### 열린 이슈

| # | 내용 | 발견 | 담당 |
|---|---|---|---|
| I-1 | **기준 장면의 "압력 0·충돌 0" 대조군 성질이 기본 시드 전용.** `buildBaseScene` 이 `herd-valley.carryingCapacity` 를 50 으로 고정하는데 무리 개체수는 [30,50] 으로 굴려져, 여유 목초(=50−개체수)가 0~20 으로 흔들린다. 시드 25종 중 8종에서 기준 장면에 `herd-valley-forage`·`marsh-colony` 충돌이 이미 발생(최대 압력 1.00). 테스트 `기준 장면은 균형 상태다` 는 기본 시드만 검사하므로 속성처럼 보이지만 단일 점 검사다. **구간 1 종료 조건 자체는 시드 무관하게 성립하므로 차단 결함은 아니다.** 수정 방향: 수용력을 배역의 실제 개체수에서 파생(예: 개체수+10)하거나 기준 장면의 개체수를 고정하고, 테스트를 시드 다중 검사로 승격. | 검증 세션 | `advprotog-step-implementer` (D-S01 후속) |

## TODO

- [ ] **I-1 수정** — 기준 장면 대조군의 시드 견고성 (위 열린 이슈)
- [ ] 구간 2 착수: **C01-P-S01** (행동 원자 + 전략 6계열 + 목적 선택) —
      D 의 `dominant`·압력이 P 의 목적 활성화 입력이 된다
- [ ] 구간 2 잔여: C01-Q-S01(세계 요구) → C01-W-S01(협곡 실체화)
- [ ] 구간 2 종료 조건: `cycle:trace` 미근거 세계 요소 0건 (STEPS.md)
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
