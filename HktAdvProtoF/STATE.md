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
| 0 (M0 결정적 세계) | V1-a 모노레포 스캐폴드 | IMPLEMENTED | `npm test` — core 배럴이 빌드 없이 로드되고 런타임 의존성 0개 (2 pass) |
| 0 | V1 결정적 실행 환경 | 미착수 | |
| 0 | V2, V0, V4, V3, O0~O2 | 미착수 | |

구현 루트는 [app/](app/) — npm workspaces 모노레포, Node ≥22.18 네이티브 TS 타입 스트리핑으로
빌드 없이 `.ts` 를 실행한다 (런타임 의존성 0개, `typescript`·`@types/node` 는 타입 검사 전용).

모든 작업은 [modules/WORKFLOW.md](modules/WORKFLOW.md)의 8단계 사이클을 따른다:
작업 카드 없이 착수 금지, 커밋 1개 = 작업 1개, 완료 판정은 증거 파일로만.

## TODO — 단계 0 (구현 순서: WORKFLOW §9)

### [V1] 결정적 실행 환경
- 목적: 같은 시드와 입력이면 항상 같은 사건 순서와 상태 해시가 나오게 한다.
- 입력: `(seed, tick)` / 출력: TickClock, SeededRandom, DeterministicId, stableSort, stateHash
- 검증 장면: 같은 시드 100회 실행 → 해시 전부 동일, 다른 시드 → 해시 상이.
- 상태 원소: Seed, Tick, StateHash
- 시각화: diff — 해시 비교표
- 비고: 하위 작업 `V1-a` (app/ 모노레포 스캐폴드) 완료 — 위 구현 현황 참조.

### [V2] 시나리오 실행기
- 목적: 모듈의 대표 장면을 arrange/act/assert 로 자동 실행한다.
- 입력: Scenario / 출력: ScenarioResult + Assertion[] (실패 시 최초 분기 상태 경로)
- 검증 장면: 일부러 실패하는 시나리오 → 초기 상태·입력·기대·실제·분기 경로가 출력된다.
- 상태 원소: ScenarioResult, Assertion
- 시각화: diff — 기대 vs 실제

### [V0] 모듈 계약 레지스트리
- 목적: 모든 모듈의 목적·입출력·의존·검증 상태를 등록하고 결함 계약을 거부한다.
- 입력: contracts/*.yaml / 출력: ModuleRegistry (의존 DAG + 상태)
- 검증 장면: 목적 없는 계약·순환 의존 계약 투입 → 등록 거부 사유가 출력된다.
- 상태 원소: ModuleContract, ModuleStatus
- 시각화: 그래프 — 모듈 의존 DAG (색=status)

### [V4] 완료 증거 시스템
- 목적: 검증 산출물을 증거 JSON 으로 만들어 완료 선언을 증거로만 하게 한다.
- 입력: 테스트·시나리오·리플레이 해시 / 출력: evidence/<id>.json, status: VERIFIED
- 검증 장면: 시나리오 미통과 모듈 → VERIFIED 전이가 거부된다.
- 상태 원소: Evidence
- 시각화: diff — 모듈별 통과 대시보드

### [V3] 브라우저 검증 Lab
- 목적: 코드를 읽지 않아도 모듈 작동을 브라우저에서 눈으로 확인하게 한다.
- 입력: 모듈 상태 원소 / 출력: Lab 페이지 (화면 7요소)
- 검증 장면: V1 해시 비교표·V2 시나리오 결과가 Lab 페이지에 보인다.
- 상태 원소: — (렌더러)
- 시각화: 자체 — Vite 셸 + 공용 렌더러(diff 뷰 우선, 나머지 4종은 필요 시 하위 작업)

### [O1] 공통 세계 존재론 → [O2] 상태·규칙 스키마 → [O0] 세계관 공리
- 카드 상세는 착수 시 MODULES.md O 계층 행으로부터 작성.

## 단계 게이트

단계 0 의 완료 조건(계약 등록·결정 실행·시나리오 자동 실행·Lab 확인)이 증거로 확인되기 전에는
단계 1(S0~S3, D0~D4)에 착수하지 않는다.
