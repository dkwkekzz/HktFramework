# [01·2.2] 각운동 — 선형과의 대응 (Angular Motion)

> 회전 운동을 선형 운동에 평행하게 기술하되, 결정적 차이인 **비가환성(non-commutativity)** 과 "각속도 `ω` 는 진짜 벡터" 라는 사실을 짚는다.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) ([회전 표현](../00-foundations.md))

---

회전은 선형 운동과 **구조적으로 평행**하되, 핵심 차이는 회전이 **비가환(non-commutative)** 이라는 점이다(두 회전의 순서를 바꾸면 결과가 다르다). 1D 또는 고정축 회전에서는 스칼라로 평행하게 쓸 수 있다:

```
선형                  ↔   각 (고정축/평면)
위치   x              ↔   각도   θ          [rad]
속도   v = dx/dt      ↔   각속도 ω = dθ/dt   [rad/s]
가속도 a = dv/dt      ↔   각가속 α = dω/dt   [rad/s²]
등가속: θ = θ0 + ω0·t + ½·α·t²
```

## 유한 회전은 벡터처럼 더해지지 않는다

3D 에서는 각도를 단일 벡터로 적분할 수 없다 — **유한 회전(finite rotation)은 벡터처럼 더해지지 않는다**(비가환). 90° X 회전 뒤 90° Y 회전과, 그 반대 순서는 전혀 다른 자세를 준다. 이것이 "각도를 벡터로 누적"하는 단순한 코드가 큰 각·큰 dt 에서 틀리는 이유다.

반면 **무한소 회전(infinitesimal rotation)은 가환**이고, 그래서 **각속도 `ω` 는 진짜 벡터** 다. 이것이 회전 운동학의 가장 미묘한 지점이며, 회전의 미분 규칙([04-rotation-derivative.md](04-rotation-derivative.md))이 "유한 회전" 이 아니라 "순간 각속도 `ω`" 위에서 세워지는 근본 이유다.

## 각속도 벡터 ω 의 의미

`ω` 는 축–각(axis–angle) 형식의 순간 표현이다: 방향 = 순간 회전축, 크기 `|ω|` = 그 축 둘레 각속력. 오른손 법칙(right-hand rule)을 따른다.

```
ω = θ̇ · n̂      (n̂ = 단위 회전축, θ̇ = 각속력)
```

이 한 벡터가 회전 운동학 전체의 입력이다 — 강체 한 점의 속도(`ω × r`, [03-point-velocity.md](03-point-velocity.md)), 자세의 시간변화(`Ṙ = [ω]×R`, `q̇ = ½ωq`, [04-rotation-derivative.md](04-rotation-derivative.md))가 모두 `ω` 에서 출발한다.

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **회전 비가환 무시**: 유한 회전을 더하거나 순서를 바꾸면 안 된다. "각도를 벡터로 누적" 하는 코드는 큰 각·큰 dt 에서 틀린다 — `ω` 미분식으로 적분할 것([04-rotation-derivative.md](04-rotation-derivative.md)).
- **degree/radian 혼용**: 내부 수식은 전부 라디안. degree 는 입력/표시 경계에서만 변환.

**다음**: [03-point-velocity.md](03-point-velocity.md) — `ω` 가 강체의 각 점에 주는 선속도 `v = v_cm + ω × r`.
