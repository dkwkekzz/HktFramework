# 00. 모듈 표준 계약

> 상위: [Design-Modules.md](../Design-Modules.md) · 함께 읽기: [01-Global-Invariants.md](01-Global-Invariants.md)

모든 모듈은 페이즈와 무관하게 이 문서의 계약을 따른다.

---

## 1. 모듈 디렉터리 구조

각 모듈에는 다음 파일을 의무적으로 둔다.

```text
packages/<module-id>-<module-name>/
├─ MODULE.yaml
├─ README.md
├─ src/
├─ schemas/
├─ tests/
│  ├─ unit/
│  ├─ property/
│  └─ integration/
├─ scenarios/
├─ lab/
└─ evidence/
   └─ latest.json
```

| 경로 | 역할 |
|---|---|
| `MODULE.yaml` | 목적·의존·소유 상태·입출력·불변조건·시나리오·명령 선언 |
| `src/` | 구현. **소유 영역 밖 상태를 직접 수정하지 않는다** |
| `schemas/` | 입출력 JSON 스키마 (V1 이 런타임 강제) |
| `tests/unit` | 정상·실패·경계값 |
| `tests/property` | 무작위 입력에서의 불변조건 유지 |
| `tests/integration` | 지정된 수직 통합 슬라이스 |
| `scenarios/` | Given-When-Then 검증 장면 정의 |
| `lab/` | 브라우저 Lab 페이지 (`/lab/<module-id>-<name>`) |
| `evidence/latest.json` | 최신 검증 증거 (7절 형식) |

---

## 2. `MODULE.yaml`

```yaml
id: I1
name: social-strategy
purpose: >
  주체가 목적, 믿음, 관계, 성격을 바탕으로
  요청·거래·협박·기만 중 하나를 선택하게 한다.

depends_on:
  - U0
  - U2
  - U3
  - G3
  - I0

owns_state:
  - none

inputs:
  - subject_state
  - target_subject_state
  - active_goal
  - relation_state
  - available_social_actions

outputs:
  - social_intent
  - decision_trace

invariants:
  - canonical_world_state_must_not_be_read_directly
  - selected_action_must_support_active_goal
  - impossible_action_must_not_be_selected
  - identical_seed_and_state_must_produce_identical_result

scenarios:
  - trusted_request
  - weak_actor_bargains
  - strong_actor_threatens
  - deceptive_actor_hides_information

commands:
  test: pnpm test --filter I1
  lab: pnpm lab --module I1
  verify: pnpm verify --module I1
```

`purpose` 를 한 문장으로 쓸 수 없으면 모듈을 더 분할한다 (분할 원칙 2.1).
`owns_state` 에 선언되지 않은 상태를 쓰면 V0 등록 단계에서 실패한다.

---

## 3. 공통 TypeScript 계약

```ts
export interface ModuleDefinition<Input, Output> {
  id: string;
  version: string;
  purpose: string;
  dependencies: string[];
  validateInput(input: unknown): Input;
  execute(input: Input, context: ModuleContext): Output;
  validateOutput(output: Output): VerificationIssue[];
  scenarios: VerificationScenario<Input, Output>[];
}

export interface VerificationScenario<Input, Output> {
  id: string;
  title: string;
  seed: bigint;
  arrange(): Input;
  act(input: Input, context: ModuleContext): Output;
  assert(
    input: Input,
    output: Output,
    context: ModuleContext
  ): AssertionResult[];
  toLabView(
    input: Input,
    output: Output,
    context: ModuleContext
  ): LabViewModel;
}

export interface AssertionResult {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  reason?: string;
}
```

`toLabView` 는 선택이 아니다. 모든 시나리오는 브라우저에서 눈으로 확인 가능한 뷰 모델을 만들어야 한다.

---

## 4. 검증 상태 머신

모든 모듈은 다음 상태를 순서대로 통과한다.

```text
BLOCKED
  선행 모듈이 검증되지 않음
SPECIFIED
  목적·입력·출력·불변조건 작성 완료
TEST_READY
  실패하는 검증 시나리오 작성 완료
IMPLEMENTED
  코드 구현 완료
UNIT_PASS
  단위·속성 테스트 통과
LAB_PASS
  브라우저 대표 장면에서 직관적으로 확인
SLICE_PASS
  수직 통합 시나리오 통과
VERIFIED
  모든 증거가 저장된 검증 완료 상태
FROZEN
  후속 모듈이 의존 중인 안정 계약
```

