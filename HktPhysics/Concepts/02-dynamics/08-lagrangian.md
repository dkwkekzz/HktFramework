# [02.8] Lagrangian / Hamiltonian 역학 (Generalized Coordinates)

> Newton–Euler가 "힘 → 가속도"의 벡터 역학이라면, Lagrangian은 에너지(`L = KE − PE`)에서 운동방정식을 직접 뽑는 좌표 자유로운 역학이다. 핵심 분기는 좌표 선택 — **최대 좌표(maximal)**(모든 강체를 자유 6DOF로 두고 구속으로 묶기) vs **축소 좌표(reduced)**(관절 각도 같은 독립 자유도만 쓰기). 본 문서는 그 둘의 트레이드오프, 심플렉틱으로의 다리, 그리고 축소 좌표가 Featherstone/ABA 관절체([../06-joints-articulation.md](../06-joints-articulation.md))로 구체화되는 지점을 잇는다.
> **상위 허브**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md)

---

## 1. 왜 필요한가 — 힘 대신 에너지로

Newton–Euler([06-newton-euler.md](06-newton-euler.md))는 모든 힘·토크를 일일이 세서 `F=ma`를 푼다. 구속이 많은 계(관절 로봇, ragdoll, 차량 서스펜션)에서는 구속력(joint reaction force)을 다 세는 게 번거롭고, 좌표가 6DOF×강체 수로 폭발한다. Lagrangian 역학은 다른 접근이다:

- **에너지에서 출발:** 운동방정식을 힘이 아니라 `KE`·`PE`([07-energy.md](07-energy.md))에서 유도.
- **좌표 자유:** 데카르트 좌표가 아니라 **일반화 좌표(generalized coordinates)** `q` — 계의 실제 자유도에 맞춘 임의 좌표(관절 각도, 호 길이 등).
- **구속력 소거:** 좌표가 이미 구속을 만족하면(예: 관절 각도) 구속력이 방정식에서 자동으로 빠진다. 안 세도 됨.

이 "좌표를 자유도에 맞춘다"는 발상이 축소 좌표 관절체([../06-joints-articulation.md](../06-joints-articulation.md))의 이론적 뿌리다.

---

## 2. 일반화 좌표와 Euler–Lagrange 방정식

**일반화 좌표 `q = (q₁,...,q_n)`:** 계의 형상(configuration)을 유일하게 정하는 최소 독립 변수 집합. `n` = 자유도(DOF). 진자는 각도 `θ` 하나, 이중진자는 `(θ₁,θ₂)`, 자유 강체는 6개. `q̇`는 일반화 속도.

**Lagrangian:**

```
L(q, q̇, t) = KE(q, q̇) − PE(q)
```

**Euler–Lagrange 방정식** — 작용(action) `S=∫L dt`을 정상화(최소작용 원리)하면:

```
d/dt ( ∂L/∂q̇ᵢ ) − ∂L/∂qᵢ = Qᵢ        (i = 1..n)
```

`Qᵢ`는 비보존 일반화 힘(마찰·모터 토크 등; 보존력은 이미 `PE`에 들어감). 이 `n`개 식이 계의 완전한 운동방정식이다 — 구속력 없이.

**예(단진자):** `KE = ½mℓ²θ̇²`, `PE = −mgℓcosθ`, `L = ½mℓ²θ̇² + mgℓcosθ`. 대입하면 `mℓ²θ̈ + mgℓsinθ = 0` ⟹ `θ̈ = −(g/ℓ)sinθ`. Newton으로 줄·장력 세는 것보다 깔끔 — 장력(구속력)이 안 나온다.

**단계별로(왜 장력이 사라지나):** Newton이라면 추에 작용하는 중력 `mg`와 줄 장력 `T`를 모두 세고, "줄 길이 일정"이라는 구속을 따로 강제해야 한다 — `T`는 미지수라 구속 방정식과 연립해 풀어야 나온다. Lagrangian은 좌표를 처음부터 `θ` 하나로 잡았다(줄 길이 `ℓ`이 고정이라는 구속이 좌표 선택에 이미 흡수됨). 그래서 `T`가 운동방정식에 **등장조차 하지 않는다**. 구속이 좌표에 내장돼 구속력이 자동 소거되는 — 이것이 축소 좌표(§3)의 본질이고, 관절이 많아질수록 이득이 커진다.

