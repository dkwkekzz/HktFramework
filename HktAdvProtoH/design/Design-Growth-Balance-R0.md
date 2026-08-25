# SYSTEM DESIGN DOCUMENT

## Growth Balance System — 성장 비용·보상 균형 설계

| **문서 버전** | R0 |
|---|---|
| **상태** | Human 원안 (레이아웃 정리만 — 내용은 원문 그대로) |
| **범위** | 모든 성장(Attribute·Skill·Slot·Property·Class·Capability·지역·World Interaction)의 비용·보상 균형 평가와 자동 검증 |

---

## 1. 목적

본 시스템의 목적은 다음 질문에 답하는 것이다.

> 이 성장을 얻기 위해 플레이어가 지불하는 비용과, 그 결과 얻는 힘·가능성이 서로 합리적인가?

성장 시스템에서는 단순한 능력치 증가뿐 아니라 다음이 모두 보상이 될 수 있다.

- Attribute 증가
- Skill 획득
- Equipment Slot 해금
- Property 획득
- Class Change
- 새 Capability
- 새로운 지역 접근
- 새로운 World Interaction

따라서 밸런스를 단순히

```text
Resource 10개  =  AttackPower +5
```

와 같은 교환비로 평가할 수 없다.

특히 베이라의 성장은 Resource를 통해 새로운 Capability를 얻고, 이전에는 대응할 수 없었던 세계에 진입하는 구조다.

본 시스템은 모든 성장에 대해

```text
성장 비용  ↕  성장 가치
```

를 공통 기준으로 평가하고, 잘못된 성장 Route를 자동으로 탐지할 수 있도록 한다.

---

## 2. 밸런스의 보장 범위

게임의 재미 자체를 수학적으로 완전히 보장할 수는 없다.

대신 시스템적으로 다음을 보장한다.

1. 더 저렴한 성장 Route가 더 비싼 Route를 완전히 압도하지 않는다.
2. 하나의 성장으로 의도한 Progression 단계를 지나치게 건너뛰지 않는다.
3. 같은 단계의 성장들은 비용 대비 가치가 일정한 범위 안에 존재한다.
4. 강력한 성장에는 비용 / 조건 / 적용 범위 / 제약 중 하나 이상의 대가가 존재한다.
5. 설계된 성장 효과와 실제 World Rule 실행 결과가 크게 다르면 검출한다.
6. 모든 성장에는 무엇을 잘하게 되는지뿐 아니라 무엇을 하지 못하는지도 정의한다.

따라서 Balance System의 역할은:

> 밸런스가 완벽함을 증명하는 것이 아니라, 잘못된 밸런스를 반증 가능하게 만드는 것

이다.

---

## 3. 성장의 비용은 Resource 개수가 아니다

성장을 얻기 위해 필요한 실제 부담을 `Acquisition Burden`으로 정의한다.

예:

```text
경계결정 10개 필요
```

만으로는 성장 비용을 알 수 없다.

실제 비용에는 다음이 포함된다.

- 경계결정을 찾는 시간
- 지역의 위험
- 채집 난이도
- 필요한 플레이 실력
- 필요한 세계 지식
- 선행 Capability
- 다른 성장에서 사용할 기회비용
- 재획득 가능성

따라서 모든 성장 Route는 `Cost Profile`을 가진다.

---

## 4. Cost Profile

- Growth Cost
  - Time Cost
  - Risk Cost
  - Skill Cost
  - Knowledge Cost
  - Resource Cost
  - Opportunity Cost
  - Repeatability Cost

### 4.1 Time Cost

정상적인 플레이에서 성장 조건을 완료하는 데 필요한 능동 플레이 부담.

단순한 실제 시간보다:

- 의미 있는 플레이 단계
- 반복 필요량
- 이동
- 전투
- 관찰
- 채집
- Trial

을 기준으로 한다.

### 4.2 Risk Cost

획득 과정에서 감수해야 하는 실패와 손실 가능성.

예:

- 사망 위험
- Resource 손실
- 지역 퇴출
- Equipment 손상
- 위험한 Hazard 노출

베이라에서는 일반적으로 높은 세계압이 높은 위험과 새로운 Property 가능성을 동시에 만들지만, 위험하다고 반드시 가치 있는 Resource가 보장되지는 않는다.

### 4.3 Skill Cost

성장을 얻기 위해 플레이어에게 필요한 실제 수행 능력.

예:

- 정확한 Guard
- 약점 타격
- 위치 제어
- Hazard 이용
- 여러 Skill 연계
- Pattern 대응

