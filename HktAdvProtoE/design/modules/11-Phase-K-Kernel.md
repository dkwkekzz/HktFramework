# 11. Phase K — 결정적 세계 커널

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [10-Phase-V-Verification.md](10-Phase-V-Verification.md) · 후속: [12-Phase-S-World-State.md](12-Phase-S-World-State.md)

세계의 모든 변화가 **사건을 통해서만** 일어나고, **완전히 재생 가능**하게 만드는 계층이다.
이 페이즈의 계약이 흔들리면 K3 → I3 → R3 → N0 의 검증이 연쇄적으로 무효화된다 (분할 원칙 2.5).

---

## 모듈 목록

| ID | 목적 | 핵심 산출물 | 직관적 검증 | 선행 |
|---|---|---|---|---|
| K0 | 세계의 모든 실체와 상태를 고유 ID로 저장한다 | Entity Registry, Component Store | 두 실체의 상태가 섞이지 않고 독립 조회됨 | V |
| K1 | 세계 상태를 선언적 조건으로 질의한다 | Predicate AST, Query Planner | “체력 50 이하 + 반경 10m 내 인간”만 정확히 선택 | K0 |
| K2 | 행동 의도를 조건·비용·효과에 따라 원자적으로 처리한다 | Rule Matching, StateDelta | 에너지 부족 시 공격 실패, 피해·비용 모두 미적용 | K0, K1 |
| K3 | 모든 변화의 원인을 사건으로 기록하고 정확히 재생한다 | Event Log, Replay, Snapshot | 1,000틱 실행 후 재생 결과가 완전히 동일 | K0~K2, V2 |

---

## K0 — entity-state

패키지: `packages/kernel/K0-entity-state`

| 항목 | 내용 |
|---|---|
| 목적 | 세계의 모든 실체와 상태를 고유 ID로 저장한다 |
| 포함 | Entity Registry, Component Store, 타입별 인덱스 |
| 출력 | `EntityState`, `ComponentSnapshot` |
| 대표 검증 | 두 실체의 체력·위치·소유권이 섞이지 않고 독립적으로 조회됨 |
| 금지 | 다른 모듈이 내부 Map을 직접 수정하는 것 |

읽기는 공개하되 쓰기는 K2 의 `StateDelta` 적용 경로만 허용한다.

---

## K1 — predicate-query

패키지: `packages/kernel/K1-predicate-query`

| 항목 | 내용 |
|---|---|
| 목적 | 세계 상태를 선언적 조건으로 질의한다 |
| 포함 | Predicate AST, Query Planner, Path Resolver |
| 출력 | 참·거짓, 대상 목록, **조건 실패 원인** |
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

조건 실패 원인 리포트는 선택 기능이 아니다. G3(가능성), R3(능력), A2(정적 검증), A5(인과 감사)가 모두 “왜 실패했는가”를 이 모듈에서 받는다.

---

## K2 — rule-transaction

패키지: `packages/kernel/K2-rule-transaction`

| 항목 | 내용 |
|---|---|
| 목적 | 행동 의도를 조건·비용·효과에 따라 원자적으로 처리한다 |
| 포함 | Intent Validation, Rule Matching, Cost Calculation, StateDelta |
| 출력 | 성공 또는 실패 결과와 상태 변경안 |
| 대표 검증 | 에너지 부족 시 공격이 실패하며 피해·비용 모두 적용되지 않음 |
| 선행 | K0, K1 |

규칙은 임의 실행 코드가 아니라 데이터 AST(`RuleSpec` / `EffectSpec`, [Design-MMO.md](../Design-MMO.md) 15.3)로만 표현한다.
원자성이 핵심이다. 부분 적용된 상태 변경은 남아서는 안 된다.

규칙 우선순위 L0~L6 (메타 공리 → 물리·생명 → 종·신체 → 의념·기관·신 → 지역 → 사회·제도 → 개인 계약)은 이 모듈의 `priority` 로 해석한다.

---

## K3 — event-replay

패키지: `packages/kernel/K3-event-replay`

| 항목 | 내용 |
|---|---|
| 목적 | 모든 변화의 원인을 사건으로 기록하고 정확히 재생한다 |
| 포함 | Event Log, Scheduler, Snapshot, Replay, Invariant Audit |
| 출력 | `WorldEvent`, 리플레이 해시, 스냅샷 |
| 대표 검증 | 1,000틱 실행 후 재생한 최종 상태와 사건 해시가 완전히 동일 |
| 선행 | K0~K2, V2 |

Invariant Audit 은 [01-Global-Invariants.md](01-Global-Invariants.md) 의 GI-01(사건 없는 상태 변경 금지)과 GI-12(리플레이 불일치 금지)를 매 틱 감사한다.

---

## 페이즈 완료 결과

```text
어떤 상태 변경도 WorldEvent 없이 발생하지 않는다.
실패한 행동은 어떤 상태도 남기지 않는다.
같은 시드로 재생한 사건 로그 해시가 1개로 수렴한다.
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS0](30-Vertical-Slices.md#vs0-결정적-세계-변화) | 이 페이즈의 필수 통과 슬라이스 |

## 다음 페이즈로 넘어가는 조건

```text
K0~K3 모두 VERIFIED
VS0 통과
K2 계약(RuleSpec / EffectSpec / StateDelta)이 FROZEN
```
