# 16. Phase R — 성장과 능력

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [15-Phase-I-Interaction.md](15-Phase-I-Interaction.md) · 후속: [17-Phase-C-Complex-Subjects.md](17-Phase-C-Complex-Subjects.md)

성장은 레벨 숫자가 아니라 **가능성 그래프의 변화**다.
능력은 스킬 목록이 아니라 캐릭터의 욕망·두려움·가치로부터 생성되는 제약 구조다.
GI-06(무비용 능력 금지), GI-07(대응 불가 능력 금지)의 강제 지점이다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| R0 | 사건 경험이 가능성 그래프의 노드·간선·가중치를 변경하게 한다 | 반복 실패 후 준비·조사 전략 가중치 상승으로 다음 행동이 달라짐 | U3, G2, I3 |
| R1 | 단순 레벨이 아닌 행동 방식과 자아의 변화를 성장으로 표현한다 | 동료를 반복 보호한 인물이 보호 행동·능력에 특화됨 | R0 |
| R2 | 의념 능력을 조작·대상·전달·조건·비용 조합으로 정의한다 | 조건·비용 없는 고영향 능력 정의가 스키마 단계에서 거부됨 | S3, G0, K1 |
| R3 | 능력 조건·비용·위반 결과를 권위 규칙으로 실행한다 | 조건이 참일 때만 효과 발생, 비용이 정확히 차감됨 | R2, K2 |
| R4 | 강력한 능력에 징후와 대응 경로가 있도록 검증한다 | 정체를 알아낸 상대가 준비하면 실제 성공률이 낮아짐 | R3, U1 |

---

## R0 — growth-graph

패키지: `packages/progression/R0-growth-graph`

| 항목 | 내용 |
|---|---|
| 목적 | 사건 경험이 가능성 그래프의 노드·간선·가중치를 변경하게 한다 |
| 포함 | Unlock, Reweight, Add Edge, Prune, Merge, Specialize |
| 대표 검증 | 반복 실패 후 준비·조사 전략의 가중치가 상승하여 다음 행동이 달라짐 |
| 선행 | U3, G2, I3 |

```ts
export type GrowthEffect =
  | { op: "unlock_node"; nodeId: Id }
  | { op: "add_edge"; edge: PossibilityEdge }
  | { op: "reweight_node"; nodeId: Id; delta: number }
  | { op: "specialize_action"; actionTemplateId: Id; delta: number }
  | { op: "bind_cost"; nodeId: Id; cost: EffectSpec }
  | { op: "prune_node"; nodeId: Id }
  | { op: "merge_nodes"; sourceIds: Id[]; resultId: Id }
  | { op: "unlock_scale"; scale: "group" | "city" | "nation" | "god" }
  | { op: "change_value"; valueId: Id; delta: number }
  | { op: "change_trait"; traitId: Id; delta: number };
```

같은 실패를 경험해도 주체마다 다른 성장이 발생해야 한다.

```text
용감한 인물       더 위험한 시도를 배운다.
신중한 인물       사전 조사·도구 준비 노드가 강화된다.
복수심이 강한 인물 상대 제거 목적이 강화된다.
책임감이 강한 인물 동료 보호 능력이 각성된다.
공포에 압도된 인물 회피 노드가 강해지거나 공포를 힘으로 전환하는 능력이 생긴다.
```

---

## R1 — identity-mastery

패키지: `packages/progression/R1-identity-mastery`

| 항목 | 내용 |
|---|---|
| 목적 | 단순 레벨이 아닌 행동 방식과 자아의 변화를 성장으로 표현한다 |
| 포함 | Skill Mastery, Trait Shift, Value Conflict, Identity Coherence |
| 대표 검증 | 동료를 반복적으로 보호한 인물이 보호 행동과 관련 능력에 특화됨 |
| 선행 | R0 |

성장 축은 9개다: 신체 · 기술 · 지각 · 지식 · 관계 · 제도 · 의념 · 정체성 · 영향 범위.
`IdentityCoherence` 는 R2/R3 의 능력 강도 계산에 직접 입력된다.

---

## R2 — ability-definition

패키지: `packages/progression/R2-ability-definition`

