# [05·2.2] 자코비안과 구속 정식화 (Jacobian & Constraint Formulation)

> 접촉·조인트의 "이러면 안 된다" 를 **위치 함수 `C(x)`** 로 적고, 시간 미분해 **속도 구속 `J v = 0`** 으로 내린 뒤, 구속력이 `J^T λ` 방향으로만 작용한다는 사실에서 임펄스 식과 **effective mass** 를 끌어낸다.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md) (선형대수) · [02-dynamics](../02-dynamics.md) (`M`, 임펄스)

---

## 위치 구속에서 속도 구속으로

구속은 보통 **위치 함수** `C(x) = 0` (또는 부등식 `C(x) ≥ 0`)으로 정의한다. `x` 는 모든 물체의 일반화 위치(위치+방향).

예: 두 점이 거리 `L`로 묶인 distance 구속

```
C(x) = |p2 - p1| - L = 0
```

솔버는 위치를 직접 풀기 어려우므로 보통 **속도 수준**에서 푼다. `C`를 시간 미분하면 일반화 속도 `v`에 대한 선형식이 나온다.

```
Ċ = (∂C/∂x) · ẋ = J v = 0          ← 속도 구속 (velocity constraint)
```

여기서 `J = ∂C/∂x` 가 **Jacobian**. 행 하나가 구속 하나에 대응하고, "어느 자유도(DOF)가 이 구속을 위반시키는 방향인가"를 가리킨다. 강체 한 쌍의 접촉이면 `J`는 보통

```
J = [ -n^T,  -(r1×n)^T,   n^T,  (r2×n)^T ]
```

형태(법선 `n`, 각 바디 질량중심에서 접촉점까지의 팔 `r1`, `r2`). 앞 두 블록은 바디1의 선·각속도에, 뒤 두 블록은 바디2에 작용한다.

## 구속력은 `J^T` 방향으로만 — 라그랑주 승수

구속력은 구속을 위반시키는 방향으로만 작용해야 한다(그 외 방향으로 일을 하면 가짜 에너지). 가상일 원리(virtual work) / 라그랑주 승수(Lagrange multiplier)가 이를 정식화한다:

```
f_constraint = J^T λ            (λ = Lagrange 승수 = 임펄스 크기)
```

> 📐 **심화: 왜 하필 `J^T`이고, 왜 임펄스를 J로 푸는가** — `J`가 "속도→구속 위반 변화율" 사상이라면 `J^T`는 그 *전치(adjoint)* 로 "임펄스→구속 방향 힘" 사상이다. 이 쌍대성과 effective mass의 기하학적 정체를 근본부터 푼 전용 문서 → [02a-why-jacobian.md](02a-why-jacobian.md).

## Effective mass (유효 질량)

뉴턴 식 `M v̇ = J^T λ` 와 속도 구속 `J v = 0` 을 결합하면, 한 구속을 만족시키는 데 필요한 임펄스는

```
λ = -(J M⁻¹ J^T)⁻¹ (J v)
m_eff = (J M⁻¹ J^T)⁻¹           ← effective mass
```

`M⁻¹` 는 역질량 행렬(`diag(1/m, I⁻¹, …)`). 1차원 접촉이면 `J M⁻¹ J^T` 는 스칼라라 `m_eff` 도 스칼라가 된다 — sequential impulse 솔버의 핵심 양. 이 값은 한 구속 안에서 timestep 내내 변하지 않으므로 **warm start 캐시·반복 전 미리 계산**한다([07-solver-structure](07-solver-structure.md)).

직관: `m_eff` 는 "이 구속 방향에서 두 물체가 같이 보이는 관성" 이다. 가벼운 물체끼리면 작고(작은 임펄스로 큰 속도 변화), 무거우면 크다. 같은 `J v` 위반을 지우는 데 필요한 임펄스가 곧 `m_eff · (위반 속도)`.

## 등식 vs 부등식 구속

| 종류 | 식 | 예 | λ 제약 |
|---|---|---|---|
| 등식(equality) | `C = 0`, `J v = 0` | 조인트, 거리 고정 | `λ ∈ (-∞, ∞)` |
| 부등식(inequality) | `C ≥ 0`, `J v ≥ 0` | 접촉 비침투, 조인트 한계 | `λ ≥ 0` (밀기만, 당기지 못함) |

접촉의 본질은 **부등식**이다 — 바닥은 물체를 *밀어내기만* 하고 잡아당기지 못한다. 그래서 정규 임펄스는 항상 `λ_n ≥ 0` 로 **클램핑**된다([01-contact-model](01-contact-model.md)). 이 클램핑이 단순한 선형 풀이를 [04-lcp-mlcp](04-lcp-mlcp.md)의 상보성 문제로 만든다.

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **effective mass 갱신 누락**: 팔 길이 `r`·법선 `n`이 substep 중 바뀌면 `m_eff`도 다시 계산해야(특히 TGS에서 위치 갱신 후). 안 하면 강성 저하.
- **부등식을 등식처럼 풀기**: `λ_n ≥ 0` 클램핑을 빼면 접촉이 물체를 *당겨* 끈끈이처럼 붙는다.

**다음**: [02a-why-jacobian](02a-why-jacobian.md) — `J`/`J^T` 쌍대성과 effective mass를 근본부터. 또는 바로 [03-sequential-impulse](03-sequential-impulse.md) — 이 식을 반복으로 푸는 게임 주류 솔버.
