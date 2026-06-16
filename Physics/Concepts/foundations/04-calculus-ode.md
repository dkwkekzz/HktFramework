# [00·2.4] 미적분 · ODE 기초 (Calculus & ODE)

> "물리 시뮬레이션 = 미분방정식의 수치적 풀이". 03([시간 적분](../03-time-integration.md))의 전체 프레임을 규정한다.
> **상위 노드**: [00-foundations.md](../00-foundations.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-vectors](01-vectors.md)

---

물리 시뮬레이션의 본질은 **미분방정식(differential equation)을 수치적으로 푸는 것**이다.

**도함수(derivative)** 는 변화율이다.

```
v(t) = dx/dt          // 속도 = 위치의 시간 미분
a(t) = dv/dt = d2x/dt2 // 가속도 = 속도의 미분 = 위치의 2차 미분
```

뉴턴 제2법칙 `F = m a` 는 **2계 ODE** 다.

```
m * d2x/dt2 = F(x, v, t)
```

**상태공간 표현(state-space form)**: 2계 ODE 를 1계 연립(coupled first-order) 으로 낮춘다. 적분기는 항상 1계 형태를 다룬다.

```
상태 y = (x, v)
dy/dt = f(y, t) = ( v ,  F(x, v, t) / m )
```

이 `dy/dt = f(y, t)` 가 03([시간 적분](../03-time-integration.md))이 다루는 표준형이다. 여기서 우리는 "주어진 현재 상태에서 `dt` 후 상태를 어떻게 추정할 것인가"를 묻게 된다.

**안정성(stability)** 개념(직관 수준만 — 적분기 상세는 03):
- 스프링-댐퍼 같은 시스템은 강성(stiffness)이 높으면 명시적(explicit) 적분이 발산(blow up)할 수 있다 — 이른바 **stiff ODE**.
- 안정성은 `dt` 와 시스템 고유진동수(eigenvalue)의 곱에 달려 있다. 너무 큰 `dt` 는 에너지를 증폭시켜 폭발한다.
- 그래서 게임 물리는 **고정 타임스텝(fixed timestep)** 과 서브스텝(substepping)을 선호한다. (자세한 음함수/반음함수 적분과 안정 영역은 [03](../03-time-integration.md).)

**적분의 직관 (테일러 전개, Taylor expansion)**: 모든 적분기의 출발점.

```
x(t + dt) = x(t) + dt * x'(t) + (dt^2/2) * x''(t) + O(dt^3)
```

- 1차 항만 쓰면 → 명시적 오일러(explicit Euler), 오차 `O(dt^2)`/스텝.
- 고차 항을 더 반영하면 → RK4 등 고차 정확도. (전부 03에서.)

---

**다음**: [05-numerical-floating-point](05-numerical-floating-point.md) — 위 적분을 실제 수행하는 부동소수점의 한계.
