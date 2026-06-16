# [08·2.2] Eulerian — 격자 (Grid-Based Fluids)

> 공간에 고정된 격자 셀에서 `u, p` 를 본다. MAC staggered 배치 + Stam 의 무조건 안정 파이프라인(advect→project) + 소산을 줄이는 FLIP/PIC/APIC 하이브리드.
> **상위 노드**: [08-fluids.md](../08-fluids.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-navier-stokes.md](01-navier-stokes.md) · [03-time-integration.md](../03-time-integration.md) · [11-spatial-structures.md](../11-spatial-structures.md)

---

연속체를 공간에 박힌 셀 격자로 이산화한다. [01-navier-stokes](01-navier-stokes.md) 의 두 줄을 격자 위에서 항별로 푼다(연산자 분리). 게임에서는 주로 연기·불 같은 *기체 시각 효과* 에 쓴다.

## MAC grid (staggered grid)

Harlow & Welch 의 **Marker-and-Cell** 격자. 핵심 트릭은 **속도 성분을 셀 면(face)에, 스칼라(압력)를 셀 중심(center)에** 저장하는 *어긋난(staggered)* 배치다.

```
       u_{i+1/2, j}      ┌── 압력 p, 밀도 ρ : 셀 중심
        ↑                │
  ──────┼──────          ├── u (x-속도) : 좌/우 면 중심
   p_ij │  p_{i+1,j}     └── v (y-속도) : 상/하 면 중심
  ──────┼──────
        ↓
       u_{i+1/2, j-1}
```

**왜 어긋나게?** 모든 양을 셀 중심에 두면(collocated) 압력 그래디언트 `∇p` 가 인접 셀을 건너뛰어(`p_{i+1} - p_{i-1}` 처럼 2칸 차분) **체커보드(checkerboard) 압력 모드**가 새는데 — 격자가 흑백 두 패턴으로 분리돼 서로를 못 보는 가짜 해 — staggered 배치는 `∇p` 와 `∇·u` 가 **인접 셀 사이에서** 자연스럽게 정의되어(1칸 차분) 이 문제를 제거한다. 압력은 셀 중심에, 압력차가 미는 속도는 면에 — 인과가 한 칸 안에서 맞물린다.

## Stam "Stable Fluids" — 무조건 안정 파이프라인

Jos Stam(1999)이 그래픽스를 바꾼 분해. 한 스텝을 **연산자 분리(operator splitting)** 로 쪼갠다 — [01a §6](01a-navier-stokes-terms.md) 에서 본 "항을 하나씩 적용"의 구체형이다.

```
한 스텝 (operator splitting):
  1. add force      u ← u + Δt · f
  2. advect         u ← SemiLagrangian(u, Δt)     // 이류
  3. diffuse        u ← ImplicitDiffuse(u, ν, Δt)  // 점성(선택)
  4. project        u ← u - (1/ρ)∇p,  s.t. ∇·u = 0 // 압력
```

**semi-Lagrangian advection.** 격자점에서 속도장을 *시간 거꾸로* 추적해(`x_back = x - Δt·u`) 그 위치의 값을 보간해 가져온다. "지금 이 셀에 있는 물은 한 스텝 전 어디서 왔나"를 역으로 찾는 것 — 그 출발점이 어디든(아무리 빨라도) 격자 안에서 보간하므로 **CFL 조건과 무관하게 폭발하지 않는다**. 이게 "Stable" 의 정체다. 대가는 **수치 점성/소산**(numerical diffusion): 보간이 매 스텝 디테일을 평균 내 뭉개므로 연기가 흐릿해진다([01a §4](01a-navier-stokes-terms.md) 의 인공 확산).

**pressure projection (Poisson 풀이).** 발산을 0 으로 만드는 압력은 포아송 방정식의 해다([01a §3](01a-navier-stokes-terms.md) 의 라그랑주 승수).

```
∇·u* = ∇²p · (Δt/ρ)   →   ∇²p = (ρ/Δt) ∇·u*   (Poisson)
그 후:  u = u* - (Δt/ρ)∇p
```

큰 희소(sparse) 대칭 양정치 선형계 — **Conjugate Gradient**(전형적으로 MIC(0) preconditioner), 멀티그리드(multigrid), 또는 GPU 에서 red-black Gauss–Seidel/Jacobi 로 푼다. 보통 **한 프레임 비용의 최대 항**이다.

## FLIP / PIC / APIC (하이브리드 입자-격자)

Eulerian advection 의 소산이 싫으면 입자를 섞는다. "이류는 입자로(무소산), 압력은 격자로(projection 이 쉬움)" — 두 세계의 장점을 합친다.

- **PIC**(Particle-In-Cell): 입자 → 격자로 속도 전사(P2G), 격자에서 압력 projection, 격자 → 입자로 되전사(G2P). 안정적이지만 P2G/G2P 보간이 **PIC 도 심하게 소산**시킨다(매 왕복마다 평균).
- **FLIP**(Fluid-Implicit-Particle, Brackbill & Ruppel; Zhu & Bridson 가 유체로): 격자가 만든 속도 *그 자체* 가 아니라 **변화량(delta)** 만 입자로 되돌린다 → 거의 무소산, 출렁이는 물보라. 단, 노이즈가 끼어 보통 `α·FLIP + (1-α)·PIC` 로 섞어 안정화한다(α≈0.95~0.99).
- **APIC**(Affine Particle-In-Cell, Jiang 외): 입자에 속도뿐 아니라 **국소 아핀(affine) 속도장 행렬**을 실어 P2G/G2P 시 각운동량을 보존 — FLIP 의 노이즈 없이 디테일을 살린다. MPM(Material Point Method) 의 토대이기도 하다.

> **선택 직관**: 순수 Eulerian(Stable Fluids)은 안정하지만 흐릿하다 → 연기에 OK. 물보라·자유 표면이 중요하면 FLIP/APIC. 이류 소산이 곧 화질이라, 이 축이 격자 유체 품질의 핵심 노브다.

---

**관련 함정** (전체 체크리스트는 [08-fluids §5](../08-fluids.md#5-함정--결정론-체크리스트)):
- **수치 점성/소산**: semi-Lagrangian·PIC 보간이 매 스텝 디테일을 뭉갠다 → FLIP/APIC 비율↑ 또는 vorticity confinement 로 소용돌이 되박기.
- **Poisson 풀이 비용**: 한 프레임 최대 항. 반복 솔버(CG/multigrid) 수렴 횟수를 *고정* 하지 않으면 프레임 시간이 출렁인다 — 상한을 걸어라(결정론에도 직결, → [12](../12-determinism-networking.md)).
- **collocated 체커보드**: 속도·압력을 같은 위치에 두면 가짜 압력 모드. staggered(MAC)로 피한다.
- **CFL**: semi-Lagrangian advection 은 면제지만, 명시적 점성·외력 일부는 여전히 `Δt` 제약을 받는다.

**다음**: [03-lagrangian-sph](03-lagrangian-sph.md) — 격자를 버리고 입자로 같은 방정식을 푸는 길.
