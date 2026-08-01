# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

### 문서

| 문서 | 상태 |
|---|---|
| [design/Design-MasterPlan.md](design/Design-MasterPlan.md) — 세계 설계도 (원문) | 작성 완료 |
| [design/Design-ModulePlan.md](design/Design-ModulePlan.md) — 모듈 분할 및 점진적 구현 계획 (원문) | 작성 완료 |
| [modules/WORKFLOW.md](modules/WORKFLOW.md) — 작업 방식 설계 (파생) | 작성 완료 |
| [modules/MODULES.md](modules/MODULES.md) — 모듈 레지스트리: V~A 전 모듈 입력·출력·상태 원소·시각화 (파생) | 작성 완료 |
| [modules/MODULE-TEMPLATE.yaml](modules/MODULE-TEMPLATE.yaml) — 모듈 계약 서식 (파생) | 작성 완료 |

### 코드

| 단계 | 모듈 | 상태 | 확인 장면 |
|---|---|---|---|
| 0 (M0 결정적 세계) | V1-a 모노레포 스캐폴드 | DONE | `npm test` — core 배럴이 빌드 없이 로드되고 런타임 의존성 0개 |
| 0 | **V1 결정적 실행 환경** | **VERIFIED** ([증거](app/packages/contracts/evidence/V1.json)) | `node packages/scenarios/verify/v1.ts` — 같은 시드 100회 실행이 상태 해시 하나로 모이고, 시드 한 글자를 바꾸면 사건 #0 부터 갈라지는 것이 표로 보인다 |
| 0 | **V2 시나리오 실행기** | **VERIFIED** ([증거](app/packages/contracts/evidence/V2.json)) | `node packages/scenarios/verify/v2.ts` — 자체 장면 3종이 통과 표로 나오고, 고의 결함 장면에서 초기상태·입력·기대·실제·최초 분기 경로 `$.stock.b` 다섯이 함께 출력된다 |
| 0 | V2-b V1 시나리오 소급 등록 | DONE | `node packages/scenarios/verify/evidence.ts` — V1·V2 가 같은 실행기·같은 증거 생성기를 지나 둘 다 커버리지 완결로 찍힌다 |
| 0 | V0-a 계약 파서 | DONE | `node --test` — 실제 계약을 읽고 탭·앵커·플로 매핑·중복 키를 줄 번호와 함께 거부한다 |
| 0 | **V0 모듈 계약 레지스트리** | **VERIFIED** ([증거](app/packages/contracts/evidence/V0.json)) | `node packages/scenarios/verify/v0.ts` — 실제 계약 3개가 위상 순서 `V1 → V2 → V0` 으로 등록되고, 목적·입출력·시나리오·증거를 지우거나 자기 의존을 넣으면 각각의 사유로 거부된다 |
| 0 | **V4 완료 증거 시스템** | **VERIFIED** ([증거](app/packages/contracts/evidence/V4.json)) | `node packages/scenarios/verify/v4.ts` — 증거 대시보드에 네 모듈이 완료로 찍히고, 산출물을 하나씩 무너뜨리면 사유와 함께 IMPLEMENTED 로 내려앉는다. 소스를 고친 뒤 예전 증거로 완료를 유지하려 하면 `evidence-unsupported` 로 막힌다 |
| 0 | **V3 브라우저 검증 Lab** | **VERIFIED** ([증거](app/packages/contracts/evidence/V3.json)) | `npm run dev -w @hkt/lab` → `http://localhost:5173/#/v1` — 다섯 모듈 페이지가 각각 화면 7요소로 열리고 전부 통과 배지를 단다 (Chromium 확인: 콘솔 오류 없음) |
| 0 | O1-a 존재론 골격 + 존재 3종 | DONE | `node --test` — 사냥꾼·붉은 장막·허기 값이 각각 `Subject`·`Entity`·`State` 로 분류되고, 손으로 지은 id·구조 값·함수는 경로와 사유로 거부된다 |
| 0 | O1 → O2 → O0 | 진행 중 | |

구현 루트는 [app/](app/) — npm workspaces 모노레포, Node ≥22.18 네이티브 TS 타입 스트리핑으로
빌드 없이 `.ts` 를 실행한다 (런타임 의존성 0개, `typescript`·`@types/node` 는 타입 검사 전용).

모든 작업은 [modules/WORKFLOW.md](modules/WORKFLOW.md)의 8단계 사이클을 따른다:
작업 카드 없이 착수 금지, 커밋 1개 = 작업 1개, 완료 판정은 증거 파일로만.