| 항목 | 내용 |
|---|---|
| 목적 | 의념 능력을 조작·대상·전달·조건·비용 조합으로 정의한다 |
| 포함 | 감응, 피복, 응축, 방사, 전환, 각인, 연결, 구현 |
| 대표 검증 | 발동 조건이나 비용이 없는 고영향 능력 정의가 스키마 단계에서 거부됨 |
| 선행 | S3, G0, K1 |

능력은 캐릭터의 다음 요소로부터 생성된다.

```text
가장 강한 욕망
가장 두려운 상실
절대로 포기하지 않을 가치
익숙하게 사용하는 수단
감수할 수 있는 대가
자기 자신에게 내릴 수 있는 제한
타인에게 숨기고 싶은 약점
```

원자 조작 8종:

| 조작 | 기능 |
|---|---|
| 감응 | 생명장·의도·잔향을 감지 |
| 피복 | 신체·물체를 의념으로 보호·강화 |
| 응축 | 제한된 지점에 의념을 모음 |
| 방사 | 의념을 몸 밖으로 전달 |
| 전환 | 한 종류의 상태를 다른 상태로 변환 |
| 각인 | 대상·장소·약속에 규칙을 부여 |
| 연결 | 둘 이상의 대상 상태를 연동 |
| 구현 | 의념으로 일시적 구조나 존재를 형성 |

프로토타입 초기 능력 원자는 6개로 제한한다: 감응, 피복, 응축, 방사, 각인, 연결.

`AbilityDefinition` 구조는 [Design-MMO.md](../Design-MMO.md) 16.2 를 따른다. `activationCondition`, `costs`, `breachEffects`, `observableTells`, `counterplayPredicates` 는 **모두 필수 필드**다 — 비면 스키마 검증에서 거부한다.

능력 강도:

```text
Power = Mastery × IdentityCoherence × CostCredibility
      × ConstraintSpecificity × Preparation × ExposureRisk
```

“마음속으로 각오했다”처럼 서버가 검증할 수 없는 비용은 실제 비용으로 인정하지 않는다.

---

## R3 — ability-runtime

패키지: `packages/progression/R3-ability-runtime`

| 항목 | 내용 |
|---|---|
| 목적 | 능력 조건·비용·위반 결과를 권위 규칙으로 실행한다 |
| 포함 | Ability Intent, Cost Transaction, Vow, Breach Effect |
| 대표 검증 | 조건이 참일 때만 효과가 발생하고 비용이 정확히 차감됨 |
| 선행 | R2, K2 |

비용 차감과 효과 적용은 K2 의 원자적 트랜잭션을 사용한다. 부분 적용은 허용하지 않는다.

---

## R4 — ability-audit

패키지: `packages/progression/R4-ability-audit`

| 항목 | 내용 |
|---|---|
| 목적 | 강력한 능력에 관찰 가능한 징후와 현실적인 대응 경로가 있도록 검증한다 |
| 포함 | Observable Tell, Counter Predicate, Batch Duel Evaluation |
| 대표 검증 | 능력의 정체를 알아낸 상대가 준비하면 실제 성공률을 낮출 수 있음 |
| 선행 | R3, U1 |

Batch Duel Evaluation 은 능력 쌍을 다수 시드로 대결시켜 “대응 불가능한 승률”을 탐지한다.
`abilitiesWithoutCounterplay` 지표는 [60-Traceability-And-Completion.md](60-Traceability-And-Completion.md) 완료 조건에서 `0` 이어야 한다.

강력한 능력은 다음 중 하나 이상을 요구한다.

```text
범위가 좁다.
조건이 복잡하지만 검증 가능하다.
실패 비용이 실제 상태에 적용된다.
준비 시간이 길다.
정체를 노출한다.
타인이 대응할 단서가 존재한다.
사용자의 신념과 강하게 일치한다.
```

---

## 페이즈 완료 결과

```text
같은 실패를 겪은 인물들이 서로 다르게 성장한다.
무비용·무제한 능력이 정의 단계에서 거부된다 (GI-06).
모든 고영향 능력에 징후와 대응 경로가 있다 (GI-07).
능력 비용과 위반 결과가 서버에서 강제된다.
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS5](30-Vertical-Slices.md#vs5-경험에-따른-성장과-능력) | R0~R4 — 이 페이즈의 핵심 슬라이스 |
