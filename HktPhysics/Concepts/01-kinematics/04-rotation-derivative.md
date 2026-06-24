# [01.4] 회전의 시간 변화 (Time Derivative of Rotation)

> 자세는 벡터가 아니라 곡면 SO(3) 의 점이다([01-kinematics/02](02-angular-motion.md)). 그럼 자세를 어떻게 적분하나? 답은 두 미분식 — 행렬판 `Ṙ = [ω]× R`(푸아송 방정식)와 사원수판 `q̇ = ½ ω⊗q`. 그리고 정확히 곡면 위에 머무는 지수사상(exponential map). 이 문서는 *형태와 사용법* 을 잡는다 — ½ 와 skew-symmetric 의 *근본 유도* 는 형제 [04a](04a-quaternion-derivative.md)로 미룬다.
> **상위 허브**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md)

---

## 1. 왜 회전 미분식이 따로 필요한가

선형 운동은 `v = ẋ` 한 줄로 끝났다 — 위치를 더하면 됐으니까. 회전은 그게 안 된다. 자세 `q`(또는 `R`)는 곡면 SO(3) 위의 점이라 "자세 + 자세 변화" 라는 덧셈이 군에서 정의되지 않고, 직선으로 밀면 곡면을 벗어난다([01-kinematics/02](02-angular-motion.md)).

그런데 *순간 각속도* `ω` 는 멀쩡한 벡터였다. 그러니 필요한 건 "벡터 `ω` 를 받아 곡면 위의 자세를 어느 방향으로 밀지" 알려주는 미분식이다. 그게 바로:

```
Ṙ = [ω]× R            (회전행렬판 — 푸아송 방정식, Poisson's equation)
q̇ = ½ ω⊗q             (사원수판)
```

이 두 식이 적분기([03](../03-time-integration.md))의 회전 부분 핵심이다. 적분기는 `ω`(동역학 [02](../02-dynamics.md)가 준 `α` 를 적분한 것)를 받아 이 미분식으로 자세를 한 스텝 전진시킨다. **이 문서의 약속**: 두 식의 *형태·의미·사용법·정규화* 를 다룬다. ½ 계수가 왜 나오는지, skew-symmetric 이 왜 나오는지의 *유도* 는 길어서 형제 [04a-quaternion-derivative.md](04a-quaternion-derivative.md)로 분리했다.

---

## 2. 정의 — skew-symmetric 와 사원수 곱

미분식을 읽으려면 두 도구를 먼저 정의한다(상세 [00](../00-foundations.md)).

### 2.1 skew-symmetric 행렬 `[ω]×`

각속도 벡터 `ω = (ωx, ωy, ωz)` 를 외적을 행렬곱으로 바꾸는 3×3 반대칭(skew-symmetric) 행렬로 둔다:

```
        [  0   −ωz   ωy ]
[ω]× =  [  ωz   0   −ωx ]          # [ω]× r = ω × r  (임의의 r에 대해)
        [ −ωy   ωx   0  ]
```

핵심 성질: `[ω]×ᵀ = −[ω]×`(반대칭), 그리고 `[ω]× r = ω × r`. 이게 `Ṙ=[ω]×R` 의 `[ω]×` 다 — `ṙ = ω × r`([01-kinematics/03](03-point-velocity.md))의 외적을 행렬로 옮긴 것.

### 2.2 사원수와 순수 사원수

자세 사원수 `q = (w, x, y, z)`(단위 노름 `|q|=1`). 각속도를 스칼라부가 0인 **순수 사원수(pure quaternion)** 로 승격한다:

```
ω̂ = (0, ωx, ωy, ωz)              # 순수 사원수 (스칼라부 0)
⊗ : 사원수 곱 (해밀턴 곱, 비가환)
```

`q̇ = ½ ω⊗q` 의 `ω` 는 이 `ω̂` 를 뜻한다. 사원수 곱 `⊗` 는 비가환이라 `ω⊗q ≠ q⊗ω` — 곱 순서가 "월드 프레임 ω" 냐 "바디 프레임 ω" 냐를 가른다(§3.3).

---

## 3. 수식 — 두 미분식과 그 의미

### 3.1 회전행렬판 — 푸아송 방정식

```
Ṙ = [ω]× R                        (ω 는 월드/공간 프레임 각속도)
```