## 소급 부채 (V0~V4 완성 시 갚는다)

WORKFLOW §5 단서대로, V0~V4 자체가 없는 동안은 5~7단계를 수동으로 수행한다.
아래는 V0~V4 가 서는 즉시 소급 등록해야 할 항목이다.

| 부채 | 현재 대체 수단 | 갚는 시점 |
|---|---|---|
| ~~V1 시나리오가 `Scenario{arrange,act,assert}` 가 아니다~~ | **V2-b 로 상환** — `suites/v1.ts` | 완료 |
| ~~계약이 레지스트리에 등록되지 않았다~~ | **V0 으로 상환** — `buildRegistry` 가 실제 계약을 검사 | 완료 |
| Lab 확인이 자동이 아니다 (증거의 `labScenarios` 가 `manual`) | 사람이 브라우저에서 본다 + `verify/v3.ts` 가 7요소 충족·렌더 결정성을 검사 | 브라우저 자동 확인 도입 시 |
| ~~증거를 손으로 쓴 스크립트가 만든다~~ | **V4 로 상환** — `buildEvidence` 가 유일한 status 판정자 | 완료 |
| ~~Lab 페이지가 없다~~ | **V3 으로 상환** — 모듈당 페이지 1개, 화면 7요소 | 완료 |

## TODO — 단계 0 (구현 순서: WORKFLOW §9)

### [O1] 공통 세계 존재론
- 목적: 원문 설계의 모든 개념을 공통 존재론 12타입 중 하나 이상으로 표현한다.
- 입력: (없음 — 타입 정의 모듈) + 원문 개념 카탈로그
- 출력: 존재론 타입 12종 + `classify()` + `checkCoverage() → CoverageReport`
- 검증 장면: 원문 개념 카탈로그 전 항목이 12타입 중 하나 이상으로 분류되고, 12타입 모두 최소 1개 개념을 갖는다.
- 상태 원소: `Subject` `Entity` `State` `Rule` `Phenomenon` `Claim` `Commitment` `Affordance` `Event` `Dependency` `Possibility` `WorldRequirement`
- 시각화: Lab `/o1` — diff(원문 개념 ↔ 타입 커버리지 표)

상태 원소 12종 > 3종이라 WORKFLOW §3(원소 묶음별 분할)에 걸린다. 아래 5개 하위 작업으로 쪼갠다.

- **[O1-b] 작동 3종** — 목적: 세계가 굴러가는 방식을 `Rule` `Phenomenon` `Event` 로 정의한다.
  검증 장면: 사건 하나가 현상을 낳고 규칙이 그 사건의 근거로 지목되는 사슬이 타입만으로 표현된다.
- **[O1-c] 관계 3종** — 목적: 주체가 세계에 거는 것을 `Claim` `Commitment` `Affordance` 로 정의한다.
  검증 장면: 실제 상태와 다른 주장, 기한이 지난 약속, 비용 없는 어포던스가 각각 값으로 구별된다.
- **[O1-d] 요구 3종** — 목적: 주체의 결핍과 세계에 대한 청구를 `Dependency` `Possibility` `WorldRequirement` 로 정의한다.
  검증 장면: 의존 → 가능성 → 세계 요구가 id 로 이어지는 근거 사슬이 타입만으로 표현된다.
- **[O1-e] 개념 커버리지 검사기** — 목적: 원문 개념 중 12타입으로 환원되지 않는 것이 남으면 그 사실을 드러낸다.
  검증 장면: 카탈로그 전 항목이 매핑되고, 타입 없는 개념을 넣으면 미분류로 지목된다.
  상태 원소: `ConceptEntry`, `CoverageReport` / 시각화: diff(커버리지 표)

### [O2] 상태·규칙 스키마 → [O0] 세계관 공리
- 카드 상세는 착수 시 MODULES.md O 계층 행으로부터 작성.

## 남은 공용 렌더러 (WORKFLOW §6)

diff 뷰는 구현됐고, 그래프·게이지는 최소판이 V0·V4 페이지에 있다.
타임라인과 3D 씬은 소비할 모듈(R1·E2·X 계층)에 착수할 때 작업 카드로 만든다.

## 단계 게이트

단계 0 의 완료 조건(계약 등록·결정 실행·시나리오 자동 실행·Lab 확인)이 증거로 확인되기 전에는
단계 1(S0~S3, D0~D4)에 착수하지 않는다.
