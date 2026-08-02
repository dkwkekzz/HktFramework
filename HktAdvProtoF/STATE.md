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
| 0 | O2-a 영역 확정 | DONE | `node --test` — MasterPlan §12.1 의 이름 9개가 같음·개명·흡수·영역 아님으로 하나도 남김없이 해소되고, 해소 하나를 빼거나 없는 영역으로 보내면 각각의 사유로 걸린다 |
| 0 | O2-b 필드 스펙 | DONE | `node --test` — 9영역 57자리가 서고 원문 필드 39개가 전부 자리를 얻는다. 매개 자리에 사물을 넣거나 사물이 배고파하면 무엇이 와야 하는지와 함께 거부된다 |
| 0 | O2-c 세계 트리 | DONE | `node --test` — 상태 32개가 9영역 트리로 서고 분해하면 처음 자리로 돌아온다. 입력 순서를 뒤집어도 같은 세계 해시, 어긴 상태는 트리에 들어가지 않는다 |
| 0 | **O2 상태 스키마** | **VERIFIED** ([증거](app/packages/contracts/evidence/O2.json)) | `npm run dev -w @hkt/lab` → `http://localhost:5173/#/o2` — 원문 두 목록이 9영역으로 좁혀지는 대조표, 영역별 자리 카탈로그, 원문 필드 39개 대조표가 차례로 펼쳐지고, 붉은 장막 사냥꾼의 지금이 9영역 32자리로 선다. 세 틱 뒤와의 차이 다섯 줄(바뀜 3·생김 1·사라짐 1)이 나오고, 결함 상태 9종은 각자의 사유·자리로 거부된다 (Chromium 확인: 페이지 리소스 전부 200, 콘솔 오류 없음 — 브라우저 기본 favicon 요청만 404) |
| 0 | O0-a 공리 확정 | DONE | `node --test` — 원문 16문장이 공리 8개로 해소되고, 해소 하나를 지우면 그 문장과 근거를 잃은 공리가 함께 지목된다 |
| 0 | O0-b 정의 검사 | DONE | `node --test` — 근거 없는 규칙을 O1 은 통과시키고 O0 는 거부한다. 흔적·대가는 O2 의 실재하는 자리를 가리켜야 성립한다 |
| 0 | O0-c 강제 지점 프로브 | DONE | `node --test` — 선언된 관문 10곳에 공리를 어기는 값을 넣어 전부 거부가 나오고, 없는 프로브·죽은 프로브·막지 못한 관문이 각각의 사유로 걸린다 |
| 0 | O0-d 도출 대조 | DONE | `node --test` — 정의 층위 공리 넷이 각각 둘 이상을 낳고, 도출 하나를 지우면 그 공리가 불모·단조로 찍힌다 |
| 0 | **O0 세계관 공리** | **VERIFIED** ([증거](app/packages/contracts/evidence/O0.json)) | `npm run dev -w @hkt/lab` → `http://localhost:5173/#/o0` — 원문 세 목록 16문장이 공리 8개로 좁혀지는 대조표가 펼쳐지고, 공리마다 지금 누가 막는지가 관문 10곳의 실행 결과와 함께 선다 (O0 4곳 + O1·O2 6곳, 아직 못 막는 둘은 갚을 모듈 R3·W2 와 함께 노랑으로 남는다). 그 공리 위에 붉은 장막 세계의 능력 셋·종 넷이 서고, 같은 공리에서 유래가 다른 두 신이 나온다. 결함 정의 14종은 각자의 공리·사유·자리로 거부된다 (Chromium 확인: 페이지 리소스 4xx 없음, 콘솔 오류 없음 — 브라우저 기본 favicon 요청만 404) |

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

## TODO — 단계 1 (M1 의존하는 주체)

단계 0 이 닫혔다. 다음은 원문 §18 순서대로 S0~S3 · D0~D4 — 대표 장면은
"배고픈 인간 1 + 음식 1 (아직 행동 없음)" 이다.

