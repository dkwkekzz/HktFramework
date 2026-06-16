# [06·2.5a] Featherstone / ABA — 심화 (Articulated Body Algorithm, from the ground up)

> "왜 축소 좌표는 드리프트가 없는가", "왜 순방향 동역학을 **O(n)** 으로 풀 수 있는가", "공간 대수(spatial algebra)의 3-패스가 *기계적으로* 무엇을 하는가"를 **근본부터** 푼다.
> **상위 노드**: [05-maximal-vs-reduced.md](05-maximal-vs-reduced.md) · [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-dynamics.md](../02-dynamics.md) · [05-constraint-solving.md](../05-constraint-solving.md)

---

## 0. 한 문장 요약

> **축소 좌표는 "관절각만 상태로 들기 때문에 분리 자체가 표현 불가능 → 드리프트 0"** 이고, **Featherstone 의 ABA 는 "자식 사슬 전체의 관성 효과를 부모가 보는 *유효 관성* 하나로 접어 올렸다가, 부모 가속도를 알면 다시 펼쳐 내려오는" 두 번의 사슬 훑기로 순방향 동역학을 반복 없이 O(n) 에 푼다.** 행렬을 통째로 역전(O(n³))하지 않고, 사슬 구조를 따라 국소적으로 접고 펴기 때문에 선형이다.

아래는 이 한 문장을 한 걸음씩 풀어가는 과정이다.

---

## 1. 문제 정의 — 순방향 동역학이란

관절체 동역학의 두 방향:

```
역동역학 (inverse):  q, q̇, q̈  →  τ      "이 가속을 내려면 토크 얼마?"   (RNEA, O(n))
순방향 (forward):     q, q̇, τ  →  q̈      "이 토크를 주면 어떻게 가속?"   (ABA,  O(n))
```

시뮬레이션이 매 스텝 풀어야 하는 건 **순방향** 이다 — 모터/중력 토크 `τ` 가 주어지고, 그 결과 관절가속도 `q̈` 를 구해 적분한다. 소박하게 풀면 관절공간 관성행렬 `H`(`n×n`)를 만들어

```
H(q) q̈ = τ − C(q, q̇)        // C = 원심·코리올리·중력 항
```

를 `q̈ = H⁻¹(τ − C)` 로 푼다. `H` 구축(CRBA)이 O(n²), 역전이 O(n³). ABA 는 같은 답을 **O(n)** 에 낸다 — 사슬이 길수록(긴 케이블, 다관절 로봇) 격차가 벌어진다.

---

## 2. 왜 드리프트가 0 인가 — 좌표가 곧 구속

maximal 좌표(→ [05-maximal-vs-reduced](05-maximal-vs-reduced.md))는 각 바디를 자유 6-DOF 로 두고 조인트를 *구속으로* 도로 묶는다. 매 반복 묶음이 새고, Baumgarte/soft 로 보정 → 드리프트가 남는다.

축소 좌표는 상태가 **관절각 `q` 그 자체** 다. 예를 들어 팔꿈치(hinge)의 상태는 "굽힘 각 하나"뿐 — 위팔과 아래팔이 *떨어진* 상태는 이 좌표로 **표현할 수 없다**.

> 핵심 직관: 분리(드리프트)가 *표현 불가능* 하면 분리 드리프트가 0 이다. "구속을 잘 푸는" 게 아니라 "구속을 어길 좌표가 없다." 이것이 reduced 가 긴 사슬·극단 질량비에서 본질적으로 강건한 이유다.

대가는 위상(topology) 변경 비용(사슬 재구성)과, 외부 접촉을 별도로 관절공간에 투영해야 한다는 점이다(§6).

---

## 3. 공간 대수(spatial algebra) — 6-벡터로 묶기

Featherstone 의 표기는 병진과 회전을 **하나의 6-벡터**로 묶는다(spatial vector). 이것이 식을 짧게 만드는 첫 트릭이다.

