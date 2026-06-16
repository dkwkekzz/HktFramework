# [07·2.2] PBD / XPBD (Position-Based Dynamics) — 게임 주류

> 힘·가속도를 거치지 않고 **위치를 직접 보정(투영)** 하는 솔버. 안정·빠름·단순해 게임 변형체의 사실상 표준. XPBD 가 compliance 로 강성을 솔버 설정에서 분리한다.
> **상위 노드**: [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-time-integration.md](../03-time-integration.md) · [05-constraint-solving.md](../05-constraint-solving.md)

---

Müller 등(2007)의 PBD 는 **힘·가속도를 거치지 않고 위치를 직접 보정**한다. 발상의 전환: "스프링 힘으로 천천히 끌어당기는"([01-mass-spring](01-mass-spring.md)) 대신 "구속을 위반한 위치를 곧장 만족하는 위치로 **투영(projection)**" 한다. mass-spring 의 stiffness 폭발 문제 자체가 사라진다 — 위치를 직접 옮기므로 stiff ODE 를 적분할 필요가 없다. 안정적이고 빠르며 구현이 단순해 게임 변형체의 사실상 표준이 됐다.

**기본 루프(한 substep):**

```
for each particle i:
    v_i ← v_i + Δt * f_ext / m_i        # 외력으로 속도 예측
    p_i ← x_i + Δt * v_i                # 위치 예측(predicted position)

for iter in 1..N:                        # 구속 투영 반복(= 강성)
    for each constraint C:
        project(C, p)                    # p 를 C 만족하도록 보정

for each particle i:
    v_i ← (p_i - x_i) / Δt              # 위치 변화에서 속도 역산
    x_i ← p_i                            # commit
```

속도를 위치 변화에서 **역산**하는 것이 PBD 의 트릭이다 — 투영이 위치를 옮기면 속도는 자동으로 따라온다.

**거리 구속 (distance constraint)** — 스프링을 대체. 두 질점이 목표 거리 `d0` 를 유지하도록 위치를 투영한다. 역질량 `w = 1/m` 가중(고정점은 `w=0` 이라 안 움직임):

```
C(p_i, p_j) = |p_i - p_j| - d0
n = (p_i - p_j) / |p_i - p_j|

Δp_i = -(w_i / (w_i + w_j)) * C * n
Δp_j = +(w_j / (w_i + w_j)) * C * n
```

가벼운 질점이 더 많이 움직인다(역질량 가중). 고정점(`w=0`)은 전혀 안 움직이고 상대만 끌려온다.

**굽힘 구속 (bending constraint).** 인접한 두 삼각형이 이루는 **이면각(dihedral angle)** 을 목표각으로 유지하는 구속(4개 질점). 단순화로는 "양끝 질점 간 거리 구속"으로 굽힘을 흉내내기도 한다(저비용 근사).

**부피 보존 구속 (volume constraint).** soft body 의 핵심. tetrahedron 의 부피를

```
V = (1/6) * (p1 - p0)·((p2 - p0) × (p3 - p0))
C = V - V0
```

로 두고 4개 질점을 투영해 부피를 유지한다(체적이 줄지 않는 살·젤리 느낌). FEM 의 푸아송비 ν 가 하던 일을 위치 구속 하나로 흉내내는 셈([04-fem](04-fem.md)).

**PBD 의 본질적 문제: 강성이 반복 횟수와 timestep 에 의존.** 순수 PBD 는 구속을 매 반복 100% 만족시키므로, 반복을 많이 돌릴수록·timestep 이 작을수록 천이 더 빳빳해진다. 즉 **물리적 강성이 솔버 설정에 끌려다닌다** — 결정론과 튜닝의 적. 반복 수를 바꾸면 같은 천이 다른 단단함을 갖는다.

**XPBD (eXtended PBD, Macklin 2016).** 이 문제를 **compliance(유연도) α** 도입으로 해결한다. `α = 1/k`(강성의 역수, 단위 있는 물리량)와 라그랑주 승수 누적 `λ` 를 써서, 구속의 강성을 반복 횟수·timestep 과 **분리**한다. 거리 구속의 XPBD 갱신:

```
α̃ = α / Δt²                                   # timestep 정규화된 compliance
Δλ = (-C - α̃ * λ) / (w_i + w_j + α̃)           # 라그랑주 승수 증분
λ  += Δλ
Δp_i = +w_i * Δλ * n
Δp_j = -w_j * Δλ * n
```

`α → 0` 이면 순수 PBD(완전 강체 구속)로 수렴하고, `α > 0` 이면 일관된 **유한 강성**을 준다. 반복을 더 돌려도 강성이 안 바뀌고 *수렴만* 좋아진다.

> 📐 **심화**: "왜 `α=1/k` 인가 · 왜 `α̃=α/Δt²` 로 Δt² 가 나누어지는가 · `λ` 누적이 무엇을 기억하는가 · 순수 PBD 가 `α→0` 극한인 이유"를 라그랑주 승수와 에너지로 풀어낸 전용 문서 → [02a-xpbd-compliance.md](02a-xpbd-compliance.md).

XPBD 의 compliance 는 [05-constraint-solving.md](../05-constraint-solving.md) 의 soft constraint(TGS soft·constraint regularization)와 **같은 뿌리**이며, 변형체와 강체 구속을 하나의 솔버 프레임으로 통합하는 다리다. 그래서 모던 엔진(Jolt·Chaos)은 강체 조인트와 천 구속을 같은 XPBD 솔버로 푼다.

> **요약**: 반복 = 수렴(품질), compliance = 강성(물리). XPBD 가 둘을 떼어놓아 game-grade 변형체를 가능케 했다.

---

**관련 함정** (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트)):
- **PBD 강성의 설정 의존성**: 순수 PBD 는 반복·Δt 가 바뀌면 단단함이 바뀐다. 일관된 물성이 필요하면 **XPBD compliance**. 품질은 반복보다 **substepping** 으로(Macklin 권고).
- **구속 투영 순서 의존(Gauss–Seidel)**: 질점·구속 순회 순서가 다르면 결과가 갈린다 → 멀티플레이는 고정 순서·고정 반복·고정 substep([12](../12-determinism-networking.md)).

**다음**: [02a-xpbd-compliance](02a-xpbd-compliance.md) — compliance 의 정체를 라그랑주 승수로 푸는 심화. (또는 [03-cloth](03-cloth.md) 로.)
