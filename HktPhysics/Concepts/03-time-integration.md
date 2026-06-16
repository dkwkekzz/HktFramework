# [03] 시간 적분 (Time Integration) — 허브

> 동역학이 만든 운동방정식(ODE)을 한 스텝씩 시간 전진시키는 분기 — 안정성·에너지·결정론이 여기서 갈린다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [03-time-integration/](03-time-integration/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [02-dynamics.md](02-dynamics.md)

---

## 1. 위치와 역할

물리 한 프레임의 파이프라인에서 적분(integration)은 **힘 적용 직후, 충돌 감지 직전**에 위치한다.

```
forces 적용 → [03] 적분 → [04] 충돌 감지 → [05] 구속 해법 → 상태 commit
```

[02-dynamics.md](02-dynamics.md) 가 "지금 이 순간 가속도가 얼마인가"(`a = F/m`, `α = I⁻¹(τ − ω×Iω)`)를 준다면, 적분은 그 순간값을 받아 **유한한 시간 간격 dt 만큼 상태를 앞으로 굴린다**. 즉 적분기는 연속 미분방정식을 이산(discrete) 스텝으로 근사하는 *수치 적분(numerical ODE solver)* 이다([03-time-integration/01](03-time-integration/01-ode-state-space.md)).

이 분기가 게임 물리에서 유난히 중요한 이유:

- **안정성의 1차 결정자** — 같은 힘이라도 적분기 선택에 따라 시뮬레이션이 멀쩡히 돌거나 폭발(explosion)한다.
- **에너지 거동의 결정자** — 적분기에 따라 진자가 영원히 흔들리거나, 점점 빨라지거나, 점점 죽는다.
- **결정론의 토대** — 고정 timestep([12-determinism-networking.md](12-determinism-networking.md))은 사실상 적분 분기의 설계 선택이며, 렌더 보간([01-kinematics.md](01-kinematics.md))과 직결된다.
- **하위 솔버의 전제** — 변형체([07-deformable-bodies.md](07-deformable-bodies.md))·유체([08-fluids.md](08-fluids.md))·파티클([09-particles.md](09-particles.md))은 모두 적분기 위에 얹힌다. cloth/soft body 는 특히 *implicit* 적분을 요구한다.

---

## 2. 하위 문서 인덱스 (세부 이론)

적분 이론은 직관 단위로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [03-time-integration/01-ode-state-space.md](03-time-integration/01-ode-state-space.md) | ODE 로서의 시뮬레이션 | 2계→1계·상태공간·`y'=f(y,t)` |
| 2.2 | [03-time-integration/02-taxonomy.md](03-time-integration/02-taxonomy.md) | 적분기 분류 | explicit↔implicit·single/multi-step |
| 2.3 | [03-time-integration/03-euler-family.md](03-time-integration/03-euler-family.md) | Euler 삼형제 | forward·semi-implicit(symplectic)·backward |
| 2.3a | [03-time-integration/03a-symplectic-energy.md](03-time-integration/03a-symplectic-energy.md) | 심플렉틱은 왜 에너지를 보존하나 | 면적 보존·shadow Hamiltonian·유계 진동 |
| 2.4 | [03-time-integration/04-verlet.md](03-time-integration/04-verlet.md) | Verlet 적분 | position/velocity Verlet·PBD 궁합 |
| 2.5 | [03-time-integration/05-runge-kutta.md](03-time-integration/05-runge-kutta.md) | Runge–Kutta | RK2·RK4·매끄러운 힘장 전용 |
| 2.6 | [03-time-integration/06-rotation-integration.md](03-time-integration/06-rotation-integration.md) | 회전(사원수) 적분 | `q̇=½ω⊗q`·재정규화·gyroscopic |
| 2.7 | [03-time-integration/07-stability-energy.md](03-time-integration/07-stability-energy.md) | 안정성·드리프트·폭발 | stiffness·CFL·energy drift·NaN |
| 2.8 | [03-time-integration/08-fixed-timestep-loop.md](03-time-integration/08-fixed-timestep-loop.md) | 고정 timestep 루프 | accumulator·substep·렌더 보간 |

---

## 3. 한눈 요약 — 적분기 선택 매트릭스

적분기별 트레이드오프를 한 표로 모았다. 상세는 각 하위 문서.

| 적분기 | 정확도 | 안정성 | 에너지 | 비용 | 주 용도 |
|---|---|---|---|---|---|
| Forward Euler | 1차 | 조건부(나쁨) | 주입→폭발 | 최저 | (쓰지 말 것) |
| **Semi-implicit Euler** | 1차 | 조건부(양호) | 유계 진동 | 최저 | **강체 메인 루프 표준** |
| Position Verlet | 2차 | 조건부 | 유계 | 낮음 | cloth/rope/입자 + 위치 제약 |
| Velocity Verlet | 2차 | 조건부 | 유계 | 낮음 | 입자/분자, 정밀 입자계 |
| RK4 | 4차 | 조건부 | 천천히 손실 | 높음(×4) | 충돌 없는 매끄러운 힘장 |
| **Backward Euler** | 1차 | **무조건** | 과감쇠 | 높음(선형계) | **cloth/soft/stiff 계** |

**에너지 거동의 핵심 직관**: explicit Euler = 주입(폭발), backward Euler = 손실(과감쇠), symplectic/Verlet = 유계 진동(이상적). *왜* symplectic 만 드리프트가 없는가는 [2.3a](03-time-integration/03a-symplectic-energy.md) 에서 면적 보존·shadow Hamiltonian 으로 끝까지 푼다.

**무엇이 dt 를 묶는가**: explicit 의 최대 안정 dt 는 계의 *가장 빳빳한 요소*가 결정한다(`dt < 2·sqrt(m/k)`, CFL 의 일반화). 한 군데만 stiff 해도 전체가 묶인다 ([2.7](03-time-integration/07-stability-energy.md)).

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 강체 적분 | 특화 적분 | 비고 |
|---|---|---|---|
| **Box2D** | semi-implicit Euler | — | 속도 적분 → sequential impulse → 위치 적분. TGS soft 로 위치 단계 보강. |
| **Bullet** | semi-implicit Euler | soft body는 별도 솔버 | `btDiscreteDynamicsWorld` 가 고정 internal dt(기본 1/60) + accumulator + maxSubSteps 내장. |
| **PhysX (NVIDIA)** | semi-implicit Euler | gyroscopic 항 implicit 처리, cloth/soft 별도 GPU 솔버 | substepping·고정 dt 권장. TGS solver 가 위치 단계 안정화. |
| **Havok** | semi-implicit Euler | — | 결정론 옵션 시 고정 dt·연산 순서 고정 강제. |
| **Jolt** | semi-implicit Euler | — | 고정 dt·고정 연산 순서로 강한 결정론. substep/collision step 분리 노출. |
| **Chaos (UE5)** | semi-implicit Euler | Chaos Cloth/소프트는 XPBD(위치 기반) | 고정 substep dt(`p.Chaos.Solver.*` CVar), async physics tick 으로 렌더 보간. |

공통 패턴 요약:

1. **강체 메인 루프 = semi-implicit Euler** — 예외 없이. 차이는 적분기가 아니라 *구속 솔버*([05-constraint-solving.md](05-constraint-solving.md))에서 난다. (왜 이 선택인지는 [2.3 §(b)](03-time-integration/03-euler-family.md), 깊은 까닭은 [2.3a](03-time-integration/03a-symplectic-energy.md).)
2. **고정 internal timestep + accumulator + maxSubSteps** 가 엔진 내부에 내장돼 있다([2.8](03-time-integration/08-fixed-timestep-loop.md)) — 사용자가 가변 프레임시간을 넣어도 엔진이 고정 dt 로 쪼갠다.
3. **cloth/soft body 는 implicit 또는 PBD/XPBD** 로 갈라진다([2.3 §(c)](03-time-integration/03-euler-family.md)) — 강체와 다른 적분 철학.
4. 렌더 보간/async tick 으로 물리-렌더 주파수 분리([2.8](03-time-integration/08-fixed-timestep-loop.md)).

> HktFramework 관점: 결정론([12-determinism-networking.md](12-determinism-networking.md))이 전제이므로 **고정 dt + 고정 연산 순서 + semi-implicit Euler** 를 기준선으로 잡고, 시뮬레이션 상수(FIXED_DT, substep 수)는 CVar 가 아니라 헤더 상수로 못 박는 편이 안전하다(루트 CLAUDE.md 의 "결정론에 영향을 주는 값은 헤더 상수로 고정" 원칙과 합치).

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **가변 dt 를 적분에 직접 넣지 말 것** — 결정론·안정성을 동시에 깬다. 항상 accumulator 로 고정 dt 화. ([03-time-integration/08](03-time-integration/08-fixed-timestep-loop.md))
- **forward Euler 의 위치 갱신에 옛 속도를 쓰는 것** — semi-implicit 와 단 한 줄 차이지만 결과는 폭발 vs 안정. 코드 리뷰에서 가장 흔한 미세 버그. ([03-time-integration/03](03-time-integration/03-euler-family.md))
- **MAX_FRAME_TIME 클램프 누락** — spiral of death 의 직접 원인. 디버거에 멈췄다 재개하면 거대한 frameTime 이 들어와 즉시 폭발. ([03-time-integration/08](03-time-integration/08-fixed-timestep-loop.md))
- **quaternion 재정규화 누락** — 자세가 서서히 찌그러진다. 그리고 재정규화 *연산 순서*를 고정하지 않으면 결정론 깨짐. ([03-time-integration/06](03-time-integration/06-rotation-integration.md))
- **자이로스코픽 항을 explicit 으로** — 비대칭 관성텐서 자유 회전에서 에너지 발산. 그 항만 implicit 으로 분리. ([03-time-integration/06](03-time-integration/06-rotation-integration.md))
- **부동소수점 결정론**: 같은 적분식이라도 연산 순서/컴파일러/FMA/SIMD 가 다르면 비트 단위 결과가 갈린다. 크로스플랫폼 lockstep 은 연산 순서 고정 + (필요시) fixed-point 까지 가야 한다([12-determinism-networking.md](12-determinism-networking.md) · [00-foundations.md](00-foundations.md)).
- **substep 수를 결정론 변수로 노출하지 말 것** — substep 수가 바뀌면 결과가 바뀐다. 멀티플레이에선 고정. ([03-time-integration/08](03-time-integration/08-fixed-timestep-loop.md))
- **stiff 요소 하나가 전체 dt 를 묶음** — explicit 으로 빳빳한 천/제약을 섞으면 한 군데 때문에 전부 폭발. 그 부분만 implicit/PBD 로 분리하라. ([03-time-integration/07](03-time-integration/07-stability-energy.md))
- **RK4 를 충돌 루프에 넣는 실수** — 중간점 힘 평가가 불연속 충돌력에서 오차를 키운다. 매끄러운 힘장 전용으로만. ([03-time-integration/05](03-time-integration/05-runge-kutta.md))
- **Verlet 에 가변 dt** — position Verlet 식이 dt 일정을 가정. 가변 dt 면 부정확. ([03-time-integration/04](03-time-integration/04-verlet.md))
- **렌더 보간 생략 / 시뮬 상태를 보간값으로 덮어씀** — 전자는 judder, 후자는 결정론 파괴. 보간은 렌더 전용 사본으로만. ([03-time-integration/08](03-time-integration/08-fixed-timestep-loop.md))

---

## 6. 더 읽기 / 관련 노드

- **선행** — [02-dynamics.md](02-dynamics.md)(적분할 `a = F/m`, `α` 의 출처) · [01-kinematics.md](01-kinematics.md)(상태 표현·회전·렌더 보간) · [00-foundations.md](00-foundations.md)(부동소수점·수치 안정성·quaternion)
- **후행/이용** — [05-constraint-solving.md](05-constraint-solving.md)(속도 적분과 한 흐름인 impulse 솔버, PBD/XPBD) · [07-deformable-bodies.md](07-deformable-bodies.md)(implicit Euler·cloth) · [08-fluids.md](08-fluids.md)(CFL·grid 적분) · [09-particles.md](09-particles.md)(대량 입자 적분)
- **횡단** — [12-determinism-networking.md](12-determinism-networking.md)(고정 dt·연산 순서·fixed-point) · [13-performance-parallelism.md](13-performance-parallelism.md)(sleeping/island 으로 적분 생략, SIMD 일괄 적분)
- **외부 레퍼런스** — Glenn Fiedler "Fix Your Timestep!" · Baraff & Witkin "Large Steps in Cloth Simulation"(1998, implicit cloth) · Jakobsen "Advanced Character Physics"(2001, Verlet+제약) · Hairer et al. *Geometric Numerical Integration*(symplectic 이론)