`IMPLEMENTED` 는 완료 상태가 아니다. 최종 완료는 `VERIFIED` 이상이다.

선행 모듈의 계약이 변경되면 (분할 원칙 2.5) 의존 모듈의 상태는 자동으로 `BLOCKED` 로 되돌아간다.

---

## 5. 공통 완료 게이트

| 게이트 | 검증 내용 |
|---|---|
| G0 목적 게이트 | 목적을 한 문장으로 설명할 수 있음 |
| G1 계약 게이트 | 입력·출력·상태 소유권·오류 형식이 명시됨 |
| G2 단위 게이트 | 정상·실패·경계값 테스트 통과 |
| G3 속성 게이트 | 무작위 입력에서도 불변조건 유지 |
| G4 직관 게이트 | 브라우저 Lab에서 전후 상태와 원인이 보임 |
| G5 결정성 게이트 | 같은 시드와 입력에서 같은 사건 해시 발생 |
| G6 통합 게이트 | 지정된 수직 통합 시나리오 통과 |
| G7 회귀 게이트 | 기존 검증 시나리오를 깨뜨리지 않음 |
| G8 증거 게이트 | 코드 해시·테스트 결과·리플레이 해시가 저장됨 |

게이트와 상태의 대응은 다음과 같다.

```text
G0, G1        → SPECIFIED
(실패 시나리오) → TEST_READY
(구현)         → IMPLEMENTED
G2, G3        → UNIT_PASS
G4            → LAB_PASS
G5, G6        → SLICE_PASS
G7, G8        → VERIFIED
```

---

## 6. 브라우저 Lab의 공통 화면

모든 모듈은 같은 형태의 검증 UI를 가진다.

```text
┌─────────────────────────────────────────────┐
│ 모듈 목적                                   │
│ “주체가 믿음과 관계에 따라 사회 행동 선택” │
├─────────────────────────────────────────────┤
│ 입력 상태                                   │
│ NPC 목적 / 믿음 / 관계 / 능력               │
├─────────────────────────────────────────────┤
│ 실행                                        │
│ [1틱 실행] [전체 실행] [다른 시드]          │
├─────────────────────────────────────────────┤
│ 후보                                        │
│ 요청 72 / 거래 64 / 협박 21 / 기만 17       │
├─────────────────────────────────────────────┤
│ 선택 결과                                   │
│ 거래 제안                                   │
├─────────────────────────────────────────────┤
│ 이유                                        │
│ 신뢰 +20, 힘의 차이 -5, 도덕 비용 -2        │
├─────────────────────────────────────────────┤
│ 상태 전후                                   │
│ 약속 없음 → 거래 제안 상태                  │
├─────────────────────────────────────────────┤
│ 검증                                        │
│ ✓ 목적 관련성                               │
│ ✓ 행동 가능성                               │
│ ✓ 결정성                                    │
│ ✓ 세계 상태 직접 접근 없음                  │
└─────────────────────────────────────────────┘
```

그래픽 모듈이 아니더라도 표·그래프·타임라인을 통해 반드시 눈으로 확인할 수 있어야 한다.

---

## 7. 모듈 완료 증거 형식

AI 에이전트가 “테스트가 성공했다”고 자연어로 보고하는 것은 증거로 인정하지 않는다.

```json
{
  "moduleId": "I1",
  "moduleVersion": "1.2.0",
  "sourceHash": "sha256:...",
  "dependencyVersions": {
    "U0": "1.1.0",
    "U2": "1.3.0",
    "U3": "1.0.2",
    "G3": "1.4.1",
    "I0": "1.0.0"
  },
  "staticCheck": {
    "passed": true
  },
  "unitTests": {
    "passed": 31,
    "failed": 0
  },
  "propertyTests": {
    "seeds": 1000,
    "invariantViolations": 0
  },
  "labScenarios": {
    "trusted_request": "passed",
    "strong_actor_threatens": "passed",
    "deceptive_actor": "passed"
  },
  "replay": {
    "runs": 100,
    "uniqueHashes": 1
  },
  "integrationSlices": {
    "VS3": "passed"
  },
  "status": "VERIFIED"
}
```

`evidence/latest.json` 이 없거나 `sourceHash` 가 현재 코드와 다르면 V4 가 `VERIFIED` 를 거부한다.
