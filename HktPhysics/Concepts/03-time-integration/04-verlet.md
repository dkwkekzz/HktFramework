# [03·2.4] Verlet 적분 (Verlet Integration)

> 위치를 1급 시민으로 두고 속도를 (저장하지 않고) 두 과거 위치에서 끌어내는 심플렉틱 적분기. 제약 투영(PBD)·cloth·rope·입자와 궁합이 최고.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-taxonomy](02-taxonomy.md)

---

Verlet 계열은 위치를 1급 시민으로 두는 적분기로, **속도를 명시적으로 저장하지 않고 두 개의 과거 위치에서 암묵적으로** 끌어낸다(velocity Verlet 은 예외). 심플렉틱 적분기라 에너지 거동이 좋고([03a-symplectic-energy](03a-symplectic-energy.md)), 제약(constraint) 투영과 궁합이 매우 좋아 cloth/rope/입자에서 인기다.

## Position Verlet (속도 미저장)

```
x_{n+1} = 2·x_n − x_{n-1} + a_n · dt²
속도는 필요 시 v ≈ (x_n − x_{n-1}) / dt 로 추정
```

**장점**:
- (a) symplectic 에 준하는 에너지 거동 — 장기 안정.
- (b) **위치를 직접 만지는 제약 해법(PBD 스타일)과 자연스럽다** — 막대 길이/충돌을 *위치를 강제로 끌어다 놓는* 방식으로 풀면, Verlet 은 다음 스텝에서 그 위치차(`x_n − x_{n-1}`)로부터 속도를 자동 흡수한다(별도 속도 보정 불필요). 위치를 옮기면 "암묵 속도"가 그만큼 따라 바뀌는 것이 Verlet 의 결정적 강점. Jakobsen 의 "Advanced Character Physics"(Hitman, 2001) 가 대중화한 cloth/ragdoll 기법의 토대.

**단점**:
- 가변 dt 에 약하다(위 식은 dt 일정 가정 — 가변 dt 면 부정확). → [08-fixed-timestep-loop](08-fixed-timestep-loop.md) 의 고정 dt 가 사실상 전제.
- 초기 속도 주입이 어색하다(`x_{-1}` 을 역산해야 — `x_{-1} = x_0 − v_0·dt`).

## Velocity Verlet (속도 명시 저장, 강체에서 선호)

```
x_{n+1} = x_n + v_n·dt + ½·a_n·dt²
a_{n+1} = F(x_{n+1}) / m                 ← 새 위치에서 힘 재평가
v_{n+1} = v_n + ½·(a_n + a_{n+1})·dt     ← 옛·새 가속의 평균
```

velocity Verlet 은 **2차 정확도이면서 symplectic** 이라, 분자동역학/입자계에서 표준이다. 속도를 명시적으로 들고 있어 속도 의존 힘이나 초기 속도 주입이 position Verlet 보다 깔끔하다.

단 가속도가 *속도에 의존*하면(예: 점성/항력 `F = −c·v`) 마지막 줄의 `a_{n+1}` 이 `v_{n+1}` 을 필요로 해 **암묵식**이 된다 → 정정 반복이나 근사(예: 반음해 처리)가 필요하다.

> Verlet vs semi-implicit Euler: 둘 다 심플렉틱이라 에너지 거동은 비슷하지만, Verlet 은 *위치 중심* 이라 PBD/제약 투영과 한 몸이 되고, semi-implicit Euler 는 *속도 중심* 이라 impulse 솔버([05-constraint-solving.md](../05-constraint-solving.md))와 한 몸이 된다. 강체 메인 루프가 후자를, cloth/입자가 전자를 선호하는 갈림이 여기서 난다.

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **Verlet 에 가변 dt** — position Verlet 식 자체가 dt 일정을 가정. 가변 dt 면 부정확/불안정. 항상 고정 dt.
- **velocity Verlet + 속도 의존 힘** — 마지막 줄이 암묵식이 됨. 근사하거나 정정 반복.

**다음**: [05-runge-kutta](05-runge-kutta.md) — 한 스텝 안에서 도함수를 여러 번 평가하는 고차 적분기.
