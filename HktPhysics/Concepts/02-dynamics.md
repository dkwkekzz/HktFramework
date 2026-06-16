# [02] 동역학 (Dynamics) — 허브

> 힘(force)이 운동을 만든다 — 질량·관성·힘/토크에서 가속도를 끌어내 강체의 6자유도 운동방정식(Newton–Euler)을 세우는 분기. 운동학([01])이 "어떻게 움직이는가"라면, 동역학은 "왜 그렇게 움직이는가"를 푼다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [02-dynamics/](02-dynamics/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md)

---

## 1. 위치와 역할

동역학(dynamics)은 DAG 에서 `[01 운동학] → [02 동역학] → [03 적분]` 의 한가운데 노드다. 운동학이 위치·속도·가속도와 회전 표현(사원수/회전행렬)을 *기술*했다면, 동역학은 그 가속도가 **어디서 오는가** — 즉 힘과 토크, 질량과 관성으로부터 가속도를 계산하는 인과 모델을 제공한다.

```
[01] pose, velocity (상태)  ──┐
[02] force, torque, mass, I  ──┤──→  가속도 a, 각가속도 α  ──→  [03] 적분 ──→ 다음 상태
```

이 분기의 산출물은 한 문장으로 요약된다:

> **상태(state) = pose + velocity, 그 미분(derivative) = force/torque 로부터 얻은 가속도.**
> 이 "상태 → 미분" 함수가 곧 [03] 적분기가 시간으로 굴리는 ODE 의 우변(right-hand side)이다.

따라서 동역학은 충돌·구속 솔버([04]/[05])가 만들어내는 **충격량(impulse)** 과 외력(중력·항력 등)을 모두 받아, "이 강체의 가속도는 무엇인가"라는 질문에 답하는 계층이다. 강체 6DOF 의 정확한 운동방정식(Newton–Euler)과 그 핵심 데이터 구조인 **관성텐서(inertia tensor)** 가 이 분기의 두 기둥이다.

### 적분으로의 인계 (→ [03])

이 분기의 모든 것을 한 함수로 압축하면:

```
상태 state = { pose: (x, q),  velocity: (v, ω) }

미분 derivative(state, forces) :
    a = invMass · F_total
    α = invI_world · ( τ_total − ω × (I_world · ω) )   # 자이로 항(옵션)
    return { ẋ = v,  q̇ = ½·ω⊗q,  v̇ = a,  ω̇ = α }
```

이 `derivative` 함수가 정확히 [03-time-integration](03-time-integration.md) 적분기가 dt 만큼 전진시키는 ODE 의 우변이다.
- `ẋ = v`, `q̇ = ½·ω⊗q`(사원수 미분, [01] 참조)는 **운동학** 부분 — 속도가 pose 를 어떻게 바꾸는가.
- `v̇ = a`, `ω̇ = α` 는 **동역학** 부분 — 힘/토크가 속도를 어떻게 바꾸는가. 이 분기가 채운 것이 바로 여기다.

동역학은 "한 순간의 가속도"까지만 책임진다. 그것을 시간으로 굴려 다음 상태를 만드는 일은 [03] 적분기의 몫이고, 그 사이에 충돌·구속이 속도에 충격량을 주입한다([04]/[05]).

---

## 2. 하위 문서 인덱스 (세부 이론)

