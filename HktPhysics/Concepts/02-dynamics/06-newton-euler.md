# [02.6] Newton–Euler 방정식 (Newton–Euler Equations)

> 강체 6자유도(병진 3 + 회전 3)의 운동방정식. 병진은 친숙한 `F = m·a`, 회전은 `τ = I·α + ω×(I·ω)`로 자이로 항(gyroscopic term)이라는 비선형 짐이 붙는다. 본 문서는 그 자이로 항이 어디서 오는지(`L∦ω`), 세차를 어떻게 낳는지, 그리고 explicit 적분에서 왜 발산하며 implicit으로 어떻게 길들이는지 — 그리고 그 토글이 왜 결정론 분기인지를 다룬다.
> **상위 허브**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md)

---

## 1. 왜 필요한가 — 6DOF 의 완전한 운동방정식

자유 강체는 6자유도다: CoM의 병진 3 + 자세(orientation)의 회전 3. 동역학 분기의 산출물은 "힘·토크가 주어졌을 때 이 6DOF의 가속도(`a`, `α`)는 무엇인가"이고, 그 답이 Newton–Euler 방정식이다. 이것이 [../03-time-integration.md](../03-time-integration.md) 적분기가 굴리는 ODE의 우변(허브 §1의 `derivative()`)을 채운다.

병진과 회전을 나란히:

```
Newton (병진):   F = m · a              = dp/dt          (p = m·v)
Euler  (회전):   τ = I·α + ω×(I·ω)      = dL/dt          (L = I·ω)
```

병진은 깔끔하다 — `m`이 스칼라라 `a = F/m`. 회전은 `I`가 텐서라 `ω×(I·ω)`라는 추가 항이 붙는다. 이 항이 본 문서의 주인공이다.

---

## 2. Euler 방정식 유도 — 자이로 항은 어디서 오는가

회전의 기본 법칙은 `τ = dL/dt` (각운동량의 시간변화율, [03-momentum-impulse.md](03-momentum-impulse.md)). `L = I·ω`인데, **`I`가 시간에 따라 변한다**는 게 핵심이다 — 물체가 회전하면 world 좌표에서 본 관성텐서 `I_world = R·I_body·Rᵀ`가 매 순간 달라지니까([04a §5](04a-inertia-tensor-geometric.md)).

곱의 미분:

```
τ = dL/dt = d(I·ω)/dt = (dI/dt)·ω + I·(dω/dt) = (dI/dt)·ω + I·α
```

`dI/dt`가 0이 아니라서 `I·α` 외에 항이 더 생긴다. body frame에서 보면(아래 §4) `dI/dt` 항이 정확히 `ω×(I·ω)`로 정리된다:

```
τ = I·α + ω×(I·ω)
⟹  α = invI·( τ − ω×(I·ω) )
```

`ω×(I·ω)`이 **자이로스코픽 항**(gyroscopic term)이다. 외부 토크가 없어도(`τ=0`) `ω`가 변하게 만드는 항 — 회전축 자체가 움직인다. 그 근원은 `L ∦ ω`([04a §2](04a-inertia-tensor-geometric.md)): `L`은 보존되는데 `ω`가 `L`과 어긋나 있으면 `ω`가 `L` 주위를 돌 수밖에 없다.

**언제 0인가:**
- 구형 관성(`I = c·E`, 모든 축 동일): `ω×(c·ω) = c·(ω×ω) = 0`. 자이로 항 없음.
- `ω`가 주축 정렬: `I·ω ∥ ω`라 외적 0. 깨끗한 회전.
- 2D: `ω`와 `I·ω` 둘 다 z축이라 외적 0([04a §6](04a-inertia-tensor-geometric.md)). Box2D에 자이로 항이 없는 이유.

---

## 3. 세차 (Precession) — 자이로 항의 가시적 효과

`τ = 0`인 자유 회전체를 보자. `L`은 공간에 대해 보존된다. 그런데 물체가 비대칭(`I₁≠I₂≠I₃`)이고 `ω`가 주축이 아니면, `ω`는 `L`을 고정한 채 그 주위를 돈다 — 이것이 **세차(precession)**다.

직관: `L = I·ω`에서 `ω`가 살짝 어긋나면 `I`가 그 어긋남을 비틀어 `L`과 다른 방향의 토크 효과를 만들고, 그 결과 `ω`가 원뿔을 그리며 돈다. 관찰되는 현상:

- **던진 스마트폰/책의 비틀거림** — 중간 주축(`I₂`)으로 던지면 불안정(테니스 라켓 정리, 중간축 정리). 최대/최소 주축은 안정, 중간축은 발산.
- **자이로스코프·팽이의 세차** — 중력 토크가 있으면 `L`이 천천히 원을 그린다.
- **회전하는 비대칭 잔해(debris)·발사체** — 정확히 모델링하려면 자이로 항이 필요.

게임에선 이 효과가 드물고(빠른 자전 물체가 흔치 않음) 비싸서, 자이로 항을 **기본 off 또는 옵션**으로 둔다(허브 §4). 켜면 정확하지만 안정성·결정론 비용이 따른다(§5).

**중간축 정리(테니스 라켓 정리) 직관.** body frame Euler 식(§4)을 `τ=0`, 주축으로 두면, `I₁<I₂<I₃`일 때 최대축(`I₃`)·최소축(`I₁`) 근방의 작은 교란은 진동(안정)으로 남지만 중간축(`I₂`) 근방의 교란은 **지수적으로 커진다**(불안정). 선형화하면 중간축에서 고유값이 실수 양수가 되기 때문 — 그래서 중간축으로 던진 물체가 반바퀴 뒤집히는 플립을 반복한다. 비대칭 잔해·발사체 연출에서 이 불안정성이 "생동감"의 근원이고, 끄면(자이로 off) 사라진다.

---

## 4. body frame 정식화 — Euler 방정식의 본가

자이로 항은 **body(본체) 좌표**에서 가장 깔끔하다. body frame에서는 관성텐서가 상수(`I_body` 고정, 회전해도 안 변함)라 `dI/dt` 골칫거리가 사라지고, 대신 회전하는 프레임이라 코리올리류 항으로 자이로가 명시적으로 나타난다. 주축 정렬 body frame에서:

```
I₁·ω̇₁ = τ₁ + (I₂ − I₃)·ω₂·ω₃
I₂·ω̇₂ = τ₂ + (I₃ − I₁)·ω₃·ω₁
I₃·ω̇₃ = τ₃ + (I₁ − I₂)·ω₁·ω₂          (Euler's equations, principal axes)
```

`(I₂−I₃)ω₂ω₃` 등이 자이로 항의 성분 형태다. `I₁=I₂=I₃`(구형)이면 모두 0 — §2와 일치. 이 형태가 세차(§3)를 직접 보여준다: `τ=0`에서도 주관성모멘트가 다르면 `ω`성분들이 서로 결합해 진동한다.

**좌표 선택 (실무):**
- **body frame 적분:** `I_body` 상수라 자이로 항이 위 식으로 싸게 나온다. 단 토크·`ω`를 매 스텝 body↔world 변환해야 함.
- **world frame 적분:** `α = invI_world·(τ − ω×(I_world·ω))`, `I_world = R·invI_body⁻¹·Rᵀ` 갱신([04a §5](04a-inertia-tensor-geometric.md)). 충돌·구속이 world에서 오니 변환이 덜 필요. Bullet의 자이로 플래그가 implicit/explicit **world** 처리를 선택(허브 §4).

회전 적분(`q̇ = ½ω⊗q`)과 사원수 재정규화는 [../03-time-integration.md](../03-time-integration.md)의 회전 적분 분기 담당. **재정규화를 빼먹으면** 사원수 스케일 드리프트로 관성·토크가 왜곡된다(허브 §5).

**한 스텝 전체 의사코드(world frame, 자이로 옵션).** 동역학이 적분기에 넘기는 `derivative()`의 회전 부분(허브 §1)을 구체화하면:

```
step_rotation(body, τ_total, dt):
    R = body.q.to_matrix()                       # body→world ([01])
    invI_world = R · body.invI_body · Rᵀ          # [04a §5], 대각이면 R·diag·Rᵀ
    if gyroscopic_on:
        I_world = R · body.I_body · Rᵀ
        gyro = body.ω × (I_world · body.ω)        # ω×(I·ω)
        # implicit이면 §5의 Newton 1-step으로 gyro 흡수
    else:
        gyro = 0
    α = invI_world · (τ_total − gyro)             # 각가속도
    body.ω += dt · α                              # 속도 갱신(병진과 동일 패턴)
    body.q  = integrate_quat(body.q, body.ω, dt)  # q̇=½ω⊗q, [../03]
    body.q.normalize()                            # 재정규화 필수
```

