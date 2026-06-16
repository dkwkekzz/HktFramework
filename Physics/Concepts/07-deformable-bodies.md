# [07] 변형체 (Deformable Bodies)

> 강체(rigid body)와 달리 **형상이 변하는** 물체 — 천(cloth)·소프트바디(soft body)·연속체(continuum) — 를 질점·구속·연속체역학으로 시뮬레이션하는 분기. 게임에서는 정확도보다 **안정·저비용**이 지배해 PBD/XPBD 가 주류다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [03-time-integration.md](03-time-integration.md) · [05-constraint-solving.md](05-constraint-solving.md)

---

## 1. 위치와 역할

변형체는 [03] 적분 루프 위에 얹히는 **특화 솔버**다. 한 프레임의 물리 스텝(`forces → [03] 적분 → [04] 충돌 → [05] 구속 → commit`)에서, 변형체는 강체와 같은 6-DOF 한 덩어리가 아니라 **수백~수천 개의 질점(particle)** 을 가진 입자 집합으로 취급된다. 각 질점은 [02] 동역학의 뉴턴 법칙을 따르고, 질점 사이의 관계(형상 유지)는 [05] 구속 해법 — 특히 **Position-Based Dynamics(PBD)/XPBD** — 로 풀린다.

핵심 분기는 세 갈래다:

| 모델 | 표현 | 정확도 | 비용 | 게임 사용 |
|---|---|---|---|---|
| **Mass-spring** | 질점 + 스프링 망 | 낮음(스프링 강성에 의존) | 낮음 | 고전 cloth, 교육용 |
| **PBD / XPBD** | 질점 + 위치 구속 | 중(compliance 로 튜닝) | 낮음 | **게임 주류** (cloth·soft) |
| **FEM** | 연속체 + tetra/triangle mesh | 높음(물성 직접 모델) | 높음 | 오프라인·고품질, GPU soft |

게임 물리에서 "변형체 = 거의 cloth + PBD soft body" 라고 봐도 무방하다. FEM 은 영화/CAD/일부 GPU 데모의 영역이고, 실시간 게임 본편 루프에는 드물다.

---

## 2. 핵심 이론

### 2.1 Mass-spring 시스템

가장 직관적인 모델. 변형체를 **질점(mass point)** 들의 격자로 보고, 질점들을 **스프링(spring)** 으로 잇는다. 천의 한 패치를 사각 격자로 깔면 세 종류의 스프링이 필요하다:

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

각 스프링은 **Hooke 법칙 + 감쇠(damping)** 로 힘을 낸다. 질점 i, j 사이 스프링(자연길이 `L0`, 강성 `k_s`, 감쇠 `k_d`):

```
x_ij = x_i - x_j
d    = |x_ij|
n    = x_ij / d                       (단위 방향)

F_spring = -k_s * (d - L0) * n        (Hooke: 변형량에 비례)
F_damp   = -k_d * ((v_i - v_j)·n) * n (상대속도의 스프링축 성분만 감쇠)

F_i += F_spring + F_damp
F_j -= F_spring + F_damp              (작용-반작용)
```

**explicit 적분의 강성 폭발 (stiffness explosion).** 천은 거의 안 늘어나려 하므로 `k_s` 가 매우 커야 한다. 그런데 mass-spring 의 운동방정식은 stiff ODE 이고, explicit Euler/symplectic Euler 로 풀면 안정 조건이 대략

```
Δt < 2 * sqrt(m / k_s)      (스프링 1개 임계 timestep, 감쇠 무시)
```

즉 `k_s` 를 키울수록 허용 `Δt` 가 `1/sqrt(k_s)` 로 작아진다. 빳빳한 천을 explicit 으로 풀려면 timestep 을 비현실적으로 잘게 쪼개야 하고, 조금만 넘으면 **에너지가 발산해 천이 폭발**한다(03 의 안정성/에너지 드리프트 참조). 이것이 변형체에서 [03-time-integration.md](03-time-integration.md) 의 **implicit Euler** 가 등장하는 핵심 이유다.

**implicit Euler (Baraff–Witkin).** Baraff & Witkin 의 고전 "Large Steps in Cloth Simulation"(1998) 은 backward Euler 를 써서 강성과 무관하게 큰 timestep 을 안정적으로 쓴다. 다음 스텝 속도 `v^{n+1}` 에 대해 암묵적으로 풀어야 하므로 선형 시스템이 나온다:

```
(M - Δt * ∂F/∂v - Δt² * ∂F/∂x) Δv = Δt * (F + Δt * (∂F/∂x) v)
        └────────── 시스템 행렬 A ──────────┘   └──── 우변 b ────┘
```

여기서 `∂F/∂x`(강성 행렬, stiffness/force Jacobian), `∂F/∂v`(감쇠 Jacobian)가 필요하다. A 는 크고 sparse·SPD 에 가까워 **conjugate gradient(CG)** 로 푼다. 안정적이지만 Jacobian 조립과 CG 반복 비용이 크고, 수치 감쇠로 천이 과도하게 죽어 보일 수 있다. 게임이 이 경로 대신 PBD 로 옮겨간 이유가 여기 있다.

### 2.2 Position-Based Dynamics (PBD) / XPBD — 게임 주류

Müller 등(2007)의 PBD 는 **힘·가속도를 거치지 않고 위치를 직접 보정**한다. 발상의 전환: "스프링 힘으로 천천히 끌어당기는" 대신 "구속을 위반한 위치를 곧장 만족하는 위치로 투영(projection)" 한다. 안정적이고 빠르며 구현이 단순해 게임 변형체의 사실상 표준이 됐다.

기본 루프(한 substep):

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

**거리 구속 (distance constraint)** — 스프링을 대체. 두 질점이 목표 거리 `d0` 를 유지하도록 위치를 투영. 역질량 `w = 1/m` 가중(고정점은 `w=0`):

```
C(p_i, p_j) = |p_i - p_j| - d0
n = (p_i - p_j) / |p_i - p_j|

Δp_i = -(w_i / (w_i + w_j)) * C * n
Δp_j = +(w_j / (w_i + w_j)) * C * n
```

**굽힘 구속 (bending constraint).** 인접한 두 삼각형이 이루는 **이면각(dihedral angle)** 을 목표각으로 유지하는 구속(4개 질점). 단순화로는 "양끝 질점 간 거리 구속"으로 굽힘을 흉내내기도 한다.

**부피 보존 구속 (volume constraint).** soft body 의 핵심. tetrahedron 의 부피를

```
V = (1/6) * (p1 - p0)·((p2 - p0) × (p3 - p0))
C = V - V0
```

로 두고 4개 질점을 투영해 부피를 유지한다(체적이 줄지 않는 살·젤리 느낌).

**PBD 의 본질적 문제: 강성이 반복 횟수와 timestep 에 의존.** 순수 PBD 는 구속을 매 반복 100% 만족시키므로, 반복을 많이 돌릴수록·timestep 이 작을수록 천이 더 빳빳해진다. 즉 **물리적 강성이 솔버 설정에 끌려다닌다** — 결정론과 튜닝의 적.

**XPBD (eXtended PBD, Macklin 2016).** 이 문제를 **compliance(유연도) α** 도입으로 해결한다. `α = 1/k`(강성의 역수, 단위 있는 물리량)와 라그랑주 승수 누적 `λ` 를 써서, 구속의 강성을 반복 횟수·timestep 과 **분리**한다. 거리 구속의 XPBD 갱신:

```
α̃ = α / Δt²                                   # timestep 정규화된 compliance
Δλ = (-C - α̃ * λ) / (w_i + w_j + α̃)           # 라그랑주 승수 증분
λ  += Δλ
Δp_i = +w_i * Δλ * n
Δp_j = -w_j * Δλ * n
```

`α → 0` 이면 순수 PBD(완전 강체 구속)로 수렴하고, `α > 0` 이면 일관된 **유한 강성**을 준다. XPBD 의 compliance 는 [05-constraint-solving.md](05-constraint-solving.md) 의 soft constraint(TGS soft·constraint regularization)와 같은 뿌리이며, 변형체와 강체 구속을 **하나의 솔버 프레임**으로 통합하는 다리다.

> **요약**: 반복 = 수렴(품질), compliance = 강성(물리). XPBD 가 둘을 떼어놓아 game-grade 변형체를 가능케 했다.

### 2.3 Cloth 특화 주제

천은 별도 난제가 많다.

**자기 충돌 (self-collision).** 천이 자기 자신을 통과하지 않게 해야 한다(접힌 옷자락). 모든 질점쌍을 보는 건 O(n²) 이라 [11] 공간 가속 구조(공간 해시·BVH)로 broad phase 를 깔고, 가까운 삼각형-점/삼각형-삼각형 쌍에만 척력 구속이나 충돌 응답을 건다. CCD([04])를 섞어 빠른 천의 터널링을 막는다. 게임에서 가장 비싸고 자주 끄는 기능.

