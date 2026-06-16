# 게임 물리 이론 지도 (Concepts)

> 게임 물리 엔진에서 **실무가 실제로 쓰는** 이론 전 영역을 tree/DAG 로 정리한 마스터 인덱스.
> 각 노드는 하나의 심화 문서로 연결된다. **읽기 전 이 지도에서 위치와 의존을 먼저 확인할 것.**

---

## 0. 이 지도를 읽는 법

게임 물리는 순수한 트리가 아니라 **DAG** 다. 위쪽 분기(수학·적분)는 거의 모든 하위 분기가 의존하는 *공유 기반*이고, 공간 가속 구조 같은 분기는 충돌·유체·파티클에 동시에 가지를 뻗는다. 그래서 아래 트리는 "소속(분류)"을 보여주고, 그 뒤의 **DAG 의존 그래프**가 "무엇이 무엇을 필요로 하는가"를 보여준다.

한 프레임의 물리 스텝은 보통 이 파이프라인을 돈다 — 이 순서가 분기 번호의 뼈대다:

```
forces 적용 → [03] 적분 → [04] 충돌 감지(broad→narrow) → [05] 구속 해법(contact+joint) → 상태 commit → [의존] sleeping/islands
                    └ [06] 조인트 · [07] 변형체 · [08] 유체 · [09] 파티클 은 이 루프에 끼어드는 특화 솔버
```

---

## 1. 분류 트리 (소속)

```
게임 물리 (Game Physics)
│
├─ 기반 (Foundations) ─────────── 거의 모든 분기가 의존하는 공유 기반
│   ├─ [00] 수학·수치 기반 ........ 선형대수 · 사원수 · 미적분 · 부동소수점 · 수치 안정성
│   ├─ [01] 운동학 (Kinematics) .... 위치/속도/가속 · 회전 표현 · 좌표 프레임 · 변환
│   └─ [02] 동역학 (Dynamics) ...... Newton–Euler · 질량/관성텐서 · 힘/토크 · 운동량 · (Lagrangian)
│
├─ 시뮬레이션 코어 (Simulation Core)
│   ├─ [03] 시간 적분 (Time Integration) ... Euler/Symplectic · Verlet · RK4 · Implicit · 고정 timestep
│   ├─ [04] 충돌 감지 (Collision Detection)
│   │     ├─ Broad phase ........ SAP · BVH/DBVT · 공간 해시 · 그리드 · octree
│   │     ├─ Narrow phase ....... SAT · GJK · EPA · MPR · contact manifold
│   │     ├─ Bounding volume .... AABB · OBB · sphere · capsule · k-DOP
│   │     └─ CCD (연속 충돌) .... conservative advancement · speculative contact · swept
│   ├─ [05] 구속 해법 (Constraint Solving)
│   │     ├─ Contact model ...... restitution · Coulomb friction · penetration/Baumgarte
│   │     ├─ Impulse 기반 ....... sequential impulse · PGS · warm start · TGS
│   │     ├─ LCP / MLCP ......... 정식화 · projected Gauss–Seidel · Jacobi
│   │     └─ Position-based ..... PBD · XPBD
│   └─ [06] 조인트·관절체 (Joints & Articulation)
│         ├─ Joint types ........ hinge · ball · prismatic · fixed · distance · motor
│         ├─ Ragdoll
│         └─ Reduced coordinate . Featherstone / Articulated Body Algorithm
│
├─ 확장 시뮬레이션 (Extended Simulation)
│   ├─ [07] 변형체 (Deformable) .. mass-spring · cloth · PBD/XPBD soft · FEM · shape matching
│   ├─ [08] 유체 (Fluids)
│   │     ├─ Eulerian (grid) .... Navier–Stokes · stable fluids · MAC · FLIP/PIC
│   │     ├─ Lagrangian (입자) .. SPH · PCISPH · PBF
│   │     └─ Height-field ....... shallow water · 파도
│   └─ [09] 파티클·이펙트 (Particles) .. emitter · force field · GPU particle
│
├─ 특화 시스템 (Specialized Systems)
│   └─ [10] character controller · vehicle(타이어/서스펜션) · active ragdoll · 부력/공력 · 파괴(fracture)
│
└─ 횡단 관심사 (Cross-cutting) ─── 여러 분기를 가로지름
    ├─ [11] 공간·가속 구조 (Spatial Structures) .. BVH · DBVT · grid · BSP/octree  (→ 04·08·09 공유)
    ├─ [12] 결정론·네트워킹 (Determinism & Net) .. fixed-point vs float · lockstep/rollback · 서버 권위
    └─ [13] 성능·병렬 (Performance) ............. island · sleeping · SIMD · job · GPU
```

---

## 2. 의존 DAG (무엇이 무엇을 필요로 하는가)

화살표 `A → B` = "A 가 B 를 전제/이용한다".

