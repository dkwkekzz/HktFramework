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
| C01-D-S01 | [C01-D-S01.json](cycles/C01-border-canyon/evidence/C01-D-S01.json) | 의존 6계열·의존 22건·경합 대상 14종 (`packages/dependencies/`), 기준 장면 압력 0·충돌 0(시드 25종), basePressureHash `48dd56b636f4ba9f` (W-S01 에서 장면이 W 산출을 소비 → I-2 로 조합 hunt-order 의존 추가) |
| C01-P-S01 | [C01-P-S01.json](cycles/C01-border-canyon/evidence/C01-P-S01.json) | 행동 원자·전략 30건·목적 선택/유지·행동 계획 (`packages/possibilities/`), ST-01 planHash `c9259bbfcdda3de8` |
| C01-Q-S01 | [C01-Q-S01.json](cycles/C01-border-canyon/evidence/C01-Q-S01.json) | 세계 요구 29건·성공 결과 47건·근거 사슬 (`packages/world-requirements/`), TRACE 요구 6종 전부 일치, requirementHash `6b48208894d77879` (I-2 로 조절 계약의 근거가 목장 안전 → 목초 여유로 이동) |
| C01-W-S01 | [C01-W-S01.json](cycles/C01-border-canyon/evidence/C01-W-S01.json) | 요구 병합 → 장소6·경로2(+1 잠재)·규칙4·자원8 실체화 + 압축 역사 5건 (`packages/world-compiler/`), worldHash `983af252f581a028`. 장면 픽스처가 W 산출을 소비하도록 전환 |

**구간 1 (주체와 압력) 종료 조건 충족** — 5개 Situation 의 경합 자원이 전부 D5 충돌로 표현됨
(`node scripts/check-C01-D-S01.mjs` 5번째 점검). 검증 세션(2026-08-05) 통과 —
시드 25종 x Situation 5종 = 125 판정 전부 성립. I-2 로 조합의 사냥 질서 의존이 더해진 뒤
재검증도 통과 (목초 여유 경합이 무리 자체 경합 → 3자 경합으로 바뀌었으나 경합 자원 표현은 유지).

**구간 2 (전략과 세계 생성) 종료 조건 충족** — `node scripts/check-cycle-trace.mjs` 에서
정식 세계 요소 20종이 전부 `세계 요소 ← 요구 ← 전략 ← 의존 계열 ← 주체 ← 공리` 사슬로 이어짐
(미근거 0건). 전체 재현: `npm run check:all`.

**구간 2 묶음 검증 통과 (2026-08-05)** — `node scripts/check-segment-2.mjs` 6/6,
증거 [C01-SEGMENT-2.json](cycles/C01-border-canyon/evidence/C01-SEGMENT-2.json).
개별 Step 점검이 "그 Step 이 자기 주장을 지키는가"를 본다면 이 묶음 검증은 세 가지를 더 본다 —
① **동결 해시 재현**: 공리·존재론·배역·압력·계획·요구·세계 7종 해시를 재계산으로 대조
(상류가 조용히 바뀌면 여기서 깨진다) ② **Handoff 반사실**: 압력을 없애면 목적이 사라지고,
전략을 줄이면 요구가 줄고, 요구를 비우면 세계가 빈다 — 뒤 모듈이 앞 모듈 산출을 실제로 읽는다는
증명(청사진 하드코딩 우회 0) ③ **결정성**: 같은 시드 반복 동일, 다른 시드는 구조 6/2/4 고정·해시만 상이.
증거 재생성 시 `generatedAt` 외 `contentHash` 포함 전 필드가 비트 동일 — 주장이 아니라 재현으로 확인.

### 열린 이슈

| # | 내용 | 발견 | 담당 |
|---|---|---|---|
| I-3 | **Q 의 성공 결과(outcomes 47건)를 아무도 소비하지 않는다.** `c01Extractor` 는 전략 원자마다 `{effect, behavior, at}` 성공 결과를 뽑아 `WorldRequirementGraph` 에 실어 보내지만(주석에는 "W/R 이 소비"), W 는 요구(`merged`)만 읽고 outcomes 는 건드리지 않는다 — 소비처 전수 조사 결과 테스트와 증거 카운트 외 0건. Handoff Gate 의 **"미소비 출력이 없음"** 항목이 현재 미충족이다. 세계에 남는 변화가 소비되지 않으면 R 의 현상(발자국·훼손·실종 흔적)이 전략과 무관하게 따로 만들어질 위험이 있다 — 그러면 "행동 → 세계에 남는 자국" 인과가 끊긴다. **처리**: C01-R-S01 이 PhenomenonStream 을 만들 때 outcomes 를 입력으로 삼고, 소비 여부를 `check-segment-2.mjs` 에 검사로 추가한다. | 구간 2 묶음 검증 | `advprotog-step-implementer` (R-S01 에서) |

