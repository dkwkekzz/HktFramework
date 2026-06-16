# [01·2.1] 선형 운동 — 위치·속도·가속도 (Linear Motion)

> 질점의 운동을 시간의 함수 `x(t)` 로 보고, 그 미분(속도·가속도)과 적분(역방향) 관계를 정리한다. 운동학에서 가장 먼저 만나는 한 덩어리.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)

---

질점(particle)의 운동은 시간의 함수인 위치 벡터 `x(t)` 로 시작한다. 속도(velocity)와 가속도(acceleration)는 그 시간 미분이다:

```
v(t) = dx/dt            (속도, velocity)
a(t) = dv/dt = d²x/dt²  (가속도, acceleration)
```

역으로, 가속도에서 적분으로 올라간다(적분 상수 = 초기 조건):

```
v(t) = v0 + ∫₀ᵗ a(s) ds
x(t) = x0 + ∫₀ᵗ v(s) ds
```

이 한 쌍의 미분/적분 관계가 시뮬레이션 루프의 뼈대다 — 동역학([02-dynamics.md](../02-dynamics.md))이 `a` 를 주면, 적분기([03-time-integration.md](../03-time-integration.md))가 위 적분을 수치적으로 수행해 `(x, v)` 를 시간 전진시킨다.

## 등가속 운동 (constant acceleration)

`a` 가 상수이면 적분이 닫힌 형태로 풀린다 — 가장 기본적인 운동방정식(SUVAT):

```
v(t) = v0 + a·t                         (1차: 속도)
x(t) = x0 + v0·t + ½·a·t²                (2차: 위치)
v(t)² = v0² + 2·a·(x(t) − x0)            (시간 소거형, 1D)
```

게임에서 중력 낙하·포물선 운동·점프 아크가 전부 이 식이다.

> **주의**: 위 위치식은 시간 `t` 의 정확한 2차식이지만, 엔진은 보통 이를 직접 쓰지 않고 매 스텝 수치 적분한다(가속도가 일반적으로 상수가 아니므로). 단순 explicit Euler 의 위치 갱신 `x += v·dt` 는 이 `½·a·t²` 항을 빠뜨려 한 스텝당 오차를 남긴다 — symplectic/Verlet 계열이 왜 더 나은지의 출발점이다([03-time-integration.md](../03-time-integration.md) 참조).

## 평균속도 vs 순간속도, 유한차분

이산 시뮬레이션에서 속도는 종종 두 위치 샘플의 차로 추정된다:

```
v ≈ (x_{n} − x_{n-1}) / dt        (후방 차분 backward difference)
v ≈ (x_{n+1} − x_{n-1}) / (2·dt)  (중심 차분 central difference, 2차 정확)
```

Verlet 적분이 속도를 명시적으로 저장하지 않고 두 과거 위치로 복원하는 것이 바로 중심 차분이다([03-time-integration.md](../03-time-integration.md)).

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **explicit Euler 의 ½·a·t² 누락**: `x += v·dt` 는 등가속 해석해보다 한 스텝당 위치 오차를 남긴다 → symplectic/Verlet 으로 보정([03-time-integration.md](../03-time-integration.md)).
- **가변 dt 의존**: 적분 결과가 프레임레이트에 묶이면 비결정적 → 고정 timestep 위에서 적분([12-determinism-networking.md](../12-determinism-networking.md)).

**다음**: [02-angular-motion.md](02-angular-motion.md) — 같은 운동 기술을 회전(각운동)으로 확장한다.
