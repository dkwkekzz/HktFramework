# [07] 변형체 (Deformable Bodies) — 허브

> 강체(rigid body)와 달리 **형상이 변하는** 물체 — 천(cloth)·소프트바디(soft body)·연속체(continuum) — 를 질점·구속·연속체역학으로 시뮬레이션하는 분기. 게임에서는 정확도보다 **안정·저비용**이 지배해 PBD/XPBD 가 주류다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [07-deformable-bodies/](07-deformable-bodies/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [03-time-integration.md](03-time-integration.md) · [05-constraint-solving.md](05-constraint-solving.md)

---

## 1. 위치와 역할

변형체는 [03] 적분 루프 위에 얹히는 **특화 솔버**다. 한 프레임의 물리 스텝(`forces → [03] 적분 → [04] 충돌 → [05] 구속 → commit`)에서, 변형체는 강체와 같은 6-DOF 한 덩어리가 아니라 **수백~수천 개의 질점(particle)** 을 가진 입자 집합으로 취급된다. 각 질점은 [02] 동역학의 뉴턴 법칙을 따르고, 질점 사이의 관계(형상 유지)는 [05] 구속 해법 — 특히 **Position-Based Dynamics(PBD)/XPBD** — 로 풀린다.

핵심 분기는 세 갈래다. 직관으로 보면 **"힘으로 끌어당기는가(mass-spring) / 위치를 직접 투영하는가(PBD) / 연속체를 이산화하는가(FEM)"** 의 차이다.

게임 물리에서 "변형체 = 거의 cloth + PBD soft body" 라고 봐도 무방하다. FEM 은 영화/CAD/일부 GPU 데모의 영역이고, 실시간 게임 본편 루프에는 드물다.

---

## 2. 하위 문서 인덱스 (세부 이론)

변형체는 직관 단위로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래(mass-spring 의 폭발 문제가 PBD 의 동기, PBD 가 cloth 의 코어, FEM 이 그 대척점).

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [07-deformable-bodies/01-mass-spring.md](07-deformable-bodies/01-mass-spring.md) | Mass-spring 시스템 | 구조/전단/굽힘 스프링·Hooke·stiffness 폭발·implicit Euler(Baraff–Witkin)·CG |
| 2.2 | [07-deformable-bodies/02-pbd-xpbd.md](07-deformable-bodies/02-pbd-xpbd.md) | PBD / XPBD (게임 주류) | 위치 투영·거리/굽힘/부피 구속·역질량·compliance α·λ 누적 |
| 2.2a | [07-deformable-bodies/02a-xpbd-compliance.md](07-deformable-bodies/02a-xpbd-compliance.md) | XPBD compliance 심화 | 왜 α=1/k·왜 α̃=α/Δt²·λ 누적·PBD=α→0 극한 (라그랑주 승수) |
| 2.3 | [07-deformable-bodies/03-cloth.md](07-deformable-bodies/03-cloth.md) | Cloth 특화 | self-collision·collider·바람/공력(Cd·Cl)·LRA/tether·주름 |
| 2.4 | [07-deformable-bodies/04-fem.md](07-deformable-bodies/04-fem.md) | FEM (연속체) | 변형 구배 F·strain/stress·co-rotational·강성행렬 K |
| 2.4a | [07-deformable-bodies/04a-fem-continuum.md](07-deformable-bodies/04a-fem-continuum.md) | FEM 연속체역학 심화 | 왜 F가 변형의 전부·왜 strain=FᵀF·K의 정체·왜 선형 FEM 이 회전에서 폭발 |
| 2.5 | [07-deformable-bodies/05-shape-matching.md](07-deformable-bodies/05-shape-matching.md) | Shape matching · 기타 | rest 로의 최적 강체변환 goal·plasticity(F=FₑFₚ)·tearing 토폴로지 |

---

## 3. 한눈 요약 — 모델·기법 비교

변형체에서 선택지가 갈리는 모델·기법을 한 표로 모았다. 상세는 각 하위 문서.

**세 갈래 모델**

| 모델 | 표현 | 정확도 | 비용 | 게임 사용 |
|---|---|---|---|---|
| **Mass-spring** | 질점 + 스프링 망 | 낮음(스프링 강성에 의존) | 낮음 | 고전 cloth, 교육용 |
| **PBD / XPBD** | 질점 + 위치 구속 | 중(compliance 로 튜닝) | 낮음 | **게임 주류** (cloth·soft) |
| **FEM** | 연속체 + tetra/triangle mesh | 높음(물성 직접 모델) | 높음 | 오프라인·고품질, GPU soft |

**주요 기법/도구**

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

UE 작업 흐름: Skeletal Mesh → Cloth Editor 에서 painting(질량/강성/max-distance 등 weight map) → collider 부착 → Chaos Cloth 가 런타임 시뮬. (상세 [07-deformable-bodies/03-cloth.md](07-deformable-bodies/03-cloth.md))

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **explicit mass-spring 폭발**: 빳빳한 천 + 큰 Δt = 발산. implicit 으로 가거나 PBD/XPBD 로 갈 것([03]). (`deformable-bodies/01-mass-spring`)
- **PBD 강성의 설정 의존성**: 순수 PBD 는 반복 횟수·Δt 가 바뀌면 천의 단단함이 바뀐다. 일관된 물성이 필요하면 **XPBD compliance** 를 쓸 것. 품질은 반복보다 **substepping** 으로 올리는 게 안정적이다(Macklin 권고). (`deformable-bodies/02-pbd-xpbd`, `02a-xpbd-compliance`)
- **over-stretch / 흘러내림**: 반복 부족 시 천이 늘어난다. **LRA/tether** 로 단방향 max-distance 를 걸어라. (`deformable-bodies/03-cloth`)
- **self-collision 비용·불안정**: O(n²) 회피로 공간 해시/BVH([11]) 필수, 그래도 가장 비싼 항목 — LOD 로 끄거나 거리로 컬링. (`deformable-bodies/03-cloth`)
- **결정론(determinism, [12] 전제)**:
  - 구속 투영은 **순서 의존(Gauss–Seidel)** 이다 — 질점·구속을 도는 순서가 다르면 결과가 갈린다. 병렬화(graph coloring/Jacobi)는 순서를 바꾸므로, 멀티플레이라면 **고정된 순회 순서·고정 반복 수·고정 substep** 을 박아야 한다. (`deformable-bodies/02-pbd-xpbd`)
  - 부동소수점 누적 순서, polar decomposition/sqrt/CG 반복 수, 면 법선 정규화 등이 플랫폼 간 비트 차이를 만든다 → fixed-point 또는 결정론 모드 필요([12]). (`deformable-bodies/04-fem`, `04a-fem-continuum`)
  - rest length·compliance 같은 결정론 상수는 CVar 로 흔들지 말고 헤더 상수로 고정(프로젝트 규약). (`deformable-bodies/02a-xpbd-compliance`)
- **FEM 큰 회전 artifact**: 선형 FEM 은 회전을 변형으로 오인해 폭발 — **co-rotational** 필수. (`deformable-bodies/04-fem`, `04a-fem-continuum`)
- **inverted element (FEM/tet)**: tet 이 뒤집히면(det F < 0) 힘이 잘못된 방향으로 폭발 — invertible/stable FEM 기법 또는 충돌 응답 한계 처리 필요. (`deformable-bodies/04a-fem-continuum`)
- **tearing 의 토폴로지 변경**: 런타임 메시/구속 변경은 결정론·메모리·재할당을 깨기 쉽다. 사전 fracture 패턴 + 구속 끊기로 제한하는 편이 안전. (`deformable-bodies/05-shape-matching`)

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