동역학은 직관 단위로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [02-dynamics/01-newton-laws.md](02-dynamics/01-newton-laws.md) | 뉴턴 법칙·힘 | 3법칙·`a=F/m`·invMass·중력/스프링/항력 |
| 2.2 | [02-dynamics/02-torque.md](02-dynamics/02-torque.md) | 토크와 외적의 물리 | `τ=r×F`·지렛대·`τ=dL/dt`·오프센터 힘 |
| 2.3 | [02-dynamics/03-momentum-impulse.md](02-dynamics/03-momentum-impulse.md) | 운동량·충격량 | `p=m·v`·`L=I·ω`·`J=Δp`·충격량 솔버 |
| 2.4 | [02-dynamics/04-inertia-tensor.md](02-dynamics/04-inertia-tensor.md) | 관성텐서 | 부피 적분·주축·평행축·`R·I·Rᵀ`·형상 공식 |
| 2.4a | [02-dynamics/04a-inertia-tensor-geometric.md](02-dynamics/04a-inertia-tensor-geometric.md) | 관성텐서 기하학적 심화 | 왜 텐서인가·`L≠ω`·고유분해 주축·평행축 유도·합동변환 |
| 2.5 | [02-dynamics/05-mass-properties.md](02-dynamics/05-mass-properties.md) | 무게중심·합성 강체 | CoM 정의·질량 속성 절차·Mirtich |
| 2.6 | [02-dynamics/06-newton-euler.md](02-dynamics/06-newton-euler.md) | Newton–Euler 방정식 | 6DOF·자이로 항 `ω×(I·ω)`·세차·body frame |
| 2.7 | [02-dynamics/07-energy.md](02-dynamics/07-energy.md) | 에너지(보존 vs 소산) | KE/PE·일–에너지 정리·적분기 진단 신호 |
| 2.8 | [02-dynamics/08-lagrangian.md](02-dynamics/08-lagrangian.md) | Lagrangian/Hamiltonian | 일반화 좌표·축소 vs 최대 좌표·심플렉틱 다리 |

---

## 3. 한눈 요약 — 선형 ↔ 회전 대응

동역학의 뼈대는 "선형의 모든 양에 회전 짝이 있다"는 대응 구조다. 단 하나의 비대칭이 **질량은 스칼라, 관성은 텐서**라는 점이고, 거기서 회전의 모든 까다로움이 나온다.

| 선형 (병진) | 회전 |
|---|---|
| 힘 `F` | 토크 `τ = r × F` |
| 질량 `m` (스칼라) | 관성텐서 `I` (**3×3, 방향 의존**) |
| 가속도 `a` | 각가속도 `α` |
| 운동량 `p = m·v` | 각운동량 `L = I·ω` (`L`∦`ω`) |
| `F = m·a = dp/dt` | `τ = I·α + ω×(I·ω) = dL/dt` |
| 충격량 `J = Δp`, `Δv = J·invMass` | 각충격량 `r×J = ΔL`, `Δω = invI·(r×J)` |
| 운동E `½m|v|²` | 회전E `½ωᵀIω` |

**고정체 표현** — 엔진은 `m`/`I` 대신 `invMass = 1/m`, `invI = I⁻¹` 를 저장한다. 곱셈으로 솔버를 가속하고, `invMass = 0` 으로 무한 질량(static)을 분기 없이 표현한다([02-dynamics/01](02-dynamics/01-newton-laws.md)).

**2D 붕괴** — 2D는 회전축이 화면 수직 하나뿐이라 관성텐서가 단일 스칼라로 붕괴하고 자이로 항이 사라진다(Box2D 가 단순한 이유). 텐서 논의 대부분이 1 float 로 줄어든다([02-dynamics/04a §6](02-dynamics/04a-inertia-tensor-geometric.md)).

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 동역학 관련 선택 |
|---|---|
| **Box2D** | 2D 라 관성이 스칼라(텐서 불필요) — `I` 는 단일 float, 회전은 1DOF. 동역학 코드가 단순해 교과서적 명료함의 원천. `invMass`/`invI` 저장, 충격량 솔버. |
| **Bullet** | `btRigidBody` 가 `m_invMass`(스칼라) + `m_invInertiaTensorWorld`(3×3) 저장. body 관성은 대각벡터 `m_invInertiaLocal` 로 보관, 매 스텝 `R·invI·Rᵀ` 로 world 갱신. 자이로스코픽은 `BT_ENABLE_GYROSCOPIC_*` 플래그(implicit/explicit world 선택). |
| **PhysX** | 질량 속성을 콜라이더에서 자동 계산(`PxRigidBodyExt::updateMassAndInertia`), 관성은 **대각(principal)** 으로 저장 + body 자세. 자이로스코픽 항은 옵션. TGS 솔버가 충격량을 다룸([05]). |
| **Jolt** | `MotionProperties` 에 `mInvMass` + `mInvInertiaDiagonal`(대각) + `mInertiaRotation`(주축 회전 사원수). 대각+회전 표현으로 `invI` 변환이 싸고 결정론적. 콜라이더 모양에서 질량 속성 자동 산출. |
| **Havok** | 상용 AAA. 질량 속성·관성 자동화 + 결정론 옵션 제공. 빠른 솔버에 맞춰 invMass/invI 캐시. |
| **Chaos (UE5)** | `FParticles`/`FRigidParticles` 에 `M`, `InvM`, `I`, `InvI` 를 SoA 로 보관(SIMD·병렬 친화). 관성 대각 표현, 질량 속성은 지오메트리에서 산출. |

