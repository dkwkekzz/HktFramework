# V3 scenario-runner

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [10-Phase-V-Verification.md](../../../design/modules/10-Phase-V-Verification.md)
> 선행: [V0](../V0-module-contract/README.md) · [V1](../V1-schema/README.md) · [V2](../V2-determinism/README.md)

## 목적 (G0)

Given-When-Then 시나리오를 결정적으로 실행하고, 실패한 조건마다 그 값의 전후 상태와 그것을 바꾼 단계를 함께 보고한다.

원문 「8」이 V3 에 요구한 직관적 검증은 하나다 — **“실패한 조건의 전후 상태가 한 화면에 표시”**.
그래서 이 모듈의 출력은 “통과/실패”가 아니라 **무엇이 어디서 어떻게 달라졌는가**다.

## 계약 (G1)

| 구분 | 내용 |
|---|---|
| 입력 | `fixture_document` (초기 상태) · `scenario_spec` (Given-When-Then) |
| 출력 | `scenario_report` (단계별 전후 · 변경 경로 · 해시) · `condition_result` (전·후·원인 단계) |
| 소유 상태 | `fixture_registry` · `step_registry` |
| 선행 | V0(공통 계약·해시) · V1(픽스처·params 검증) · V2(시드·시계·ID) |

### 선행에 V0 를 적은 이유

원문 「8」의 표는 V3 의 선행을 `V1, V2` 로 적는다. 그것은 **검증 기능상의** 선행이고,
이 저장소의 V3 패키지는 그 위에 원문 「3.2」의 공통 TypeScript 계약(`ModuleDefinition` ·
`VerificationScenario` · `LabViewModel`)과 `sha256` 을 실제로 쓴다. 그 계약을 소유한 모듈이 V0 다.

의존을 숨기면 V4 의 무효화 연쇄(원문 「2.5」)가 틀린 답을 낸다 — V0 의 계약이 바뀌어도 V3 가
무효화되지 않기 때문이다. 그래서 실제로 쓰는 의존을 그대로 적었다. 원문 「28」의 고정 순서
(V0~V4)에서 V0 은 이미 V3 보다 앞이므로 순서를 어기지 않는다. V4 의 선행이 원문에서
`V0~V3` 인 것도 같은 이유로 읽는다.

## 세 조각

### 1. Fixture Loader — 실행 전에 초기 상태를 검증한다

```ts
const fixtures = new FixtureLoader()
  .addSchema(sceneStateSchema)          // V1 스키마 저장소
  .add({ id: 'hunter_scene', title: '…', schemaId: '…', state: { actor: { energy: 10 }, log: [] } });
```

- 스키마를 어긴 픽스처는 **적재 시점에** JSON Pointer 경로와 함께 거부한다
  (`/fixtures/broken_scene/state/actor/energy`). 잘못된 초기 상태로 굴린 장면은 아무것도 증명하지 못한다.
- `load()` 는 매번 **새로 복사해 깊게 동결한** 상태를 준다. 한 장면이 다른 장면의 초기 상태를 오염시키지 못한다.

### 2. Scenario Runner — 데이터로 쓴 Given-When-Then

```ts
runner.run({
  id: 'four_actions_on_ten_energy',
  given: { fixture: 'hunter_scene' },
  when: [ { step: 'consume', params: { path: '/actor/energy', amount: 3 } }, … ],
  then: [ { id: 'energy_result_is_1', path: '/actor/energy', op: 'equals', value: 1 } ],
  seed: { worldSeed: '20260730', subjectId: 'npc_hunter_01' },
});
```

조건은 **경로 + 연산자 + 값** 세 조각의 데이터일 뿐이다. 표현식이나 콜백을 두지 않는다 —
원문 「23」의 “임의 실행 코드를 콘텐츠 데이터에 삽입” 금지가 시나리오 데이터에도 그대로 적용된다.

**실행 전 거부(preflight).** 모르는 픽스처·모르는 단계·잘못된 `params`·잘못된 조건은 한 단계도
굴리기 전에 거부하고, 각각 `/given/fixture` · `/when/0/step` · `/when/1/params/amount` · `/then/0/path`
를 지목한다. `params` 검사는 V1 스키마가 한다.