병진 부분은 같은 골격에서 `a = invMass·F_total`, `v += dt·a`, `x += dt·v`로 더 단순하다 — 6DOF가 이렇게 병진 3 + 회전 3으로 나뉘어 흐른다.

---

## 5. 자이로 항의 발산과 implicit 처리

**문제 — explicit Euler에서 에너지 생성.** 자이로 항 `ω×(I·ω)`을 explicit(전진 Euler)으로 적분하면, 빠른 자전 물체에서 수치적으로 **에너지를 만들어내며 발산**한다(허브 §5). 자이로 항은 보존력(에너지 일정해야 함)인데, explicit 이산화가 매 스텝 작은 에너지를 주입해 `ω`가 점점 커지다 폭발한다([07-energy.md](07-energy.md)의 에너지 드리프트 진단).

```
explicit:  ω_{n+1} = ω_n + dt·invI·( τ − ω_n×(I·ω_n) )   # ← 빠른 자전 시 발산
```

**해법 1 — implicit/암묵 처리.** 자이로 항을 다음 스텝 `ω_{n+1}`에서 평가하는 implicit 형태로 풀면 에너지가 유계로 잡힌다. 비선형이라 보통 1회 Newton 반복으로 근사한다(Bullet의 implicit gyroscopic):

```
# 자이로만 암묵화 — 잔차 g(ω*) = ω* − ω_n + dt·invI·( ω*×(I·ω*) ) = 0
# 야코비안 J = E + dt·invI·( skew(ω*)·I − skew(I·ω*) )
ω* = ω_n
repeat 1회(또는 수렴까지):
    ω* = ω* − J⁻¹·g(ω*)
ω_{n+1} = ω*    (외부 토크 τ는 별도 적용)
```

**해법 2 — body frame + 작은 dt.** body frame Euler 식(§4)을 작은 timestep으로 적분하면 explicit도 견딜 만하다. 그래도 빠른 자전에선 substep이 필요.

**왜 explicit이 에너지를 만드는가 (수치 직관).** 자이로 항은 `ω`에 수직이라 일을 하지 않아야 하고([07-energy.md](07-energy.md) §4) 따라서 `|L|`·`KE_rot`을 보존해야 한다. 그런데 explicit는 스텝 시작점 `ω_n`에서 `ω×(I·ω)`을 평가해 그 방향으로 직선 전진한다 — 곡선(원뿔 세차) 궤적을 접선으로 근사하니 매 스텝 바깥으로 살짝 벗어나고, 그 벗어남이 `|ω|`를 키운다. 빠른 자전일수록 곡률이 커 오차가 누적되어 폭발한다. 빠른 팽이를 explicit으로 굴리면 몇 백 스텝 안에 `KE_rot`이 단조 증가하는 게 보인다 — 이 단조 증가가 곧 진단 신호([07-energy.md](07-energy.md) §5).

**해법 3 — 그냥 끈다.** 게임 대부분은 자이로 항을 끄고(`α = invI·τ`만) 산다 — 빠른 자전이 드물고, 끄면 무조건 안정·싸다. 정확한 세차가 필요한 특수 물체만 켠다.

```
토글:
  off  : α = invI·τ                              # 안정·싸다·근사
  on   : α = invI·(τ − ω×(I·ω)), implicit 처리    # 정확한 세차·비싸다
```

---

## 6. 결정론 토글 — 자이로 항은 분기점이다

자이로 항을 켜고/끄는 선택, 그리고 explicit/implicit 중 어느 처리를 쓰는가는 **결정론 분기**다(허브 §5, [../12-determinism-networking.md](../12-determinism-networking.md)). 이유:

- 자이로 항은 비선형이라 부동소수 연산 순서·반복 횟수에 민감하다. implicit Newton 반복 횟수가 머신마다 다르면 `ω`가 갈린다.
- 네트워크 lockstep에서 양단이 **동일한 토글·동일한 반복 수·동일한 연산 순서**를 써야 한다. 한쪽만 자이로 on이면 시뮬레이션이 즉시 발산.
- 그래서 결정론이 필요한 게임은 자이로 항을 **끄거나**(가장 안전), 켤 거면 고정 반복 수·고정 dt·fixed-point까지 통일한다([../12-determinism-networking.md](../12-determinism-networking.md)).