```
공간 속도   v = (ω, v_lin)        ∈ R⁶      // 각속도 + 선속도를 한 묶음
공간 가속   a = (ω̇, a_lin)        ∈ R⁶
공간 힘     f = (τ, f_lin)         ∈ R⁶      // 토크 + 힘
공간 관성   I  : 6×6 행렬                    // 질량·관성텐서·질량중심 오프셋을 한 행렬로
```

각 관절은 자신이 허용하는 운동 방향을 **motion subspace `S_i`** 로 갖는다 — hinge 면 축 하나(6×1), ball 이면 6×3. 관절속도가 만드는 링크 속도 기여가 `S_i q̇_i` 다. "남긴 DOF 의 방향"([02-joint-types](02-joint-types.md))이 여기선 `S_i` 의 열로 나타난다.

---

## 4. ABA — 3 패스의 기계적 의미

ABA 는 사슬을 **세 번 훑는다**: 밖으로(속도), 안으로(관성 접기), 다시 밖으로(가속).

```
# ABA — 3 패스 (Featherstone)
# 입력: 관절각 q, 관절속도 q̇, 관절토크 τ   → 출력: 관절가속도 q̈

1) Outward pass (base → leaf):
     각 링크의 spatial velocity v_i 를 부모로부터 전파
     원심/코리올리 항(velocity-product) c_i 계산

2) Backward pass (leaf → base):
     articulated body inertia  I^A_i  와 bias force  p^A_i 를
     자식으로부터 부모로 누적
     # 핵심: 자식 사슬 전체의 관성 효과를 부모가 보는 "유효 관성"으로 접음

3) Outward pass (base → leaf):
     base 가속도부터 시작해 각 관절가속도 q̈_i 계산
     a_i = a_parent 로부터 전파, q̈_i = (관절축 투영)
```

수식 골격(공간 대수 6-벡터):

```
v_i = v_{parent} + S_i q̇_i               // 공간 속도 전파, S_i = 관절 motion subspace (축)
I^A_i, p^A_i 누적:                         // articulated inertia / bias force
   U_i = I^A_i S_i ,  D_i = S_iᵀ U_i      // D_i = 관절공간 유효 질량 (scalar~m×m)
   u_i = τ_i − S_iᵀ p^A_i
   부모로 접기: I^A_parent += I_i − U_i D_i⁻¹ U_iᵀ   (자식 효과를 부모 관성에 흡수)
a_i = a_{parent} + S_i q̈_i ,  q̈_i = D_i⁻¹ (u_i − U_iᵀ a_{parent})
```

각 패스를 *직관*으로:

**패스 1 (밖으로, 속도)**: base 가 정한 속도에 관절속도를 더해 가며 말단까지 내려간다. 부모가 움직이면 자식도 따라 움직이니까. 부산물로 속도에서 오는 원심·코리올리 항 `c_i` 를 챙긴다.

**패스 2 (안으로, 관성 접기) — ABA 의 심장**: 말단부터 거꾸로 올라오며, *그 링크 아래 매달린 사슬 전체* 가 부모에게 어떤 관성으로 보이는지를 하나의 6×6 행렬 `I^A`("articulated body inertia")로 접는다. 핵심 줄이

```
I^A_parent += I_i − U_i D_i⁻¹ U_iᵀ
```

이고, 의미는 "자식이 *자기 관절축으로는 자유롭게 풀려* 있으니, 그 풀린 방향(`U_i D_i⁻¹ U_iᵀ`)만큼은 부모가 밀 때 저항하지 않는다 → 그만큼 빼고 나머지만 부모 관성에 더한다." 자유 관절은 부모에게 *부분적으로 투명* 한 것이다. 이 "접기"가 한 번에 끝나므로 행렬 역전이 필요 없다.

**패스 3 (밖으로, 가속)**: 이제 base 가속이 정해지면(외력·중력으로), 부모 가속이 정해질 때마다 자식 관절가속 `q̈_i = D_i⁻¹(u_i − U_iᵀ a_parent)` 를 *국소적으로* 계산하며 말단까지 펼쳐 내려간다. 패스 2 에서 이미 `D_i⁻¹`(관절공간 유효 질량의 역, 보통 scalar 나 작은 행렬)를 준비해 뒀기에 즉시 나온다.

