# 12. Phase S — 공간과 세계 상태

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「10. Phase S — 공간과 세계 상태」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 10. Phase S — 공간과 세계 상태

## S0. 논리적 3D 공간과 행동 가능성

| 항목 | 내용 |
| -- | -- |
| 목적 | 위치·거리·충돌·접근 가능성을 렌더링과 독립적으로 계산한다 |
| 포함 | Transform, Spatial Index, Movement, Collision, Affordance |
| 대표 검증 | 벽 너머 물체를 직접 획득할 수 없고 문을 열면 접근 가능 |
| 선행 | K0~K2 |

`Affordance`는 대상이 어떤 행동을 허용하는지 나타낸다.

```ts
interface Affordance {
  id: string;
  verb: string;
  targetEntityId: string;
  condition: PredicateSpec;
  requiredCapabilities: string[];
  estimatedCost: Record<string, number>;
}
```

## S1. 자연 상태

| 항목 | 내용 |
| -- | -- |
| 목적 | 물리·생물·생태 상태를 공통 규칙으로 표현한다 |
| 포함 | 질량, 온도, 손상, 허기, 질병, 개체군, 먹이 관계 |
| 대표 검증 | 먹이가 줄면 초식 개체군이 감소하고 일정 지연 후 포식자가 감소 |
| 선행 | K, S0 |

초기 프로토타입에서는 실제 원자 시뮬레이션이 아니라 콘텐츠에 필요한 거시 상태만 구현한다.

## S2. 사회·제도·경제 상태

| 항목 | 내용 |
| -- | -- |
| 목적 | 관계·소유권·법·조직 자원·거래 상태를 표현한다 |
| 포함 | Trust, Fear, Debt, Ownership, Law, Inventory, Price Expectation |
| 대표 검증 | 절도는 가능하지만 소유권·목격·평판·법적 추적 가능성이 변경됨 |
| 선행 | K |

## S3. 정보·의념·초월 상태

| 항목 | 내용 |
| -- | -- |
| 목적 | 물리적으로 직접 보이지 않는 정보와 규칙장을 표현한다 |
| 포함 | Claim, Evidence, Rumor, Aura Field, Vow, Region Rule, God Domain |
| 대표 검증 | 의념 감지 능력이 없는 주체는 잔향을 발견하지 못하지만 물리 흔적은 발견 |
| 선행 | K, S0 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| S0 | `packages/world-state/S0-spatial-affordance` |
| S1 | `packages/world-state/S1-natural-state` |
| S2 | `packages/world-state/S2-social-economic-state` |
| S3 | `packages/world-state/S3-information-aura-state` |

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | S0, S1 |
| [VS3](30-Vertical-Slices.md#vs3-퀘스트-없는-요청) | S2 |
| [VS4](30-Vertical-Slices.md#vs4-경쟁과-사건-연쇄) | S3 |

### 함께 읽을 세계 설계 원본

- S0 의 논리 공간 / 표현 공간 분리 — [Design-MMO.md](../Design-MMO.md) 18.4
- S2 의 소프트 규칙(법은 집행 주체가 있을 때만 힘을 가진다) — 같은 문서 15.2
- S3 의 `CanonicalState` / `BeliefState` / `PublicRecordState` / `RumorState` 4층위 — 같은 문서 14장
- 세계 상태 9계층(물리·생물·생태·의념·사회·제도·경제·정보·초월) — 같은 문서 14장
