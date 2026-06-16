# [06] 조인트·관절체 (Joints & Articulation)

> 강체를 서로 묶는 **등식 구속(equality constraint)** 의 집합 — 그리고 그것을 *드리프트 없이* 정확하게 푸는 **축소 좌표(reduced-coordinate)** 관절체까지. 05 의 Jacobian/임펄스 위에 한 층을 더 쌓는다.
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

## 2. 핵심 이론

### 2.1 조인트 = Jacobian 한 줄(들)

[05](05-constraint-solving.md) 에서 본 등식 구속의 일반형을 다시 쓴다. 위치 수준 구속 C(x) = 0 을 시간 미분하면 속도 수준:

```
C(x) = 0                      // 위치 제약 (등식)
Ċ = J v = 0                   // 속도 제약 — J 가 조인트의 Jacobian
J = ∂C/∂x                     // 행: 막는 DOF 수,  열: 관련 강체들의 6-DOF (v,ω)
```

조인트가 막는 DOF 가 m 개면 J 는 m×(12) 행렬(두 강체 각 6-DOF). 솔버는 매 반복마다 효과 질량 K = J M⁻¹ Jᵀ 를 풀어 임펄스 λ 를 구하고:

```
effective mass  K = J M⁻¹ Jᵀ            // m×m
bias           b = (β/Δt) C  +  γ Ċ      // Baumgarte/soft 보정 (05 참조)
solve          K λ = -(J v + b)
apply          v += M⁻¹ Jᵀ λ
```

**조인트 ↔ 접촉의 유일한 구조적 차이**: 접촉은 λ_n ≥ 0 으로 clamp(부등식), 조인트는 clamp 없음(등식). 한계(limit)와 모터(motor)는 이 등식 위에 *부등식/목표*를 추가로 얹는 것이다(§2.4).

### 2.2 조인트 타입별 구속식과 DOF

각 조인트를 "막는 DOF(constrained)" 와 "남는 DOF(free)"로 본다. 강체쌍의 상대 운동은 6-DOF(병진 3 + 회전 3)이고, 조인트는 그중 일부를 0 으로 묶는다.

| 조인트 | 남는 DOF | 막는 DOF | 구속식 C | 용도 |
|---|---|---|---|---|
| **Distance** | 5 | 1 | `‖p_b − p_a‖ − L = 0` | 로프(고정 길이), 막대 |
| **Ball-socket / Point-to-point (spherical)** | 3 (회전) | 3 (병진) | `p_a + R_a r_a − (p_b + R_b r_b) = 0` | 어깨·고관절, ragdoll 관절 |
| **Hinge / Revolute** | 1 (한 축 회전) | 5 | point-to-point(3) + 두 perpendicular 축 정렬(2) | 팔꿈치·무릎, 문, 바퀴 축 |
| **Prismatic / Slider** | 1 (한 축 병진) | 5 | 축 직교 병진(2) + 회전 전부(3) | 서스펜션 스트럿, 피스톤, 엘리베이터 |
| **Universal (Hooke)** | 2 (직교 두 축 회전) | 4 | point-to-point(3) + 한 축 정렬(1) | 드라이브 샤프트, 손목 |
| **Cylindrical** | 2 (한 축 회전+병진) | 4 | 축 직교 병진(2) + 축 직교 회전(2) | 나사 없는 축 |
| **Fixed / Weld** | 0 | 6 | 상대 위치(3) + 상대 회전(3) 고정 | 본 융합, 파편 접착, compound |
| **Planar** | 3 (평면 2병진+1회전) | 3 | 평면 법선 병진(1) + 면내 회전 외 2축(2) | 평면 위 슬라이딩 |

> **읽는 법**: 막는 DOF 수 = J 의 행 수. 예) hinge 는 6−1=5 행짜리 Jacobian. point-to-point 3 행 + 회전 정렬 2 행.

**Hinge 의 회전 정렬 구속**(가장 헷갈리는 부분)을 펼치면 — 두 바디의 hinge 축이 한 직선이어야 하므로, 축 a 에 직교하는 두 벡터 t1, t2 에 대해:

```
// a_a = 바디A 의 hinge 축(월드),  a_b = 바디B 의 hinge 축(월드)
// t1, t2 = a_a 에 직교하는 두 단위벡터
C_rot = [ t1 · a_b ,  t2 · a_b ] = [0, 0]    // a_b 가 a_a 와 평행 → 두 직교성분 0
```

