# 11. Phase K — 결정적 세계 커널

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「9. Phase K — 결정적 세계 커널」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 9. Phase K — 결정적 세계 커널

## K0. 실체 및 상태 저장소

| 항목 | 내용 |
| -- | -- |
| 목적 | 세계의 모든 실체와 상태를 고유 ID로 저장한다 |
| 포함 | Entity Registry, Component Store, 타입별 인덱스 |
| 출력 | `EntityState`, `ComponentSnapshot` |
| 대표 검증 | 두 실체의 체력·위치·소유권이 섞이지 않고 독립적으로 조회됨 |
| 금지 | 다른 모듈이 내부 Map을 직접 수정하는 것 |

## K1. 조건과 질의 엔진

| 항목 | 내용 |
| -- | -- |
| 목적 | 세계 상태를 선언적 조건으로 질의한다 |
| 포함 | Predicate AST, Query Planner, Path Resolver |
| 출력 | 참·거짓, 대상 목록, 조건 실패 원인 |
| 대표 검증 | “체력 50 이하이며 반경 10m 내에 있는 인간”만 정확히 선택 |
| 선행 | K0 |

```ts
export type PredicateSpec =
  | { op: "eq"; path: string; value: unknown }
  | { op: "gt"; path: string; value: number }
  | { op: "lt"; path: string; value: number }
  | { op: "has_tag"; target: string; tag: string }
  | { op: "within_distance"; a: string; b: string; max: number }
  | { op: "and"; items: PredicateSpec[] }
  | { op: "or"; items: PredicateSpec[] }
  | { op: "not"; item: PredicateSpec };
```

## K2. 규칙 및 상태 트랜잭션

| 항목 | 내용 |
| -- | -- |
| 목적 | 행동 의도를 조건·비용·효과에 따라 원자적으로 처리한다 |
| 포함 | Intent Validation, Rule Matching, Cost Calculation, StateDelta |
| 출력 | 성공 또는 실패 결과와 상태 변경안 |
| 대표 검증 | 에너지 부족 시 공격이 실패하며 피해·비용 모두 적용되지 않음 |
| 선행 | K0, K1 |

## K3. 사건·시간·재생

| 항목 | 내용 |
| -- | -- |
| 목적 | 모든 변화의 원인을 사건으로 기록하고 정확히 재생한다 |
| 포함 | Event Log, Scheduler, Snapshot, Replay, Invariant Audit |
| 출력 | `WorldEvent`, 리플레이 해시, 스냅샷 |
| 대표 검증 | 1,000틱 실행 후 재생한 최종 상태와 사건 해시가 완전히 동일 |
| 선행 | K0~K2, V2 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| K0 | `packages/kernel/K0-entity-state` |
| K1 | `packages/kernel/K1-predicate-query` |
| K2 | `packages/kernel/K2-rule-transaction` |
| K3 | `packages/kernel/K3-event-replay` |

### 관련 원문 절

- 원문 「2.3 모든 변경은 사건을 통해 이루어진다」 — K2/K3 이 강제하는 `Intent → Rule → StateDelta → WorldEvent → Phenomenon → Memory/Relation` 경로. [Design-Modules.md](../Design-Modules.md) 2.3 참조.
- 원문 「2.5」의 무효화 연쇄가 K2 에서 시작된다: `K2 → K3 → I3 → R3 → N0`.
- K3 의 Invariant Audit 이 감사하는 조건은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-01 · GI-12.
- 세계 설계 원본의 규칙 DSL(`RuleSpec` / `EffectSpec`)과 규칙 우선순위 L0~L6 은 [Design-MMO.md](../Design-MMO.md) 15장 참조.
