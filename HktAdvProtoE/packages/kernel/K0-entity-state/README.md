# K0 entity-state

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [11-Phase-K-Kernel.md](../../../design/modules/11-Phase-K-Kernel.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [V1](../../verification/V1-schema/README.md)
> 세계 상태 계층의 근거: [Design-MMO.md](../../../design/Design-MMO.md) 14장

## 목적 (G0)

세계의 모든 실체와 상태를 고유 ID로 저장하고, 다른 모듈이 내부 저장소를 직접 고칠 수 없게 읽기 전용 사본으로만 내보낸다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `entity_registry` · `component_store` · `type_index` |
| 입력 | `component_definition` · `store_operation` · `entity_read_request` |
| 출력 | `entity_state` · `component_snapshot` · `store_rejection` |

```ts
const registry = ComponentRegistry.of([{ type: 'health', schema: healthSchema }]);
const store = EntityStore.empty(registry)
  .spawn({ id: 'hunter_a', kind: 'person', components: { health: { current: 42, max: 100 } } })
  .setComponent('hunter_a', 'health', { current: 12, max: 100 });

store.get('hunter_a');          // 동결된 EntityState 사본
store.byKind('person');         // 타입별 인덱스
store.snapshot();               // ComponentSnapshot (+ 해시)
store.audit();                  // 인덱스 정합 · GI-11 자기 감사
```

## 설계 판단

### ① 저장소는 불변이다 — 손잡이 자체를 만들지 않는다

원문 「9」 K0 의 금지 사항은 “다른 모듈이 내부 Map을 직접 수정하는 것”이다. 이것을 **규약**으로 막으면
언젠가 뚫린다. 그래서 고칠 수 있는 손잡이를 아예 두지 않았다.

- 모든 쓰기는 **새 저장소**를 돌려준다. 원본은 그대로다.
- 모든 읽기는 **동결된 사본**만 내보낸다 (`Object.freeze` 재귀).
- 쓸 때 값을 복사해 넣는다. 넘겨준 쪽이 나중에 그 객체를 고쳐도 저장소는 흔들리지 않는다.

거부된 연산이 상태를 남기지 않는 것도 여기서 공짜로 따라온다 — 반환값을 쓰지 않으면 이전 저장소가
그대로 남는다. “실패했는데 절반만 반영되었다”가 구조적으로 불가능하다. K2 의 원자적 트랜잭션과
K3 의 재생이 이 성질 위에 선다.

### ② 컴포넌트 종류는 선언해야 한다

선언되지 않은 종류는 저장하지 않는다. 아무거나 담기는 자루가 되면 `health` 와 `healt` 가 조용히
공존하고, K1 의 질의는 영원히 빈 결과를 돌려준다. 값의 형식 판정은 **V1 에 맡긴다** — 스키마 해석
규칙을 두 곳에 두면 둘이 갈라진다. K0 은 어느 실체·어느 종류에서 났는지를 경로 앞머리로 붙일 뿐이다.

```text
E_COMPONENT_SCHEMA @ entity/hunter_a/components/health/current
```

### ③ 인덱스는 갱신하되, 감사가 전수 재계산과 대조한다

종류·컴포넌트 인덱스는 쓰기마다 조금씩 갱신된다. 갈라진 인덱스는 예외를 내지 않고 **질의를 조용히
틀리게** 만든다. 그래서 `audit()` 이 인덱스를 전수 재계산과 통째로 비교한다. 속성 테스트가 무작위
연산 열 1000 표본에서 이 감사를 돌린다.

### ④ GI-11 은 규칙이 아니라 저장 구조로 지킨다

소유권은 `(실체 id, "ownership")` 한 칸에만 들어간다. 두 번째 소유자를 “추가”할 자리 자체가 없으므로
중복 소유가 발생할 수 없다. 남는 위험은 “세계에 없는 소유자”뿐이라, 감사는 그것만 본다.

### ⑤ 연산은 데이터다

`StoreOperation` 은 함수가 아니라 데이터 AST 다. 원문 「23」이 “임의 실행 코드를 콘텐츠 데이터에 삽입”을
금지하기도 하고, 상태 변경 요청이 데이터여야 K3 의 사건 로그에 그대로 실려 재생될 수 있기 때문이다.

### ⑥ 선행에 V0·V1 을 적은 이유

원문 「9」의 K0 행에는 선행 칸이 없다. 다만 이 저장소에서 K0 은
`ModuleDefinition`·`sha256Tagged`(V0)와 `canonicalJson`·`compileSchema`(V1)를 실제로 쓴다.
원문 「3.1」이 “계약에 적지 않은 것에 의존하지 않는다”를 요구하므로, **쓰는 것을 그대로 적었다.**
V0~V4 → K0~K3 은 원문 「28」의 고정 순서이기도 하다.

## 실행

```bash
pnpm test K0-entity-state
pnpm lab                 # K0 탭
pnpm verify K0 --lab
```

## 검증 상태

`evidence/latest.json` 이 실제 상태다. 손으로 적지 않는다 — `pnpm verify` 가 출력하는 `status=` 가 그 값이다.