**행렬 형태(다체):** 일반화하면 `M(q)·q̈ + C(q,q̇) = Q`. `M(q)`는 **질량행렬(generalized mass matrix)** — 위치 의존, 관성텐서의 일반화. `C`는 코리올리·원심 항(자이로 항의 일반화, [06 §2](06-newton-euler.md)). 이 구조가 관절체 솔버의 핵심.

**왜 `M`이 위치 의존인가(이중진자 직관).** 이중진자 `q=(θ₁,θ₂)`의 `KE`를 전개하면 `½q̇ᵀM(q)q̇` 꼴이 나오는데, 두 팔 사이 각도차가 변하면 한 팔의 운동이 다른 팔에 미치는 관성 결합(`M`의 비대각 성분)이 달라진다 — 그래서 `M`이 `q`에 의존한다. 단일 강체의 `I`는 body frame에서 상수였지만([04a §3](04a-inertia-tensor-geometric.md)), 다체에선 형상이 바뀌며 유효 관성이 매 순간 달라지는 것. `M(q)`을 매 스텝 다시 만들고 `q̈ = M⁻¹(Q − C)`를 푸는 게 직접법이고, 이걸 트리에서 행렬 역 없이 `O(n)`으로 푸는 게 ABA(§5).

**일반화 힘 `Q`는 어디서 오나(가상일).** `Qᵢ`는 외력 `F_k`(데카르트)를 일반화 좌표로 투영한 것이다. 가상일(virtual work) `δW = Σ F_k·δr_k = Σ Qᵢ·δqᵢ`가 좌표와 무관하게 같아야 하므로:

```
Qᵢ = Σ_k  F_k · (∂r_k / ∂qᵢ)
```

