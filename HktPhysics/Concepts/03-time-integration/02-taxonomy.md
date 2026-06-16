# [03·2.2] 적분기 분류 (Integrator Taxonomy)

> 적분기를 두 축 — 명시성(explicit↔implicit)과 스텝 폭(single↔multi-step) — 으로 나눈다. 안정성의 차이는 전부 명시성 축에서 나온다.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-ode-state-space](01-ode-state-space.md)

---

`y' = f(y,t)` 를 한 스텝 전진시키는 방법은 두 축으로 분류한다.

| 축 | 분류 | 의미 |
|---|---|---|
| **명시성** | **Explicit (양해법)** | `y_{n+1}` 이 *과거/현재 값만으로* 직접 계산됨. 싸지만 조건부 안정. |
| | **Implicit (음해법)** | `y_{n+1}` 이 *자기 자신(미래 값)에* 의존 → 방정식을 풀어야 함. 비싸지만 무조건 안정. |
| **스텝 폭** | **Single-step** | 직전 한 스텝만 참조 (Euler, RK). |
| | **Multi-step** | 여러 과거 스텝 참조 (Adams 계열). 게임에선 거의 안 씀 — 충돌로 상태가 불연속해지면 과거 히스토리가 오염됨. |

**게임 물리는 single-step 이 압도적이다.** 충돌·구속이 상태를 자주 끊어 버려, 과거 스텝을 평균내 정확도를 사는 multi-step 의 이점이 무의미해진다(끊긴 직후 히스토리가 거짓이 된다). 그래서 게임의 적분기는 거의 전부 single-step 이고, 진짜 선택은 explicit ↔ implicit 스펙트럼 위 어디에 설 것인가이다.

> **분류상 핵심 직관**: explicit 은 "현재 기울기로 미래를 추측", implicit 은 "미래 기울기가 미래에 정합하도록 역으로 푼다". explicit 은 한 번 평가하면 끝나니 싸고, implicit 은 미래 값이 자기 자신을 정의하는 방정식을 풀어야 하니 비싸다. 그 대가로 안정성이 갈린다 — explicit 은 dt 가 크면 폭발하고, implicit 은 어떤 dt 에서도 안 터진다(대신 인위적 감쇠). *왜* 그렇게 갈리는가의 본질은 [07-stability-energy](07-stability-energy.md) 에서 다룬다.

이 스펙트럼을 따라 아래 순서로 읽는다:

- [03-euler-family](03-euler-family.md) — explicit/symplectic/implicit Euler 삼형제 (스펙트럼의 양 끝과 게임 표준)
- [04-verlet](04-verlet.md) — 위치를 1급으로 두는 explicit 계열, 제약과 궁합
- [05-runge-kutta](05-runge-kutta.md) — 고차 explicit (RK2/RK4)

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **multi-step 을 게임에 끌어오는 실수** — 충돌로 끊긴 히스토리가 누적 정확도를 오히려 망친다. single-step 을 고수하라.

**다음**: [03-euler-family](03-euler-family.md) — Euler 삼형제: 한 줄 차이가 폭발과 안정을 가른다.
