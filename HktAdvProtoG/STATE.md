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
| C01-S-S01 | [C01-S-S01.json](cycles/C01-border-canyon/evidence/C01-S-S01.json) | 원형 프로필 6종+역할 4종 (`packages/subjects/`), 표준 배역 8주체 결정적 생성, castHash `44b0b0ce93d081f1` |
| C01-D-S01 | [C01-D-S01.json](cycles/C01-border-canyon/evidence/C01-D-S01.json) | 의존 6계열·의존 21건·경합 대상 14종 (`packages/dependencies/`), 기준 장면 압력 0·충돌 0(시드 25종), pressureHash `bce1764b284c89db` |
| C01-P-S01 | [C01-P-S01.json](cycles/C01-border-canyon/evidence/C01-P-S01.json) | 행동 원자·전략 30건·목적 선택/유지·행동 계획 (`packages/possibilities/`), ST-01 planHash `c9259bbfcdda3de8` |
| C01-Q-S01 | [C01-Q-S01.json](cycles/C01-border-canyon/evidence/C01-Q-S01.json) | 세계 요구 29건·성공 결과 47건·근거 사슬 (`packages/world-requirements/`), TRACE 요구 6종 전부 일치, requirementHash `deb3ec1471ed0617` |
| C01-W-S01 | [C01-W-S01.json](cycles/C01-border-canyon/evidence/C01-W-S01.json) | 요구 병합 → 장소6·경로2(+1 잠재)·규칙4·자원8 실체화 + 압축 역사 5건 (`packages/world-compiler/`), worldHash `983af252f581a028`. 장면 픽스처가 W 산출을 소비하도록 전환 |

**구간 1 (주체와 압력) 종료 조건 충족** — 5개 Situation 의 경합 자원이 전부 D5 충돌로 표현됨
(`node scripts/check-C01-D-S01.mjs` 4번째 점검). 검증 세션(2026-08-05) 통과 —
시드 25종 x Situation 5종 = 125 판정 전부 성립.

**구간 2 (전략과 세계 생성) 종료 조건 충족** — `node scripts/check-cycle-trace.mjs` 에서
정식 세계 요소 20종이 전부 `세계 요소 ← 요구 ← 전략 ← 의존 계열 ← 주체 ← 공리` 사슬로 이어짐
(미근거 0건). 전체 재현: `npm run check:all`.

### 열린 이슈

| # | 내용 | 발견 | 담당 |
|---|---|---|---|
| I-2 | **조합의 `hunt-order`(사냥 질서) 목적이 D 의존으로 표현되지 않는다.** CYCLE.yaml 은 조합 목적을 `village-defense·hunt-order·reputation` 으로 선언하는데 D-S01 은 앞뒤 둘만 의존으로 만들었다. 그 결과 무리 과잉(ST-C01-02)에서 조합의 압력이 0 이라 `P-CULL-CONTRACT`(조절 계약)가 활성화되지 않는다 — 생태 관리 지렛대가 세계에서 당겨지지 않는다. **수정 시 파급 주의**: 조합에 목초 여유 의존을 추가하면 D 할당 캐스케이드에서 조합이 무리보다 먼저 신청해 ST-C01-02 의 `herd-valley-forage` 충돌이 자체 경합(selfContention)에서 다자 경합으로 바뀐다 → 구간 1 종료 조건과 SC-C01-D5-01 재검증 필요. | C01-P-S01 구현 | `advprotog-step-implementer` (D-S01 후속) |

### 닫힌 이슈

| # | 내용 | 처리 |
|---|---|---|
| I-1 | 기준 장면의 "압력 0·충돌 0" 대조군 성질이 기본 시드 전용이었다 — `herd-valley.carryingCapacity` 상수(50) 대 무리 개체수 변동([30,50])의 불일치로 시드 8/25 에서 기준 장면에 이미 충돌 발생. | **수정 완료** — 수용력을 배역 개체수에서 파생(`개체수 + BASE_FORAGE_SLACK`), ST-C01-02 도 절대값 대신 `수용력 − 2` 상대값으로 전환. 테스트·점검을 단일 시드에서 **25 시드 속성 검사**로 승격하고 파생 강제 회귀 테스트 추가. 시드 1~100 재검증: 기준 장면 균형 100/100, 종료 조건 500/500, D5-01 3자 충돌 100/100. |

## TODO
- [ ] **(권장) 구간 2 묶음 검증** — `advprotog-scenario-verifier` 로 P·Q·W 재현·증거 대조
- [ ] **I-2 (조합 hunt-order 의존)** — 구간 2 가 닫혔으므로 지금이 처리 시점
- [ ] 구간 3 착수: **C01-R-S01** (상태 저장소·사건 로그·현상 생성) → C01-R-S02 → C01-E-S01 → C01-E-S02
- [ ] 구간 3 종료 조건: 5개 Situation 전부 상태 계산으로 발생 (하드코딩 트리거 0)
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