**공통 패턴 요약**
- 거의 모두 `invMass`(스칼라) + `invI`(대각벡터 + 본체 회전)로 저장한다. 풀 3×3 을 상시 들고 다니는 엔진은 드물다([02-dynamics/04](02-dynamics/04-inertia-tensor.md)).
- 질량 속성(질량·CoM·관성)은 **콜라이더 모양에서 자동 산출**하는 게 표준 — 수동 입력은 오버라이드용([02-dynamics/05](02-dynamics/05-mass-properties.md)).
- 자이로스코픽 항은 **기본 off 또는 옵션** 이 다수 — 빠른 자전이 드물고 안정성/결정론 비용이 크기 때문([02-dynamics/06](02-dynamics/06-newton-euler.md)).
- 2D 엔진(Box2D)은 관성이 스칼라라 텐서 논의 대부분이 단일 float 로 붕괴한다.

**주요 기법/도구**

| 기법 | 무엇 | 어디 쓰나 |
|---|---|---|
| **inverse mass / inverse inertia** | `invMass=1/m`, `invI=I⁻¹` 저장 | 적분·솔버 가속, static 을 `0` 으로 표현 |
| **역질량 0 = 고정체** | 무한 질량 ⇒ 가속도 0 | static/kinematic body, 분기 없는 솔버 |
| **충격량 적용** `Δv = J·invMass` | 힘 대신 속도 점프 | 충돌·구속 솔버([05])의 기본 단위 |
| **각충격량** `Δω = invI·(r×J)` | 오프센터 충격의 회전 효과 | 접촉점이 CoM 밖일 때 |
| **평행축 정리** | 부품 I 를 CoM 으로 이동·합산 | 합성 강체 질량 속성 |
| **대각화/주축 저장** | I 를 (대각벡터 + 회전)으로 | `invI` 저렴 계산, 메모리 절약 |
| **I_world = R·I_body·Rᵀ** | 매 프레임 텐서 회전 | 회전 중 물체의 정확한 토크 응답 |
| **Mirtich 부피 적분** | 볼록 메시의 m·CoM·I 자동 산출 | 콜라이더→강체 질량 속성 |
| **자이로스코픽 항 토글** | `ω×(I·ω)` on/off | 자전 물체 정확도 vs 안정성·결정론 |

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **body 텐서를 world 에서 그대로 사용** — 가장 흔한 버그. 회전 중인 물체는 매 프레임 `I_world = R·I_body·Rᵀ` 로 변환해야 한다. 빼먹으면 토크 응답이 회전에 따라 틀어진다. ([02-dynamics/04](02-dynamics/04-inertia-tensor.md), 유도는 [02-dynamics/04a §5](02-dynamics/04a-inertia-tensor-geometric.md))
- **CoM 이 원점이 아닌 좌표에서 토크 계산** — `τ = r × F` 의 `r` 은 반드시 **무게중심 기준** 위치여야 한다. 모델 피벗(pivot)을 CoM 으로 착각하면 회전이 어긋난다. ([02-dynamics/02](02-dynamics/02-torque.md), [02-dynamics/05](02-dynamics/05-mass-properties.md))
- **자이로스코픽 항의 발산** — explicit Euler 에서 `ω × (I·ω)` 는 에너지를 만들어 발산하기 쉽다. 켤 거면 implicit 처리하거나 작은 dt 가 필요. 켜고/끄는 선택이 **결정론 분기**다 — 네트워크 양단이 동일해야 함([12]). ([02-dynamics/06](02-dynamics/06-newton-euler.md))
- **각도 좌표/사원수 정규화 누락** — 회전 적분 후 사원수를 정규화하지 않으면 스케일 드리프트로 관성/토크가 왜곡된다([01]). ([02-dynamics/06](02-dynamics/06-newton-euler.md))
- **단위·부호 규약 불일치** — 곱 관성(products of inertia)의 부호 관례가 자료마다 다르다. 평행축 정리·world 변환과 자기 일관성을 검증할 것(삼각부등식 체크). ([02-dynamics/04](02-dynamics/04-inertia-tensor.md), [02-dynamics/04a §7](02-dynamics/04a-inertia-tensor-geometric.md))
- **강성 스프링/항력을 외력으로** — 큰 `k`/`b` 를 explicit 외력으로 적분하면 발산. implicit([03]) 또는 구속([05])으로 옮긴다. ([02-dynamics/01](02-dynamics/01-newton-laws.md))
- **연산 순서 = 결정론** — 여러 힘/충격량을 누적할 때 부동소수 덧셈은 비결합적이다. 누적 순서가 프레임/머신마다 같아야 lockstep 동기화가 깨지지 않는다([12]). fixed-point 를 쓰면 더 강하게 보장된다. ([02-dynamics/03](02-dynamics/03-momentum-impulse.md))
- **자동 산출 질량 속성의 함정** — 콜라이더에서 산출한 관성이 물리적으로 무효(삼각부등식 위반)면 적분이 폭발한다. 비정상적으로 얇은/큰 모양은 클램프하거나 검증할 것. ([02-dynamics/05](02-dynamics/05-mass-properties.md))
- **무한/0 질량 혼용** — static(`invMass=0`)과 동적 물체가 충돌할 때 양쪽 `invMass` 합으로 정규화하는데, 둘 다 0 이면 0 나눗셈이 난다. static–static 쌍은 솔버 진입 전에 걸러야 한다([05]). ([02-dynamics/01](02-dynamics/01-newton-laws.md))

