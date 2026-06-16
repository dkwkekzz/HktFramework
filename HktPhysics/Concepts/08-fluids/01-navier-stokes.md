# [08·2.1] Navier–Stokes 기초 (Navier–Stokes Equations)

> 모든 유체 솔버가 이산화하려는 *원본 방정식*. 운동량 보존(이류·압력·점성·외력) + 질량 보존(비압축)의 두 줄.
> **상위 노드**: [08-fluids.md](../08-fluids.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-time-integration.md](../03-time-integration.md)

---

게임 유체는 거의 항상 **비압축**(incompressible)·뉴턴 유체(Newtonian)를 가정한다. 그러면 연속체의 거동은 두 줄로 끝난다 — 운동량 보존과 질량 보존.

```
운동량 (momentum):
  ∂u/∂t = -(u·∇)u  -  (1/ρ)∇p  +  ν ∇²u  +  f
            └ 이류 ┘  └ 압력 ┘   └ 점성 ┘   └ 외력

비압축 조건 (mass / divergence-free):
  ∇·u = 0
```

`ρ`=밀도(density), `p`=압력(pressure), `u`=속도장(velocity field), `ν`=동점성계수(kinematic viscosity), `f`=외력(중력 등). 비압축 가정에서 `ρ` 는 상수로 두는 게 보통이다.

**네 항을 한눈에**

| 항 | 이름 | 물리 의미 | 수치 처리 |
|---|---|---|---|
| `-(u·∇)u` | 이류 (advection) | 유체가 자신의 속도를 *자기 자신을 따라* 실어 나름 — 비선형 핵심 | semi-Lagrangian, FLIP, SPH 커널 |
| `-(1/ρ)∇p` | 압력 (pressure) | 압축을 막는 복원력. `∇·u=0` 을 강제하는 라그랑주 승수 역할 | Poisson 풀이(projection) / EOS |
| `ν ∇²u` | 점성 (viscosity) | 속도 확산, 운동 에너지를 열로 소산 | 명시적 라플라시안 / 암시적 확산 |
| `f` | 외력 (external) | 중력·부력·사용자 힘·소용돌이 강제(vorticity confinement) | 직접 가산 |

> 📐 **각 항의 직관을 근본부터**: "왜 이류만 비선형인가 · 압력에는 왜 시간 발전 방정식이 없는가(라그랑주 승수) · 점성은 왜 라플라시안인가 · `∇·u=0` 은 도대체 무슨 뜻인가"를 전용 문서에서 그림으로 푼다 → [01a-navier-stokes-terms.md](01a-navier-stokes-terms.md).

**핵심 통찰 — 압력은 미지수가 아니라 구속의 산물**

> 비압축 조건 `∇·u=0` 은 명시적 미분 방정식이 아니라 *구속*(constraint)이다. 압력 `p` 에는 독립적인 시간 발전 방정식이 없다 — 압력은 "발산을 0 으로 만들기 위해 필요한 만큼" 매 스텝 풀어내는 미지수다. 이것이 Eulerian 솔버의 **pressure projection**([02-eulerian-grid](02-eulerian-grid.md)) 과 Lagrangian 솔버의 **상태방정식/밀도 구속**([03-lagrangian-sph](03-lagrangian-sph.md) · [04-position-based-fluids](04-position-based-fluids.md)) 으로 갈리는 분기점이다.

**왜 이게 분류 축이 되는가**

연속체는 무한 자유도다. 유체 솔버의 전부는 이 두 줄을 *유한한 자유도로 이산화*하는 방법의 차이로 갈린다.

- **Eulerian** — 공간에 고정된 격자 셀에서 `u, p` 를 본다. 이류항을 격자 위에서 처리하고 압력을 Poisson 으로 푼다. → [02-eulerian-grid](02-eulerian-grid.md)
- **Lagrangian** — 유체를 따라다니는 입자에서 본다. 이류는 입자가 움직이는 것 *그 자체* 라 공짜, 대신 미분(∇p, ∇²u)을 커널 합으로 근사한다. → [03-lagrangian-sph](03-lagrangian-sph.md)
- **Height-field** — 수면 높이 `h(x,y)` 한 층으로 차원을 하나 줄인다. → [05-height-field](05-height-field.md)

세 갈래 모두 시간 전진은 [03] 의 적분기에 의존하고, CFL 조건의 지배를 받는다.

---

**관련 함정** (전체 체크리스트는 [08-fluids §5](../08-fluids.md#5-함정--결정론-체크리스트)):
- **CFL 조건**: 명시적 advection 은 `Δt` 상한이 있다 — 한 스텝에 유체가 셀 하나를 넘어 흐르면 정보가 새어 폭발한다(상세 [02](02-eulerian-grid.md)).
- **압력을 "상태"로 착각**: 압력에는 발전 방정식이 없다. 매 스텝 `∇·u=0` 에서 새로 풀어야 한다.

**다음**: [02-eulerian-grid](02-eulerian-grid.md) — 이 방정식을 고정 격자에서 푸는 길.