`∂r_k/∂qᵢ`는 일반화 좌표 `qᵢ`를 흔들 때 점 `r_k`가 움직이는 방향(야코비안 열) — 즉 모터 토크·중력·외부 힘을 관절 좌표로 끌어오는 변환이 이 야코비안이다. 구속력이 `Q`에 안 들어오는 이유도 여기서 보인다: 이상 구속력은 구속을 만족하는 가상변위 `δr_k`에 수직이라 `F_constraint·δr_k = 0`, 가상일이 0이다 — **이상 구속은 일을 하지 않는다**(d'Alembert 원리). 그래서 §2 단진자에서 장력이 사라졌다.

**질량행렬을 명시적으로(이중진자).** 같은 길이·질량 `ℓ,m`인 이중진자 `q=(θ₁,θ₂)`의 `M(q)`는:

```
        [ (m₁+m₂)ℓ₁²              m₂ℓ₁ℓ₂·cos(θ₁−θ₂) ]
M(q) =  [ m₂ℓ₁ℓ₂·cos(θ₁−θ₂)      m₂ℓ₂²             ]
```

비대각 성분 `m₂ℓ₁ℓ₂cos(θ₁−θ₂)`이 두 팔의 **관성 결합**이고, `θ₁−θ₂`(각도차)에 따라 변한다 — 그래서 `M`이 `q` 의존(§위). 두 팔이 일직선(`θ₁=θ₂`)일 때 결합이 최대, 직각일 때 0. 운동방정식은 `M(q)q̈ + C(q,q̇) = Q`이고, `C`에 `sin(θ₁−θ₂)·θ̇²` 꼴의 코리올리/원심 항이 든다. 이중진자가 카오스적인 이유가 이 `M`·`C`의 강한 비선형 결합이다 — 그래서 닫힌형 적분이 안 되고 수치 적분(symplectic)으로 굴린다.

---

## 3. 최대 좌표 vs 축소 좌표 — 핵심 분기

같은 다체계를 두 방식으로 모델링할 수 있다:

**최대 좌표(maximal / full coordinates):**
- 모든 강체를 **독립 6DOF 자유체**로 두고, 관절은 **구속(constraint)**으로 사후에 묶는다.
- 좌표 수 = 6 × 강체 수 (구속 수만큼 잉여).
- 운동방정식은 Newton–Euler + 구속 솔버([../05-constraint-solving.md](../05-constraint-solving.md)). 구속력을 Lagrange 승수(λ)로 푼다.

**축소 좌표(reduced / minimal coordinates):**
- **독립 자유도만** 좌표로 (관절 각도 등). 구속이 좌표에 흡수돼 사라짐.
- 좌표 수 = 실제 DOF (관절 트리면 6 + 관절 수).
- 운동방정식은 Euler–Lagrange / Featherstone ABA([../06-joints-articulation.md](../06-joints-articulation.md)).

```
                최대 좌표(maximal)              축소 좌표(reduced)
좌표 수          많음(6×body, 잉여)             적음(실제 DOF)
구속             솔버가 반복적으로 강제          좌표에 내장(구속 위반 0)
구속 드리프트    있음(soft, 새어나감)            없음(hard, 정확)
솔버             impulse/PGS 반복([05])          ABA 등 O(n) 직접 풀이
유연성           충돌·끊어지는 관절 쉬움         토폴로지 고정(트리)
비용/스텝        싸나 반복·수렴 의존             관절당 비싸나 정확·안정
대표             Box2D·PhysX·Bullet 기본·ragdoll  PhysX articulation·로봇·차량
```

**왜 둘 다 존재하나:** 최대 좌표는 **유연**하다 — 임의 충돌, 끊어지는/추가되는 관절, 혼합 강체를 통일적으로 다룬다(게임 일반 강체의 표준). 축소 좌표는 **정확·안정**하다 — 구속이 절대 새지 않아 긴 관절 체인(로봇 팔, 차량 드라이브트레인)이 떨거나 늘어지지 않는다. 게임은 일반 객체에 최대 좌표, 정밀 관절체(articulation)에 축소 좌표를 **혼용**한다.

---

## 4. Hamiltonian — 심플렉틱으로의 다리

Lagrangian이 `(q, q̇)`로 2계 ODE를 준다면, Hamiltonian은 **일반화 운동량** `p`를 도입해 1계 ODE 짝으로 바꾼다:

```
일반화 운동량:  pᵢ = ∂L/∂q̇ᵢ
Hamiltonian:    H(q, p) = Σ pᵢq̇ᵢ − L = KE + PE   (보존계에서 = 총에너지)

Hamilton 정준방정식:
    q̇ᵢ =  ∂H/∂pᵢ
    ṗᵢ = −∂H/∂qᵢ
```

**왜 이게 중요한가 — 심플렉틱 구조:** `(q,p)`가 사는 위상공간(phase space)에는 심플렉틱 형식(symplectic form)이라는 면적 구조가 있고, Hamilton 흐름은 그 **면적을 보존**한다. 이것이 [../03-time-integration.md](../03-time-integration.md)의 symplectic 적분기·shadow Hamiltonian·에너지 유계성([07-energy.md](07-energy.md) §6)의 이론적 원천이다.

```
보존계  →  H = const(에너지 보존)  →  symplectic 적분기가 shadow H 보존
        →  장기 에너지 드리프트 없음(게임이 semi-implicit 쓰는 이유)
```

즉 "왜 semi-implicit Euler가 에너지를 보존하는가"의 깊은 답이 Hamiltonian의 심플렉틱 구조다. 동역학([02])에서 적분([03])으로 넘어가는 다리가 여기 놓인다.

**일반화 운동량과 보존 법칙(Noether 직관).** `pᵢ = ∂L/∂q̇ᵢ`는 데카르트 운동량([03-momentum-impulse.md](03-momentum-impulse.md))의 일반화다 — 병진 좌표면 선운동량, 각도 좌표면 각운동량이 자동으로 나온다. 그리고 `L`이 어떤 좌표 `qᵢ`에 명시적으로 의존하지 않으면(`∂L/∂qᵢ=0`, cyclic 좌표) Euler–Lagrange에서 `ṗᵢ=0` — 즉 그 짝 운동량이 **보존**된다(Noether 정리의 한 단면). 회전 대칭이면 각운동량 보존, 병진 대칭이면 선운동량 보존이 이 한 줄에서 떨어진다. 게임에서 직접 쓰진 않아도, 솔버가 운동량을 보존하는지 검증하는 이론적 기준이 된다([07-energy.md](07-energy.md)의 에너지 진단과 짝).

---

## 5. 게임 물리에서의 자리매김 — 알고리즘적 함의

Lagrangian/Hamiltonian은 게임 엔진이 **직접 풀지는 않는** 경우가 많다(일반 강체는 Newton–Euler + 충격량이 더 실용적). 하지만 두 곳에서 결정적이다:

**(1) 축소 좌표 관절체 → Featherstone/ABA.** Euler–Lagrange의 `M(q)q̈ + C = Q`를 트리 토폴로지에서 `O(n)`으로 푸는 게 Featherstone의 Articulated Body Algorithm([../06-joints-articulation.md](../06-joints-articulation.md)). 일반화 좌표·질량행렬·코리올리 항이 그대로 ABA의 재귀에 들어간다. 로봇 팔·차량·정밀 ragdoll이 이 경로.

```
ABA 개요(축소 좌표):
    q, q̇ 에서 KE·PE → M(q), C(q,q̇)
    외부→내부 재귀로 관절력 전파 → q̈ 직접 계산 (구속 잔차 0)
    적분: (q,q̇) ← symplectic step
```

`O(n)`이 핵심이다 — 최대 좌표가 구속 `n`개를 반복 솔버로 푸는 동안 누적 오차·수렴 문제를 안고 가는 반면, ABA는 트리 구조를 이용해 한 번의 전후방 재귀로 정확한 `q̈`를 뽑는다(구속 잔차 0). 그래서 50관절 로봇 팔도 떨지 않는다. 대가는 토폴로지가 트리로 고정되고(루프 관절은 별도 처리), 충돌·끊김 같은 동적 변화에 약하다는 점.

**(2) 심플렉틱 적분기 선택.** Hamiltonian 구조가 semi-implicit Euler·Verlet이 왜 안정·에너지 보존인지를 설명한다([07-energy.md](07-energy.md) §6, [../03-time-integration.md](../03-time-integration.md)). 게임은 이 이론을 *근거*로 symplectic류를 표준 채택.

**최대 좌표 솔버와의 관계:** Box2D·PhysX·Bullet의 기본 강체 솔버는 최대 좌표 + Lagrange 승수(λ = 구속력)다 — 본문 §3의 maximal 경로. Lagrangian의 구속·승수 형식론이 그 충격량 솔버([../05-constraint-solving.md](../05-constraint-solving.md))의 이론 배경.

**holonomic vs nonholonomic 구속(왜 차량이 까다로운가).** 구속에는 두 종류가 있다:
- **holonomic(완전):** 위치만의 관계 `f(q)=0`로 쓸 수 있는 구속 — 관절 길이 고정, 핀 조인트. 좌표에서 변수를 **제거**할 수 있어 축소 좌표로 깔끔히 흡수된다(§3).
- **nonholonomic(비완전):** 속도까지 얽혀 `f(q,q̇)=0`로만 쓰이고 적분해서 위치 관계로 못 줄이는 구속 — 미끄러지지 않는 바퀴의 "구르기 조건", 스케이트 날의 측면 비활주.

nonholonomic 구속은 자유도 수를 줄이지 못해(위치는 자유롭지만 속도 방향이 제한) 순수 축소 좌표로 다 흡수가 안 된다. 그래서 차량의 타이어 모델은 보통 **속도 수준 구속**(또는 마찰력 모델)으로 솔버에서 처리한다([../05-constraint-solving.md](../05-constraint-solving.md), [../10-specialized-systems.md](../10-specialized-systems.md))— Lagrangian 이론이 "왜 바퀴가 단순 관절처럼 안 풀리는가"를 설명해 주는 지점.

---

## 6. 실무

- **일반 강체 = 최대 좌표:** 게임 엔진 대다수(Box2D·PhysX·Bullet·Jolt·Chaos)는 일반 객체에 최대 좌표 + 충격량/PGS 솔버. 유연·통일적·충돌 친화(허브 §4, [../05-constraint-solving.md](../05-constraint-solving.md)).
- **정밀 관절체 = 축소 좌표:** PhysX articulation·로봇/차량 드라이브트레인은 축소 좌표 ABA — 구속이 안 새서 긴 체인이 안정([../06-joints-articulation.md](../06-joints-articulation.md)).
- **혼용이 정석:** 한 씬에서 일반 객체(maximal)와 articulation(reduced)을 섞어 쓴다. 둘 사이 결합은 구속으로.
- **심플렉틱 채택의 근거:** Hamiltonian 구조 때문에 semi-implicit/Verlet을 쓴다([07-energy.md](07-energy.md), [../03-time-integration.md](../03-time-integration.md)). RK4는 비-심플렉틱이라 장기 보존이 안 됨.
- **언제 Lagrangian을 손으로 푸나:** 특수 1-2 DOF 메커니즘(진자 시계, 특정 기믹)을 닫힌형으로 정확히 원할 때. 범용 솔버보다 정밀·싸다.
- **이론을 코드로 오해하지 마라:** 게임 엔진은 Euler–Lagrange를 기호 미분으로 직접 풀지 않는다 — Newton–Euler + 충격량(maximal) 또는 ABA 재귀(reduced)로 *수치적으로* 같은 결과를 낸다. Lagrangian은 그 솔버들이 왜 옳은지·언제 무엇을 고를지의 *지도*이지, 매 프레임 도는 코드가 아니다.
- **결정론:** 축소 vs 최대 좌표 선택, ABA 반복·연산 순서가 피어 간 동일해야 lockstep이 유지된다([../12-determinism-networking.md](../12-determinism-networking.md)). 두 좌표계를 섞을 때 결합 구속의 평가 순서까지 통일.

**좌표 선택 의사결정(빠른 가이드)**
```
구속이 거의 없는 자유 강체 다수, 충돌 많음     → 최대 좌표 (게임 일반 객체 기본)
관절이 끊어지거나 동적으로 추가/제거됨          → 최대 좌표 (토폴로지 가변)
긴 관절 체인(로봇 팔·차량 드라이브트레인)       → 축소 좌표 ABA (구속 안 샘)
체인이 떨리거나 늘어지는 게 보임                → 축소 좌표로 전환 검토
단순 1-2 DOF 정밀 기믹                          → Lagrangian 닫힌형 직접
```
혼용이 정답인 경우가 많다 — articulation(reduced)을 일반 강체(maximal) 세계에 구속으로 연결([../05-constraint-solving.md](../05-constraint-solving.md), [../06-joints-articulation.md](../06-joints-articulation.md)).

---

## 더 읽기 / 관련 노드

- **선행·자매** — [07-energy.md](07-energy.md): `L=KE−PE`, `H=KE+PE`의 재료와 심플렉틱·에너지 보존. [06-newton-euler.md](06-newton-euler.md): 벡터 역학 짝, 코리올리/자이로 항의 일반화. [04a-inertia-tensor-geometric.md](04a-inertia-tensor-geometric.md): 질량행렬 `M(q)`의 뿌리.
- **직접 후속(구체화)** — [../06-joints-articulation.md](../06-joints-articulation.md): 축소 좌표 → Featherstone/ABA 관절체, `O(n)` 트리 솔버. ragdoll·차량은 [../10-specialized-systems.md](../10-specialized-systems.md).
- **최대 좌표 솔버** — [../05-constraint-solving.md](../05-constraint-solving.md): Lagrange 승수 = 구속력, 충격량/PGS 반복.
- **적분(심플렉틱 다리)** — [../03-time-integration.md](../03-time-integration.md): Hamiltonian 흐름·면적 보존·shadow Hamiltonian·semi-implicit/Verlet.
- **선행** — [../00-foundations.md](../00-foundations.md): 변분·최소작용·행렬. [../01-kinematics.md](../01-kinematics.md): 좌표·자유도.

**외부 레퍼런스**
- David Baraff, "An Introduction to Physically Based Modeling" (SIGGRAPH course) — Lagrange 승수·구속 형식론.
- Roy Featherstone, *Rigid Body Dynamics Algorithms* — 축소 좌표 ABA의 표준 교재.
- Herbert Goldstein, *Classical Mechanics* — Lagrangian/Hamiltonian 역학의 고전.

> 한 줄 정리: Lagrangian은 에너지(`L=KE−PE`)에서 운동방정식을 뽑는 좌표 자유 역학이고, 핵심 분기는 최대 좌표(자유 6DOF + 구속, 유연하나 구속이 샘)와 축소 좌표(독립 DOF만, 정확하나 토폴로지 고정)다 — 축소 좌표는 Featherstone/ABA 관절체로, Hamiltonian의 심플렉틱 구조는 semi-implicit 적분기의 에너지 보존으로 이어진다.