### 4.4 Knowledge Cost

세계와 대상에 대한 이해 요구.

예:

- Creature Pattern 발견
- Resource 생성 조건 이해
- 약점 발견
- Hazard Rule 이해
- 원리의 작동 방식 관찰

### 4.5 Resource Cost

실제로 소비하거나 결속해야 하는 Resource의 가치.

다음이 모두 고려 대상이다.

- 희귀도
- 획득 난이도
- 사용처 개수
- 거래 가치
- 대체재 존재 여부
- 소모 여부

### 4.6 Opportunity Cost

하나의 성장을 선택함으로써 포기해야 하는 다른 가능성.

예:

```text
희귀 Resource를 Class A에 사용
→ 같은 Resource를 사용하는 Class B 성장 불가능
```

이러한 선택이 존재하면 실제 성장 비용이 증가한다.

### 4.7 Repeatability Cost

한 번 방법을 알게 된 이후 얼마나 쉽게 반복할 수 있는가.

- 한 번만 가능한 Trial
- 재생성되는 Resource
- 무한 반복 가능한 약한 적
- 희귀 환경 Event

는 서로 다른 가치가 된다.

---

## 5. 비용은 우선 벡터로 관리한다

예:

```yaml
cost_profile:
  time: 3
  risk: 4
  skill: 3
  knowledge: 4
  resource: 2
  opportunity: 3
  repeatability: 2
```

점수는 절대적인 화폐가 아니다. 다른 Growth Route와 비교하기 위한 상대적 Balance Unit이다.

초기 구현에서는 다음 정도의 5단계 표현으로 충분하다.

| 점수 | 의미 |
|---|---|
| 1 | 매우 낮음 |
| 2 | 낮음 |
| 3 | 보통 |
| 4 | 높음 |
| 5 | 매우 높음 |

---

## 6. 성장 결과도 Reward Profile로 평가한다

보상 역시 단일 숫자로 환산하지 않는다.

- Growth Reward
  - Vertical Power
  - Survivability
  - Capability Access
  - Applicability
  - Reliability
  - Permanence
  - Economic Utility

---

## 7. Vertical Power

이미 가능했던 행동을 얼마나 더 강하게 만드는가.

예:

- AttackPower 증가
- Defense 증가
- Skill 피해 증가
- Stamina 효율 증가
- Cooldown 감소

Vertical Power가 높으면 기존 콘텐츠 상당 부분이 쉬워질 수 있으므로 높은 가치로 평가한다.

---

## 8. Survivability

죽거나 실패할 가능성을 얼마나 감소시키는가.

예:

- MaxHealth
- Defense
- 회복
- 상태 이상 저항
- 회피 가능성
- 피해 무효화

특히 회복이나 피해 무효화는 반복 플레이의 Resource 소비까지 감소시킬 수 있으므로 단순 수치 이상의 가치를 가질 수 있다.

---

## 9. Capability Access

가장 중요한 항목이다.

```text
기존에는 불가능했다.
↓
성장 후 가능하다.
```

를 얼마나 많이 만들어내는가를 평가한다.

예:

```text
MC-CUT-ABNORMAL-STRUCTURE
```

를 획득하면:

- 공간 단층 구조 절단
- 비정상 Creature 연결 절단
- 특정 봉쇄 구조 제거

가 가능해질 수 있다.

이것은 일반적인 AttackPower 증가와 완전히 다른 성장 가치다.

---

## 10. Applicability

보상이 얼마나 넓은 상황에 적용되는가.

예:

```text
모든 공격 피해 +20%
```

는 매우 높은 Applicability를 가진다.

반면:

```text
공간적으로 비정상적인 구조에만 추가 효과
```

는 좁은 Applicability를 가진다.

같은 강도의 효과라면 적용 범위가 넓을수록 가치가 높다.

---

## 11. Reliability

효과가 얼마나 쉽게 발동하는가.

예:

```text
항상 피해 +20%
```

와

```text
대상을 관찰하여 구조적 약점을 확인한 뒤
정확히 해당 부위를 공격했을 경우 +20%
```

는 같은 효과량이어도 가치가 다르다.

조건이 많을수록 Reliability는 낮아진다.

---

## 12. Permanence

보상이 얼마나 오래 유지되는가.

- 일회성
- 일시적
- 지역 내 지속
- Class Active 동안 지속
- 영구 획득

영구적 Capability는 동일 효과의 임시 효과보다 높은 가치를 가진다.

---

## 13. Economic Utility

