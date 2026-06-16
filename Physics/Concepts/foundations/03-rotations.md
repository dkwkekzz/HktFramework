# [00·2.3] 회전의 표현 (Rotation Representations)

> 강체 자세(orientation)를 표현하는 네 가지 도구 — 행렬·오일러각·축각·사원수 — 와 SLERP 보간.
> **상위 노드**: [00-foundations.md](../00-foundations.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-matrices-transforms](02-matrices-transforms.md)

---

회전 *대수(algebra)* 만 여기서 다룬다. 회전의 *운동학적 적용*(각속도→자세 적분 등)은 [01-kinematics](../01-kinematics.md) / [03-time-integration](../03-time-integration.md) 로 미룬다.

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

`Omega` 가 매우 작으면(거의 같은 회전) `sin(Omega)` 가 0에 가까워 0/0 위험 → 이때는 **선형 보간 후 정규화(NLERP)** 로 폴백한다(→ [06-identities-approximations](06-identities-approximations.md)). 실무 코드는 거의 항상 이 보호 분기를 가진다. (회전 *키프레임 적용*·각속도 적분은 [01](../01-kinematics.md)/[03](../03-time-integration.md) 참조.)

---

**한눈 비교**

| 도구 | 목적 | 장점 | 단점/트레이드오프 |
|---|---|---|---|
| 회전 행렬(3x3) | 회전 표현·벡터 회전 | 곱 한 번에 회전, SIMD/GPU 친화 | 9성분 중복, 재직교화 필요, 보간 난해 |
| 오일러각 | 오소링·UI 입력 | 사람이 직관적 | 짐벌락, 순서 의존, 보간 불량 |
| 축-각 / 회전 벡터 | 각속도 연결, 최소 표현 | 물리적 의미 명확 | 합성 어려움, 0 근방 불안정 |
| 사원수 | 자세 저장·적분·보간 | 컴팩트(4성분), 정규화 저렴, 짐벌락 없음, SLERP | 비직관적, double-cover 부호 처리 |

**관련 함정** (전체 체크리스트는 [00-foundations §5](../00-foundations.md#5-공통-함정--결정론-체크리스트)):
- **정규화 빠뜨림**: 사원수/회전 행렬을 적분하고 정규화를 안 하면 누적 오차로 왜곡 → 매 스텝/주기적 재투영 필수.
- **double-cover 부호**: 보간/비교 전 `q1.q2 < 0` 이면 한쪽 부호 반전 — 안 하면 "먼 길로 도는" 보간.

**다음**: [04-calculus-ode](04-calculus-ode.md) — 자세·위치를 시간에 따라 전진시키는 미분방정식의 토대.
