# V4 evidence-gate

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [10-Phase-V-Verification.md](../../../design/modules/10-Phase-V-Verification.md)
> 선행: [V0](../V0-module-contract/README.md) · [V1](../V1-schema/README.md) · [V2](../V2-determinism/README.md) · [V3](../V3-scenario-runner/README.md)

## 목적 (G0)

게이트 판정 결과로만 검증 상태를 발급하고, 의존 모듈의 계약이 바뀌면 그것을 쓰는 모듈의 검증을 자동으로 무효화한다.

원문 「8」이 V4 에 요구한 직관적 검증은 하나다 — **“의존 모듈 변경 시 하위 모듈이 자동으로 `BLOCKED`로 변경”**.
대표 장면 `dependency_contract_change_blocks_dependents` 가 그것이고, 다섯 모듈 사슬로 확장한 것이
`invalidation_propagates_through_the_chain` 이다.

## 이 모듈이 막는 것

원문 「23」의 마지막 줄은 “증거 없이 `VERIFIED` 표시”를 금지한다. 그것을 **코드 차원에서 불가능하게** 만드는 것이 V4 다.

| 우회 경로 | 여기서 막는 방법 |
|---|---|
| 상태를 손으로 적는다 | `issueEvidence` 는 `status` 를 인자로 받지 않는다 — 게이트 판정에서만 나온다 |
| 증거 파일의 `status` 를 고친다 | 감사가 게이트로 다시 계산해 `E_STATUS_ABOVE_GATES` 로 잡고, 화면은 감사 상태를 쓴다 |
| 슬라이스를 건너뛴다 | G6 이 막으면 사다리가 `LAB_PASS` 에서 멈춘다 (속성 테스트로 500표본 확인) |
| 측정하지 않은 것을 통과로 적는다 | 게이트에 `measured` 가 따로 있다 — 미측정은 통과가 아니다 |
| 선행이 바뀐 뒤에도 옛 증거를 쓴다 | 증거에 발급 시점의 선행 계약 해시를 박아 두고, 달라지면 무효화한다 |
| 발급 도구가 자기 규칙을 쓴다 | `tools/verify.mjs` 는 **측정만** 한다. 발급은 이 모듈이 한다 |

## 네 조각

### 1. 게이트 (원문 「5」) → 상태 (원문 「4」)

```text
G0 목적 · G1 계약           → SPECIFIED
+ 계약에 대표 장면 선언       → TEST_READY
+ G8 정적 검사·해시          → IMPLEMENTED
+ G2 단위 · G3 속성          → UNIT_PASS
+ G4 직관(브라우저 대표 장면) → LAB_PASS
+ G6 통합(수직 슬라이스)      → SLICE_PASS
+ G5 결정성 · G7 회귀        → VERIFIED
```

아래에서 위로 올라가다 막히는 곳에서 멈춘다. `FROZEN` 은 사람이 정하고, `FAILED` 는 사다리 **밖**의
명시적 실패 표기다(원문 「22」 `markExplicitFailure`).

### 2. 증거 (원문 「21」)

원문의 형식에 네 항목을 더했다. 모두 파생이며 원문 항목을 바꾸지 않는다.

| 추가 항목 | 왜 필요한가 |
|---|---|
| `contractHash` | 무효화 연쇄는 “계약이 바뀌었는가”를 물어야 판정할 수 있다 |
| `dependencyContracts` | 발급 시점의 **선행** 계약 해시. 없으면 선행 변경을 감지할 수 없다 |
| `gates` | 상태가 어느 게이트에서 정해졌는지 되짚기 위한 판정 기록 |
| `issuedAtTick` | 발급 시점. 벽시계(`Date.now`)를 읽지 않는다 — V2 의 틱을 쓴다 |

### 3. 무효화 연쇄 (원문 「2.5」)

```text
K2 계약 변경 → K3 무효 → I3 무효 → R3 무효 → N0 무효
```

