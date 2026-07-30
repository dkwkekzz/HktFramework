# 12. Phase S — 공간과 세계 상태

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [11-Phase-K-Kernel.md](11-Phase-K-Kernel.md) · 후속: [13-Phase-U-Subject.md](13-Phase-U-Subject.md)

주체가 해석할 **대상**이 되는 세계 상태 계층을 만든다.
물리·생물·생태 / 사회·제도·경제 / 정보·의념·초월을 각각 독립 모듈로 분리한다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| S0 | 위치·거리·충돌·접근 가능성을 렌더링과 독립적으로 계산한다 | 벽 너머 물체를 직접 획득할 수 없고 문을 열면 접근 가능 | K0~K2 |
| S1 | 물리·생물·생태 상태를 공통 규칙으로 표현한다 | 먹이가 줄면 초식 개체군 감소, 지연 후 포식자 감소 | K, S0 |
| S2 | 관계·소유권·법·조직 자원·거래 상태를 표현한다 | 절도는 가능하지만 소유권·목격·평판·법적 추적 가능성이 변경됨 | K |
| S3 | 물리적으로 보이지 않는 정보와 규칙장을 표현한다 | 의념 감지 능력이 없으면 잔향 미발견, 물리 흔적은 발견 | K, S0 |

---

## S0 — spatial-affordance

패키지: `packages/world-state/S0-spatial-affordance`

| 항목 | 내용 |
|---|---|
| 목적 | 위치·거리·충돌·접근 가능성을 렌더링과 독립적으로 계산한다 |
| 포함 | Transform, Spatial Index, Movement, Collision, Affordance |
| 대표 검증 | 벽 너머 물체를 직접 획득할 수 없고 문을 열면 접근 가능 |
| 선행 | K0~K2 |

`Affordance` 는 대상이 어떤 행동을 허용하는지 나타낸다.

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

**이 모듈은 논리 공간만 다룬다.** 메시·머티리얼·식생·조명은 X 페이즈의 표현 공간이며 같은 데이터로 취급하지 않는다.

---

## S1 — natural-state

패키지: `packages/world-state/S1-natural-state`

| 항목 | 내용 |
|---|---|
| 목적 | 물리·생물·생태 상태를 공통 규칙으로 표현한다 |
| 포함 | 질량, 온도, 손상, 허기, 질병, 개체군, 먹이 관계 |
| 대표 검증 | 먹이가 줄면 초식 개체군이 감소하고 일정 지연 후 포식자가 감소 |
| 선행 | K, S0 |

초기 프로토타입에서는 실제 원자 시뮬레이션이 아니라 **콘텐츠에 필요한 거시 상태만** 구현한다.

---

## S2 — social-economic-state

패키지: `packages/world-state/S2-social-economic-state`

| 항목 | 내용 |
|---|---|
| 목적 | 관계·소유권·법·조직 자원·거래 상태를 표현한다 |
| 포함 | Trust, Fear, Debt, Ownership, Law, Inventory, Price Expectation |
| 대표 검증 | 절도는 가능하지만 소유권·목격·평판·법적 추적 가능성이 변경됨 |
| 선행 | K |

**소프트 규칙 원칙**: 사회적 법률이 플레이어의 버튼을 막아서는 안 된다. 법률은 집행 주체가 존재할 때만 실제 힘을 가진다.
소유권은 GI-11(고유 자원 중복 소유 금지)의 강제 지점이다.

---

## S3 — information-aura-state

패키지: `packages/world-state/S3-information-aura-state`

| 항목 | 내용 |
|---|---|
| 목적 | 물리적으로 직접 보이지 않는 정보와 규칙장을 표현한다 |
| 포함 | Claim, Evidence, Rumor, Aura Field, Vow, Region Rule, God Domain |
| 대표 검증 | 의념 감지 능력이 없는 주체는 잔향을 발견하지 못하지만 물리 흔적은 발견 |
| 선행 | K, S0 |

상태의 네 층위를 분리해 보관한다.

```text
CanonicalState      서버가 보유한 실제 상태
BeliefState         개별 주체가 믿는 상태        (U2 소유)
PublicRecordState   제도가 공식 인정하는 상태
RumorState          사회망을 통해 전파되는 불확실한 주장
```

S3 은 저장 구조를 제공하고, 믿음의 **갱신 로직**은 U2 가 소유한다.

---

## 페이즈 완료 결과

```text
같은 사건이 물리 흔적·사회 결과·의념 잔향이라는 서로 다른 상태로 남는다.
논리 공간과 표현 공간이 분리되어 있다.
어떤 상태도 소유 모듈 밖에서 직접 수정되지 않는다.
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | S0, S1 |
| [VS3](30-Vertical-Slices.md#vs3-퀘스트-없는-요청) | S2 |
| [VS4](30-Vertical-Slices.md#vs4-경쟁과-사건-연쇄) | S3 |