```
결정론 체크리스트(자이로):
  □ 모든 피어가 동일 토글(on/off)
  □ implicit 반복 횟수 고정·동일
  □ ω×(I·ω) 연산 순서 비트 동일
  □ dt·substep 동일
```

---

## 7. 실무

- **기본 off가 다수:** 빠른 자전이 드물고 안정성·결정론 비용이 커서 자이로 항은 기본 off 또는 옵션(허브 §4). Box2D는 2D라 항 자체가 없음([04a §6](04a-inertia-tensor-geometric.md)).
- **Bullet:** `BT_ENABLE_GYROSCOPIC_FORCE_*` 플래그로 implicit/explicit world 중 선택(허브 §4). implicit이 기본 권장 — 발산 방지.
- **PhysX/Jolt/Chaos:** 자이로 항 옵션 제공, 대각 관성 저장으로 body frame 식이 싸다. 결정론 모드에선 통일.
- **켤 때 규칙:** explicit 금지(발산). implicit 또는 작은 dt. 사원수 재정규화 필수.
- **6DOF 분리:** 병진(`a=F/m`)과 회전(`α=invI(τ−ω×Iω)`)은 독립적으로 적분기에 넘어간다(허브 §1 `derivative()`). 충돌·구속의 충격량은 그 사이 `Δv·Δω`로 주입([../05-constraint-solving.md](../05-constraint-solving.md)).

**함정 체크리스트(Newton–Euler)**
- body 텐서를 world에서 그대로 사용 — 매 스텝 `R·I·Rᵀ` 갱신 필수([04a §5](04a-inertia-tensor-geometric.md)). 1순위 버그.
- `τ=r×F`의 `r`을 CoM 기준이 아닌 모델 피벗으로 잡음 — 회전 어긋남([02-torque.md](02-torque.md), [05-mass-properties.md](05-mass-properties.md)).
- 자이로 항을 explicit으로 적분 — 빠른 자전에서 발산. implicit 또는 off(§5).
- 사원수 재정규화 누락 — 스케일 드리프트로 관성·토크 왜곡(§4).
- 자이로 토글·반복 수·연산 순서가 피어 간 불일치 — lockstep 깨짐(§6).
- 무효 관성(삼각부등식 위반) 입력 — `invI·τ`가 폭주([05-mass-properties.md](05-mass-properties.md) §6).

---

## 더 읽기 / 관련 노드

- **선행·자매** — [04a-inertia-tensor-geometric.md](04a-inertia-tensor-geometric.md): `L∦ω`·world 변환(`R·I·Rᵀ`)·2D 붕괴 — 자이로 항의 기하 뿌리. [03-momentum-impulse.md](03-momentum-impulse.md): `τ=dL/dt`. [05-mass-properties.md](05-mass-properties.md): `m·I·CoM` 산출.
- **직접 후속** — [07-energy.md](07-energy.md): 자이로 항의 에너지 생성/드리프트를 적분기 진단 신호로. [08-lagrangian.md](08-lagrangian.md): 같은 운동을 일반화 좌표로.
- **적분** — [../03-time-integration.md](../03-time-integration.md): `derivative()`를 dt로 굴리는 적분기, 회전(사원수) 적분·재정규화, explicit↔implicit·symplectic.
- **횡단** — [../12-determinism-networking.md](../12-determinism-networking.md): 자이로 토글·연산 순서·fixed-point 제약. [../05-constraint-solving.md](../05-constraint-solving.md): 충격량 주입.

**외부 레퍼런스**
- David Baraff, "An Introduction to Physically Based Modeling" (SIGGRAPH course) — Newton–Euler·Euler 방정식의 고전 강의록.
- Ian Millington, *Game Physics Engine Development* — 강체 6DOF 적분 실전.

> 한 줄 정리: Newton–Euler는 6DOF 운동방정식 — 병진은 `F=ma`, 회전은 `τ=Iα+ω×(Iω)`로 자이로 항이 붙는다. 그 항은 `L∦ω`에서 나와 세차를 낳고, explicit으로 적분하면 에너지를 만들어 발산하므로 implicit 처리하거나 끈다 — 그 선택이 곧 결정론 분기다.