### 닫힌 이슈

| # | 내용 | 처리 |
|---|---|---|
| I-2 | **조합의 `hunt-order`(사냥 질서) 목적이 D 의존으로 표현되지 않았다.** CYCLE.yaml 은 조합 목적을 `village-defense·hunt-order·reputation` 으로 선언하는데 D-S01 은 앞뒤 둘만 의존으로 만들었다. 그 결과 무리 과잉(ST-C01-02)에서 조합의 압력이 0 이라 `P-CULL-CONTRACT`(조절 계약)가 활성화되지 않았다 — 생태 관리 지렛대가 세계에서 당겨지지 않았다. | **수정 완료** — ① D: 조합에 `habitat`/`herd-valley-forage` 의존 추가, 요구는 무리 개체수에서 파생(`ceil(개체수/20)` — 무리 자신의 서식 요구와 같은 척도 = "무리가 번식할 여지"). ② P: `P-CULL-CONTRACT` 를 `safety`/`village-safety` → `habitat`/`herd-valley-forage` 로 이동 — 조절 계약은 마을 안전이 아니라 사냥 질서에서 나온다. CYCLE.yaml 의 개입군 선언과도 일치(조절 계약은 ST-01 이 아니라 **ST-02** 의 개입군). **파급 처리**: 예고대로 `herd-valley-forage` 충돌이 자체 경합 → 3자 경합(조합·무리 먹이·무리 서식)으로 바뀌었고, SC-C01-D5-01 과 구간 1 종료 조건을 25 시드로 재검증해 통과. requirementHash·basePressureHash 갱신, planHash·worldHash 는 불변. |
| I-4 | **STATE.md 에 적힌 C01-D-S01 의 pressureHash 가 커밋된 증거와 달랐다.** 기록은 `bce1764b284c89db`, 실제 증거 파일은 `basePressureHash: 0b7ba374ba3c41e7`. W-S01 커밋(83bd87b)에서 장면 픽스처가 손으로 적던 지형·재고 상수를 버리고 W 산출을 소비하도록 바뀌며 기준 장면 압력 해시가 정당하게 갱신됐는데, STATE.md 행만 옛 값으로 남았다. 증거는 맞고 요약만 틀린 경우라 세계 동작에는 영향이 없지만, 요약이 증거와 어긋나면 회귀를 놓친다. | **수정 완료** — STATE.md 를 증거 값으로 정정. 재발 방지로 `check-segment-2.mjs` 가 7종 해시를 **동결값 대조**로 재계산 검사한다 (이 이슈도 그 검사가 처음 잡아냈다). 상류가 바뀌면 이제 `npm run check:all` 이 실패한다. |
| I-1 | 기준 장면의 "압력 0·충돌 0" 대조군 성질이 기본 시드 전용이었다 — `herd-valley.carryingCapacity` 상수(50) 대 무리 개체수 변동([30,50])의 불일치로 시드 8/25 에서 기준 장면에 이미 충돌 발생. | **수정 완료** — 수용력을 배역 개체수에서 파생(`개체수 + BASE_FORAGE_SLACK`), ST-C01-02 도 절대값 대신 `수용력 − 2` 상대값으로 전환. 테스트·점검을 단일 시드에서 **25 시드 속성 검사**로 승격하고 파생 강제 회귀 테스트 추가. 시드 1~100 재검증: 기준 장면 균형 100/100, 종료 조건 500/500, D5-01 3자 충돌 100/100. |

## TODO
- [x] **구간 2 묶음 검증** — 통과 (6/6, `scripts/check-segment-2.mjs`). I-4 발견·수정, I-3 이슈업
- [x] **I-2 (조합 hunt-order 의존)** — 닫힘. 무리 과잉에서 조합이 조절 계약을 발급한다
      (균형 압력 0 → 과잉 0.33 → 여유 소진 시 1.00, 이득 0 → 3 으로 단조 상승)
- [ ] 구간 3 착수: **C01-R-S01** (상태 저장소·사건 로그·현상 생성) → C01-R-S02 → C01-E-S01 → C01-E-S02
      — R-S01 에서 **I-3(Q outcomes 소비)** 를 함께 닫는다: 현상은 전략의 성공 결과에서 나와야 한다
- [ ] 구간 3 종료 조건: 5개 Situation 전부 상태 계산으로 발생 (하드코딩 트리거 0)
- [ ] (선택) docs/ 보강 — Project-Architecture.md, Module-Contracts.md, Glossary.md 는
      Foundation 구현이 실체를 갖춘 뒤 `advprotog-workflow-maintainer` 로 추가한다.