### [S0] 주체 공통 인터페이스
- 목적: 사람·생물·조직·국가·신이 하나의 공통 인터페이스로 서서 다섯 질문(감지·의존·능력·기억·유지)에 전부 답하게 한다.
- 입력: `SubjectSpec`(O1 Subject + 경계·감지·의존·유지·능력), `SpeciesDefinition`(O0), `StateSchema`(O2)
- 출력: `SubjectProfile` + `SubjectViolation[]` + `FiveQuestionReport`
- 검증 장면: 주체 5종이 다섯 질문에 전부 답하고, 답 못 하는 주체는 어느 질문이 왜 비었는지와 함께 거부된다.
- 상태 원소: `SubjectProfile`, `Boundary`, `PerceptionProfile`, `Need`, `ValueTarget`
- 시각화: diff(주체 카드 — 5질문 응답표 + 경계·감지·의존·유지·능력)
- 상태 원소 5종 · 검증 장면 다수 → WORKFLOW §3 분할. 하위 작업은 아래 순서로 닫는다.

#### [S0-a] 주체 경계와 그래프 자리
- 목적: 주체 종류마다 어디까지가 자기인지를 경계로 밝히고, 매달 그래프 4종의 자리를 유래에서 연다.
- 입력: `SubjectRef`(id·이름·주체 종류), `Boundary[]`, `SubjectGraphIds`
- 출력: `SubjectViolation[]` (경계 미달 · 경계 대상 종류 불일치 · 손으로 지은 그래프 ID)
- 검증 장면: 신체 없는 사람 · 구성원 없는 국가 · 앵커 없는 신 · 손으로 지은 기억 ID 가 각각의 사유로 거부된다.
- 상태 원소: `Boundary`, `SubjectGraphIds`
- 시각화: diff(주체 카드 — 경계 목록 + 그래프 4종 자리)

#### [S0-b] 감지 프로필
- 목적: 주체가 현상 통로 6종 중 무엇을 얼마나 감지하는지 선언하고, 어떤 현상이 감지되는지 판정한다.
- 입력: `PerceptionProfile`, `Phenomenon`(통로·세기), 거리, `Boundary[]`
- 출력: `PerceptionVerdict` + `SubjectViolation[]` (통로 없음 · 전지한 문턱 · 몸 없는 감각)
- 검증 장면: 같은 장막의 빛을 사냥꾼은 보고 국가는 보지 못한다 — 통로·세기·거리가 각각 어디서 갈리는지 나온다.
- 상태 원소: `PerceptionProfile`, `PerceptionAcuity`
- 시각화: diff(같은 현상, 주체별 감지 비교표)

#### [S0-c] 의존·유지 자리 · [S0-d] 주체 골격 · [S0-e] 5질문 검사기 · [S0-f] 눈 검증
- 카드 상세는 각 하위 작업 착수 시 작성한다 (WORKFLOW §2 여섯 필드).
- O0 가 남긴 입력: 종은 이미 정의(`SpeciesDefinition`)로 세워졌고 공리를 지난다 —
  S0 의 `Subject` 는 그 정의에서 태어나는 개체여야 한다. 정의에 적힌 자리(slots)가
  개체의 상태 자리(O2)와 어긋나면 그것은 S0 이 잡는다.
- O0 가 남긴 자리: 능력 정의는 `Rule` 이고 흔적은 `psychic.trace.{rule}` 에 적힌다 —
  S2(능력)·R2(현상)가 그 자리를 실제로 채우는 쪽이다.

## 남은 공용 렌더러 (WORKFLOW §6)

diff 뷰는 구현됐고, 그래프·게이지는 최소판이 V0·V4·O2·O0 페이지에 있다 (O2 는 세계 트리를, O0 는 공리↔관문 대조를 표로 편다).
타임라인과 3D 씬은 소비할 모듈(R1·E2·X 계층)에 착수할 때 작업 카드로 만든다.

## 단계 게이트

**단계 0 (M0 결정적 세계) 닫힘** — V0~V4 · O0 · O1 · O2 여덟 모듈이 전부 VERIFIED 이고,
계약 레지스트리가 위상 순서 `V1 → V2 → V0 → V4 → V3 → O1 → O2 → O0` 으로 등록한다
(`node packages/scenarios/verify/v0.ts` 의 "착수 가능" 목록이 다음에 할 일을 계산해 준다).

단계 1(S0~S3, D0~D4)에 착수한다. 단계 1 의 완료 조건이 증거로 확인되기 전에는
단계 2(P0~P5)의 어떤 모듈도 착수하지 않는다.