전투와 탐험 외의 가치.

예:

- 제작 재료
- 거래 가치
- 다른 Actor에게 제공 가능
- 다른 성장 Route의 재료

하나의 Resource나 Capability가 전투·탐험·경제 모두에서 강하면 실제 총가치는 매우 높아질 수 있다.

---

## 14. Reward Profile 예시

```yaml
reward_profile:
  vertical_power: 1
  survivability: 3
  capability_access: 5
  applicability: 2
  reliability: 3
  permanence: 5
  economic_utility: 1
```

예를 들어 `경계 수호자`라면:

> 일반적인 전투력 증가는 작다.
>
> 하지만
>
> 특정 공간 Hazard에 대한 새로운 대응 방법을 제공한다.

가 핵심이 될 수 있다.

---

## 15. 하나의 Balance Score에 의존하지 않는다

다음 방식은 사용하지 않는다.

```text
Cost = 47
Reward = 45
→ Balanced
```

이 방식은 중요한 차이를 숨긴다.

예:

```text
Class A
모든 상황에서 공격력 증가

Class B
특정 상황에서만 강력한 탐험 Capability
```

두 성장의 성질은 완전히 다르다.

따라서:

> Cost Profile과 Reward Profile의 벡터 비교를 기본으로 하고 총점은 검색과 경고를 위한 보조값으로만 사용한다.

---

## 16. Dominance Test

가장 중요한 자동 Balance 검사다.

두 Growth Route A와 B를 비교한다.

A가 B보다 모든 비용에서 같거나 낮으면서:

| 비용 항목 | 조건 |
|---|---|
| Time | A ≤ B |
| Risk | A ≤ B |
| Skill | A ≤ B |
| Knowledge | A ≤ B |
| Resource | A ≤ B |
| Opportunity | A ≤ B |

보상에서는 모든 항목이 같거나 높다면:

| 보상 항목 | 조건 |
|---|---|
| Power | A ≥ B |
| Survivability | A ≥ B |
| Capability | A ≥ B |
| Applicability | A ≥ B |
| Reliability | A ≥ B |

B는 `Dominated Growth Route`다.

> B를 선택해야 할 게임적인 이유가 없다.

이 경우 자동 실패시킨다.

```text
BALANCE-DOMINATED-ROUTE
```

---

## 17. 좋은 성장 Route는 Trade-off를 가진다

예:

```text
Growth A
높은 공격 성능
높은 획득 위험
좁은 적용 범위
```

```text
Growth B
낮은 직접 공격 성능
낮은 획득 위험
넓은 탐험 Utility
```

둘 중 어느 하나가 절대적으로 우월하지 않아야 한다.

즉:

> Balance의 핵심은 모든 선택을 동일하게 만드는 것이 아니라 서로 다른 장단점을 만드는 것이다.

---

## 18. Growth Tier

성장의 허용 범위를 관리하기 위해 `Growth Tier`를 둔다.

| Tier | 내용 |
|---|---|
| GT0 | 기본 Capability |
| GT1 | 기본 성장 |
| GT2 | 전문화 |
| GT3 | 특수 Capability |
| GT4 | 고급 Principle 조작 |
| GT5 | 추상 WorldState 조작 |

World Depth와 Growth Tier는 동일하지 않다.

기존 베이라 구조 역시 깊이를 절대적인 거리·수치 공식으로 고정하지 않는다. 지역마다 Local WorldState가 다를 수 있다.

따라서:

```text
World Depth  !=  Growth Tier
```

이다.

---

## 19. Tier별 Reward Budget

각 Tier에는 허용할 수 있는 성장 범위를 설정한다.

예:

**GT1**

- 허용
  - 소규모 Attribute 증가
  - 기본 Skill 성장
  - 기본 Slot 해금
  - 기본 Resource 효율 개선
- 금지
  - 공간 조작
  - Identity 조작
  - 죽음 무효
  - 광범위한 피해 면역

**GT3**

- 허용
  - 특수 Hazard 대응
  - 특정 Property 사용
  - 첫 Principle Class
  - 새로운 제한적 Capability Gate 해결
- 조건
  - 적용 범위 또는 발동 조건이 명확해야 한다.

**GT5**

- 허용: Memory · Identity · Space · Relation · Pattern 같은 추상 WorldState 개입.
- 조건 (하나 이상 반드시 요구):
  - 강한 Constraint
  - 좁은 적용 조건
  - 높은 획득 부담

---

## 20. 강도와 범용성의 Trade-off

기본 Balance 원칙:

```text
강도 ↑        → 적용 범위 ↓
적용 범위 ↑   → 강도 ↓
```

예:

**범용 성장**

```text
AttackPower +5%
대부분의 적에게 사용 가능
```

작은 효과만 허용한다.

**전문 성장**

```text
경계 구조에 +80% 효과
특정 구조에만 적용
```

큰 효과를 허용할 수 있다.

**특수 Capability**

```text
공간 연결 자체를 절단
```

매우 강력하므로:

- 사전 관찰 필요
- 특정 Target만 가능
- Stamina 대량 소비
- 특수 Property 필요
- Cooldown
- Class Constraint

등이 요구될 수 있다.

---

## 21. Constraint 역시 성장 비용이다

강력한 성장의 가격을 Resource만으로 지불하게 만들지 않는다.

다음 모두 Balance Cost가 될 수 있다.

- 발동 조건
- 대상 제한
- Resource 소비
- Stamina 소비
- 선행 관찰
- 위치 조건
- Class 제한
- 사용 후 취약 시간
- 동시에 유지 가능한 수

따라서:

```text
강력한 효과  =  많은 Resource
```

만 사용하지 않는다.

```text
강력한 효과  =  높은 획득 부담 + 좁은 적용 범위 + 명확한 Constraint
```

의 조합으로 설계한다.

---

## 22. Class 비용은 Resource만으로 지불하지 않는다

다음 설계는 금지한다.

```text
경계결정 100개
↓
경계 수호자
```

이 경우 Class Change가 사실상 경제력 구매가 된다.

Class의 기본 비용 구조는 다음이다.

```text
Observation + Understanding + Meaningful Experience + Resource / Property + Choice + Trial
```

예:

| 조건 | 충족 |
|---|---|
| 경계결정 보유 | ✓ |
| 공간 단층 관찰 | ✓ |
| 구조 연속성 이해 | ✓ |
| 동료 보호 경험 | ✗ |
| Class Trial | ✗ |

→ Class LOCKED

따라서 거래를 통해 Resource를 구매해도 플레이 경험 전체를 우회할 수 없다.

---

## 23. Capability Reach

새 Capability에는 반드시 적용 범위를 정의한다.

```yaml
MC-RESTORE-BIOLOGICAL-STATE:
  effective_against:
    - physical_damage
    - organ_damage
  partial_against:
    - poison
    - biological_mutation
  ineffective_against:
    - memory_loss
    - identity_loss
    - spatial_severance
```

즉 모든 Capability는:

- 잘하는 것
- 부분적으로 가능한 것
- 하지 못하는 것

을 가진다.

---

## 24. Gate Coverage

Capability의 가치는 몇 개의 기존 불가능을 가능으로 바꾸는지에 크게 영향을 받는다.

```text
Capability
↓
어떤 Capability Gate를 해결하는가?
```

예:

`MC-CUT-ABNORMAL-STRUCTURE`

| Gate | Coverage |
|---|---|
| 공간 단층 구조 | ✓ |
| 비정상 갑각 연결 | ✓ |
| 일부 생체 연결 | ✓ |
| 독성 환경 | ✗ |
| 정신 간섭 | ✗ |
| Identity 침식 | ✗ |

하나의 Growth가 지나치게 많은 독립적인 Gate를 해결하면 Balance Warning을 발생시킨다.

```text
BALANCE-EXCESSIVE-GATE-COVERAGE
```

---

## 25. Power Envelope

모든 중요한 성장에는 의도된 영향 범위를 정의한다.

```yaml
power_envelope:
  general_combat: small
  specialized_combat: strong
  survivability: medium
  exploration_gate: transformative
  economy: low
```

예:

```yaml
CL-BOUNDARY-WARDEN:
  intended_growth:
    vertical_power: low
    survivability: medium
    capability_access: high
    applicability: narrow
  power_envelope:
    general_combat: small_change
    structural_enemy: large_change
    spatial_hazard: enables_solution
```

이 Class가 실제로 모든 일반 전투에서도 대폭 강해진다면 설계 의도에서 벗어난 것이다.

---

## 26. Benchmark Suite

정적 Profile만으로 Balance를 확정하지 않는다.

고정된 Benchmark WorldState를 만든다.

예:

- BM-01 일반 근접 생물
- BM-02 고방어 생물
- BM-03 고기동 생물
- BM-04 재생 생물
- BM-05 공간 단층 생물
- BM-06 공생 Network
- BM-07 독성 Hazard
- BM-08 추상 인식 Hazard

