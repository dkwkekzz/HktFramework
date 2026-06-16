# [06] 조인트·관절체 (Joints & Articulation) — 허브

> 강체를 서로 묶는 **등식 구속(equality constraint)** 의 집합 — 그리고 그것을 *드리프트 없이* 정확하게 푸는 **축소 좌표(reduced-coordinate)** 관절체까지. 05 의 Jacobian/임펄스 위에 한 층을 더 쌓는다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [06-joints-articulation/](06-joints-articulation/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [05-constraint-solving.md](05-constraint-solving.md)

---

## 1. 위치와 역할

[05 구속 해법](05-constraint-solving.md) 은 두 종류의 구속을 푼다 — **접촉(contact, 부등식)** 과 **조인트(joint, 등식)**. 이 문서는 후자, 그리고 조인트가 사슬을 이루었을 때 생기는 **관절체(articulation)** 문제를 다룬다.

```
[02 동역학] ──→ [03 적분] ──→ [05 구속 해법] ──→ [06 조인트/관절체] ──→ [10 ragdoll/vehicle/active ragdoll]
                                  (Jacobian·임펄스 토대)        (등식 구속 · 축소 좌표 · Featherstone)
```

조인트의 본질은 **"두 강체의 상대 운동 중 일부 자유도를 0 으로 고정한다"** 이다. 접촉이 "파고들지 마라"(한쪽 방향만 막는 부등식)인 데 비해, 조인트는 "이 점은 항상 붙어 있어라 / 이 축으로만 돌아라"(양방향으로 막는 등식)이다. 그래서 조인트의 라그랑주 승수 λ 는 부호 제한이 없다(접촉의 λ ≥ 0 과 대비).

관절체는 게임에서 **ragdoll, 캐릭터 IK/물리, 차량 서스펜션, 로봇/메카, 케이블/체인, 문·뚜껑** 등 거의 모든 "연결된 물체"의 토대다. 그리고 06 은 두 갈래로 갈린다:

- **최대 좌표(maximal)** — 각 강체를 자유 6-DOF 로 두고 조인트를 *구속으로* 솔버에 넘긴다. 05 의 임펄스 솔버를 그대로 재사용. 구현 단순, 그러나 사슬이 길어지면 드리프트·불안정.
- **축소 좌표(reduced/generalized)** — 사슬의 *허용된* DOF 만 상태로 들고, 구속은 좌표계 자체가 보장한다. 드리프트 0, 사슬에 강건. Featherstone/ABA 가 여기 산다.

---

## 2. 하위 문서 인덱스 (세부 이론)

조인트·관절체를 직관 단위로 분할했다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [06-joints-articulation/01-joint-as-jacobian.md](06-joints-articulation/01-joint-as-jacobian.md) | 조인트 = Jacobian 한 줄(들) | C(x)·Ċ=Jv·효과질량 K·임펄스 λ·distance/ball-socket 예제 |
| 2.2 | [06-joints-articulation/02-joint-types.md](06-joints-articulation/02-joint-types.md) | 조인트 타입별 구속식·DOF | hinge·ball·prismatic·universal·fixed·distance·축 정렬 트릭 |
| 2.3 | [06-joints-articulation/03-limits-motors.md](06-joints-articulation/03-limits-motors.md) | 한계·모터·드라이브 | joint limit(부등식)·velocity/PD 모터·soft drive·XPBD 통합 |
| 2.4 | [06-joints-articulation/04-ragdoll.md](06-joints-articulation/04-ragdoll.md) | Ragdoll: 본→강체+조인트 | swing-twist·self-collision·질량비·active ragdoll(PD) |
| 2.5 | [06-joints-articulation/05-maximal-vs-reduced.md](06-joints-articulation/05-maximal-vs-reduced.md) | 최대 좌표 vs 축소 좌표 | 상태변수·드리프트·O(n)·강건성 비교 |
| 2.5a | [06-joints-articulation/05a-featherstone-aba.md](06-joints-articulation/05a-featherstone-aba.md) | Featherstone/ABA 심화 | 왜 O(n)·spatial algebra·3-패스·articulated inertia·접촉 투영 |

> 📐 **심화의 자리**: §2.5a 는 "왜 축소 좌표가 드리프트 없는 정확한 관절체를 주는가 · 왜 ABA 가 O(n) 인가 · 자식 사슬을 부모 유효 관성으로 어떻게 접는가"의 직관 장벽을 전용 문서로 푼다.

---

## 3. 한눈 요약 — 최대 좌표 vs 축소 좌표

06 전체를 가르는 단 하나의 표. 상세는 [2.5](06-joints-articulation/05-maximal-vs-reduced.md) / [2.5a](06-joints-articulation/05a-featherstone-aba.md).

| 축 | 최대 좌표 (maximal) | 축소 좌표 (reduced / generalized) |
|---|---|---|
| 상태 변수 | 각 바디 풀 6-DOF (위치+회전) | 관절 DOF q, q̇ 만 (사슬당 base 6 + Σ joint DOF) |
| 조인트 | **구속으로** 솔버에 추가 | 좌표계가 **본질적으로 보장** (구속 불필요) |
| 드리프트 | 존재 (Baumgarte/soft 로 *보정*) | **없음** — 위반 자체가 표현 불가능 |
| 솔버 | 05 임펄스/PGS 재사용 | Featherstone/ABA 전용 알고리즘 |
| 단가 | 조인트당 저렴, 사슬 길면 반복 多 | base+joint 단위 O(n), 한 패스로 정확 |
| 강건성 | 질량비/긴 사슬에 약함 | 긴 사슬·극단 질량비에 강함 |
| 자유도 추가/제거 | 런타임 쉽게 붙였다 뗌 | 위상(topology) 변경 비쌈 |
| 충돌 | 자연스럽게 통합 | 충돌 임펄스를 별도로 articulation 에 투영해야 |

**조인트 타입 한눈 표** (상세 [2.2](06-joints-articulation/02-joint-types.md)): distance(막 1)·ball-socket(막 3)·hinge(막 5)·prismatic(막 5)·universal(막 4)·cylindrical(막 4)·fixed(막 6)·planar(막 3). **막는 DOF 수 = Jacobian 행 수**.

**주요 기법/도구** (각 하위 문서에 상세):
- **Soft constraint 통합**: hard joint·limit·motor·spring 을 compliance α 한 파라미터로 연속 표현(05 의 XPBD/TGS soft). 강성을 안전하게 무한대까지 밀 수 있음. ([2.3](06-joints-articulation/03-limits-motors.md))
- **Swing-twist 분해**: 사원수를 swing(원뿔) + twist(축 회전)로 분해해 ragdoll 한계를 해부학적으로 부여. ([2.4](06-joints-articulation/04-ragdoll.md))
- **Warm starting**: 조인트도 직전 프레임 λ 를 초기값으로 — 사슬 솔버 수렴을 크게 가속(05 와 동일).
- **Mini-island / sub-stepping**: 무거운 관절체는 substep 으로 Δt 를 잘게 쪼개 안정화(TGS substep 기반).
- **Featherstone/ABA**: O(n) 축소 좌표 순방향 동역학. CRBA(관절공간 관성행렬 구축)·RNEA(역동역학 O(n))와 한 묶음. ([2.5a](06-joints-articulation/05a-featherstone-aba.md))
- **Stabilization**: 축소 좌표라도 적분 오차로 사슬이 미세하게 늘 수 있어 위치 보정/projection 을 더하는 구현도 있음. ([2.5a](06-joints-articulation/05a-featherstone-aba.md))

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 조인트/관절체 접근 | 비고 |
|---|---|---|
| **Box2D** | maximal — revolute·prismatic·distance·weld·motor·spring, sequential impulse + TGS soft | 2D, joint 코드가 가장 읽기 좋은 교과서 |
| **Bullet** | maximal(btTypedConstraint: p2p·hinge·slider·generic 6-DOF) **+** reduced(**btMultiBody** = Featherstone ABA) | 둘 다 제공, multibody 가 정밀 사슬용 |
| **PhysX (NVIDIA)** | maximal joint(D6 generic) **+** **PxArticulationReducedCoordinate** (Featherstone, 로봇/정밀 ragdoll) | TGS solver, GPU articulation 지원 |
| **Jolt** | maximal 6-DOF·hinge·slider·cone·swing-twist·path, 모터/스프링 풍부 | 결정론·대규모 병렬, 우수한 sleeping |
| **Havok** | maximal constraint + powered/limited, 결정론 옵션 | AAA ragdoll/vehicle 전통 강세 |
| **Chaos (UE5)** | maximal joint(D6) + **PhysicsControl / PhysicsAnimation**(active ragdoll·motorized drive), Chaos Cloth/Vehicle | UE 의 ragdoll·물리애니 토대 |

**UE5 구체**:
- `Chaos` 조인트는 D6(6-DOF generic)로 표현하고 swing/twist 한계와 drive(position/velocity, stiffness/damping)를 준다.
- **PhysicsControl** 플러그인 / `UPhysicsAnimationComponent` 가 골격 위에 모터 드라이브를 걸어 **active ragdoll**(애니 추종 + 물리 반응)을 만든다 → [10](10-specialized-systems.md).
- Chaos 는 기본 maximal 임펄스/TGS-류 솔버. Featherstone-식 reduced articulation 은 PhysX 만큼 1급으로 노출돼 있지 않으므로, 정밀 사슬이 필요하면 설계 단계에서 솔버 선택을 확인할 것.

**선택 가이드**: 일반 강체·ragdoll 대부분은 maximal + soft 로 충분. **차량 드라이브트레인·로봇 팔·정밀 IK·긴 사슬·극단 질량비**는 reduced(PhysX articulation / Bullet btMultiBody).

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **무거운 부모 ↔ 가벼운 자식 질량비**: maximal 반복 솔버(PGS/sequential impulse)의 고질병. 질량비가 크면 수렴이 극도로 느려 사슬이 떨리거나 늘어난다. 완화: 반복 ↑, TGS substep, warm start, 질량비 인위 압축, 또는 **reduced 좌표 전환**. (06-joints-articulation/04-ragdoll · 05-maximal-vs-reduced)
- **긴 사슬 = 정보 전파 지연**: PGS 는 한 반복에 이웃끼리만 정보 교환 → n-링크 사슬은 정보가 끝까지 가는 데 ~n 반복 필요. 반복 부족 시 "고무줄"처럼 늘어남(reduced/ABA 는 한 패스로 전파 → 이 문제 없음). (06-joints-articulation/05-maximal-vs-reduced)
- **조인트 한계 = 부등식**: 등식 조인트와 달리 limit 은 접촉처럼 λ clamp 필요. clamp 누락 시 한계가 양방향으로 끌어당겨 본이 한계각에 "달라붙음". (06-joints-articulation/03-limits-motors)
- **등식엔 clamp 금지**: 반대로 조인트 자체 λ 는 부호 자유. 접촉 코드 재사용 시 무심코 `λ ≥ 0` 남기면 한쪽으로만 작동. (06-joints-articulation/01-joint-as-jacobian)
- **자기충돌 미설정**: 인접 본 충돌을 안 끄면 첫 프레임에 폭발. 조인트-연결 쌍 충돌 무시는 거의 필수. (06-joints-articulation/04-ragdoll)
- **soft drive 발산**: 명시적 PD 모터는 k_p 가 크면 발산(Δt·k_p 가 안정 한계 초과). soft constraint/implicit 표현으로 회피. (06-joints-articulation/03-limits-motors)
- **접촉 투영 누락**: reduced articulation 은 사슬 내부만 닫아 풀므로, 외부 접촉 임펄스를 관절공간에 투영하지 않으면 바닥을 뚫거나 접촉에 반응 안 함. (06-joints-articulation/05a-featherstone-aba)
- **결정론 — 연산 순서 고정**: 조인트/한계/모터 해법 순서, 사슬 순회 순서가 결과를 바꾼다. island 내 정렬 키를 안정적으로([12](12-determinism-networking.md), [13](13-performance-parallelism.md)).
- **결정론 — 사원수 정규화·swing-twist 분해**: float 누적오차에 민감 — 분해 알고리즘과 정규화 시점을 모든 머신에서 동일하게.
- **결정론 — reduced vs maximal 혼용**: 두 솔버의 부동소수점 경로가 달라 재현성 관리 포인트가 늘어남.
- **결정론 — warm-start 캐시**: 프레임 간 상태 → rollback([12](12-determinism-networking.md)) 시 함께 저장/복원해야 재현됨.
- **결정론 목표면** fixed timestep·고정 substep 수·고정 반복 수를 박을 것([03](03-time-integration.md)).

---

## 6. 더 읽기 / 관련 노드

**선행(이 문서가 의존)**
- [05-constraint-solving.md](05-constraint-solving.md) — Jacobian, 임펄스/PGS/TGS, soft constraint(이 문서의 토대)
- [02-dynamics.md](02-dynamics.md) — 질량/관성텐서·토크 (spatial inertia 의 뿌리)
- [03-time-integration.md](03-time-integration.md) — substep·고정 timestep·implicit 안정성

**후행(이 문서를 의존)**
- [10-specialized-systems.md](10-specialized-systems.md) — active ragdoll, vehicle 서스펜션/드라이브트레인, character controller

**횡단**
- [12-determinism-networking.md](12-determinism-networking.md) — 솔버 순서·warm-start 캐시·rollback
- [13-performance-parallelism.md](13-performance-parallelism.md) — island/sleeping, 사슬 병렬화

**형제 문서 전체**
- [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · **06(이 문서)** · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)

**외부 레퍼런스**
- Featherstone, *Rigid Body Dynamics Algorithms* (2008) — ABA/CRBA/RNEA 의 정전(spatial algebra 표준)
- Erin Catto, *Soft Constraints / Modeling and Solving Constraints* (GDC 슬라이드) — joint Jacobian·soft·TGS 실무
- Bullet `btMultiBody` 소스, NVIDIA PhysX `PxArticulationReducedCoordinate` 문서
- Mirtich, *Impulse-based Dynamic Simulation* — maximal 임펄스 관점
