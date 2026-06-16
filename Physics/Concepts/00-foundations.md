# [00] 수학·수치 기반 (Foundations)

> 게임 물리의 모든 분기가 딛고 서는 토대 — 선형대수(linear algebra), 회전 대수(rotation algebra), 미적분/상미분방정식(ODE), 부동소수점 수치해석(numerical analysis)을 한 곳에 모은다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: (없음 — 최상위 기반)

---

## 1. 위치와 역할

이 문서는 물리 엔진 지식 그래프의 **뿌리 노드**다. 다른 모든 분기 — 운동학([01](01-kinematics.md)), 동역학([02](02-dynamics.md)), 시간 적분([03](03-time-integration.md)), 충돌 검출([04](04-collision-detection.md)), 제약 해석([05](05-constraint-solving.md)) 등 — 은 여기서 정의한 객체(벡터, 행렬, 사원수)와 연산 규칙, 그리고 부동소수점의 한계를 전제로 한다.

게임 물리 파이프라인을 한 틱(tick) 기준으로 추상화하면 다음과 같다.

```
[입력/상태]
  → 운동학(위치·속도 표현)         ... 01
  → 동역학(힘 → 가속도, 뉴턴 법칙)  ... 02
  → 적분(상태를 dt 만큼 전진)       ... 03
  → 충돌 검출(겹침/접촉 찾기)        ... 04
  → 제약/조인트 해석(겹침·관절 해소) ... 05, 06
  → [다음 상태]
```

이 모든 단계가 **공통으로** 사용하는 것이 본 문서의 내용이다.

- **선형대수**는 위치/속도/힘 같은 물리량의 *컨테이너*이자 변환의 언어다. 04(충돌)의 분리축 정리(SAT), 05(제약)의 야코비안(Jacobian) 모두 벡터·행렬 연산이다.
- **회전 표현(사원수 등)**은 강체(rigid body)의 자세(orientation)를 다루는 02·03의 핵심 도구다. 적분 시 회전을 어떻게 전진시키는가가 03과 직결된다.
- **ODE 관점**은 "물리 시뮬레이션 = 미분방정식의 수치적 풀이"라는 03의 전체 프레임을 규정한다.
- **부동소수점/수치해석**은 12([결정론·네트워킹](12-determinism-networking.md))과 13([성능·병렬](13-performance-parallelism.md))의 근본 제약이다. 결정론(determinism)은 이 문서의 IEEE754 이해 없이는 불가능하다.

요컨대 이 문서를 읽지 않고 다른 노드를 읽으면 "왜 정규화(normalize)를 매 틱 다시 하는가", "왜 큰 좌표에서 떨림이 생기는가", "왜 오일러각을 쓰면 안 되는가" 같은 질문에 답할 수 없다.

---

## 2. 핵심 이론

### 2.1 벡터 (Vectors)

게임 물리는 보통 3차원 유클리드 공간 `R^3`(2D 물리는 `R^2`)에서 작동한다. 벡터 `v = (x, y, z)` 는 위치(position), 변위(displacement), 속도(velocity), 가속도(acceleration), 힘(force) 등을 표현한다.

**크기(norm)와 정규화(normalization)**

```
|v|     = sqrt(x*x + y*y + z*z)        // L2 노름(Euclidean norm)
|v|^2   = x*x + y*y + z*z              // 제곱 길이 — sqrt 회피용으로 비교에 자주 쓴다
v_hat   = v / |v|     (단, |v| != 0)   // 단위벡터(unit vector)
```

> 실무 팁: 길이 비교(`|a| < |b|`)는 `|a|^2 < |b|^2` 로 대체해 `sqrt` 한 번을 아낀다. 단 음수가 없을 때만 성립한다.

**내적 (dot product)**

```
a . b = ax*bx + ay*by + az*bz = |a| |b| cos(theta)
```