**충돌체와의 충돌.** 캐릭터 몸(보통 capsule/sphere 근사 콜라이더)에 천을 얹는다. 질점이 콜라이더에 파고들면 표면 밖으로 위치 투영 + 마찰. UE Chaos Cloth 등은 스켈레탈 메시에 **collider primitive(capsule/sphere/convex)** 를 본에 붙여 근사한다.

**바람/공력 (wind / aerodynamics).** 삼각형 면적과 법선, 상대 풍속으로 항력·양력을 면에 가한다:

```
v_rel = v_wind - v_tri              # 천 면 기준 상대 풍속
F_aero = ρ * A * (Cd*(v_rel·n)*n + Cl*(...))   # 항력 Cd + 양력 Cl, n=면 법선
```

펄럭임(flag flutter)은 양력 항과 약한 감쇠에서 나온다.

**LRA / tether (long-range attachment).** PBD 천은 반복이 부족하면 **무한정 늘어나(over-stretch)** 캐릭터에서 천이 줄줄 흘러내린다. LRA 는 각 질점에 "고정점(attachment)으로부터의 최대 허용 거리"를 단방향 구속으로 걸어, 멀어지면 끌어당기되 가까우면 자유롭게 둔다. 적은 반복으로도 신축을 잡는 값싼 트릭 — Chaos·NvCloth 모두 채택.

```
if |p_i - p_anchor| > maxDist:
    p_i ← p_anchor + maxDist * normalize(p_i - p_anchor)   # 단방향(끌어당기기만)
```

**주름 (wrinkles).** 저해상도 시뮬 + 고해상도 normal map/메시 디테일을 얹거나(post wrinkle), 굽힘 구속을 약하게 해 자연스러운 접힘을 유도한다.

### 2.4 FEM (유한요소법, 연속체)

