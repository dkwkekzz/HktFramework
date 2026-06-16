# [07·2.1] Mass-spring 시스템 (Mass-Spring Systems)

> 변형체를 질점(mass point)들의 격자로 보고 스프링(spring)으로 잇는 가장 직관적인 모델 — 그리고 그 스프링이 빳빳해질수록 explicit 적분이 폭발하는 이유.
> **상위 노드**: [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-dynamics.md](../02-dynamics.md) · [03-time-integration.md](../03-time-integration.md)

---

가장 직관적인 변형체 모델. 변형체를 **질점(mass point)** 들의 격자로 보고, 질점들을 **스프링(spring)** 으로 잇는다. 천의 한 패치를 사각 격자로 깔면 세 종류의 스프링이 필요하다:

```
구조 스프링 (structural)  : 가로/세로 이웃 — 늘어남(stretch) 저항
전단 스프링 (shear)       : 대각선 이웃   — 기울어짐(shear) 저항
굽힘 스프링 (bend)        : 한 칸 건너뛴 이웃 — 접힘(bending) 저항

  o──o──o          o──o──o
  │╲ │ ╱│          │  │  │   ← 구조: 인접 변
  o──o──o    +     │╲ │ ╱│   ← 전단: 대각
  │╱ │ ╲│                    ← 굽힘: 2칸 떨어진 질점 연결(그림 생략)
  o──o──o
```

세 종류가 각각 다른 변형 모드(stretch·shear·bend)를 막는다. 구조 스프링만 있으면 천이 대각으로 무너지고(전단 무방비), 전단까지 있어도 종이처럼 마음대로 접힌다(굽힘 무방비).

**힘 — Hooke 법칙 + 감쇠(damping).** 각 스프링은 질점 i, j 사이에서 변형량에 비례하는 복원력을 낸다(자연길이 `L0`, 강성 `k_s`, 감쇠 `k_d`):

```
x_ij = x_i - x_j
d    = |x_ij|
n    = x_ij / d                       (단위 방향)

F_spring = -k_s * (d - L0) * n        (Hooke: 변형량에 비례)
F_damp   = -k_d * ((v_i - v_j)·n) * n (상대속도의 스프링축 성분만 감쇠)

F_i += F_spring + F_damp
F_j -= F_spring + F_damp              (작용-반작용)
```

감쇠를 **스프링축 성분만** 거는 것에 주목 — 축에 수직인 상대운동(회전)까지 죽이면 천이 부자연스럽게 뻣뻣해진다.

**explicit 적분의 강성 폭발 (stiffness explosion).** 천은 거의 안 늘어나려 하므로 `k_s` 가 매우 커야 한다. 그런데 mass-spring 의 운동방정식은 **stiff ODE** 이고, explicit Euler/symplectic Euler 로 풀면 안정 조건이 대략

```
Δt < 2 * sqrt(m / k_s)      (스프링 1개 임계 timestep, 감쇠 무시)
```

즉 `k_s` 를 키울수록 허용 `Δt` 가 `1/sqrt(k_s)` 로 작아진다. 빳빳한 천을 explicit 으로 풀려면 timestep 을 비현실적으로 잘게 쪼개야 하고, 조금만 넘으면 **에너지가 발산해 천이 폭발**한다([03-time-integration.md](../03-time-integration.md) 의 안정성/에너지 드리프트 참조). 이것이 변형체에서 implicit 적분이 등장하는 핵심 이유이자, 게임이 결국 PBD/XPBD 로 넘어간 출발점이다.

**implicit Euler (Baraff–Witkin).** Baraff & Witkin 의 고전 *Large Steps in Cloth Simulation*(1998) 은 backward Euler 를 써서 강성과 무관하게 큰 timestep 을 안정적으로 쓴다. 다음 스텝 속도 `v^{n+1}` 에 대해 암묵적으로 풀어야 하므로 선형 시스템이 나온다:

```
(M - Δt * ∂F/∂v - Δt² * ∂F/∂x) Δv = Δt * (F + Δt * (∂F/∂x) v)
        └────────── 시스템 행렬 A ──────────┘   └──── 우변 b ────┘
```

여기서 `∂F/∂x`(강성 행렬, stiffness/force Jacobian), `∂F/∂v`(감쇠 Jacobian)가 필요하다. A 는 크고 sparse·SPD 에 가까워 **conjugate gradient(CG)** 로 푼다([05-constraint-solving.md](../05-constraint-solving.md) 의 선형계 풀이와 같은 도구). 안정적이지만 Jacobian 조립과 CG 반복 비용이 크고, 수치 감쇠로 천이 과도하게 죽어 보일 수 있다. 게임이 이 경로 대신 PBD 로 옮겨간 이유가 여기 있다.

---

**관련 함정** (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트)):
- **explicit mass-spring 폭발**: 빳빳한 천 + 큰 Δt = 발산. implicit 으로 가거나 PBD/XPBD 로 갈 것([03](../03-time-integration.md)).
- **감쇠 방향**: 상대속도 전체가 아니라 **스프링축 성분만** 감쇠 — 전체를 죽이면 회전까지 죽어 부자연스럽다.

**다음**: [02-pbd-xpbd](02-pbd-xpbd.md) — 힘 대신 위치를 직접 보정하는 게임 주류 솔버.