내적의 활용:
- `theta = acos( (a.b) / (|a||b|) )` — 두 벡터 사이 각.
- 부호로 방향 판정: `a.b > 0` 이면 예각(같은 쪽), `< 0` 이면 둔각(반대 쪽), `= 0` 이면 직교(perpendicular).
- **투영(projection)**: `b` 를 `a` 방향으로 사영한 벡터
  ```
  proj_a(b) = ( (a . b) / (a . a) ) * a
  ```
  `a` 가 단위벡터면 `proj_a(b) = (a.b) * a`. 충돌 응답에서 법선(normal) 방향 속도 성분 분리에 직접 쓰인다.
- 평면까지의 부호 있는 거리: 평면이 법선 `n`(단위)과 점 `p0` 로 주어질 때 점 `p` 의 거리 = `n . (p - p0)`.

**외적 (cross product, 3D 한정)**

```
a x b = ( ay*bz - az*by,
          az*bx - ax*bz,
          ax*by - ay*bx )
|a x b| = |a| |b| sin(theta)
```

- 결과는 `a`, `b` 가 만드는 평면의 **법선** 방향(오른손 법칙, right-hand rule).
- `|a x b|` 는 두 벡터가 이루는 평행사변형 넓이. 삼각형 넓이는 그 절반.
- 반교환(anticommutative): `a x b = -(b x a)`, 그리고 `a x a = 0`.
- 물리적 의미: 토크 `tau = r x F`, 각속도에 의한 점 속도 `v = omega x r`. → [02-dynamics](02-dynamics.md) 에서 본격 사용.

**2D에서의 "외적"**: 2D 물리에서는 외적이 스칼라로 축약된다.

```
cross2(a, b) = ax*by - ay*bx     // z 성분만 남음, 부호 있는 넓이
```

좌/우 회전 판정(orientation test)과 2D 토크에 쓴다.

### 2.2 행렬과 변환 (Matrices & Transforms)

**선형변환(linear transform)** 은 행렬 곱으로 표현된다. `R^3` → `R^3` 의 회전·스케일·전단은 3x3 행렬로 충분하지만, **평행이동(translation)은 선형이 아니다**(원점을 옮기므로). 그래서 **동차좌표(homogeneous coordinates)** 와 4x4 행렬을 쓴다.

```
점:    p = (x, y, z, 1)
벡터:  v = (x, y, z, 0)     // w=0 이라 평행이동의 영향을 받지 않음
```

**아핀 변환(affine transform)** = 선형변환 + 평행이동. 4x4 행렬:

```
      | R00 R01 R02 Tx |
M  =  | R10 R11 R12 Ty |
      | R20 R21 R22 Tz |
      |  0   0   0   1 |
```

좌상단 3x3 `R` 이 회전/스케일/전단, 오른쪽 열 `T` 가 평행이동.

**변환 합성**: `M_total = M_a * M_b` 는 "먼저 `M_b`, 그다음 `M_a`" 를 의미(열벡터 규약, column-major / right-multiply 기준). 행렬곱은 **결합법칙은 성립하지만 교환법칙은 성립하지 않는다** (`A*B != B*A`). 회전 순서가 결과를 바꾸는 근본 이유다.

**좌표계 변환 (basis change)**: 한 좌표계의 점을 다른 좌표계로 옮길 때, 그 좌표계의 기저벡터(basis vectors)를 열로 갖는 행렬로 곱한다. 월드↔로컬, 모델↔뷰 변환이 모두 이것이다.

**정규직교 행렬 (orthonormal / orthogonal matrix)**: 열(및 행)이 서로 직교하는 단위벡터인 행렬. 순수 회전 행렬이 여기 속한다. 핵심 성질:

```
R^T * R = I          // 전치(transpose)가 곧 역행렬(inverse)
R^-1 = R^T           // 역행렬을 공짜로 얻는다 — 성능상 큰 이점
det(R) = +1          // 회전(반사가 섞이면 -1)
|R v| = |v|          // 길이 보존(isometry)
```

