# [03·2.1] ODE 로서의 시뮬레이션 · 상태공간 (Simulation as an ODE · State-Space)

> 물리 시뮬레이션 = 미분방정식 `y' = f(y,t)` 의 수치적 풀이. 2계 뉴턴 법칙을 1계 연립으로 낮춰 모든 적분기를 하나의 솔버로 통일한다.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-dynamics.md](../02-dynamics.md) · [00-foundations/04-calculus-ode](../00-foundations/04-calculus-ode.md)

---

[02-dynamics.md](../02-dynamics.md) 가 "지금 이 순간 가속도가 얼마인가"(`a = F/m`, `α = I⁻¹(τ − ω×Iω)`)를 준다면, 적분(integration)은 그 순간값을 받아 **유한한 시간 간격 dt 만큼 상태를 앞으로 굴린다**. 적분기는 연속 미분방정식을 이산(discrete) 스텝으로 근사하는 *수치 적분(numerical ODE solver)* 이다.

**뉴턴 제2법칙은 2계 ODE 다.**

```
m x''(t) = F(x, x', t)
```

수치 적분기는 보통 2계를 1계 연립으로 낮춘 **상태공간(state-space)** 형태를 다룬다. 상태 벡터를 `y = [x, v]` 로 잡으면:

```
d/dt [ x ]   =  [   v        ]
     [ v ]      [ F(x,v,t)/m ]

요약:  y' = f(y, t)
```

이렇게 두면 모든 적분기는 "`y' = f(y,t)` 를 푸는 일반 솔버"로 통일된다 — Euler 든 Verlet 이든 RK4 든, 차이는 "`f` 를 어디서 몇 번 평가해 한 스텝을 만드는가"뿐이다.

3D 강체라면 상태에 자세(quaternion `q`)와 각속도 `ω` 가 추가된다. 회전은 좌표별 스칼라 적분이 통하지 않아 특수하게 다뤄야 한다 — [06-rotation-integration](06-rotation-integration.md).

**한 스텝의 목표**: 현재 상태 `y_n`(시각 `t_n`)에서 한 스텝 `dt` 뒤 `y_{n+1}`(시각 `t_n + dt`)를 구하는 것. 이 한 스텝을 어떻게 짜느냐가 시뮬레이션의 안정성·에너지·결정론을 전부 결정한다.

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **가변 dt 를 적분에 직접 넣지 말 것** — `f` 평가는 같아도 dt 가 흔들리면 결정론·안정성이 깨진다. 항상 고정 dt 로 굴린다([08-fixed-timestep-loop](08-fixed-timestep-loop.md)).

**다음**: [02-taxonomy](02-taxonomy.md) — 한 스텝을 만드는 방식들의 분류(explicit ↔ implicit).
