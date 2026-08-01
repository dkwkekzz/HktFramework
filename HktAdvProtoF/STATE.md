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
| 0 | O1-b 작동 3종 | DONE | `node --test` — 규칙 → 사건 → 현상이 id 로 이어지고, 조건 없는 규칙·상태를 안 바꾸는 사건·원인 없는 현상이 각각의 사유로 거부된다 |
| 0 | O1-c 관계 3종 | DONE | `node --test` — 실제 상태(마비독)와 어긋난 주장(치유 효과)이 둘 다 온전한 원소로 서고, 자기 자신과의 약속·위반 결과 없는 약속·비용 0 어포던스는 거부된다 |
| 0 | O1-d 요구 3종 (12타입 완결) | DONE | `node --test` — 식량 의존 → 채집 가능성 → 접근로 요구가 id 로 이어지고, 가운데 고리를 빼면 끊긴 지점을 지목한다. `implementedKinds()` 가 12타입을 모두 채운다 |
| 0 | O1-e 개념 커버리지 검사기 | DONE | `node --test` — 원문 개념 40종이 전부 12타입으로 덮이고 남는 타입이 없다. 타입 없는 개념·12타입 밖 이름·중복 id·빈 카탈로그는 각각의 사유로 미완결이 된다 |
| 0 | **O1 공통 세계 존재론** | **VERIFIED** ([증거](app/packages/contracts/evidence/O1.json)) | `npm run dev -w @hkt/lab` → `http://localhost:5173/#/o1` — 원문 개념 40종 ↔ 12타입 대조표가 한 화면에 펼쳐지고, 붉은 장막 사냥꾼 장면의 원소 14개가 선언한 타입 그대로 판정된다. 같은 약초를 두고 실제(마비독)와 믿음(치유 효과)이 나란히 서고, 결함 원소 8종은 각자의 사유·경로로 거부된다 (Chromium 확인: 4xx·콘솔 오류 없음) |
| 0 | O2 → O0 | 미착수 | |

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
| 개념 카탈로그가 손으로 뽑은 40종이다 — 원문에 이 목록 밖의 개념이 남아 있을 수 있다 | O1-e 커버리지 검사기가 목록 안의 누락은 잡는다 | 원문 재독 시 카탈로그에 추가 (작업 카드로) |
| ~~증거를 손으로 쓴 스크립트가 만든다~~ | **V4 로 상환** — `buildEvidence` 가 유일한 status 판정자 | 완료 |
| ~~Lab 페이지가 없다~~ | **V3 으로 상환** — 모듈당 페이지 1개, 화면 7요소 | 완료 |

## TODO — 단계 0 (구현 순서: WORKFLOW §9)

### [O2] 상태 스키마 — 9영역 필드 트리
- 목적: 세계의 모든 상태 값을 9영역 필드 트리 하나로 표현하고, 그 트리에 없는 값을 거부한다.
- 입력: 영역별 정의 (원문 §12.1 + ModulePlan O2)
- 출력: `StateSchema` (9영역 필드 트리) + `WorldState` (9영역 서브트리)
- 검증 장면: 붉은 장막 사냥꾼 장면의 상태들을 스키마에 통과시켜 세계 트리로 세우고,
  스키마에 없는 영역·경로·범위 밖 값이 각각의 사유로 거부된다.
- 상태 원소: `DomainSpec`, `FieldSpec`, `WorldState` 9영역 서브트리
- 시각화: Lab `/o2` — 상태 트리 뷰(diff) + 원문 필드 ↔ 스키마 경로 대조표
- 분할 근거(WORKFLOW §3): 새 상태 원소 3종 초과 + 검증 장면 3개 → 하위 작업 4개

| 하위 작업 | 목적 (한 문장) | 상태 |
|---|---|---|
| O2-a 영역 확정 | 원문 두 목록이 다르게 적은 상태 영역을 대조해 9영역으로 확정한다. | TODO |
| O2-b 필드 스펙 | 영역 안의 각 상태 필드가 가질 수 있는 값을 스펙으로 선언하고 위반을 사유로 돌려준다. | TODO |
| O2-c 세계 트리 | 상태 원소 목록을 9영역 서브트리로 조립하고 다시 원소로 분해한다. | TODO |
| O2-d 눈 검증 | 시나리오 3종 + Lab `/o2` 상태 트리 뷰로 O2 를 눈으로 확인한다. | TODO |

O2-a 가 풀어야 할 어긋남: O1 이 이름표로만 고정한 `STATE_DOMAINS` 9영역(= ModulePlan O2 목록)과
원문 §12.1 의 목록(ability·spatial·historical 포함)이 다르다.

### [O0] 세계관 공리
- 카드 상세는 착수 시 MODULES.md O0 행으로부터 작성 (O2 완료 후).

## 남은 공용 렌더러 (WORKFLOW §6)

diff 뷰는 구현됐고, 그래프·게이지는 최소판이 V0·V4 페이지에 있다.
타임라인과 3D 씬은 소비할 모듈(R1·E2·X 계층)에 착수할 때 작업 카드로 만든다.

## 단계 게이트

단계 0 의 완료 조건(계약 등록·결정 실행·시나리오 자동 실행·Lab 확인)이 증거로 확인되기 전에는
단계 1(S0~S3, D0~D4)에 착수하지 않는다.
현재 V0~V4 · O1 이 VERIFIED — 단계 0 에 남은 것은 O2 · O0 이다.
