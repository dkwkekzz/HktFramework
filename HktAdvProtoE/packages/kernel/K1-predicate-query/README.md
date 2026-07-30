# K1 predicate-query

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [11-Phase-K-Kernel.md](../../../design/modules/11-Phase-K-Kernel.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [K0](../K0-entity-state/README.md)

## 목적 (G0)

세계 상태를 데이터로 적힌 조건식으로 질의해, 참·거짓과 대상 목록과 조건이 어긋난 위치를 함께 돌려준다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `none` — K1 은 읽기만 한다 |
| 입력 | `predicate_spec` · `query_spec` · `binding_table` |
| 출력 | `predicate_result` · `matched_entities` · `failure_cause` |

```ts
runQuery(store, {
  as: 'subject',
  where: {
    op: 'and',
    items: [
      { op: 'has_tag', target: 'subject', tag: 'human' },
      { op: 'or', items: [
        { op: 'lt', path: 'subject.health.current', value: 50 },
        { op: 'eq', path: 'subject.health.current', value: 50 },
      ] },
      { op: 'within_distance', a: 'subject', b: 'hero', max: 10 },
    ],
  },
  bindings: { hero: 'hero' },
});
```

## 설계 판단

### ① `PredicateSpec` 을 한 줄도 늘리지 않았다

원문 「9」 K1 의 AST 는 여덟 연산자뿐이다. `lte` 가 없어서 “체력 50 이하”를 적기가 불편하다 —
연산자를 하나 더하고 싶어진다. 그러나 그것은 상위 계약 변경이고, 원문 「23」은 Change Request 없이
그렇게 하는 것을 금지한다. 그래서 조건을 정확히 적는 쪽을 택했다.

### ② `not(gt(50))` 이 아니라 `or[lt(50), eq(50)]` 인 이유

“체력 50 이하”를 `not(gt(체력, 50))` 으로 적으면 **체력이라는 것이 없는 실체까지 뽑힌다.**
없는 값은 `gt` 를 만족하지 못하므로 `not` 이 참이 되기 때문이다.

```text
and[ has_tag(human), not(gt(health.current, 50)), within(10) ]
  → wounded_scout, dying_healer, ghost_child   ← 체력이 없는 유령이 “약한 인간” 이 된다
and[ has_tag(human), or[lt(50), eq(50)], within(10) ]
  → wounded_scout, dying_healer
```

`or[lt, eq]` 는 없는 값에 대해 두 항목 모두 거짓이라 새지 않는다. `boolean_algebra_holds` 장면이
두 형태를 나란히 돌려 이 차이를 화면에 보여 준다.

### ③ 오타는 거짓이 아니라 거부다

세계의 사실과 명세의 잘못을 구분한다.

| 상황 | 처리 |
|---|---|
| 문법에 맞지 않는 경로 · 모르는 결합 이름 · **선언되지 않은 컴포넌트** | 거부 (`QueryRejection`) |
| 결합된 실체가 없음 · 그 실체에 그 컴포넌트가 없음 · 필드가 없음 | 거짓 + 원인 기록 |

`healt.current` 라고 잘못 적은 것을 거짓으로 처리하면, `not(...)` 안에 들어갔을 때 **참**이 되어
조용히 통과하는 조건이 생긴다. 오타를 거부로 잡을 수 있는 이유는 K0 이 컴포넌트 종류를 선언하기
때문이다 — 선언이 없었다면 오타와 사실을 구분할 방법이 없다.

빈 `and`/`or` 도 거부한다. 빈 `and` 는 조용히 참, 빈 `or` 는 조용히 거짓이 되어 조건을 무력화한다.

### ④ 원인은 접속사가 아니라 어긴 잎을 지목한다

“`and` 가 거짓이다”라는 말에는 정보가 없다. 그래서 원인을 잎까지 내려간다.

- `and` — 어긴 항목들만
- `or` — 모든 항목 (전부 거짓이므로)
- `not` — 참이 되어 뒤집힌 안쪽 조건

이것이 원문 「9」 K1 의 출력 “조건 실패 원인”이며, Lab 화면에서 “왜 이 NPC 는 대상이 아닌가”에
그대로 답한다.

### ⑤ 계획은 성능만 바꾸고 답을 바꾸지 않는다

계획기는 **최상위 `and` 사슬에 직접 놓인** 조건에서만 인덱스 힌트를 뽑는다. `or`·`not` 안쪽의
조건으로 후보를 좁히면 답이 달라지기 때문이다. 태그 조건은 K0 에 인덱스가 없으므로 어느 경로로
왔든 마지막에 반드시 걸러 낸다 — 인덱스가 잡힐 때만 거르면 전수 조회로 온 질의가 태그 조건을 통째로
잃는다(속성 테스트가 실제로 이 결함을 잡아냈다).

`planned_result_must_equal_full_scan` 불변조건이 이 성질을 지킨다. 모든 질의는 계획 결과와
전수 조회 결과를 **둘 다** 계산해 대조한다.

## 실행

```bash
pnpm test K1-predicate-query
pnpm lab                 # K1 탭
pnpm verify K1 --lab
```