> 왜 O(n) 인가: 세 패스 모두 링크를 *한 번씩* 만 방문하고, 링크당 작업이 관절 DOF 크기(보통 1~6)에만 의존하는 상수 비용이다. 전역 `n×n` 행렬을 만들거나 역전하지 않는다 — "큰 역전 한 번" 대신 "작은 접기 n 번". 이것이 CRBA+직접해법(O(n²)~O(n³))과 갈리는 지점이다.

---

## 5. 대안과의 자리매김 — ABA vs CRBA/RNEA

| 알고리즘 | 푸는 문제 | 비용 | 쓰임 |
|---|---|---|---|
| **RNEA** (Recursive Newton–Euler) | 역동역학 q,q̇,q̈→τ | O(n) | 필요 토크 계산, 중력 보상 |
| **CRBA** (Composite Rigid Body) | 관절공간 관성행렬 H 구축 | O(n²) | H 가 명시적으로 필요할 때 |
| **ABA** (Articulated Body) | 순방향 q,q̇,τ→q̈ | **O(n)** | **시뮬 매 스텝의 순방향 적분** |

셋은 한 묶음(Featherstone 정전)이다. 시뮬 루프의 주역은 ABA 이고, RNEA/CRBA 는 토크 계산·해석에 보조로 쓰인다. 사슬형(tree) 위상에서 ABA 가 가장 빠르고 자연스럽다.

---

## 6. 충돌·접촉과의 결합

articulation 은 그 자체로 *닫힌 해*(반복 없이 한 패스)를 준다. 하지만 외부 접촉이 생기면 그 접촉 임펄스를 **관절공간으로 투영** 해 함께 풀어야 한다 — 접촉은 maximal 세계의 부등식 구속이라 reduced 좌표가 직접 못 삼킨다.

실무 엔진의 두 길:
- ABA 가 제공하는 **유효 관성**(`I^A`, 또는 그로부터의 operational-space inertia)을 이용해, contact 를 articulation *위에서* PGS/TGS 로 반복.
- articulated body 와 rigid contact 를 **한 글로벌 솔버**에 섞어 동시에 푼다.

> 직관: reduced 가 "사슬 내부"는 공짜로 정확히 풀어 주지만, "사슬과 바깥세상의 접촉"은 여전히 05 식 반복 솔버의 일이다. 그래서 게임은 maximal+reduced 혼용이 자연스럽다(→ [05-maximal-vs-reduced](05-maximal-vs-reduced.md)).

---

## 7. 함정 (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트))

- **위상 변경 비용**: 런타임에 링크를 붙였다 떼면 사슬 재구성 비용. maximal 처럼 가볍지 않다.
- **접촉 투영 누락**: articulation 만 풀고 외부 contact 를 관절공간에 투영 안 하면, 사슬이 바닥을 뚫거나 접촉에 반응 안 함.
- **stabilization**: 축소 좌표라도 수치 적분 오차로 사슬이 미세하게 늘 수 있어, 위치 보정/projection 을 추가하는 구현도 있다.
- **결정론**: 사슬 순회 순서·`D_i⁻¹` 계산·spatial 연산 순서를 모든 머신에서 동일하게. reduced/maximal 혼용 시 두 부동소수점 경로 관리 포인트가 는다([12](../12-determinism-networking.md)).

---

## 8. 더 읽기

- [05-maximal-vs-reduced](05-maximal-vs-reduced.md) — 두 좌표 패러다임 비교(이 문서의 상위 절).
- [02-dynamics](../02-dynamics.md) — 질량/관성텐서·토크(spatial inertia 의 뿌리).
- [03-time-integration](../03-time-integration.md) — `q̈` 를 적분하는 substep·고정 timestep.
- Featherstone, *Rigid Body Dynamics Algorithms* (2008) — ABA/CRBA/RNEA 의 정전, spatial algebra 표준.
- Bullet `btMultiBody` 소스, NVIDIA PhysX `PxArticulationReducedCoordinate` 문서 — 실제 게임 엔진 구현.
- Mirtich, *Impulse-based Dynamic Simulation* — 대비되는 maximal 임펄스 관점.
