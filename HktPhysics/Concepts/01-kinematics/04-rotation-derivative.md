# [01·2.4] 회전의 시간변화 — Ṙ = [ω]×R 와 q̇ = ½ωq (Rotation Derivatives)

> 각속도 `ω` 가 자세(회전행렬 `R` / 사원수 `q`)를 어떻게 시간 전진시키는가. 적분기([03])의 입력이 되는 핵심 미분 규칙.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) (사원수·로드리게스) · [02-angular-motion.md](02-angular-motion.md)
>
> 📐 **심화**: 여기서는 두 미분식의 *형태와 사용법* 만 둔다. "왜 `RᵀṘ` 가 반대칭인가", "왜 `½` 인가" 의 근본 유도는 → [04a-quaternion-derivative.md](04a-quaternion-derivative.md).

---

[02-angular-motion.md](02-angular-motion.md) 에서 보았듯 *유한* 회전은 벡터처럼 적분할 수 없다. 그래서 자세는 **순간 각속도 `ω`** 를 통해 미분방정식으로 전진시킨다. 자세를 무엇으로 저장하느냐에 따라 두 형태가 나온다.

## ① 회전행렬의 미분 — Ṙ = [ω]× R

자세를 회전행렬 `R(t) ∈ SO(3)` 로 저장한다고 하자. `R` 은 항상 `RᵀR = I`(직교) 를 만족해야 한다. 이 직교 제약이 미분되면 `RᵀṘ` 가 **반대칭(skew-symmetric)** 이어야 함이 따라 나오고(유도는 [04a](04a-quaternion-derivative.md)), 반대칭 행렬은 어떤 벡터의 cross-product 연산자다. 그 벡터가 바로 각속도다. world frame 각속도 `ω` 로 정리하면 **푸아송 방정식(Poisson's equation)**:

```
Ṙ = [ω]× R              ( [ω]× = ω 의 skew-symmetric 행렬 )

         ⎡  0   −ωz   ωy ⎤
[ω]× =   ⎢  ωz    0  −ωx ⎥      ([ω]× a = ω × a 를 만족)
         ⎣ −ωy   ωx    0 ⎦
```

해석: 회전행렬의 변화율은 "현재 자세에 각속도를 cross 로 곱한 것". `[ω]× R` 은 world 좌표(좌측 곱), `R [ω_body]×` 는 body 좌표(우측 곱) 표현이며 `ω = R ω_body`.

한 스텝 적분(정확한 지수사상):

```
R_{n+1} = exp([ω]× · dt) · R_n
        = R_n + dt·[ω]× R_n + O(dt²)   (1차 근사 = explicit Euler)
```

`exp([ω]× dt)` 는 로드리게스 공식(Rodrigues, [00-foundations.md](../00-foundations.md))으로 닫힌 형태로 계산된다. 단순 1차 근사 `R += dt [ω]× R` 는 직교성을 깨므로 **재정규화(Gram–Schmidt 또는 SVD)** 가 필요하다 — 행렬 9성분을 정규화하는 비용 때문에 실무는 사원수를 선호한다.

## ② 사원수의 미분 — q̇ = ½ ω q

자세를 단위 사원수(unit quaternion) `q` 로 저장하는 것이 3D 엔진의 표준이다(4성분, 짐벌락 없음, 보간 우수). 각속도를 순허수 사원수 `ω̂ = (0, ωx, ωy, ωz)` 로 본다. world frame 각속도에 대해:

```
q̇ = ½ · ω̂ ⊗ q        ( ⊗ = 사원수 곱, ω̂ 는 world frame )
```

body frame 각속도 `ω_body` 를 쓰면 곱 순서가 바뀐다:

```
q̇ = ½ · q ⊗ ω̂_body    ( ω̂_body 는 body frame )
```

`½` 은 사원수가 회전을 **반각(half-angle)** 으로 인코딩하기 때문이다(`q = (cos(θ/2), n̂ sin(θ/2))`). 이것이 사원수 미분의 핵심 직관이고, 한 줄짜리 유도가 아니라 반각 구조까지 거슬러 올라가는 이야기다.

> 📐 **심화: `½` 의 유도 / `RᵀṘ` 반대칭 유도** — "왜 정확히 절반인가", "직교 제약에서 어떻게 skew-symmetric 이 떨어지는가", 그리고 두 미분식이 같은 회전을 두 언어로 적은 것임을 → [04a-quaternion-derivative.md](04a-quaternion-derivative.md).

## 적분과 정규화 (→ [03])

한 스텝 사원수 적분은 두 갈래다:

```
(a) 1차 explicit:  q_{n+1} = q_n + dt · ½ ω̂ ⊗ q_n,  그 후  q ← q / |q|   (재정규화 필수)
(b) 지수사상(정확): q_{n+1} = exp(½ ω̂ dt) ⊗ q_n
                    exp(½ ω̂ dt) = ( cos(|ω|dt/2), (ω/|ω|) sin(|ω|dt/2) )
```

(a) 는 단위 노름을 벗어나므로 **매 스텝 `q /= |q|` 정규화가 필수** 다. 빼먹으면 자세에 *스케일/전단* 이 섞여 강체가 찌그러진다. (b) 는 단위 노름을 정확히 보존하지만 sin/cos 비용이 있고, `|ω|` 가 0 근처일 때 0/0 을 막는 작은-각 분기(Taylor 전개)가 필요하다. **적분기 선택과 정규화 정책의 본문은 [03-time-integration.md](../03-time-integration.md)** 에 있으니 거기서 마저 본다. 결정론 관점에서 sin/cos 의 플랫폼별 결과 차이는 [12-determinism-networking.md](../12-determinism-networking.md) 의 주제다.

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **사원수 정규화 누락**: 1차 적분 후 `q /= |q|` 를 빼먹으면 노름이 드리프트해 자세에 전단/스케일이 섞인다. 매 스텝 필수.
- **회전행렬 재직교화 누락**: `R += dt [ω]× R` 는 직교성을 깬다 → Gram–Schmidt/SVD 재정규화.
- **world/body 곱 순서**: world 는 좌측 곱(`ω̂ ⊗ q`), body 는 우측 곱(`q ⊗ ω̂`). 혼동하면 회전 방향이 틀린다.
- **초월함수 결정론**: 지수사상의 sin/cos 가 플랫폼별로 갈린다 → lockstep 은 [12-determinism-networking.md](../12-determinism-networking.md).

**다음**: [04a-quaternion-derivative.md](04a-quaternion-derivative.md) — `½` 과 skew-symmetric 의 근본 유도. (또는 바로 [05-frames-transforms.md](05-frames-transforms.md) 로.)
