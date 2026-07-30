# 10. Phase V — 검증 기반 모듈

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행 페이즈: 없음 (최초 구현 대상) · 후속: [11-Phase-K-Kernel.md](11-Phase-K-Kernel.md)

세계 구현보다 **먼저** 검증 시스템을 만들어야 한다. 이것이 없으면 AI 에이전트가 “완료했다”고 주장할 뿐 실제 완료 여부를 판단할 수 없다.

---

## 모듈 목록

| ID | 목적 | 핵심 산출물 | 직관적 검증 | 선행 |
|---|---|---|---|---|
| V0 | 모든 모듈의 계약과 의존성을 등록한다 | `MODULE.yaml`, 모듈 레지스트리 | 목적이나 선행 모듈이 없는 모듈은 등록 실패 | 없음 |
| V1 | 입력·출력 데이터가 계약을 지키도록 강제한다 | 런타임 스키마 검증기 | 잘못된 상태 JSON을 넣으면 구체적인 경로와 함께 실패 | V0 |
| V2 | 시간·ID·무작위성을 결정적으로 만든다 | Seed RNG, Tick Clock, Deterministic ID | 같은 시드를 100회 실행해 같은 ID·난수열 출력 | V0 |
| V3 | Given-When-Then 시나리오를 실행한다 | Scenario Runner, Fixture Loader | 실패한 조건의 전후 상태가 한 화면에 표시 | V1, V2 |
| V4 | 검증 결과를 시각화하고 증거를 발급한다 | Lab UI, `evidence.json`, 검증 상태 관리 | 의존 모듈 변경 시 하위 모듈이 자동으로 `BLOCKED` 로 변경 | V0~V3 |

---

## V0 — module-contract

패키지: `packages/verification/V0-module-contract`

| 항목 | 내용 |
|---|---|
| 목적 | 모든 모듈의 계약과 의존성을 등록한다 |
| 포함 | `MODULE.yaml` 로더, 모듈 레지스트리, 의존 그래프, 순환 의존 탐지 |
| 입력 | `packages/**/MODULE.yaml` |
| 출력 | 모듈 레지스트리, 의존성 그래프, 등록 오류 목록 |
| 대표 검증 | 목적이나 선행 모듈이 없는 모듈은 등록 실패 |
| 금지 | 레지스트리에 없는 모듈을 다른 모듈이 의존 선언하는 것 |

레지스트리는 [00-Module-Contract.md](00-Module-Contract.md) 4절의 상태 머신을 함께 보유한다. `owns_state` 중복 선언(두 모듈이 같은 상태를 소유)은 등록 실패로 처리한다.

---

## V1 — schema

패키지: `packages/verification/V1-schema`

| 항목 | 내용 |
|---|---|
| 목적 | 입력·출력 데이터가 계약을 지키도록 강제한다 |
| 포함 | 런타임 스키마 검증기, 오류 경로 리포터, 콘텐츠 JSON 로더 게이트 |
| 입력 | `schemas/*.json`, 임의 데이터 |
| 출력 | 검증 통과 값 또는 `VerificationIssue[]` (실패 경로 포함) |
| 대표 검증 | 잘못된 상태 JSON을 넣으면 구체적인 경로와 함께 실패 |
| 선행 | V0 |

오류는 “검증 실패”로 끝나지 않고 `subjects[3].relations.npc_12.trust: expected number, got "high"` 처럼 경로와 기대값을 보고해야 한다.

---

## V2 — determinism

패키지: `packages/verification/V2-determinism`

| 항목 | 내용 |
|---|---|
| 목적 | 시간·ID·무작위성을 결정적으로 만든다 |
| 포함 | Seed RNG, Tick Clock, Deterministic ID 생성기 |
| 입력 | `worldSeed`, `currentTick`, `subjectId`, `decisionCounter`, `situationId` |
| 출력 | 난수열, ID, 틱 |
| 대표 검증 | 같은 시드를 100회 실행해 같은 ID·난수열 출력 |
| 선행 | V0 |
| 금지 | `Math.random()`, `Date.now()`, 삽입 순서 의존 반복 |

시드 조합 규칙은 원설계와 동일하다.

```text
worldSeed
+ currentTick
+ subjectId
+ decisionCounter
+ situationId
```

---

## V3 — scenario-runner

패키지: `packages/verification/V3-scenario-runner`

| 항목 | 내용 |
|---|---|
| 목적 | Given-When-Then 시나리오를 실행한다 |
| 포함 | Scenario Runner, Fixture Loader, Assertion 수집, 전후 상태 diff |
| 입력 | `VerificationScenario`, fixture |
| 출력 | `AssertionResult[]`, 전후 상태 스냅샷, `LabViewModel` |
| 대표 검증 | 실패한 조건의 전후 상태가 한 화면에 표시 |
| 선행 | V1, V2 |

속성 테스트(G3)도 이 런너 위에서 시드 배치를 돌리는 방식으로 구현한다.

---

## V4 — evidence-gate

패키지: `packages/verification/V4-evidence-gate`

| 항목 | 내용 |
|---|---|
| 목적 | 검증 결과를 시각화하고 증거를 발급한다 |
| 포함 | Lab UI 셸, `evidence.json` 발급기, 검증 상태 관리, 의존 무효화 전파 |
| 입력 | V3 실행 결과, 소스 해시, 의존 모듈 버전 |
| 출력 | `evidence/latest.json`, 모듈 상태 전이, 무효화된 모듈 목록 |
| 대표 검증 | 의존 모듈 변경 시 하위 모듈이 자동으로 `BLOCKED` 로 변경 |
| 선행 | V0~V3 |
| 금지 | 증거 없이 `VERIFIED` 표시, 실패한 시나리오를 목록에서 제외 |

---

## 페이즈 완료 결과

브라우저에서 다음 페이지가 동작해야 한다.

```text
/lab
  모든 모듈 상태
  실패한 검증
  의존성 그래프
  최신 코드 해시
  리플레이 해시
  자동 검증 결과
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS0](30-Vertical-Slices.md#vs0-결정적-세계-변화) | V0~V4 + K0~K3 이 함께 통과해야 한다 |

## 다음 페이즈로 넘어가는 조건

```text
V0~V4 모두 VERIFIED
/lab 이 실제 브라우저에서 열리고 모듈 상태를 표시
V2 결정성 100회 재실행 해시 일치
계약 변경 시 하위 모듈 BLOCKED 전파가 실증됨
```