회전 행렬의 역을 구할 때 일반 역행렬 계산(가우스 소거) 대신 **전치만** 하면 된다는 점은 실무에서 매우 중요하다.

**직교 기저 만들기 (Gram-Schmidt / 즉석 기저)**: 법선 하나로부터 접선 공간(tangent space)을 만들 때 자주 쓴다. 마찰(friction) 방향, 접촉 좌표계 구성 등.

```
n 정규화
임의 보조벡터 a 선택 (n과 평행하지 않게: |nx| < 0.9 면 a=(1,0,0) 아니면 (0,1,0))
t1 = normalize( a - (a.n)*n )    // n 성분 제거 후 정규화
t2 = n x t1                       // 이미 직교·단위
```

### 2.3 회전의 표현 (Rotation Representations)

회전 *대수(algebra)* 만 여기서 다룬다. 회전의 *운동학적 적용*(각속도→자세 적분 등)은 [01-kinematics](01-kinematics.md) / [03-time-integration](03-time-integration.md) 로 미룬다.

**(a) 회전 행렬 (rotation matrix)** — 3x3 정규직교, det=+1. 장점: 벡터 회전이 단순 곱(`v' = R v`), GPU/SIMD 친화적, 합성이 곱. 단점: 9개 성분으로 3 자유도(DOF)를 표현 → 중복(redundancy)이 커서 누적 오차로 비-직교(non-orthogonal)가 되기 쉬움 → 재직교화(re-orthonormalization) 필요. 보간이 어렵다.