회전 자유도를 "막는" 구속을 **두 직교 성분의 0** 으로 표현하는 것이 3D 조인트의 핵심 트릭이다(세 번째 성분 = 축 자체의 회전은 자유로 남김).

### 2.3 Distance vs Ball-socket — 가장 작은 두 예제

```
# Distance (1-DOF 막음): 두 anchor 사이 거리 L 유지
d   = p_b - p_a
n   = d / ‖d‖
C   = ‖d‖ - L
J   = [ -nᵀ, -(r_a × n)ᵀ,  nᵀ, (r_b × n)ᵀ ]     // 1×12

# Ball-socket (3-DOF 막음): 두 anchor 가 한 점
C   = (p_b + r_b) - (p_a + r_a)                  // 3-벡터
J   = [ -I, [r_a]×, I, -[r_b]× ]                 // 3×12, [·]× = skew(외적 행렬)
```

`[r]×` 는 외적을 행렬로 표현한 skew-symmetric 행렬이며, 회전이 anchor 점 속도에 주는 기여(ω × r)를 J 에 싣는 표준 방식이다.

### 2.4 한계(Limit)와 모터(Motor) — 등식 위의 부등식/목표

조인트의 *남은* DOF 에 추가로 거는 제약이다.

**조인트 한계(joint limit)** — 부등식 구속. hinge 각 θ 를 [θ_min, θ_max] 로 가둔다. 한계에 닿았을 때만 활성:

```
if   θ < θ_min:   C = θ - θ_min ,   λ ≥ 0      // 아래쪽 벽: 밀어올리는 임펄스만
elif θ > θ_max:   C = θ - θ_max ,   λ ≤ 0      // 위쪽 벽
else:             비활성 (접촉처럼 켰다 껐다)
```

→ 사실상 **접촉(부등식)** 과 동일하게 푼다. 한계는 "회전판에 박힌 두 개의 벽"이다.

**모터(motor)** — 목표를 향해 능동 임펄스를 가하되 `|λ| ≤ τ_max·Δt`(최대 토크/힘) 로 clamp.

```
# 속도 모터: 상대 각속도를 ω_target 으로
C_dot_target = ω_target
λ = K⁻¹ ( ω_target - J v )
λ = clamp(λ, -τ_max·Δt, +τ_max·Δt)    // 최대 토크 한계 → λ box-clamp

# 위치/스프링 드라이브 (PD): 목표 각 θ_target
τ = k_p (θ_target - θ)  -  k_d θ̇       // stiffness k_p, damping k_d
```

**스프링/감쇠 드라이브**는 위 PD 토크를 그대로 쓰거나, soft-constraint(05 의 γ, β 또는 XPBD 의 compliance α)로 표현한다. soft 표현이 큰 stiffness 에서 *명시적 PD 보다 안정* 하다 — k_p 를 키워도 발산하지 않는다(implicit 적분 효과).

> **TGS soft / XPBD 통합**: 현대 솔버는 limit·motor·drive 를 전부 "compliance 와 damping 을 가진 soft 등식/부등식 구속"으로 일원화한다. 강성 = 1/α 로 연속 조절되어, hard 조인트부터 물렁한 스프링까지 한 코드 경로로 처리.

### 2.5 Ragdoll — 본 계층 → 강체+조인트

골격 애니메이션의 본(bone) 계층을 물리로 바꾸는 매핑:

```
스켈레톤 본 트리           →   물리 표현
─────────────────────────────────────────
각 본 (혹은 본 묶음)       →   1 개의 강체 (캡슐/구가 보통)
부모-자식 본 연결          →   1 개의 조인트 (대개 ball-socket 또는 swing-twist)
관절 가동 범위             →   조인트 한계 (swing/twist cone)
본 길이·굵기              →   강체 형상 + 질량/관성텐서
```

핵심 설계 항목:

- **충돌 그룹 / self-collision**: 인접 본(부모-자식)끼리는 충돌을 *끈다*(서로 겹쳐 있으니 끄지 않으면 폭발). 보통 "조인트로 연결된 쌍은 충돌 무시" + 사용자 collision group/mask. 비인접 본 자기충돌은 켤지 말지 비용·품질 트레이드오프.
- **swing-twist 한계**: ball-socket 에 해부학적 가동범위를 주려면 단순 cone 보다 swing(원뿔)·twist(축 회전)를 분리해 다른 각 한계를 주는 swing-twist 분해가 표준.
- **안정성 문제**: 본은 질량비가 극단적(골반 vs 손가락)이고 사슬이 깊다 → 반복 임펄스 솔버가 수렴 안 해 떨거나 늘어남(§5). 그래서 ragdoll 은 *축소 좌표(articulation)* 로 푸는 것이 점점 표준이 됐다.
- **애니메이션 블렌딩 (active ragdoll)**: 순수 ragdoll(완전 물리)과 키프레임 애니(완전 비물리) 사이를 섞는다. 조인트 모터를 PD 드라이브로 켜서 *애니 포즈를 목표 각으로* 추종시키면 "물리적으로 반응하지만 자세는 유지"하는 active ragdoll 이 된다. 상세는 [10 특화 시스템](10-specialized-systems.md).

### 2.6 최대 좌표(maximal) vs 축소 좌표(reduced) — 핵심 비교

| 축 | 최대 좌표 (maximal) | 축소 좌표 (reduced / generalized) |
|---|---|---|
| 상태 변수 | 각 바디 풀 6-DOF (위치+회전) | 관절 DOF q, q̇ 만 (사슬당 base 6 + Σ joint DOF) |
| 조인트 | **구속으로** 솔버에 추가 | 좌표계가 **본질적으로 보장** (구속 불필요) |
| 드리프트 | 존재 (Baumgarte/soft 로 *보정*) | **없음** — 구속을 푸는 게 아니라 위반 자체가 불가능 |
| 솔버 | 05 임펄스/PGS 재사용 | Featherstone/ABA 전용 알고리즘 |
| 단가 | 조인트당 저렴, 사슬 길면 반복 多 | base+joint 단위 O(n), 한 패스로 정확 |
| 강건성 | 질량비/긴 사슬에 약함 | 긴 사슬·극단 질량비에 강함 |
| 자유도 추가/제거 | 런타임 쉽게 붙였다 뗌 | 위상(topology) 변경 비쌈 (사슬 재구성) |
| 충돌 | 자연스럽게 통합 | 충돌 임펄스를 별도로 articulation 에 투영해야 |

요약: **maximal = 일반성·단순함, reduced = 정확성·강건함**. 게임은 둘을 *혼용* — 일반 강체/접촉은 maximal 임펄스 솔버, 정확이 필요한 관절체(차량 드라이브트레인, 정밀 ragdoll, 로봇)는 reduced articulation.

### 2.7 Featherstone / Articulated Body Algorithm (ABA)

축소 좌표 순방향 동역학(forward dynamics: 토크 → 가속도)을 **O(n)** 으로 푸는 알고리즘. n = 관절 수. 사슬을 base 에서 말단까지(또는 거꾸로) 한 번씩 훑는 세 패스로 구성된다.

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

수식 골격(공간 대수, 6-벡터 spatial algebra):

```
v_i = v_{parent} + S_i q̇_i               // 공간 속도 전파, S_i = 관절 motion subspace (축)
I^A_i, p^A_i 누적:                         // articulated inertia / bias force
   U_i = I^A_i S_i ,  D_i = S_iᵀ U_i      // D_i = 관절공간 유효 질량 (scalar~m×m)
   u_i = τ_i − S_iᵀ p^A_i
   부모로 접기: I^A_parent += I_i − U_i D_i⁻¹ U_iᵀ   (자식 효과를 부모 관성에 흡수)
a_i = a_{parent} + S_i q̈_i ,  q̈_i = D_i⁻¹ (u_i − U_iᵀ a_{parent})
```

**왜 축소 좌표가 드리프트 없는 정확한 관절체를 주는가** — 핵심 통찰:

- 상태가 *관절각 q 그 자체*다. ball-socket 이 "붙어 있다"는 사실은 풀어야 할 구속이 아니라 **좌표 정의에 내장**되어 있다. 분리가 표현 불가능하므로 분리 드리프트가 0.
- maximal 은 "12개 DOF 를 자유로 두고 6개를 도로 묶는" 방식이라 반복마다 위반이 새고 Baumgarte 로 보정 → 에너지 오차·드리프트. reduced 는 *허용된 DOF 만* 들고 시작하므로 보정할 위반이 없다.
- ABA 는 그 reduced 모델의 순방향 동역학을 **반복 없이 한 번에, O(n)** 으로 정확히 푼다. (대안: 관절공간 관성행렬 H 를 만들어 H q̈ = τ − C 를 직접 푸는 CRBA + 선형해법 = O(n³) 또는 O(n²) — ABA 가 더 빠르고 사슬형에 자연스럽다.)