성장 전과 후에 동일한 조건으로 World Rule을 실행한다.

---

## 27. Benchmark 측정값

- Damage Output
- Damage Taken
- Encounter Duration
- Stamina Consumption
- Resource Consumption
- Required Actions
- Allowed Mistakes
- Successful Strategies
- Reachable Gates

Capability 중심 성장에서는 특히:

```text
Before: 불가능
After:  가능
```

여부를 본다.

---

## 28. Horizontal Growth 검증 예

경계 수호자 획득 전:

| Benchmark | 결과 |
|---|---|
| BM-01 일반 생물 | SUCCESS |
| BM-02 갑각 생물 | SUCCESS |
| BM-03 빠른 생물 | SUCCESS |
| BM-05 공간 단층 | BLOCKED |

획득 후:

| Benchmark | 결과 |
|---|---|
| BM-01 | 거의 변화 없음 |
| BM-02 | 거의 변화 없음 |
| BM-03 | 거의 변화 없음 |
| BM-05 | SUCCESS |

이것은 의도한 Horizontal Capability Growth다.

반대로:

| Benchmark | 결과 |
|---|---|
| BM-01 | 전투시간 -40% |
| BM-02 | 전투시간 -45% |
| BM-03 | 전투시간 -50% |
| BM-05 | SUCCESS |

라면 Class가 의도보다 훨씬 높은 범용 전투력을 제공한다.

```text
BALANCE-POWER-ENVELOPE-VIOLATION
```

---

## 29. Resource Balance

Resource 역시 성장과 동일한 Profile을 가진다.

예:

```yaml
IP-BOUNDARY-STABLE:
  acquisition:
    time: medium
    risk: high
    skill: medium
    knowledge: medium
    repeatability: low
  utility:
    combat: medium
    exploration: high
    crafting: high
    economy: high
  limitations:
    - 일반 공격력을 크게 증가시키지 않는다.
    - 구조적 연결이 존재하지 않는 대상에는 특수 효과가 없다.
```

경계결정은 기존 세계관에서 공간 변화 속에서도 구조적 연속성을 유지하며, 이를 이용한 무기는 비정상적인 구조적 연결을 절단할 수 있다.

따라서:

```text
위험한 곳에서 얻었다. → 공격력이 매우 높아야 한다.
```

가 아니다.

```text
높은 획득 부담  ↔  독특하고 높은 탐험 Utility
```

로 균형을 맞출 수 있다.

---

## 30. 세 단계 Balance Validation

### Phase 1 — Static Balance Check

콘텐츠 정의 단계에서 자동 검사한다.

검사 대상:

- Cost Profile
- Reward Profile
- Growth Tier
- Power Envelope
- Capability Reach
- Gate Coverage
- Constraint
- Dominance

명백한 구조적 불균형을 제거한다.

### Phase 2 — Simulation / Benchmark

실제 World Rule을 실행한다.

```text
Before Growth  vs  After Growth
```

같은 WorldState와 같은 입력을 사용하여 결과 차이를 측정한다.

결정론적인 Combat / World Rule일수록 이 테스트의 신뢰도가 높아진다.

### Phase 3 — Human Play Validation

마지막 판단은 사람이 한다.

검사 질문:

- 노력에 비해 보상이 만족스러운가?
- Class 선택 사이에서 실제 고민이 발생하는가?
- 특정 Route가 안 고르면 손해인 필수 선택이 되었는가?
- 새로운 Capability가 기존 플레이와 다른 경험을 만드는가?
- 성장 이후 세계를 보는 방식이 실제로 달라졌는가?
- 획득 과정이 지나치게 반복적인가?

자동 시스템은 구조적 정확성을 검사한다. 인간은 최종적인 플레이 가치를 판단한다.

---

## 31. Growth Balance Contract

모든 중요한 Growth Node는 다음 Contract를 가진다.

```yaml
GrowthBalanceContract:
  growth_id: GR-BOUNDARY-WARDEN
  tier: GT3

  cost_profile:
    time: 3
    risk: 4
    skill: 3
    knowledge: 4
    resource: 3
    opportunity: 2
    repeatability: 3

  reward_profile:
    vertical_power: 1
    survivability: 3
    capability_access: 5
    applicability: 2
    reliability: 3
    permanence: 5
    economic_utility: 1

  power_envelope:
    general_combat: small_change
    structural_enemy: strong_change
    spatial_hazard: enables_solution

  capability_reach:
    effective:
      - spatial_shear
      - abnormal_structure
    partial:
      - biological_link
    ineffective:
      - memory_damage
      - identity_damage
      - generic_damage

  constraints:
    - requires_boundary_identification
    - affects_declared_boundary_only
    - consumes_stamina

  benchmark_suite:
    - BM-GENERAL-COMBAT
    - BM-ARMORED-CREATURE
    - BM-SPATIAL-SHEAR

  validation:
    static: PASS
    benchmark: PASS
    human_review: REQUIRED
```

