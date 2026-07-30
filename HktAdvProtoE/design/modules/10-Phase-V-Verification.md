# 10. Phase V — 검증 기반 모듈

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「8. Phase V — 검증 기반 모듈」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 8. Phase V — 검증 기반 모듈

세계 구현보다 먼저 검증 시스템을 만들어야 한다. 이것이 없으면 AI 에이전트가 “완료했다”고 주장할 뿐 실제 완료 여부를 판단할 수 없다.

| ID | 목적 | 핵심 산출물 | 직관적 검증 | 선행 |
| -- | -- | -- | -- | -- |
| V0 | 모든 모듈의 계약과 의존성을 등록한다 | `MODULE.yaml`, 모듈 레지스트리 | 목적이나 선행 모듈이 없는 모듈은 등록 실패 | 없음 |
| V1 | 입력·출력 데이터가 계약을 지키도록 강제한다 | 런타임 스키마 검증기 | 잘못된 상태 JSON을 넣으면 구체적인 경로와 함께 실패 | V0 |
| V2 | 시간·ID·무작위성을 결정적으로 만든다 | Seed RNG, Tick Clock, Deterministic ID | 같은 시드를 100회 실행해 같은 ID·난수열 출력 | V0 |
| V3 | Given-When-Then 시나리오를 실행한다 | Scenario Runner, Fixture Loader | 실패한 조건의 전후 상태가 한 화면에 표시 | V1, V2 |
| V4 | 검증 결과를 시각화하고 증거를 발급한다 | Lab UI, `evidence.json`, 검증 상태 관리 | 의존 모듈 변경 시 하위 모듈이 자동으로 `BLOCKED`로 변경 | V0~V3 |

### V 단계 완료 결과

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

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

원문 「25. 프로젝트 디렉터리 구조」에서 이 페이즈에 해당하는 경로.

| ID | 패키지 |
|---|---|
| V0 | `packages/verification/V0-module-contract` |
| V1 | `packages/verification/V1-schema` |
| V2 | `packages/verification/V2-determinism` |
| V3 | `packages/verification/V3-scenario-runner` |
| V4 | `packages/verification/V4-evidence-gate` |

### 관련 수직 통합

원문 「20. 수직 통합 검증 시나리오」의 [VS0](30-Vertical-Slices.md#vs0-결정적-세계-변화) 이 V0~V4 와 K0~K3 을 함께 포함한다.

### 함께 읽을 원문 절

- [00-Module-Contract.md](00-Module-Contract.md) — V0 이 등록하는 `MODULE.yaml`, V1 이 강제하는 계약, V3 이 실행하는 시나리오, V4 가 발급하는 증거 형식이 모두 여기 있다.
- [01-Global-Invariants.md](01-Global-Invariants.md) — V2 는 GI-12(리플레이 불일치 금지)의 기반이다.
- V2 의 결정적 시드 조합 규칙은 [Design-MMO.md](../Design-MMO.md) 29장 참조.
