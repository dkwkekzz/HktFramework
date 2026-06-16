# [03] 시간 적분 (Time Integration)

> 동역학이 만든 운동방정식(ODE)을 한 스텝씩 시간 전진시키는 분기 — 안정성·에너지·결정론이 여기서 갈린다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [02-dynamics.md](02-dynamics.md)

---

## 1. 위치와 역할

물리 한 프레임의 파이프라인에서 적분(integration)은 **힘 적용 직후, 충돌 감지 직전**에 위치한다.

```
forces 적용 → [03] 적분 → [04] 충돌 감지 → [05] 구속 해법 → 상태 commit
```

[02-dynamics.md](02-dynamics.md) 가 "지금 이 순간 가속도가 얼마인가"(`a = F/m`, `α = I⁻¹(τ − ω×Iω)`)를 준다면, 적분은 그 순간값을 받아 **유한한 시간 간격 dt 만큼 상태를 앞으로 굴린다**. 즉 적분기는 연속 미분방정식을 이산(discrete) 스텝으로 근사하는 *수치 적분(numerical ODE solver)* 이다.

이 분기가 게임 물리에서 유난히 중요한 이유:

- **안정성의 1차 결정자** — 같은 힘이라도 적분기 선택에 따라 시뮬레이션이 멀쩡히 돌거나 폭발(explosion)한다.
- **에너지 거동의 결정자** — 적분기에 따라 진자가 영원히 흔들리거나, 점점 빨라지거나, 점점 죽는다.
- **결정론의 토대** — 고정 timestep([12-determinism-networking.md](12-determinism-networking.md))은 사실상 적분 분기의 설계 선택이며, 렌더 보간([01-kinematics.md](01-kinematics.md))과 직결된다.
- **하위 솔버의 전제** — 변형체([07-deformable-bodies.md](07-deformable-bodies.md))·유체([08-fluids.md](08-fluids.md))·파티클([09-particles.md](09-particles.md))은 모두 적분기 위에 얹힌다. cloth/soft body 는 특히 *implicit* 적분을 요구한다.

---

## 2. 핵심 이론

### 2.1 ODE 로서의 운동방정식 · 상태공간

뉴턴 제2법칙은 2계 ODE 다.

```
m x''(t) = F(x, x', t)
```

수치 적분기는 보통 2계를 1계 연립으로 낮춘 **상태공간(state-space)** 형태를 다룬다. 상태 벡터를 `y = [x, v]` 로 잡으면:

```
d/dt [ x ]   =  [   v        ]
     [ v ]      [ F(x,v,t)/m ]

요약:  y' = f(y, t)
```

이렇게 두면 모든 적분기는 "`y' = f(y,t)` 를 푸는 일반 솔버"로 통일된다. 3D 강체라면 상태에 자세(quaternion `q`)와 각속도 `ω` 가 추가된다 — 회전 적분은 §2.8 에서 따로 다룬다.

목표는: 현재 상태 `y_n`(시각 `t_n`)에서 한 스텝 `dt` 뒤 `y_{n+1}`(시각 `t_n + dt`)를 구하는 것.

### 2.2 적분기 분류 (taxonomy)

두 축으로 나눈다.

| 축 | 분류 | 의미 |
|---|---|---|
| **명시성** | **Explicit (양해법)** | `y_{n+1}` 이 *과거/현재 값만으로* 직접 계산됨. 싸지만 조건부 안정. |
| | **Implicit (음해법)** | `y_{n+1}` 이 *자기 자신(미래 값)에* 의존 → 방정식을 풀어야 함. 비싸지만 무조건 안정. |
| **스텝 폭** | **Single-step** | 직전 한 스텝만 참조 (Euler, RK). |
| | **Multi-step** | 여러 과거 스텝 참조 (Adams 계열). 게임에선 거의 안 씀 — 충돌로 상태가 불연속해지면 과거 히스토리가 오염됨. |

게임 물리는 **single-step** 이 압도적이다(충돌·구속이 상태를 자주 끊어 버려 multi-step 의 누적 정확도 이점이 무의미). 그래서 아래는 single-step 위주로, explicit ↔ implicit 스펙트럼을 따라 본다.