이 Contract가 없는 중요한 성장 콘텐츠는 완료된 것으로 인정하지 않는다.

---

## 32. 자동 Balance Rule

최소 다음 규칙은 모든 Growth에 적용한다.

- **GB-01** — 모든 중요한 Growth는 Cost Profile을 가진다.
- **GB-02** — 모든 중요한 Growth는 Reward Profile을 가진다.
- **GB-03** — 같은 비교 집합 안에서 명백하게 Dominated된 Growth Route를 허용하지 않는다.
- **GB-04** — 높은 강도와 높은 범용성을 동시에 제공하려면 높은 Cost 또는 강한 Constraint가 필요하다.
- **GB-05** — 모든 Capability는 effective / partial / ineffective 범위를 가진다.
- **GB-06** — 하나의 Growth가 의도하지 않은 다수의 Capability Gate를 동시에 무효화할 수 없다.
- **GB-07** — 모든 중요한 Growth는 Benchmark 전/후 비교를 통과해야 한다.
- **GB-08** — Class의 핵심 획득 조건을 Resource 구매만으로 완전히 우회할 수 없다.
- **GB-09** — 영구적인 Reward는 동일 효과의 일시적 Reward보다 더 높은 가치로 평가한다.
- **GB-10** — 성장에는 무엇이 가능해지는가와 함께 무엇이 여전히 불가능한가를 명시한다.

---

## 33. Balance 실패 상태

Agent와 테스트 도구는 최소 다음 상태를 구분한다.

- `BALANCED`
- `UNRESOLVED`
- `DOMINATED_ROUTE`
- `EXCESSIVE_POWER`
- `EXCESSIVE_APPLICABILITY`
- `EXCESSIVE_GATE_COVERAGE`
- `INSUFFICIENT_REWARD`
- `INSUFFICIENT_COST`
- `TIER_VIOLATION`
- `POWER_ENVELOPE_VIOLATION`
- `BENCHMARK_FAILURE`
- `HUMAN_REVIEW_REQUIRED`

`UNRESOLVED` 상태의 Growth는 구현할 수 있지만 Release-ready로 인정하지 않는다.

---

## 34. Agent 작업 순서

새로운 성장 콘텐츠를 만드는 Agent는 반드시 다음 순서를 따른다.

1. Growth의 세계적 원인을 정의한다.
2. 획득 Route를 정의한다.
3. Cost Profile을 작성한다.
4. Reward Profile을 작성한다.
5. Growth Tier를 결정한다.
6. Power Envelope를 정의한다.
7. Capability Reach를 정의한다.
8. 필요한 Constraint를 정의한다.
9. 동급 Growth와 Dominance 비교한다.
10. Benchmark를 실행한다.
11. 예상 범위를 벗어나면 Cost / Reward / Constraint를 조정한다.
12. Human Review 대상으로 전달한다.

---

## 35. 최종 Balance Pipeline

```text
World Need
↓
Growth Candidate
│
├─ Acquisition Route
├─ Cost Profile
├─ Reward Profile
├─ Growth Tier
├─ Power Envelope
├─ Capability Reach
└─ Constraints
        │
        ▼
STATIC BALANCE CHECK
        │
        ▼
DOMINANCE CHECK
        │
        ▼
BENCHMARK SIMULATION
        │
        ▼
EXPECTED vs ACTUAL
        │
        ▼
HUMAN PLAY REVIEW
        │
        ▼
APPROVED GROWTH
```

---

## 36. 핵심 원칙

Growth Balance System의 핵심은 다음 세 문장이다.

> 성장의 비용은 소비한 자원의 개수가 아니라 그 성장을 획득하기 위해 치른 전체 플레이 부담이다.

> 성장의 가치는 증가한 숫자가 아니라 이전보다 세계에서 무엇을 더 할 수 있게 되었는지를 포함한다.

> 밸런스는 비용과 보상을 하나의 점수로 맞추는 것이 아니라, 각 성장의 장단점과 적용 범위를 명시하고 실제 World Rule에서 그 범위를 벗어나지 않는지를 검증함으로써 관리한다.