감사는 위상 순서로 훑으므로 한 번의 순회로 하위 폐포 전체에 전파된다. 무효화 **이유는 거리마다 다르다** —
직접 의존은 `E_DEPENDENCY_CONTRACT_CHANGED`, 간접 의존은 `E_DEPENDENCY_INVALIDATED` 다.
증거 파일은 한 글자도 바뀌지 않는다. 원문 「2.5」 그대로, 상태를 내리는 것은 파일이 아니라 감사다.

`impactOf(registry, 'K2')` 로 **바꾸기 전에** 영향 범위를 먼저 볼 수 있다 (원문 「23」의 Change Request 절차).

### 4. V 단계 완료 화면 (원문 「8」)

```text
/lab
  모든 모듈 상태     statuses
  실패한 검증        failedChecks
  의존성 그래프      dependencyGraph
  최신 코드 해시     hashes
  리플레이 해시      replays
  자동 검증 결과     completion
```

`completion` 은 원문 「27」의 완성 판정이다. **아직 담당 모듈이 없는 지표는 0 이 아니라 `null`** 로 두고
`pending` 에 이유와 담당을 적는다 (`globalInvariantViolations` → K3, `orphanWorldEntities` → W3 …).
측정하지 않은 것을 통과로 적는 순간 판정 전체가 쓸모없어진다.

## 자기 검증에 V3 를 쓴다

V4 의 대표 장면은 그 자체가 Given-When-Then 이다 — *“검증된 모듈이 있다 / 선행의 계약을 바꾼다 / 하위가
`BLOCKED` 가 된다.”* 그래서 V3(scenario-runner)로 굴린다. 실행기와 판정기를 따로 만들면 둘 중 무엇이
틀렸는지 알 수 없게 된다. 장면 상태는 이렇게 생겼다.

```json
{ "contracts": { "K2": "<MODULE.yaml 원문>" }, "measurements": {…}, "evidences": {…}, "audit": null }
```

단계는 `issue_evidence` · `edit_contract` · `set_measurement` · `forge_status` · `run_audit` 다.
조건은 `/audit/status/K3 equals BLOCKED` 처럼 데이터로만 쓴다.

합성 저장소를 쓰는 이유는 실제 저장소의 증거가 `pnpm verify` 때마다 코드 해시가 바뀌어 고정 입력이 될 수
없기 때문이다. **실제 저장소를 대상으로 한 감사**는 `tests/integration/scenarios.test.ts` 가 따로 돌린다.

## 대표 장면 (G4)

`pnpm lab` → V4 탭.

| 장면 | 무엇을 보이는가 |
|---|---|
| `gates_decide_status` | 측정 하나를 낮추면 상태가 사다리를 내려온다 |
| `evidence_cannot_claim_status_above_gates` | 손으로 올린 상태를 감사가 되돌린다 |
| `verified_without_slice_is_refused` | 슬라이스가 남아 있으면 `LAB_PASS` 에서 멈춘다 |
| **`dependency_contract_change_blocks_dependents`** | **원문 「8」 V4 의 직관 검증** |
| `invalidation_propagates_through_the_chain` | 원문 「2.5」의 다섯 모듈 연쇄 |
| `replay_mismatch_fails_determinism_gate` | 리플레이 해시가 둘이면 `VERIFIED` 가 아니다 (GI-12) |
| `board_shows_the_v_phase_completion_screen` | 원문 「8」의 여섯 구획 |
| `evidence_is_reproducible_from_the_same_measurements` | 재발급해도 발급 틱 말고는 그대로 |

## 실행 방법

```bash
pnpm test V4-evidence-gate
pnpm lab                              # 브라우저에서 V4 탭
pnpm verify V4 --lab                  # 증거 발급 → evidence/latest.json
pnpm verify V4 --lab --regression     # G7 회귀 게이트까지 측정 (저장소 전체 실행)
```

## 검증 상태

`LAB_PASS`. G6 통합 게이트가 막고 있다 — VS0 이 K0~K3 을 함께 요구한다(원문 「20」).
G7 회귀 게이트는 `--regression` 없이 돌리면 **미측정**이며, 미측정은 통과가 아니다. VS0 이 통과하는
시점에 두 게이트를 함께 켜야 `VERIFIED` 가 나온다.