```
[00 수학] ──┬─→ [01 운동학] ──→ [02 동역학] ──→ [03 적분] ──→ [05 구속 해법]
            │                                       │              ▲
            │                                       ▼              │
            └─────────────────────→ [04 충돌 감지] ─┴──────────────┘
                                          ▲
                       [11 공간 구조] ─────┤
                                          ├─→ [08 유체]
                                          └─→ [09 파티클]

[05 구속 해법] ──→ [06 조인트/관절체] ──→ [10 ragdoll/vehicle]
[03 적분] ──→ [07 변형체]  ;  [03]+[11] ──→ [08 유체]  ;  [03] ──→ [09 파티클]

[12 결정론] ⟂ (03·04·05 전부에 제약을 건다 — fixed timestep · 연산 순서 · fixed-point)
[13 성능]   ⟂ (04·05 에 island/sleeping/SIMD/GPU 로 가지를 침)
```

`⟂` 는 특정 분기에 매달리지 않고 **모든 코어 분기에 제약/최적화로 횡단**하는 관심사를 뜻한다.

---

## 3. 문서 인덱스

| # | 문서 | 한 줄 | 핵심 선행 |
|---|---|---|---|
| 00 | [00-foundations.md](00-foundations.md) | 선형대수 · 사원수 · 미적분 · 부동소수점·수치 안정성 (허브 + [foundations/](foundations/) 6개 세부 문서) | — |
| 01 | [01-kinematics.md](01-kinematics.md) | 운동 기술: 위치/속도/가속, 회전 표현, 좌표 변환 | 00 |
| 02 | [02-dynamics.md](02-dynamics.md) | 힘·토크·질량·관성텐서, Newton–Euler, 운동량 | 00·01 |
| 03 | [03-time-integration.md](03-time-integration.md) | ODE 적분기, 안정성/에너지 드리프트, 고정 timestep | 02 |
| 04 | [04-collision-detection.md](04-collision-detection.md) | broad/narrow phase, GJK/EPA/SAT, CCD, manifold | 00·11 |
| 05 | [05-constraint-solving.md](05-constraint-solving.md) | contact/friction, impulse·PGS·TGS, LCP, PBD/XPBD | 02·03·04 |
| 06 | [06-joints-articulation.md](06-joints-articulation.md) | 조인트, ragdoll, Featherstone 축소 좌표 | 05 |
| 07 | [07-deformable-bodies.md](07-deformable-bodies.md) | mass-spring, cloth, soft body, FEM | 03 |
| 08 | [08-fluids.md](08-fluids.md) | Eulerian/Lagrangian, SPH·PBF·FLIP, height-field | 03·11 |
| 09 | [09-particles.md](09-particles.md) | 파티클 시스템, force field, GPU 파티클 | 03 |
| 10 | [10-specialized-systems.md](10-specialized-systems.md) | character controller, vehicle, active ragdoll, 파괴 | 05·06 |
| 11 | [11-spatial-structures.md](11-spatial-structures.md) | BVH/DBVT, grid, 공간 해시, octree/BSP | 00 |
| 12 | [12-determinism-networking.md](12-determinism-networking.md) | fixed-point/float 결정론, lockstep/rollback, 서버 권위 | 03·05 |
| 13 | [13-performance-parallelism.md](13-performance-parallelism.md) | island/sleeping, SIMD, job system, GPU physics | 04·05 |

---

## 4. 권장 학습/구현 순서

1. **기반 먼저** — 00 → 01 → 02. 사원수와 관성텐서 없이는 3D 강체가 안 굴러간다.
2. **최소 루프** — 03(symplectic Euler) + 04(AABB+GJK) + 05(sequential impulse). 이 셋이면 기본 강체 엔진이 선다.
3. **횡단 조기 투입** — 12(결정론)는 *처음부터* 정해야 한다(나중에 못 바꿈). 11(공간 구조)는 04 와 함께.
4. **확장** — 06 → 07 → 08 → 09 순으로 솔버를 늘린다.
5. **특화/성능** — 10, 13 은 코어가 안정된 뒤.

---

## 5. 실무 레퍼런스 엔진 (문서들이 인용하는 기준선)

| 엔진 | 성격 | 대표 기법 |
|---|---|---|
| **Box2D** | 2D, 교과서적 명료함 | sequential impulse, TGS soft, SAP |
| **Bullet** | 3D 오픈소스 | btDbvt, GJK/EPA, PGS, Featherstone |
| **PhysX (NVIDIA)** | 산업 표준 3D | TGS solver, GPU rigid/cloth/fluid |
| **Havok** | AAA 상용 | 결정론 옵션, 고성능 solver |
| **Jolt** | 모던 오픈소스(호라이즌) | 대규모 병렬, 결정론, 우수한 sleeping |
| **Chaos (UE5)** | 언리얼 내장 | 파괴(Chaos Destruction), cloth, 차량 |

> 각 분기 문서는 "이 이론을 실제로 어느 엔진이 어떻게 쓰는가"를 **실무** 절에 반드시 적는다.