mass-spring/PBD 가 *이산* 모델이라면 FEM 은 **연속체역학(continuum mechanics)** 을 메시 요소 위에서 이산화한다. 물성(영률 Young's modulus E, 푸아송비 ν)을 직접 넣을 수 있어 물리적으로 가장 정확하다. 보통 **tetrahedral mesh**(3D) 또는 triangle mesh(2D cloth)를 쓴다.

**변형 구배 (deformation gradient) F.** 변형의 모든 국소 정보를 담는 핵심량. 기준 형상(rest) `X` → 현재 형상 `x` 의 사상에 대해

```
F = ∂x / ∂X          (3×3 행렬)
```

요소(tet) 단위로는 현재 모서리 행렬 `Ds` 와 기준 모서리 행렬 `Dm` 으로

```
F = Ds * Dm^{-1}      (Dm^{-1} 은 rest 상태에서 미리 계산)
```

**변형률(strain)과 응력(stress).**

```
Green strain : E = (1/2)(Fᵀ F - I)         # 비선형(큰 변형에 정확)
선형 strain  : ε = (1/2)(F + Fᵀ) - I        # 작은 변형 가정
응력         : σ = ℂ : ε  (Hooke, ℂ=탄성 텐서; E·ν 로 결정)
```

요소 변형 에너지를 위치로 미분하면 절점 힘이 나오고, 모으면 전역 강성행렬 `K`(sparse)가 된다.

**선형 FEM vs co-rotational FEM.** 선형(small-strain) FEM 은 빠르지만 **큰 회전에서 망가진다** — 회전을 변형으로 오인해 요소가 부풀거나 폭발한다(artifact). **Co-rotational FEM** 은 각 요소의 회전 성분 R 을 `F = R*S` 로 극분해(polar decomposition)해 *떼어내고*, 나머지 순수 변형 `S - I` 에만 선형 탄성을 적용한다:

```
F = R S                      # polar decomposition
f_elem = -R * K_local * (Rᵀ x - x_rest)   # 회전을 보정한 절점 힘
```

회전이 큰 캐릭터 살·고무에서 안정적이라 실시간 soft body FEM 의 사실상 표준이다.

**비용.** 전역 강성행렬 조립 + (implicit 이면) 큰 sparse 선형 시스템 풀이가 매 스텝 든다. tet 수가 늘면 비싸지고, 결정론·캐시 친화성도 나빠 게임 본편 루프엔 부담. GPU FEM 으로 일부 완화한다.

### 2.5 Shape Matching 과 기타 (plasticity / tearing)

**Shape matching (Müller 2005).** 메시 없이 변형체를 표현하는 또 다른 길. 질점 구름의 현재 위치에서 rest 형상에 가장 잘 맞는 **최적 강체 변환(rotation R + translation)** 을 매 스텝 구하고(공분산 행렬의 극분해로 R 추출), 각 질점을 그 "목표 위치(goal position)"로 끌어당긴다.

```
R, c = best_rigid_transform(rest_pts, current_pts)   # 극분해로 R
g_i  = R*(x_i^rest - c_rest) + c_current              # 목표 위치
x_i ← x_i + stiffness * (g_i - x_i)                   # goal 로 보간
```

stiffness 로 단단함을 조절하고, R 과 affine 변환을 섞으면 더 유연한 변형을 낸다. 빠르고 폭발하지 않아 게임 soft prop 에 쓰인다.

**부피/형상 보존.** PBD volume constraint, shape matching, FEM 의 푸아송비 ν 모두 "찌그러져도 부피·형태가 유지되는" 느낌을 담당한다.

**소성 (plasticity).** 변형이 일정 임계를 넘으면 rest 형상 자체를 갱신해 **영구 변형**으로 남긴다(찌그러진 캔). FEM 에서는 변형 구배를 탄성·소성으로 분해(`F = F_e F_p`).

**찢김 (tearing).** 요소·구속의 변형/응력이 임계를 넘으면 **토폴로지를 변경** — 구속을 끊거나(PBD), 요소 경계를 따라 메시를 분리한다(FEM). 토폴로지가 런타임에 바뀌므로 자료구조·결정론·메모리가 까다롭다.

---

## 3. 주요 기법/도구

| 기법 | 핵심 아이디어 | 강점 / 약점 |
|---|---|---|
| Mass-spring + explicit | 스프링 힘 + symplectic Euler | 단순 / stiff 폭발, 작은 Δt |
| Mass-spring + implicit (Baraff–Witkin) | backward Euler + CG | 큰 Δt 안정 / Jacobian·CG 비용, 수치 감쇠 |
| **PBD** (Müller) | 위치 구속 직접 투영 | 안정·빠름·단순 / 강성이 반복·Δt 의존 |
| **XPBD** (Macklin) | compliance α + λ 누적 | 강성을 Δt·반복과 분리 / 게임 주류 |
| Shape matching | rest 로의 최적 강체변환 goal | 폭발 없음·가벼움 / 큰 변형 표현 제한 |
| Co-rotational FEM | F=RS 극분해로 회전 제거 | 물리 정확·큰 회전 안정 / 비쌈, 결정론 부담 |
| LRA / tether | 단방향 최대거리 구속 | 적은 반복으로 over-stretch 차단 |
| substepping | 한 프레임을 작은 substep 으로 | XPBD 품질·안정 향상(반복 늘리기보다 substep) |

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진/도구 | 변형체 방식 | 비고 |
|---|---|---|
| **PhysX / NvCloth** | GPU PBD cloth | NvCloth 가 별도 cloth 라이브러리, LRA·tether·self-collision |
| **UE5 Chaos Cloth** | XPBD 기반 cloth | UE 내장. Cloth Editor, collider(capsule/sphere/convex)를 본에 부착, LRA, aerodynamics, **Chaos Flesh** 로 FEM-계열 soft body 실험 |
| **Havok Cloth** | PBD 계열 cloth | AAA 상용, 성능·LOD 중심 |
| **Jolt** | soft body (PBD/XPBD 계열) | 모던 오픈소스, 결정론 지향 |
| **Bullet** | soft body (mass-spring + PBD) | `btSoftBody`, cloth/rope/volumetric |
| **Marvelous Designer** | 오프라인 고품질 cloth | 의상 제작·베이크, 런타임 솔버 아님(작업 파이프라인) |

게임 런타임의 지배적 선택은 **XPBD cloth** 다(Chaos·NvCloth). soft body 는 PBD/shape matching, FEM 은 영화·CAD·일부 GPU 데모·UE 의 실험 기능(Chaos Flesh) 영역. **Marvelous Designer 는 시뮬레이터가 아니라 오프라인 의상 저작 도구** — 결과를 메시로 굽고 게임에선 XPBD 가 다시 시뮬한다.

UE 작업 흐름: Skeletal Mesh → Cloth Editor 에서 painting(질량/강성/max-distance 등 weight map) → collider 부착 → Chaos Cloth 가 런타임 시뮬.

---

## 5. 함정·결정론 주의

- **explicit mass-spring 폭발**: 빳빳한 천 + 큰 Δt = 발산. implicit 으로 가거나 PBD/XPBD 로 갈 것([03]).
- **PBD 강성의 설정 의존성**: 순수 PBD 는 반복 횟수·Δt 가 바뀌면 천의 단단함이 바뀐다. 일관된 물성이 필요하면 **XPBD compliance** 를 쓸 것. 품질은 반복보다 **substepping** 으로 올리는 게 안정적이다(Macklin 권고).
- **over-stretch / 흘러내림**: 반복 부족 시 천이 늘어난다. **LRA/tether** 로 단방향 max-distance 를 걸어라.
- **self-collision 비용·불안정**: O(n²) 회피로 공간 해시/BVH([11]) 필수, 그래도 가장 비싼 항목 — LOD 로 끄거나 거리로 컬링.
- **결정론(determinism, [12] 전제)**:
  - 구속 투영은 **순서 의존(Gauss–Seidel)** 이다 — 질점·구속을 도는 순서가 다르면 결과가 갈린다. 병렬화(graph coloring/Jacobi)는 순서를 바꾸므로, 멀티플레이라면 **고정된 순회 순서·고정 반복 수·고정 substep** 을 박아야 한다.
  - 부동소수점 누적 순서, polar decomposition/sqrt/CG 반복 수, 면 법선 정규화 등이 플랫폼 간 비트 차이를 만든다 → fixed-point 또는 결정론 모드 필요([12]).
  - rest length·compliance 같은 결정론 상수는 CVar 로 흔들지 말고 헤더 상수로 고정(프로젝트 규약).
- **FEM 큰 회전 artifact**: 선형 FEM 은 회전을 변형으로 오인해 폭발 — **co-rotational** 필수.
- **tearing 의 토폴로지 변경**: 런타임 메시/구속 변경은 결정론·메모리·재할당을 깨기 쉽다. 사전 fracture 패턴 + 구속 끊기로 제한하는 편이 안전.
- **inverted element (FEM/tet)**: tet 이 뒤집히면(det F < 0) 힘이 잘못된 방향으로 폭발 — invertible/stable FEM 기법 또는 충돌 응답 한계 처리 필요.

---

## 6. 더 읽기 / 관련 노드

**선행/관련 분기**
- [03-time-integration.md](03-time-integration.md) — implicit Euler, stiff ODE 안정성, substepping (mass-spring 폭발의 근원과 해법)
- [05-constraint-solving.md](05-constraint-solving.md) — PBD/XPBD, soft constraint·compliance(변형체 구속의 공통 솔버 프레임)
- [04-collision-detection.md](04-collision-detection.md) — self/외부 충돌, CCD, manifold
- [11-spatial-structures.md](11-spatial-structures.md) — self-collision broad phase(공간 해시·BVH)
- [02-dynamics.md](02-dynamics.md) — 질점 뉴턴 동역학, 힘/감쇠
- [12-determinism-networking.md](12-determinism-networking.md) — 구속 순서·fixed-point 결정론
- [13-performance-parallelism.md](13-performance-parallelism.md) — graph coloring/Jacobi 병렬 PBD, GPU cloth

**형제 문서 전체**
[00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · **07-deformable-bodies.md** · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)

**외부 레퍼런스**
- Müller et al., *Position Based Dynamics* (2007) — PBD 원전
- Müller et al., *Meshless Deformations Based on Shape Matching* (2005) — shape matching
- Macklin, Müller, Chentanez, *XPBD: Position-Based Simulation of Compliant Constrained Dynamics* (2016) — compliance·λ 누적
- Macklin et al., *Small Steps in Physics Simulation* (2019) — 반복보다 substepping
- Baraff & Witkin, *Large Steps in Cloth Simulation* (SIGGRAPH 1998) — implicit cloth, CG
- Sifakis & Barbič, *FEM Simulation of 3D Deformable Solids* (SIGGRAPH course) — FEM·co-rotational 입문
- Provot, *Deformation Constraints in a Mass-Spring Model* (1995) — mass-spring·over-stretch 보정
