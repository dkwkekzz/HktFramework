# [00·2.1] 벡터 (Vectors)

> 위치·속도·힘 등 물리량의 *컨테이너*이자 변환의 언어. 충돌(SAT)·제약(Jacobian)이 모두 벡터 연산이다.
> **상위 노드**: [00-foundations.md](../00-foundations.md) · **상위 지도**: [README.md](../README.md) · **의존**: (기반)
>
> 🎨 **인터랙티브 시각화**: [vectors-dot-cross.html](vectors-dot-cross.html) — 내적·외적의 기하학적 의미를 점을 드래그하며 직접 실험.

---

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
- 물리적 의미: 토크 `tau = r x F`, 각속도에 의한 점 속도 `v = omega x r`. → [02-dynamics](../02-dynamics.md) 에서 본격 사용.

**2D에서의 "외적"**: 2D 물리에서는 외적이 스칼라로 축약된다.

```
cross2(a, b) = ax*by - ay*bx     // z 성분만 남음, 부호 있는 넓이
```

좌/우 회전 판정(orientation test)과 2D 토크에 쓴다.

---

**관련 함정** (전체 체크리스트는 [00-foundations §5](../00-foundations.md#5-공통-함정--결정론-체크리스트)):
- **0 길이 정규화**: `v/|v|` 에서 `|v|=0` → NaN/Inf. 길이 epsilon 체크 후 폴백.
- **`acos` 클램프 누락**: 내적 결과가 반올림으로 `[-1,1]` 을 벗어나면 `acos` 가 NaN → 항상 `clamp(x,-1,1)` (→ [06-identities-approximations](06-identities-approximations.md)).

**다음**: [02-matrices-transforms](02-matrices-transforms.md) — 벡터를 변환하는 행렬.