> **분류상 핵심 직관**: explicit 은 "현재 기울기로 미래를 추측", implicit 은 "미래 기울기가 미래에 정합하도록 역으로 푼다". 안정성의 차이는 전부 여기서 나온다.

### 2.3 Explicit (Forward) Euler — 쓰면 안 되는 기준선

가장 단순한 적분기. 현재 도함수를 그대로 dt 만큼 외삽한다.

```
v_{n+1} = v_n + a_n · dt          (a_n = F(x_n, v_n)/m)
x_{n+1} = x_n + v_n · dt          ← 옛 속도 v_n 을 사용!
```

직관은 단순하지만 강체 물리에서는 **금기**에 가깝다. 이유는 안정성과 에너지.

**왜 에너지가 증가하는가** — 등속 원운동/조화진동(spring) 같은 보존계를 보면, forward Euler 는 매 스텝 *접선 방향으로 바깥쪽으로* 외삽한다. 그 결과 궤적이 나선형으로 *바깥으로* 퍼진다. 무중력 스프링(`a = −k x`)에 적용하면:

```
선형계 [x;v]_{n+1} = A [x;v]_n  의 증폭행렬 A 의 고윳값 크기 |λ| = sqrt(1 + (k/m)dt²) > 1
→ 매 스텝 진폭이 (1 + O(dt²)) 배 커진다 → 에너지가 단조 증가 → 폭발.
```

즉 어떤 dt 를 골라도 보존계에서 forward Euler 는 *무조건* 에너지를 주입한다(조건부로 "느리게" 폭발할 뿐). 안정 영역(stability region)이 허수축을 포함하지 못하기 때문 — 진동계(eigenvalue 가 순허수)는 절대 안정화 못 한다.

**정확도**: 1차(O(dt) 국소 절단오차의 누적, 전역 O(dt)). 싸고 부정확하고 불안정 — 교과서 출발점일 뿐.

### 2.4 Symplectic / Semi-implicit Euler — 게임 표준

forward Euler 에서 **순서 한 줄만 바꾸면** 거동이 극적으로 좋아진다. 속도를 먼저 갱신하고, *갱신된 새 속도*로 위치를 민다.

```
v_{n+1} = v_n + a_n · dt          ← 속도 먼저
x_{n+1} = x_n + v_{n+1} · dt      ← 새 속도 v_{n+1} 로 위치 (이 한 줄이 핵심)
```

이름이 여럿이다: **semi-implicit Euler**, **symplectic Euler**, **Euler–Cromer**, (게임 코드에서 종종) 그냥 "Euler". 정확도는 여전히 1차지만 거동은 완전히 다르다.

**왜 에너지가 보존(에 가까운가)** — 이 적분기는 *symplectic*(사교) 적분기다. 정확한 에너지 `H` 를 보존하지는 않지만, `H` 에 `O(dt)` 만큼 가까운 **수정 해밀토니안(shadow / modified Hamiltonian) `H̃`** 을 *정확히* 보존한다. 그래서 에너지가 단조 증가/감소하지 않고 참값 주위에서 **유계로 진동(bounded oscillation)** 한다 — 장시간 시뮬레이션에서도 폭발하거나 죽지 않는다.

```
스프링계 증폭행렬의 고윳값 크기 |λ| = 1   (dt < 2·sqrt(m/k) 인 한)
→ 진폭이 커지지도 작아지지도 않음. 위상만 약간 어긋남(주파수 오차).
```

**왜 거의 모든 강체 엔진이 이걸 쓰는가**:

1. **싸다** — forward Euler 와 연산량 동일. 함수평가 1회/스텝.
2. **장기 에너지 안정** — 게임은 수 시간 돌아도 안 터져야 한다. symplectic 의 유계 에너지 거동이 정확히 이 요구에 맞는다.
3. **구속 솔버와 궁합** — Box2D/PhysX/Bullet 류의 **속도 기반 sequential impulse**([05-constraint-solving.md](05-constraint-solving.md)) 파이프라인은 "속도를 먼저 적분 → 충돌/구속으로 속도를 보정 → 보정된 속도로 위치 전진" 구조다. 이게 바로 semi-implicit Euler 의 형태다. 적분기와 솔버가 자연스럽게 한 흐름이 된다.
4. **충분히 정확** — 게임은 우주 궤도 정밀도가 필요 없다. 시각적으로 그럴듯하고 안 터지면 된다.