**거부와 오류의 구분.**

| | 뜻 | 결과 |
|---|---|---|
| `StepRejection` | 규칙이 막았다 (에너지 부족 등) | 상태를 **전혀** 바꾸지 않고 다음 단계로 |
| 그 외 예외 | 단계 구현의 버그 | 그 자리에서 시나리오를 멈춘다 (`stoppedAt`) |

이 구분이 없으면 VS0 의 완료 조건 “네 번째 행동은 상태를 전혀 변경하지 않는다”를 표현할 수 없다.

**결정성.** 시각·난수·ID 는 전부 V2 에서 나온다. 단계마다 `\`${stepId}#${occurrence}\`` 이름표로
하위 난수 스트림을 열기 때문에, 뒤에 단계를 덧붙여도 앞 단계의 난수열이 밀리지 않는다.

### 3. 조건 결과 — 전·후·원인

```json
{
  "id": "energy_must_be_10", "path": "/actor/energy", "op": "equals",
  "passed": false, "expected": 10,
  "before": 10, "after": 4,
  "blame": { "index": 2, "step": "consume" }
}
```

`blame` 은 그 경로를 **마지막으로 바꾼 단계**다. 자식 경로를 바꾼 단계도 부모 조건의 원인으로 센다
(`/log/0` 을 추가한 단계는 `/log` 조건의 원인이다). 실패를 어디서부터 봐야 하는지가 보고 안에 들어 있다.

## 기본 단계 목록

V3 는 세계가 무엇인지 모른다 — 그것은 K 페이즈의 몫이다. 그래서 기본 단계는 임의 JSON 상태 위에서 도는
일반 연산뿐이며, K0~K3 이 오면 세계 규칙 단계가 같은 자리에 등록된다.

| 단계 | 하는 일 |
|---|---|
| `set` · `add` · `remove` | 값 쓰기 · 수 더하기 · 지우기 |
| `consume` | 모자라면 **아무것도 바꾸지 않고** 거부 (VS0 의 네 번째 행동) |
| `append` · `record_event` | 배열에 붙이기 · 결정적 id·시각으로 사건 기록 |
| `roll` | 결정적 난수 |
| `fail` | 일부러 터지는 단계 (거부와 오류의 차이를 보이기 위한 것) |

## 대표 장면 (G4)

`pnpm lab` → V3 탭. 7개 장면 모두 원문 「24」의 8구획을 채운다.

| 장면 | 무엇을 보이는가 |
|---|---|
| `given_when_then_runs_in_order` | 선언 순서대로 실행 · 단계마다 전후 · 틱 진행 |
| **`failed_condition_shows_before_and_after`** | **원문 「8」 V3 의 직관 검증** — 실패 조건의 전·후·원인 단계 |
| `fixture_is_validated_before_run` | 스키마 위반 픽스처를 경로와 함께 거부, 나머지 장면은 그대로 판정 |
| `step_must_not_mutate_given_state` | 상태를 직접 고치는 단계는 오류로 드러난다 |
| `unknown_step_is_rejected_with_path` | 모르는 단계·잘못된 params·잘못된 조건을 실행 전에 거부 |
| `rejected_step_leaves_state_unchanged` | 에너지 10 · 3씩 소비 · 네 번째 거부 (VS0 의 장면 형태) |
| `same_seed_replays_identically` | 100회 재실행에서 digest 하나 (GI-12) |

## 실행 방법

```bash
pnpm test V3-scenario-runner
pnpm lab                      # 브라우저에서 V3 탭
pnpm verify V3 --lab          # 증거 발급 → evidence/latest.json
```

## 검증 상태

`LAB_PASS`. `VERIFIED` 로 올리지 않은 이유는 G6 통합 게이트 — V3 가 포함된 VS0 이 K0~K3 을 함께
요구하기 때문이다(원문 「23」: 증거 없이 `VERIFIED` 표시 금지). VS0 의 **장면 형태**는
`rejected_step_leaves_state_unchanged` 가 이미 돌리지만, VS0 자체는 K 페이즈의 세계 규칙으로 다시
통과시켜야 한다 — `tests/integration/scenarios.test.ts` 에 `it.todo` 로 남겨 두었다.