**충돌·접촉과의 결합**: articulation 은 그 자체로 닫힌 해를 주지만, 외부 접촉이 생기면 그 접촉 임펄스를 관절공간으로 투영해 함께 풀어야 한다. 실무 엔진은 ABA 의 유효 관성을 이용해 contact 를 articulation 위에서 PGS/TGS 로 반복하거나, articulated body 와 rigid contact 를 한 글로벌 솔버에 섞는다.

---

## 3. 주요 기법/도구

- **Soft constraint 통합**: hard joint·limit·motor·spring 을 compliance α 한 파라미터로 연속 표현(05 의 XPBD/TGS soft). 강성을 안전하게 무한대까지 밀 수 있음.
- **Swing-twist 분해**: 사원수를 swing(원뿔 회전) + twist(축 회전)로 분해해 ragdoll 관절 한계를 해부학적으로 부여.
- **Warm starting**: 조인트도 직전 프레임 λ 를 초기값으로 — 사슬 솔버 수렴을 크게 가속(05 와 동일).
- **Mini-island / sub-stepping**: 무거운 관절체는 substep 으로 Δt 를 잘게 쪼개 안정화(TGS 가 substep 기반).
- **Featherstone/ABA**: O(n) 축소 좌표 순방향 동역학. CRBA(관절공간 관성행렬 구축)·RNEA(역동역학, O(n))와 한 묶음.
- **Stabilization**: 축소 좌표라도 수치 적분 오차로 사슬이 미세하게 늘 수 있어, 위치 보정/projection 을 추가하는 구현도 있음.

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

## 5. 함정·결정론 주의

- **무거운 부모 ↔ 가벼운 자식 질량비**: maximal 반복 솔버(PGS/sequential impulse)의 고질병. 질량비가 크면 수렴이 극도로 느려 사슬이 떨리거나 늘어난다. 완화책: 반복 수 ↑, TGS substep, warm start, 질량비 인위적 압축(가벼운 본 질량을 올림), 또는 **reduced 좌표로 전환**(질량비에 본질적으로 강건).
- **긴 사슬 = 정보 전파 지연**: PGS 는 한 반복에 이웃끼리만 정보 교환 → n-링크 사슬은 정보가 끝까지 가는 데 ~n 반복 필요. 반복 부족 시 사슬이 "고무줄"처럼 늘어남. (reduced/ABA 는 한 패스로 전체 전파 → 이 문제 없음.)
- **조인트 한계 = 부등식**: 등식 조인트와 달리 limit 은 접촉처럼 λ clamp 필요. clamp 누락 시 한계가 양방향으로 끌어당겨 본이 한계각에 "달라붙음".
- **자기충돌 미설정**: 인접 본 충돌을 안 끄면 첫 프레임에 폭발. 조인트-연결 쌍 충돌 무시는 거의 필수.
- **soft drive 발산**: 명시적 PD 모터는 k_p 가 크면 발산(Δt·k_p 가 안정 한계 초과). soft constraint/implicit 표현으로 회피.
- **결정론**:
  - **연산 순서 고정** — 조인트/한계/모터 해법 순서, 사슬 순회 순서가 결과를 바꾼다. island 내 정렬 키를 안정적으로([12](12-determinism-networking.md), [13](13-performance-parallelism.md)).
  - **사원수 정규화·swing-twist 분해**가 float 누적오차에 민감 — 분해 알고리즘과 정규화 시점을 모든 머신에서 동일하게.
  - **reduced vs maximal 혼용 시** 두 솔버의 부동소수점 경로가 달라 재현성 관리 포인트가 늘어남.
  - **warm-start 캐시**는 프레임 간 상태 → rollback([12](12-determinism-networking.md)) 시 함께 저장/복원해야 재현됨.
  - 결정론 목표면 fixed timestep·고정 substep 수·고정 반복 수를 박을 것([03](03-time-integration.md)).

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