축 `u`(단위), 각 `theta` 에 대한 회전 행렬은 **로드리게스 공식(Rodrigues' rotation formula)**:

```
R = I + sin(theta) * K + (1 - cos(theta)) * K^2

여기서 K 는 u 의 외적행렬(skew-symmetric):
      |  0   -uz   uy |
K  =  |  uz   0   -ux |
      | -uy   ux   0  |
( K v = u x v 와 동일 )
```

**(b) 오일러각 (Euler angles)** — yaw/pitch/roll 3개 각. 직관적이고 사람이 읽기 쉬움. 치명적 단점은 **짐벌락(gimbal lock)**: 두 회전축이 정렬되면 자유도 하나를 잃어 특정 자세 근방에서 회전이 불가능/불안정해진다(예: pitch=±90도). 또 회전 순서(XYZ vs ZYX …)에 따라 결과가 달라지고, 보간이 비선형이며 부드럽지 않다. → 저장/적분용으로는 부적합, UI 입력·오소링(authoring) 용도로만 권장.

**(c) 축-각 (axis-angle)** — 단위 축 `u` 와 각 `theta`(또는 둘을 합친 회전 벡터 `theta*u`). 최소 표현에 가깝고 각속도와 자연스럽게 연결된다(`omega` 자체가 순간 회전 벡터). 합성이 어렵고 `theta` 근처 0에서 축이 불안정.

**(d) 사원수 (quaternion)** — 게임 물리의 사실상 표준. 단위 사원수가 3D 회전을 표현한다.

```
q = w + x*i + y*j + z*k = (w, v),   v = (x, y, z)
i^2 = j^2 = k^2 = ijk = -1
```

축 `u`(단위)·각 `theta` 로부터:

```
q = ( cos(theta/2), sin(theta/2) * u )      // 반각(half-angle)에 주목
```

곱셈(해밀턴 곱, Hamilton product) — 회전 합성. **비교환적**:

```
q1 * q2 = ( w1*w2 - v1 . v2 ,
            w1*v2 + w2*v1 + v1 x v2 )
```

켤레(conjugate)와 노름·역:

```
q*   = (w, -v)                  // 켤레 = 역회전(단위일 때)
|q|  = sqrt(w^2 + x^2 + y^2 + z^2)
q^-1 = q* / |q|^2               // 단위 사원수면 q^-1 = q*
```

**벡터 회전 공식**: 벡터 `p` 를 순수 사원수 `(0, p)` 로 보고

```
p' = q * (0, p) * q^-1          // 결과의 벡터부가 회전된 벡터
```

실무에서는 위 식을 전개한 **최적화 형태**를 쓴다(곱 두 번보다 외적 두 번이 싸다):

```
t  = 2 * (qv x p)
p' = p + qw * t + (qv x t)      // qv = q 의 벡터부, qw = 스칼라부
```

사원수의 장점: 4개 성분으로 컴팩트, 정규화 한 번으로 직교성 회복(행렬 9성분 재직교화보다 훨씬 저렴), 짐벌락 없음, **SLERP** 로 매끄러운 보간 가능. 단점: 직관적이지 않고, `q` 와 `-q` 가 *같은* 회전을 나타냄(double cover, 이중 덮개) — 보간/비교 시 부호 정렬(`if q1.q2 < 0: q2 = -q2`) 주의.

**정규화 재투영**: 적분으로 누적 오차가 쌓이면 `|q| != 1` 이 된다. 매 스텝(혹은 주기적으로)

```
q = q / |q|
```

로 단위 구면(unit hypersphere)에 다시 투영한다. 행렬보다 압도적으로 싼 이 연산이 사원수를 표준으로 만든 큰 이유다.

**SLERP (구면 선형 보간, Spherical Linear Interpolation)**:

```
slerp(q1, q2, t) = ( sin((1-t)*Omega) * q1 + sin(t*Omega) * q2 ) / sin(Omega)
where cos(Omega) = q1 . q2     // 4D 내적
```

`Omega` 가 매우 작으면(거의 같은 회전) `sin(Omega)` 가 0에 가까워 0/0 위험 → 이때는 **선형 보간 후 정규화(NLERP)** 로 폴백한다. 실무 코드는 거의 항상 이 보호 분기를 가진다. (회전 *키프레임 적용*·각속도 적분은 [01](01-kinematics.md)/[03](03-time-integration.md) 참조.)

### 2.4 미적분 · ODE 기초 (Calculus & ODE)

물리 시뮬레이션의 본질은 **미분방정식(differential equation)을 수치적으로 푸는 것**이다.

**도함수(derivative)** 는 변화율이다.

```
v(t) = dx/dt          // 속도 = 위치의 시간 미분
a(t) = dv/dt = d2x/dt2 // 가속도 = 속도의 미분 = 위치의 2차 미분
```

뉴턴 제2법칙 `F = m a` 는 **2계 ODE** 다.

```
m * d2x/dt2 = F(x, v, t)
```

**상태공간 표현(state-space form)**: 2계 ODE 를 1계 연립(coupled first-order) 으로 낮춘다. 적분기는 항상 1계 형태를 다룬다.

```
상태 y = (x, v)
dy/dt = f(y, t) = ( v ,  F(x, v, t) / m )
```

이 `dy/dt = f(y, t)` 가 03([시간 적분](03-time-integration.md))이 다루는 표준형이다. 여기서 우리는 "주어진 현재 상태에서 `dt` 후 상태를 어떻게 추정할 것인가"를 묻게 된다.

**안정성(stability)** 개념(직관 수준만 — 적분기 상세는 03):
- 스프링-댐퍼 같은 시스템은 강성(stiffness)이 높으면 명시적(explicit) 적분이 발산(blow up)할 수 있다 — 이른바 **stiff ODE**.
- 안정성은 `dt` 와 시스템 고유진동수(eigenvalue)의 곱에 달려 있다. 너무 큰 `dt` 는 에너지를 증폭시켜 폭발한다.
- 그래서 게임 물리는 **고정 타임스텝(fixed timestep)** 과 서브스텝(substepping)을 선호한다. (자세한 음함수/반음함수 적분과 안정 영역은 [03](03-time-integration.md).)

**적분의 직관 (테일러 전개, Taylor expansion)**: 모든 적분기의 출발점.

```
x(t + dt) = x(t) + dt * x'(t) + (dt^2/2) * x''(t) + O(dt^3)
```

- 1차 항만 쓰면 → 명시적 오일러(explicit Euler), 오차 `O(dt^2)`/스텝.
- 고차 항을 더 반영하면 → RK4 등 고차 정확도. (전부 03에서.)

### 2.5 수치해석 · 부동소수점 (Numerical Analysis & Floating-Point)

게임 물리는 실수를 **부동소수점(floating-point)** 으로 근사한다. 이 근사의 성질을 모르면 결정론([12](12-determinism-networking.md))도 안정성도 얻을 수 없다.

**IEEE 754** — 표준 부동소수점 표현. `값 = (-1)^sign * (1.mantissa) * 2^exponent`.

| 타입 | 비트 | 가수(mantissa) | 유효 십진 자리 | 비고 |
|---|---|---|---|---|
| float (단정밀, single) | 32 | 23 | 약 7자리 | 게임 물리 기본 |
| double (배정밀) | 64 | 52 | 약 15-16자리 | 큰 좌표/정밀 적분 |

핵심 함의:
- **상대 정밀도(machine epsilon)**: float 은 `eps ≈ 1.19e-7`, double 은 `≈ 2.22e-16`. 표현 가능한 두 인접 값의 간격(ULP, Unit in the Last Place)은 **값의 크기에 비례**한다.
- 따라서 좌표가 커질수록 정밀도가 *떨어진다*. 원점에서 1m 떨어진 곳의 정밀도와 100km 떨어진 곳의 정밀도가 다르다 → 멀리 가면 물체가 떨리는(jitter) 근본 원인. 해법: 월드 원점 리베이싱(origin rebasing), tile/sector 좌표계, double 사용.

**반올림(rounding)과 결합/교환 법칙 깨짐**: 부동소수점 덧셈은 **결합법칙이 성립하지 않는다**.

```
(a + b) + c   !=   a + (b + c)      // 일반적으로
```

→ 합산 순서가 바뀌면 결과 비트가 달라진다. 멀티스레드에서 부분합을 합치는 순서가 비결정적이면 결과가 갈라진다 → 결정론 붕괴([12](12-determinism-networking.md), [13](13-performance-parallelism.md)).

**상쇄 (catastrophic cancellation)**: 비슷한 크기의 두 수를 빼면 유효숫자가 대량 손실된다.

```
a = 1.0000001, b = 1.0000000  →  a - b = 0.0000001
앞쪽 유효숫자가 모두 약분되어, 결과는 b의 마지막 1~2비트의 오차에 지배된다.
```

예: 이차방정식 근의 공식에서 `-b + sqrt(b^2 - 4ac)` 가 상쇄에 취약 → 수치적으로 안정한 변형 사용. 두 큰 위치의 차로 작은 변위를 구할 때도 동일 위험.

**조건수 (condition number)**: 입력의 작은 변화가 출력을 얼마나 증폭하는가. 조건수가 큰(ill-conditioned) 행렬을 푸는 제약/조인트 솔버([05](05-constraint-solving.md))는 작은 입력 오차가 폭발한다 → 질량비(mass ratio)가 극단적이거나 거의 특이(near-singular)한 야코비안에서 발생.

**epsilon 비교 (안전한 실수 비교)**: `==` 로 부동소수점을 비교하지 말 것.

```
// 절대 오차(absolute)
fabs(a - b) <= EPS

// 상대 오차(relative) — 큰 값에 적합
fabs(a - b) <= EPS * max(fabs(a), fabs(b))

// 혼합(실무 권장)
fabs(a - b) <= EPS_ABS + EPS_REL * max(fabs(a), fabs(b))
```

크기에 따라 적절한 방식을 골라야 한다. 영(zero) 근처 비교는 절대 오차, 큰 값 비교는 상대 오차.

**누적 오차 (error accumulation)**: 매 틱 작은 오차가 더해진다. 정규화를 안 하면 사원수가 단위 구면을 벗어나고, 회전 행렬은 직교성을 잃는다. → 주기적 재투영(2.3의 정규화)으로 막는다. 적분 오차의 누적은 에너지 드리프트(energy drift)로 나타난다([03](03-time-integration.md)의 심플렉틱 적분기로 완화).

**fast inverse square root (역사적 실무 트릭)**: 과거 Quake III 의 그 유명한 비트 해킹.

```
i = 0x5f3759df - (i >> 1);   // 비트 패턴으로 초기 추정
y = y * (1.5f - 0.5f*x*y*y); // 뉴턴-랩슨 1회 보정
```

오늘날에는 하드웨어 `rsqrtss`(SSE)/SIMD 명령이 더 빠르고 정확하므로 **교육적 의미** 위주다. 핵심 교훈은 "정확도와 속도를 트레이드(근사 후 뉴턴 1~2회 보정)" 라는 사고방식 — 정규화·거리 계산에서 여전히 유효하다.

### 2.6 자주 쓰는 항등식·근사 (Identities & Approximations)

**소각 근사 (small-angle approximation)** — `theta` 가 작을 때(라디안):

```
sin(theta) ≈ theta
cos(theta) ≈ 1 - theta^2/2  ≈ 1
tan(theta) ≈ theta
```

각속도 적분, 작은 회전 합성, 안정성 분석에서 선형화(linearization)에 쓴다.

**작은 회전의 사원수**: `omega*dt` 가 작을 때 자세 적분 근사

```
dq ≈ (1, 0.5 * omega * dt)     // 그 후 정규화
q_new = normalize( dq * q )
```

(정식 유도와 다양한 적분 방식은 [03](03-time-integration.md).)

**선형 보간(lerp) 후 정규화 = NLERP**: SLERP 가 비싸거나 각이 작을 때.

```
q = normalize( (1-t)*q1 + t*q2 )     // 단, q1.q2 < 0 이면 q2 부호 반전
```

**클램프(clamp)·포화(saturate)**: 수치 폭주 방지.

```
clamp(x, lo, hi) = max(lo, min(hi, x))
```

`acos` 입력은 반올림으로 `[-1,1]` 을 살짝 벗어날 수 있어 **반드시 clamp** 후 호출(아니면 NaN).

**제곱근 회피**: 비교/임계는 제곱 길이로, 정규화는 `inv_len = rsqrt(len2)` 로.

---

## 3. 주요 기법/도구

| 도구 | 목적 | 장점 | 단점/트레이드오프 |
|---|---|---|---|
| 회전 행렬(3x3) | 회전 표현·벡터 회전 | 곱 한 번에 회전, SIMD/GPU 친화 | 9성분 중복, 재직교화 필요, 보간 난해 |
| 오일러각 | 오소링·UI 입력 | 사람이 직관적 | 짐벌락, 순서 의존, 보간 불량 |
| 축-각 / 회전 벡터 | 각속도 연결, 최소 표현 | 물리적 의미 명확 | 합성 어려움, 0 근방 불안정 |
| 사원수 | 자세 저장·적분·보간 | 컴팩트(4성분), 정규화 저렴, 짐벌락 없음, SLERP | 비직관적, double-cover 부호 처리 |
| 4x4 동차행렬 | 아핀 변환(회전+이동+스케일) | 변환 합성·계층(scene graph) 일관 | 메모리/연산량, 비균등 스케일 시 법선 처리 주의 |
| double 정밀도 | 큰 월드·정밀 적분 | 정밀도 16자리 | 메모리 2배, SIMD 폭 절반, 결정론 동일 보장은 별개 |
| 고정소수점(fixed-point) | 크로스플랫폼 결정론 | 비트 단위 재현성 | 동적 범위 제한, 구현 복잡 (→ [12](12-determinism-networking.md)) |
| SIMD(SSE/AVX/NEON) | 벡터·배치 연산 가속 | 4~8배 처리량 | 데이터 정렬(SoA), 플랫폼별 반올림 차이 주의 |

**좌표계 규약(handedness) 선택** — 엔진마다 다르다. 왼손/오른손, Y-up/Z-up. 한 번 정하면 외적의 부호, 회전 방향, 행렬 곱 순서가 전부 거기에 묶인다. 혼용은 부호 버그의 단골 원인.

**행 우선 vs 열 우선(row-major vs column-major)** — 메모리 레이아웃과 곱 순서 규약이 엮인다. DirectX/HLSL 전통은 행 우선·행벡터, OpenGL/수학 교과서는 열 우선·열벡터. 인터롭 시 전치(transpose) 필요 여부를 항상 확인.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

수학 기반 계층에서 주요 엔진의 선택은 대체로 수렴한다.

- **자세 표현**: Bullet, PhysX, Havok, Jolt, Box2D(2D는 단순 각), **Chaos(UE5)** 모두 내부 강체 자세를 **사원수**로 저장하고 각속도로 적분한다. 행렬은 충돌/렌더로 넘길 때 변환한다.
- **Jolt Physics**: 결정론과 멀티스레드를 목표로 SIMD(SSE/AVX/NEON)를 적극 활용. `Vec3`/`Quat`/`Mat44` 자체 수학 라이브러리, float 기반이되 연산 순서를 고정해 *동일 바이너리* 내 결정론을 보장(크로스플랫폼은 별도 보장 아님). 게임 물리 수치 기반의 모범 사례.
- **PhysX(NVIDIA)**: `PxVec3`, `PxQuat`, `PxMat44`. float 기반. GPU 가속(rigid/cloth/particle) 경로는 부동소수점 비결정성을 동반하므로 결정론이 필요하면 CPU 경로.
- **Havok**: 상용 콘솔 타이틀 다수. SIMD 최적화 수학, 결정론 옵션 제공.
- **Bullet**: 오픈소스 표준. `btVector3`(SIMD 정렬), `btQuaternion`, `btTransform`. 교육·로보틱스에서도 널리 쓰임.
- **Box2D**: 2D. 회전은 단일 각/`b2Rot`(cos·sin 쌍)으로 표현 — 2D에서는 사원수가 과하다. v3 부터 SIMD 와이드 솔버 도입.
- **Chaos (Unreal Engine 5)**: UE 의 `FVector`(double, UE5부터 LWC — Large World Coordinates), `FQuat`, `FTransform`, `FMatrix`. **UE5 의 LWC** 가 본 문서 2.5 의 "큰 좌표 정밀도" 문제에 대한 엔진 차원의 대응 — 좌표를 double 로 승격해 거대 월드의 떨림을 줄였다. 단 double 이라도 자동 결정론을 보장하진 않는다.

공통 패턴: **핵심 수학 타입은 SIMD 정렬(16바이트)된 자체 구조체**로 두고, 정규화·역제곱근에 하드웨어 명령을 쓰며, 사원수 자세를 매 스텝 정규화한다.

---

## 5. 함정 · 결정론 주의

- **정규화 빠뜨림**: 사원수/회전 행렬을 적분하고 정규화를 안 하면 누적 오차로 스케일이 섞이거나(행렬) 회전이 왜곡된다(사원수). → 매 스텝 또는 주기적 재투영 필수.
- **`acos`/`asin`에 클램프 누락**: 내적 결과가 반올림으로 `1.0000001` 이 되면 `acos` 가 NaN. 항상 `clamp(x, -1, 1)`.
- **0 길이 정규화**: `v/|v|` 에서 `|v|=0` → NaN/Inf. 길이 epsilon 체크 후 폴백(예: 영벡터 또는 기본 축) 처리.
- **부동소수점 `==` 비교**: 누적 오차로 정확히 같아지는 일은 거의 없다. epsilon 비교 사용(2.5).
- **상쇄(cancellation)**: 큰 두 좌표의 차로 작은 변위를 구할 때 정밀도 폭락. 가능하면 로컬 좌표/상대 좌표로 계산.
- **결합법칙 의존**: `(a+b)+c == a+(b+c)` 를 가정하지 말 것. 특히 **멀티스레드 리덕션(reduction)의 합산 순서**가 비결정적이면 결과 비트가 갈라진다 → 결정론 깨짐([12](12-determinism-networking.md), [13](13-performance-parallelism.md)). 결정론이 필요하면 순서 고정 또는 보상합(Kahan summation).
- **크로스플랫폼 부동소수점 차이**: 컴파일러 최적화(`-ffast-math`, FMA 사용 여부), x87 80비트 확장정밀, SIMD 반올림 모드, 초월함수(`sin/cos`) 구현 차이로 같은 코드가 플랫폼마다 다른 비트를 낸다. 진짜 결정론(lockstep)에는 고정소수점 또는 엄격히 통제된 부동소수점 빌드가 필요([12](12-determinism-networking.md)).
- **`-ffast-math` 위험**: NaN/Inf 가정 완화, 재결합 허용 → 성능은 얻지만 결정론·정확도를 잃는다. 물리 코어에는 보통 끈다.
- **double-cover 부호**: 사원수 보간/비교 전 `q1.q2 < 0` 이면 한쪽 부호 반전. 안 하면 "먼 길로 도는" 보간이나 잘못된 거리.
- **큰 월드 떨림(far-from-origin jitter)**: 원점에서 멀어질수록 ULP 가 커져 위치/물리가 떨린다. origin rebasing, 타일 좌표, 또는 double/LWC(UE5)로 대응.
- **비균등 스케일과 법선**: 비균등 스케일(non-uniform scale) 행렬로 법선을 변환할 때 같은 행렬을 쓰면 안 됨 → **역전치(inverse transpose)** 행렬을 써야 직교성이 유지된다.

---

## 6. 더 읽기 / 관련 노드

**형제 노드 (이 기반을 직접 사용하는 곳)**
- [01-kinematics](01-kinematics.md) — 위치·속도·각속도, 회전의 운동학적 적용
- [02-dynamics](02-dynamics.md) — 뉴턴-오일러 방정식, 관성텐서, 토크(외적의 물리)
- [03-time-integration](03-time-integration.md) — ODE 수치 적분기, 안정성/심플렉틱, 자세 적분
- [04-collision-detection](04-collision-detection.md) — 분리축 정리(SAT), GJK (벡터·투영 집약)
- [05-constraint-solving](05-constraint-solving.md) — 야코비안, 선형계 풀이, 조건수
- [12-determinism-networking](12-determinism-networking.md) — 고정소수점, 부동소수점 결정론, lockstep
- [13-performance-parallelism](13-performance-parallelism.md) — SIMD, 병렬 리덕션과 합산 순서

**외부 레퍼런스**
- David H. Eberly, *Game Physics* (2nd ed.) / *3D Game Engine Design* — 수학 기반의 백과사전급 레퍼런스.
- Christer Ericson, *Real-Time Collision Detection* — 벡터·기하 연산과 수치 안정성의 실무 바이블.
- Ian Millington, *Game Physics Engine Development* — 밑바닥부터 엔진을 만드는 입문서.
- Eric Lengyel, *Foundations of Game Engine Development, Vol.1: Mathematics* — 선형대수·변환·사원수 집중.
- Ken Shoemake, "Animating Rotation with Quaternion Curves" (SIGGRAPH 1985) — SLERP 의 원전.
- David Goldberg, "What Every Computer Scientist Should Know About Floating-Point Arithmetic" (1991) — IEEE754 필독 논문.
- Erin Catto (Box2D), GDC 강연 시리즈 — "Soft Constraints", "Numerical Methods" 등 실무 수치 기법.
- Quake III Arena 소스 (`q_math.c`) — fast inverse sqrt 의 역사적 원본.
