# [03·2.7] 안정성 · 에너지 드리프트 · 폭발 (Stability · Energy Drift · Explosion)

> 적분기가 언제 터지고(explosion), 왜 에너지가 새거나 쌓이는가(drift), 무엇이 최대 dt 를 묶는가(stiffness·CFL) 의 직관을 한 곳에 모은다.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-euler-family](03-euler-family.md) · [00-foundations/04-calculus-ode](../00-foundations/04-calculus-ode.md)

---

적분기 선택의 결과는 결국 세 현상으로 나타난다 — 무엇이 dt 를 묶는가(stiffness), 에너지가 어디로 새는가(drift), 언제 터지는가(explosion). 직관 단위로 정리한다.

## stiffness (강성) — 무엇이 최대 dt 를 묶는가

계의 **가장 빠른 모드**(큰 `k/m`, 또는 큰 고윳값)가 explicit 적분기의 최대 안정 dt 를 결정한다. 핵심은 **한 군데만 빳빳해도 전체 dt 가 묶인다**는 것 — 스프링 5000개 중 하나만 강성이 1000배면, 그 하나 때문에 전체 시뮬의 dt 가 마이크로초로 내려간다.

```
스프링계 explicit 안정 한계:  dt < 2·sqrt(m/k)      ← k 가 크면 dt 가 급격히 작아짐
```

→ 이것이 빳빳한 천/강한 제약을 explicit 으로 못 푸는 이유이며, implicit Euler([03-euler-family §(c)](03-euler-family.md))나 PBD/XPBD([05-constraint-solving.md](../05-constraint-solving.md))로 그 부분을 분리하는 동기다.

## CFL 조건 (Courant–Friedrichs–Lewy)

본래 유체/파동([08-fluids.md](../08-fluids.md))의 격자 적분 안정 조건 — "정보가 한 스텝에 한 셀 이상 못 건너가게":

```
dt ≤ C · Δx / c        (c = 특성 속도/파속, Δx = 셀 크기)
```

일반화하면 **"explicit 적분기는 계의 특성 시간보다 dt 가 작아야 한다"**는 보편 원리다. 강체의 `dt < 2·sqrt(m/k)` 도 같은 정신 — explicit 의 안정성은 항상 "한 스텝에 너무 멀리 가지 마라"는 형태로 dt 에 상한을 건다.

## energy drift (에너지 드리프트) — 적분기별 거동

적분기 선택 = **어떤 드리프트를 감수할지의 선택**이다.

| 적분기 | 에너지 거동 | 시각적 증상 |
|---|---|---|
| explicit (forward) Euler | 주입 → 단조 증가 | 진동이 점점 커짐 → 폭발 |
| symplectic / Verlet | 유계 진동(드리프트 0) | 영원히 그럴듯함 — *이상적* |
| backward (implicit) Euler | 손실 → 단조 감소 | 진동이 빨리 죽음(과감쇠) |
| RK4 | 천천히 손실 | 장시간에 서서히 죽음 |

*왜* symplectic 만 드리프트가 없는가는 shadow Hamiltonian/면적 보존으로 [03a-symplectic-energy](03a-symplectic-energy.md) 에서 끝까지 푼다.

## explosion (폭발 / NaN) — 발산의 직관

dt·강성·**질량비(mass ratio)**·관통 깊이가 겹치면 속도가 발산 → 위치가 무한대/NaN 으로 간다. 직관적으로 폭발은 "한 스텝에 너무 큰 보정이 들어가 다음 스텝에 더 큰 보정을 부르는 양의 되먹임"이다. 대표 트리거:

- **dt 가 안정 한계를 넘음** — 프레임 드랍/디버거 멈춤 후 거대 dt 한 방.
- **극단적 질량비** — 무거운 물체가 가벼운 물체를 밀 때 보정이 증폭.
- **깊은 관통(penetration)** — 위치 보정이 폭발적 속도를 만듦(Baumgarte 과보정).

**방어 수단**: 고정 dt([08-fixed-timestep-loop](08-fixed-timestep-loop.md)) · substepping · 속도/관통 클램프 · implicit · sleeping([13-performance-parallelism.md](../13-performance-parallelism.md)).

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **stiff 요소 하나가 전체 dt 를 묶음** — explicit 으로 빳빳한 천/제약을 섞으면 한 군데 때문에 전부 폭발. 그 부분만 implicit/PBD 로 분리.
- **dt 가 안정 영역을 넘는 순간 폭발** — 가변 dt 의 직접 위험. 고정 dt + 클램프로 방어.

**다음**: [08-fixed-timestep-loop](08-fixed-timestep-loop.md) — 위 모든 안정성을 실무에서 지키는 루프 구조.