의미: 회전행렬 `R` 의 시간변화는 "현재 자세 `R` 에 각속도의 skew-symmetric 을 좌측 곱한 것". `[ω]×` 가 반대칭이라는 사실이 `R` 을 SO(3) 위에 머물게 한다(직교성 보존: `d/dt(RRᵀ) = 0` 을 만족, 유도는 [04a](04a-quaternion-derivative.md)). 이 식을 **푸아송 방정식(Poisson's kinematic equation)** 이라 부른다.

> **바디 프레임 버전**: 각속도를 바디(로컬) 프레임 `ω_body` 로 재면 곱 위치가 바뀐다 — `Ṙ = R [ω_body]×`. 좌측 곱(월드 ω)이냐 우측 곱(바디 ω)이냐를 혼동하면 회전이 거꾸로/이상하게 돈다. 엔진 규약(UE=행벡터·좌측곱 등, [01-kinematics/05](05-frames-transforms.md))과 맞춰야 한다.

### 3.2 사원수판

```
q̇ = ½ ω̂ ⊗ q                       (ω 는 월드/공간 프레임 각속도)
```

의미: 자세 사원수의 시간변화는 "순수 사원수 `ω̂` 를 자세 `q` 에 좌측 곱하고 ½ 을 곱한 것". `½` 은 사원수가 회전을 *반각* 으로 인코딩하기 때문에 나온다(사원수는 회전을 이중덮개로 덮어 `θ/2` 를 쓴다 — 근본 유도 [04a](04a-quaternion-derivative.md)). 회전행렬판보다 성분이 9→4 로 적고 정규화가 싸서 **실무 표준** 이다.

> **바디 프레임 버전**: `q̇ = ½ q ⊗ ω̂_body`. 월드냐 바디냐로 곱 순서가 좌/우로 바뀐다 — §3.1과 같은 주의.

### 3.3 두 식은 같은 것

`Ṙ=[ω]×R` 과 `q̇=½ω⊗q` 는 같은 회전 운동을 행렬/사원수 두 언어로 쓴 것일 뿐이다. `R = R(q)`(사원수→행렬 변환)를 미분하면 한쪽에서 다른 쪽이 나온다([04a](04a-quaternion-derivative.md)). 엔진은 거의 사원수판을 적분하고, 행렬은 점 변환·렌더 캐시에서만 만든다([01-kinematics/05](05-frames-transforms.md)·허브 §4).

---

## 4. 알고리즘 — 적분과 지수사상

### 4.1 1차(Euler) 적분 + 재정규화 — 가장 단순

```
# 입력: q_n (단위), omega (월드), dt
q_dot = 0.5 * quat(0, omega) ⊗ q_n        # q̇ = ½ ω⊗q
q_tmp = q_n + q_dot * dt                   # 1차 전진 — SO(3)를 살짝 벗어남
q_{n+1} = q_tmp / |q_tmp|                  # 재정규화 필수! 곡면으로 되돌림
```

`q_n + q̇·dt` 는 곡면 SO(3) 의 접선 방향으로 직선 한 발 내딛는 것이라 노름이 1에서 드리프트한다. **매 스텝 `q /= |q|` 정규화가 필수** — 빼먹으면 노름 드리프트가 자세에 전단/스케일을 섞는다(허브 §5 1번 함정). 작은 각(`|ω|dt` 작음)에선 충분히 정확하지만 큰 각에선 §4.2 지수사상이 낫다.

### 4.2 지수사상(exponential map) — 정확히 곡면 위로

곡면을 벗어났다 되돌리는 대신, 처음부터 곡면 위에 정확히 머무는 방법이 지수사상이다. 한 스텝의 회전 델타를 축–각으로 직접 구성한다:

```
# 회전 벡터(축*각) = ω·dt
phi   = omega * dt                  # 회전 벡터 (rad)
angle = |phi|                       # 회전 각 (rad)
if angle > eps:
    axis  = phi / angle
    dq    = quat( cos(angle/2), axis * sin(angle/2) )   # 축–각 → 사원수 (½각!)
else:
    dq    = quat(1, ½*phi)          # 소각 근사(0/0 회피) 후 normalize
q_{n+1} = normalize( dq ⊗ q_n )     # 정확한 합성 (월드 ω 면 좌측 곱)
```

`dq = exp(½ [phi]̂)` 가 지수사상이다 — 리 대수 so(3)(skew-symmetric/회전 벡터)에서 리 군 SO(3)(회전)로 정확히 사상한다. 큰 각/큰 dt 에서도 곡면을 벗어나지 않아 1차 적분보다 정확하다. `angle/2` 의 ½ 이 §3.2의 ½ 과 같은 뿌리(반각).

> **소각 폴백**: `angle≈0` 이면 `axis = phi/angle` 이 0/0 → NaN. `eps` 이하에서 `dq ≈ (1, ½phi)` 후 정규화로 폴백한다(slerp 의 `Ω→0` 폴백 [01-kinematics/07](07-interpolation.md)과 같은 패턴).

### 4.3 정규화 정책 비교

| 방식 | 곡면 유지 | 정규화 | 큰 각 정확도 | 비용 | 비고 |
|---|---|---|---|---|---|
| 1차 + renormalize | 근사(벗어났다 복귀) | 매 스텝 필수 | 낮음 | 최저 | 작은 dt 게임 흔함 |
| 지수사상 | 정확 | dq 합성 후 1회 | 높음 | sin/cos 비용 | 큰 회전·정확성 |
| RK4 등 고차 | 근사 | 매 스텝 | 중상 | 높음 | 드묾(게임) |

---

## 5. 실무 (엔진은 무엇을 쓰는가)

- **자세 적분은 사원수 `q̇=½ωq`, 매 스텝 정규화.** PhysX 는 명시적으로 `q̇=½ωq` 사원수 적분, UE5/Chaos 는 `FQuat` 사원수를 스텝마다 정규화한다(허브 [01-kinematics.md](../01-kinematics.md) §4). 행렬 적분(`Ṙ=[ω]×R`)은 직교성 유지 비용(재직교화)이 커서 자세 *저장* 엔 거의 안 쓴다.
- **큰 회전은 지수사상.** Bullet 의 `btTransformUtil::integrateTransform` 은 exponential map 으로 큰 각도 회전을 정확히 적분한다. Jolt 도 결정론 적분 경로에서 사원수+지수사상 계열을 쓴다(허브 §4).
- **2D 는 미분식이 사라진다(Box2D).** 회전 자유도 1뿐이라 `θ += ω·dt` 스칼라 적분으로 끝 — SO(3) 곡면·비가환·정규화 문제가 전부 증발한다(허브 §4, [01-kinematics/02](02-angular-motion.md)).
- **결정론 주의.** 지수사상·정규화에 들어가는 `sin/cos/sqrt` 는 플랫폼/컴파일러별 결과 차가 있어 lockstep 멀티플레이의 결정론을 깬다 — fixed-point 또는 검증된 결정론 math 라이브러리 필요([12](../12-determinism-networking.md)).

### 함정 한 줄 요약
- **사원수 정규화 누락**: 1차 적분 후 `q /= |q|` 를 빼먹으면 노름 드리프트로 자세에 전단/스케일이 섞인다. 매 스텝 필수(허브 §5).
- **회전 비가환·자세 직접 더하기 금지**: 자세를 벡터처럼 더하면 큰 각/큰 dt 에서 틀린다 — 반드시 `ω` 미분식 또는 지수사상([01-kinematics/02](02-angular-motion.md)).
- **곱 순서(월드 ω 좌측 / 바디 ω 우측)**: 뒤집으면 회전이 거꾸로 돈다. 엔진 규약([01-kinematics/05](05-frames-transforms.md))과 일치시킬 것.
- **소각 0/0**: 지수사상의 `axis = phi/angle` 가 `angle≈0` 에서 NaN → 소각 폴백.

---

## 6. 더 읽기 / 관련 노드

**형제 노드**
- **근본 유도(중요)** — [04a-quaternion-derivative.md](04a-quaternion-derivative.md): **½ 계수의 유도**, skew-symmetric 가 직교성을 보존하는 유도, so(3)↔SO(3) 리 대수. 이 문서가 *형태* 만 다루고 미룬 부분.
- **선행** — [02-angular-motion.md](02-angular-motion.md): 왜 자세는 벡터가 아니고 `ω` 는 벡터인지 — 이 미분식이 필요한 이유.
- [03-point-velocity.md](03-point-velocity.md): `ṙ = ω × r` — `Ṙ=[ω]×R` 과 같은 외적/skew-symmetric 뿌리.
- [07-interpolation.md](07-interpolation.md): 이중덮개 부호·slerp `Ω→0` 폴백 — 지수사상 소각 폴백과 같은 패턴.

**상위/이웃 노드**
- **상위 허브** — [01-kinematics.md](../01-kinematics.md): 미분 관계 표(§3.1)와 정규화/비가환 함정 체크리스트(§5).
- **적분 전문** — [03-time-integration.md](../03-time-integration.md): 이 미분식을 실제로 스텝하는 적분기(1차+정규화/지수사상/RK4)와 정규화 정책.
- **원인** — [02-dynamics.md](../02-dynamics.md): 토크·관성텐서가 `α = ω̇` 를 만들고, 그 `ω` 가 이 미분식에 들어간다(Euler 방정식).
- **선행** — [00-foundations.md](../00-foundations.md): 사원수 대수, 해밀턴 곱, `exp/log` 사상, skew-symmetric, 로드리게스 공식.
- **결정론** — [12-determinism-networking.md](../12-determinism-networking.md): `sin/cos/sqrt` 가 자세 적분 결정론에 거는 제약.

**외부 레퍼런스**
- David H. Eberly, *Game Physics* (2nd ed.) — 회전 적분·푸아송 방정식·지수사상의 표준 레퍼런스.
- Ian Millington, *Game Physics Engine Development* — 사원수 적분과 매 스텝 정규화를 밑바닥부터.
- Bullet `btTransformUtil::integrateTransform` 소스 — exponential map 적분의 실무 구현 예.