> 결론: "정확도를 더 사면(RK4) 비싸지고, 그래도 symplectic 만큼 장기 안정하지 않다"가 게임이 semi-implicit Euler 를 표준으로 쓰는 한 줄 요약이다.

### 2.5 Verlet — 제약 기반 · 입자 · cloth 의 단골

Verlet 계열은 위치를 1급 시민으로 두는 적분기로, **속도를 명시적으로 저장하지 않고 두 개의 과거 위치에서 암묵적으로** 끌어낸다. 제약(constraint) 투영과 궁합이 매우 좋아 cloth/rope/입자에서 인기.

**Position Verlet** (속도 미저장):

```
x_{n+1} = 2·x_n − x_{n-1} + a_n · dt²
속도는 필요 시 v ≈ (x_n − x_{n-1}) / dt 로 추정
```

장점: (a) symplectic 에 준하는 에너지 거동, (b) **위치를 직접 만지는 제약 해법(PBD 스타일)** 과 자연스럽다 — 막대 길이/충돌을 *위치를 강제로 끌어다 놓는* 방식으로 풀면, Verlet 은 다음 스텝에서 그 위치차로부터 속도를 자동 흡수한다(별도 속도 보정 불필요). Jakobsen 의 "Advanced Character Physics"(Hitman) 가 대중화한 cloth/ragdoll 기법의 토대.
단점: 가변 dt 에 약하다(위 식은 dt 일정 가정). 초기 속도 주입이 어색하다(`x_{-1}` 을 역산해야).

**Velocity Verlet** (속도 명시 저장, 강체에서 선호):

```
x_{n+1} = x_n + v_n·dt + ½·a_n·dt²
a_{n+1} = F(x_{n+1}) / m                 ← 새 위치에서 힘 재평가
v_{n+1} = v_n + ½·(a_n + a_{n+1})·dt     ← 옛·새 가속의 평균
```

velocity Verlet 은 2차 정확도이면서 symplectic 이라, 분자동역학/입자계에서 표준. 단 가속도가 *속도에 의존*하면(예: 점성/항력) 마지막 줄이 암묵식이 되어 정정 반복이나 근사가 필요하다.

### 2.6 RK2 (midpoint) · RK4 — 정확하지만 게임엔 과한 도구

Runge–Kutta 는 한 스텝 안에서 도함수를 *여러 곳에서 평가*해 평균내는 고차 explicit 적분기다.

**RK2 (midpoint)** — 2차:

```
k1 = f(y_n, t_n)
k2 = f(y_n + ½·dt·k1,  t_n + ½·dt)
y_{n+1} = y_n + dt·k2
```

**RK4** — 4차(국소 O(dt⁵), 전역 O(dt⁴)). 함수평가 4회/스텝:

```
k1 = f(y_n,            t_n)
k2 = f(y_n + ½dt·k1,   t_n + ½dt)
k3 = f(y_n + ½dt·k2,   t_n + ½dt)
k4 = f(y_n + dt·k3,    t_n + dt)
y_{n+1} = y_n + (dt/6)·(k1 + 2k2 + 2k3 + k4)
```

**정확도 vs 비용**: RK4 는 부드러운(smooth) 힘에서 압도적 정확도를 준다. 궤도역학·과학 시뮬에서 표준.

**게임에서 잘 안 쓰는 이유**:

1. **비싸다** — 스텝당 힘 평가 4회. 강체에선 충돌/구속이 끼어 평가 비용이 크다.
2. **symplectic 이 아니다** — RK4 는 고차 정확도지만 보존계에서 *천천히 에너지가 새는*(보통 감쇠) 비-사교 적분기다. 장시간 게임 루프에선 정확도보다 *장기 안정성*이 중요하므로 손해.
3. **불연속에 취약** — RK 의 중간 평가는 "이 스텝 안에서 힘이 매끄럽다"를 가정한다. 충돌·접촉처럼 힘이 불연속이면 중간점 평가가 오히려 오차를 키운다(충돌 검출은 스텝 경계에서만 일어나므로 스텝 내부 정보가 가짜).
4. **결정론·솔버 통합 부담** — 속도 기반 impulse 솔버와 끼워 맞추기 까다롭다.

> 정리: RK4 는 "충돌 없는 매끄러운 힘장(예: 우주선 궤도, 일부 카메라/스프링 보간)"에선 합리적이지만, **접촉 강체 메인 루프엔 부적합**하다.

### 2.7 Implicit (Backward) Euler — 무조건 안정, stiff 계의 필수품

backward Euler 는 미래의 도함수로 갱신한다.

```
v_{n+1} = v_n + a(x_{n+1}, v_{n+1}) · dt     ← 우변에 미래 값 등장!
x_{n+1} = x_n + v_{n+1} · dt
```

우변이 미지수 `y_{n+1}` 에 의존하므로 **대수 방정식을 풀어야** 한다 — 그래서 "암묵(implicit)".

**무조건 안정(unconditionally stable)** — backward Euler 의 안정 영역은 좌반평면 전체를 덮는다. 즉 *어떤 dt 를 써도 폭발하지 않는다*. 대신 공짜가 아니다: 에너지를 **인위적으로 감쇠(numerical damping)** 시킨다. 진동이 실제보다 빨리 죽는다. 그래서 정확도보다 "큰 dt 로도 안 터지는 것"이 더 중요한 곳에서 쓴다.

**왜 cloth/soft body(07)·stiff 계에 필수인가**:

- **stiff system(강성계)**: 스프링 강성 `k` 가 매우 크면(빳빳한 천, 강한 제약) explicit 의 안정 한계 `dt < 2·sqrt(m/k)` 가 *말도 안 되게 작아진다*. 5000개 스프링의 천을 explicit 으로 안정화하려면 dt 가 마이크로초 단위가 되어 실시간 불가.
- backward Euler 는 이 한계가 없으므로 **프레임 dt(예: 1/60s) 한 방에** 빳빳한 천을 안정적으로 적분한다. Baraff–Witkin "Large Steps in Cloth Simulation"(1998) 이 정확히 이 논리로 게임/영화 cloth 의 표준을 세웠다.

**어떻게 푸는가 — 선형화 + (뉴턴) 반복**:

비선형 `f` 를 1차 테일러 전개해 선형계로 만든다(semi-implicit / linearly-implicit):

```
방정식:   (I − dt·∂f/∂y) · Δy = dt · f(y_n)
          └──────┬───────┘
            야코비안 J = ∂f/∂y 로 만든 시스템 행렬
풀이:     큰 희소 선형계 → conjugate gradient(CG) 등으로 Δy 해결
          y_{n+1} = y_n + Δy
```

- `f` 가 강한 비선형이면 위 선형화를 **뉴턴 반복(Newton iteration)** 으로 감싸 수렴할 때까지 반복한다(보통 1~수 회).
- cloth 에선 힘의 야코비안(stiffness matrix)을 조립하고 희소 선형계를 CG 로 푼다 — 한 스텝 비용이 explicit 보다 훨씬 크지만, 큰 dt 한 방이 작은 dt 수천 방보다 싸다.

> implicit 의 트레이드: 안정성·큰 dt 를 사고 → 비용(선형계 풀이)·인위적 감쇠를 지불한다. 그래서 강체 메인 루프는 symplectic Euler(싸고 에너지 보존), cloth/soft 는 implicit(안정·감쇠 허용)로 갈린다. PBD/XPBD([05-constraint-solving.md](05-constraint-solving.md))는 이 implicit 비용을 *위치 투영 반복*으로 우회하는 별개의 길이다.

### 2.8 회전 적분 — quaternion 적분과 그 미묘함