---

## 6. 더 읽기 / 관련 노드

- **선행** — [00-foundations.md](00-foundations.md): 외적·행렬·사원수, 부동소수점 누적 오차. [01-kinematics.md](01-kinematics.md): 회전 표현, `ω`, 사원수 미분 `q̇ = ½ω⊗q`, 좌표 프레임.
- **직접 후속** — [03-time-integration.md](03-time-integration.md): 이 분기의 `derivative()` 를 dt 로 굴리는 적분기, 에너지 드리프트, symplectic/implicit.
- **충격량의 소비자** — [05-constraint-solving.md](05-constraint-solving.md): `Δv=J·invMass`·`Δω=invI·(r×J)` 를 반복 적용하는 contact/friction/joint 솔버. 충돌 기하는 [04-collision-detection.md](04-collision-detection.md).
- **축소 좌표로의 분기** — [06-joints-articulation.md](06-joints-articulation.md): [02-dynamics/08](02-dynamics/08-lagrangian.md) 의 일반화 좌표가 Featherstone/ABA 관절체로 구체화. ragdoll·차량은 [10-specialized-systems.md](10-specialized-systems.md).
- **횡단** — [12-determinism-networking.md](12-determinism-networking.md): 자이로 항 토글·연산 순서·fixed-point 가 동역학 결정론에 거는 제약. [13-performance-parallelism.md](13-performance-parallelism.md): invMass/invI 의 SoA 배치·SIMD.

**외부 레퍼런스**
- David H. Eberly, *Game Physics* — 질량 속성·관성텐서·Newton–Euler 의 백과사전급 레퍼런스.
- Ian Millington, *Game Physics Engine Development* — 밑바닥부터 강체 동역학 엔진을 만드는 입문서.
- Brian Mirtich, "Fast and Accurate Computation of Polyhedral Mass Properties" (1996) — 볼록 메시 질량 속성 산출의 표준.
- David Baraff, "An Introduction to Physically Based Modeling" (SIGGRAPH course) — 강체 동역학·Newton–Euler 의 고전 강의록.
- Erin Catto (Box2D), GDC 강연 — 충격량 솔버와 동역학 실무.

---

> 한 줄 정리: 동역학은 "힘·토크 + 질량·관성텐서 → 가속도·각가속도"를 Newton–Euler 로 풀어, 충격량을 단위로 솔버와 주고받고, 그 가속도를 [03] 적분기에 넘기는 강체 운동의 인과 엔진이다.
