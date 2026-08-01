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
| 0 | V0-a 계약 파서 | DONE | `node --test` — 실제 계약 `V1.yaml`·`V2.yaml` 을 읽고, 탭·앵커·플로 매핑·중복 키를 줄 번호와 함께 거부한다 (22 pass) |
| 0 | V0-b 레지스트리 검사 · V4, V3, O0~O2 | 미착수 | |

구현 루트는 [app/](app/) — npm workspaces 모노레포, Node ≥22.18 네이티브 TS 타입 스트리핑으로
빌드 없이 `.ts` 를 실행한다 (런타임 의존성 0개, `typescript`·`@types/node` 는 타입 검사 전용).

모든 작업은 [modules/WORKFLOW.md](modules/WORKFLOW.md)의 8단계 사이클을 따른다:
작업 카드 없이 착수 금지, 커밋 1개 = 작업 1개, 완료 판정은 증거 파일로만.

## 소급 부채 (V0~V4 완성 시 갚는다)

WORKFLOW §5 단서대로, V0~V4 자체가 없는 동안은 5~7단계를 수동으로 수행한다.
아래는 V0~V4 가 서는 즉시 소급 등록해야 할 항목이다.

| 부채 | 현재 대체 수단 | 갚는 시점 |
|---|---|---|
| V1·V2 계약이 레지스트리에 등록되지 않았다 | `packages/contracts/V1.yaml`, `V2.yaml` (수기 서식) | V0 |
| 증거를 검증 스크립트가 만든다 | `packages/scenarios/verify/evidence.ts` | V4 |
| Lab 페이지 `/lab/v1`, `/lab/v2` 가 없다 | 각 `verify/v1.ts`, `verify/v2.ts` 터미널 7요소 출력 | V3 |
| ~~V1 시나리오가 `Scenario{arrange,act,assert}` 가 아니다~~ | **V2-b 로 상환** — `suites/v1.ts` | 완료 |

## TODO — 단계 0 (구현 순서: WORKFLOW §9)

### [V0-b] 모듈 계약 레지스트리 검사
- 목적: 파싱된 계약을 등록하며 결함 계약(목적 없음·입출력 없음·순환 의존·시나리오 없는 완료)을 거부한다.
- 입력: contracts/*.yaml (V0-a 파서) / 출력: ModuleRegistry (의존 DAG + 상태 + 거부 사유)
- 검증 장면: 목적 없는 계약·순환 의존 계약 투입 → 등록 거부 사유가 출력된다.
- 상태 원소: ModuleContract, ModuleStatus
- 시각화: 그래프 — 모듈 의존 DAG (색=status)
- 비고: 하위 작업 `V0-a` (계약 파서) 완료.

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