병진(translation)은 위 적분기를 좌표별로 그대로 쓰면 된다. **회전(rotation)은 특수하다** — 자세를 사원수 `q`(단위 quaternion)로 표현하기 때문(상세: [01-kinematics.md](01-kinematics.md)).

각속도 `ω`(월드/바디 프레임 벡터)로 자세의 시간변화율은:

```
q'(t) = ½ · ω_quat ⊗ q          (ω_quat = (0, ωx, ωy, ωz), ⊗ = quaternion 곱)
```

이를 semi-implicit 으로 적분하면(강체 표준):

```
ω_{n+1} = ω_n + α_n · dt                       ← 각가속도로 각속도 갱신 (Euler 회전식 풀이)
q_{n+1} = q_n + (½ · ω_{n+1}_quat ⊗ q_n) · dt   ← 자세 갱신
q_{n+1} = normalize(q_{n+1})                    ← 재정규화 필수!
```

**미묘함 1 — 재정규화(re-normalization)**: 위 1차 갱신은 단위 사원수를 *단위가 아닌* 사원수로 밀어낸다(수치적으로 `|q| ≠ 1` 로 드리프트). 매 스텝 `q ← q/|q|` 로 다시 단위화하지 않으면 자세가 서서히 찌그러진다(비균등 스케일/전단 행렬화). 재정규화는 결정론에도 영향 — 연산 순서를 고정해야 한다([12-determinism-networking.md](12-determinism-networking.md)).

**미묘함 2 — 각운동량 비선형성**: 강체의 회전 운동방정식 `τ = Iα + ω×(Iω)` 에는 **자이로스코픽 항 `ω×Iω`** 이 있다(상세: [02-dynamics.md](02-dynamics.md)). 이 항은 explicit 으로 적분하면 자유 회전체(외부 토크 0)의 에너지를 키워 *불안정*해진다(특히 비대칭 관성텐서에서 격렬). PhysX 등은 이 항만 **암묵적으로(gyroscopic implicit)** 따로 처리한다.

**미묘함 3 — 정확 지수사상 vs 1차 근사**: `q_{n+1} = exp(½ω·dt) ⊗ q_n` 의 정확 지수사상(exponential map)을 쓰면 재정규화 없이 단위가 보존되고 큰 각속도에서 더 정확하다. 비용은 더 크다. 게임은 보통 1차 근사 + 재정규화로 충분하다고 본다.

### 2.9 안정성·에너지·폭발 — 한 절로 정리

- **stiffness(강성)**: 계의 가장 빠른 모드(큰 `k/m`, 또는 큰 고윳값)가 좌우. explicit 의 최대 안정 dt 는 *가장 빳빳한 요소*가 결정한다(한 군데만 빳빳해도 전체 dt 가 묶임).
- **CFL 조건(Courant–Friedrichs–Lewy)**: 본래 유체/파동([08-fluids.md](08-fluids.md))의 격자 적분 안정 조건 — "정보가 한 스텝에 한 셀 이상 못 건너가게" `dt ≤ C·Δx/c`(c=특성 속도). 일반화하면 "explicit 적분기는 계의 특성 시간보다 dt 가 작아야 한다"는 보편 원리. 강체의 `dt < 2·sqrt(m/k)` 도 같은 정신.
- **energy drift(에너지 드리프트)**: explicit Euler=주입(폭발), backward Euler=손실(과감쇠), symplectic/Verlet=유계 진동(이상적). 적분기 선택 = 어떤 드리프트를 감수할지의 선택.
- **explosion(폭발/NaN)**: dt·강성·질량비(mass ratio)·관통 깊이가 겹치면 속도가 발산 → 위치가 무한대/NaN. 방어: 고정 dt, substepping, 속도/관통 클램프, implicit, sleeping.

---

## 3. 주요 기법/도구

### 3.1 고정 timestep (fixed timestep) — 가장 중요한 실무 결정

**왜 가변 dt 가 위험한가**:

- **결정론 파괴**: dt 가 프레임마다 다르면 같은 입력도 다른 결과를 낳는다 → lockstep/rollback 네트워킹([12-determinism-networking.md](12-determinism-networking.md)) 불가, 리플레이 깨짐.
- **안정성 파괴**: 위 모든 안정 한계가 dt 의 함수다. 프레임 드랍으로 dt 가 갑자기 커지면 그 한 프레임이 explicit 안정 영역을 넘어 *폭발*할 수 있다. ("스파이럴 오브 데스" — 느려진 프레임 → 큰 dt → 더 불안정/무거움 → 더 느려짐.)
- **Verlet 오류**: position Verlet 식 자체가 dt 일정을 가정 → 가변 dt 면 부정확.

**해법 — accumulator 패턴**: 렌더 프레임시간을 누적해, **항상 같은 고정 dt** 로 물리를 0회 이상 스텝한다.

```pseudo
const FIXED_DT = 1.0 / 60.0     // 결정론·안정성의 기준 상수
accumulator += min(frameTime, MAX_FRAME_TIME)   // clamp: spiral of death 방어

while (accumulator >= FIXED_DT) {
    prevState = currentState           // 보간용 직전 상태 보관
    currentState = integrate(currentState, FIXED_DT)
    accumulator -= FIXED_DT
}

alpha = accumulator / FIXED_DT          // [0,1) 남은 비율
renderState = lerp(prevState, currentState, alpha)   // 렌더 보간
```

핵심 구성요소:

- **MAX_FRAME_TIME 클램프**: 한 프레임이 너무 느려도 물리 스텝 횟수를 상한으로 묶어 spiral of death 를 막는다(물리가 슬로우모션이 될 뿐 안 터짐).
- **렌더 보간(state interpolation)**: 물리는 60Hz 인데 렌더는 144Hz 일 수 있다. 마지막 물리 스텝과 직전 스텝 사이를 `alpha` 로 보간해 **부드러운 렌더링**을 만든다. 위치는 lerp, 회전은 slerp(quaternion). 운동학 보간 상세는 [01-kinematics.md](01-kinematics.md). 이게 없으면 물리/렌더 주파수 차이로 미세 떨림(judder)이 보인다.
- **고전 레퍼런스**: Glenn Fiedler "Fix Your Timestep!" — 이 패턴의 사실상 표준 설명.

### 3.2 Substepping (서브스텝)

한 프레임 dt 를 `N` 개의 더 작은 스텝으로 쪼개 적분한다(`dt/N` × N회).

- **용도**: 빠른 물체의 터널링 완화, 빳빳한 구속/스택의 안정화, 고속 차량/탄환.
- 고정 timestep 의 *내부* 세분화로 보면 된다 — 외부 결정론은 유지하면서 정확도/안정성을 산다(비용은 N배).
- PhysX/Chaos 등은 substep 수를 노출한다. 결정론을 위해선 substep 수도 고정해야 한다.

### 3.3 적분기 선택 매트릭스

| 적분기 | 정확도 | 안정성 | 에너지 | 비용 | 주 용도 |
|---|---|---|---|---|---|
| Forward Euler | 1차 | 조건부(나쁨) | 주입→폭발 | 최저 | (쓰지 말 것) |
| **Semi-implicit Euler** | 1차 | 조건부(양호) | 유계 진동 | 최저 | **강체 메인 루프 표준** |
| Position Verlet | 2차 | 조건부 | 유계 | 낮음 | cloth/rope/입자 + 위치 제약 |
| Velocity Verlet | 2차 | 조건부 | 유계 | 낮음 | 입자/분자, 정밀 입자계 |
| RK4 | 4차 | 조건부 | 천천히 손실 | 높음(×4) | 충돌 없는 매끄러운 힘장 |
| **Backward Euler** | 1차 | **무조건** | 과감쇠 | 높음(선형계) | **cloth/soft/stiff 계** |

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

1. **강체 메인 루프 = semi-implicit Euler** — 예외 없이. 차이는 적분기가 아니라 *구속 솔버*([05-constraint-solving.md](05-constraint-solving.md))에서 난다.
2. **고정 internal timestep + accumulator + maxSubSteps** 가 엔진 내부에 내장돼 있다(사용자가 가변 프레임시간을 넣어도 엔진이 고정 dt 로 쪼갠다).
3. **cloth/soft body 는 implicit 또는 PBD/XPBD** 로 갈라진다 — 강체와 다른 적분 철학.
4. 렌더 보간/async tick 으로 물리-렌더 주파수 분리.

> HktFramework 관점: 결정론([12-determinism-networking.md](12-determinism-networking.md))이 전제이므로 **고정 dt + 고정 연산 순서 + semi-implicit Euler** 를 기준선으로 잡고, 시뮬레이션 상수(FIXED_DT, substep 수)는 CVar 가 아니라 헤더 상수로 못 박는 편이 안전하다(루트 CLAUDE.md 의 "결정론에 영향을 주는 값은 헤더 상수로 고정" 원칙과 합치).

---

## 5. 함정·결정론 주의

- **가변 dt 를 적분에 직접 넣지 말 것** — 결정론·안정성을 동시에 깬다. 항상 accumulator 로 고정 dt 화.
- **forward Euler 의 위치 갱신에 옛 속도를 쓰는 것** — semi-implicit 와 단 한 줄 차이지만 결과는 폭발 vs 안정. 코드 리뷰에서 가장 흔한 미세 버그.
- **MAX_FRAME_TIME 클램프 누락** — spiral of death 의 직접 원인. 디버거에 멈췄다 재개하면 거대한 frameTime 이 들어와 즉시 폭발.
- **quaternion 재정규화 누락** — 자세가 서서히 찌그러진다. 그리고 재정규화 *연산 순서*를 고정하지 않으면 결정론 깨짐.
- **부동소수점 결정론**: 같은 적분식이라도 연산 순서/컴파일러/FMA/SIMD 가 다르면 비트 단위 결과가 갈린다. 크로스플랫폼 lockstep 은 연산 순서 고정 + (필요시) fixed-point 까지 가야 한다([12-determinism-networking.md](12-determinism-networking.md) · [00-foundations.md](00-foundations.md)).
- **substep 수를 결정론 변수로 노출하지 말 것** — substep 수가 바뀌면 결과가 바뀐다. 멀티플레이에선 고정.
- **stiff 요소 하나가 전체 dt 를 묶음** — explicit 으로 빳빳한 천/제약을 섞으면 한 군데 때문에 전부 폭발. 그 부분만 implicit/PBD 로 분리하라.
- **RK4 를 충돌 루프에 넣는 실수** — 중간점 힘 평가가 불연속 충돌력에서 오차를 키운다. 매끄러운 힘장 전용으로만.
- **렌더 보간 생략** — 물리 60Hz / 렌더 고주사율이면 judder. 보간 상태로 그려야 한다(시뮬 상태 자체는 절대 보간값으로 덮어쓰지 말 것 — 보간은 렌더 전용 사본).

---

## 6. 더 읽기 / 관련 노드

- **선행** — [02-dynamics.md](02-dynamics.md)(적분할 `a = F/m`, `α` 의 출처) · [01-kinematics.md](01-kinematics.md)(상태 표현·회전·렌더 보간) · [00-foundations.md](00-foundations.md)(부동소수점·수치 안정성·quaternion)
- **후행/이용** — [05-constraint-solving.md](05-constraint-solving.md)(속도 적분과 한 흐름인 impulse 솔버, PBD/XPBD) · [07-deformable-bodies.md](07-deformable-bodies.md)(implicit Euler·cloth) · [08-fluids.md](08-fluids.md)(CFL·grid 적분) · [09-particles.md](09-particles.md)(대량 입자 적분)
- **횡단** — [12-determinism-networking.md](12-determinism-networking.md)(고정 dt·연산 순서·fixed-point) · [13-performance-parallelism.md](13-performance-parallelism.md)(sleeping/island 으로 적분 생략, SIMD 일괄 적분)
- **외부 레퍼런스** — Glenn Fiedler "Fix Your Timestep!" · Baraff & Witkin "Large Steps in Cloth Simulation"(1998, implicit cloth) · Jakobsen "Advanced Character Physics"(2001, Verlet+제약) · Hairer et al. *Geometric Numerical Integration*(symplectic 이론)
