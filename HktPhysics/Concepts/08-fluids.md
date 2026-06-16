# [08] 유체 (Fluids) — 허브

> 연속체 유동(continuum flow)을 격자(Eulerian)·입자(Lagrangian)·높이장(height-field)으로 이산화해 물·연기·바다를 시뮬레이션하는 분기.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [08-fluids/](08-fluids/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [03-time-integration.md](03-time-integration.md) · [11-spatial-structures.md](11-spatial-structures.md)

---

## 1. 위치와 역할

유체는 [03] 적분 루프에 끼어드는 **특화 솔버**다. 강체(rigid body)가 6 자유도(DoF) 상태 하나로 끝나는 것과 달리, 유체는 *연속체*(continuum) — 공간 전체에 분포한 속도장 `u(x, t)`·압력장 `p(x, t)` 를 추적해야 한다. 그래서 유체 분기의 본질은 "어떻게 연속체를 유한한 자유도로 **이산화**(discretize)할 것인가"라는 질문 하나로 수렴한다.

이산화 방식이 곧 분류 축이다.

```
연속 방정식 (Navier–Stokes)
   │
   ├─ Eulerian (격자 고정) ........ 공간에 박힌 셀에서 u, p 를 본다 → MAC grid, Stable Fluids, FLIP/PIC
   ├─ Lagrangian (입자 이동) ...... 유체를 따라다니는 입자에서 본다 → SPH, PCISPH/IISPH, PBF
   └─ Height-field (수면 한 장) ... z = h(x, y) 한 층만 본다 → shallow water, Tessendorf ocean
```

- **공유 기반**: 시간 전진은 [03] 의 적분기에 의존하고, 입자/격자 이웃 탐색은 [11] 의 공간 해시·그리드에 의존한다. PBF 의 밀도 구속은 [05]·[07] 의 position-based(PBD/XPBD) 솔버와 같은 뿌리다.
- **게임에서의 위치**: 대부분 "보이는 물"(시각 효과)이며 [09] 파티클·이펙트와 GPU 파이프라인을 공유한다. 게임플레이에 영향을 주는 *상호작용 가능한* 유체는 여전히 비싸서, 실무는 height-field 같은 저차원 근사로 도망치는 경우가 많다.

---

## 2. 하위 문서 인덱스 (세부 이론)

유체는 "연속 방정식 → 이산화 패밀리"의 흐름으로 분할되어 있다. 권장 순서는 위에서 아래. 모든 패밀리의 출발점인 Navier–Stokes 를 먼저 읽고, 세 갈래(Eulerian / Lagrangian / height-field) 중 필요한 곳으로 내려간다.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [08-fluids/01-navier-stokes.md](08-fluids/01-navier-stokes.md) | Navier–Stokes 기초 | 운동량·비압축·이류·압력·점성·외력·구속으로서의 압력 |
| 2.1a | [08-fluids/01a-navier-stokes-terms.md](08-fluids/01a-navier-stokes-terms.md) | NS 각 항의 직관 (심화) | 이류 비선형·압력=라그랑주 승수·점성=확산·∇·u=0 의 의미 |
| 2.2 | [08-fluids/02-eulerian-grid.md](08-fluids/02-eulerian-grid.md) | Eulerian — 격자 | MAC staggered·Stable Fluids·semi-Lagrangian·projection·FLIP/PIC/APIC |
| 2.3 | [08-fluids/03-lagrangian-sph.md](08-fluids/03-lagrangian-sph.md) | Lagrangian — SPH 계열 | 커널 보간·EOS/WCSPH·PCISPH·IISPH·압축성-스텝 트레이드오프 |
| 2.3a | [08-fluids/03a-sph-kernels.md](08-fluids/03a-sph-kernels.md) | SPH 커널·밀도 추정 (심화) | poly6·spiky·viscosity 커널·왜 항마다 다른 커널인가·정규화 |
| 2.4 | [08-fluids/04-position-based-fluids.md](08-fluids/04-position-based-fluids.md) | Position-Based Fluids | 밀도 구속·λ 보정·통합 PBD 솔버·s_corr·큰 timestep |
| 2.5 | [08-fluids/05-height-field.md](08-fluids/05-height-field.md) | Height-field — 수면 한 장 | shallow water·2D 파동 방정식·Tessendorf FFT ocean |

---

## 3. 한눈 요약 — 이산화 패밀리 비교

세 갈래가 같은 문제(비압축 연속체)를 어떻게 다르게 푸는지 한 표로 모았다. 상세는 각 하위 문서.

| 문제 | Eulerian | Lagrangian | Height-field |
|---|---|---|---|
| 시간 전진 | operator splitting + projection | EOS 적분 / PBD 반복 | 명시적 stencil / FFT |
| 비압축 강제 | Poisson projection (CG/multigrid) | PCISPH·IISPH·PBF λ 보정 | (자동, 단일 층) |
| 이류 소산 | FLIP/APIC 로 완화 | (입자라 본질적 무소산) | 해당 없음 |
| 이웃/가속 | 격자 그 자체 | **공간 해시·그리드 → [11]** | 2D 격자 |
| 표면 추출 | level set / marching cubes | metaball + marching cubes | 높이장 → 메시 직접 |
| 가속 | GPU red-black, multigrid → [09]·[13] | GPU 입자 정렬·이웃 → [09]·[13] | GPU FFT/compute |

**Navier–Stokes 항별 요약** (상세 [08-fluids/01](08-fluids/01-navier-stokes.md) · 직관 [08-fluids/01a](08-fluids/01a-navier-stokes-terms.md)):

| 항 | 이름 | 물리 의미 | 수치 처리 |
|---|---|---|---|
| `-(u·∇)u` | 이류 (advection) | 유체가 자신의 속도를 *자기 자신을 따라* 실어 나름 — 비선형 핵심 | semi-Lagrangian, FLIP, SPH 커널 |
| `-(1/ρ)∇p` | 압력 (pressure) | 압축을 막는 복원력. `∇·u=0` 을 강제하는 라그랑주 승수 역할 | Poisson 풀이(projection) / EOS |
| `ν ∇²u` | 점성 (viscosity) | 속도 확산, 운동 에너지를 열로 소산. `ν`=동점성계수 | 명시적 라플라시안 / 암시적 확산 |
| `f` | 외력 (external) | 중력·부력·사용자 힘·소용돌이 강제(vorticity confinement) | 직접 가산 |

- **이웃 탐색**: SPH/PBF 의 지배적 비용. 균일 그리드 또는 **공간 해시**(spatial hashing)로 `O(n²)` → `O(n)`. Morton/Z-order 정렬로 GPU 캐시 지역성을 살린다 ([11] 참조).
- **표면 재구성**: 입자/level-set → 시각용 메시. **marching cubes** 가 표준, 입자를 **metaball**(blobby) 스칼라장으로 깔고 등치면(isosurface)을 뽑는다. 화면 공간 스플래팅(screen-space fluid)으로 메시 없이 셰이딩만 하기도 한다.
- **GPU 가속**: 격자 projection·입자 이웃 모두 데이터 병렬 — 현대 게임 유체는 사실상 전부 GPU([09] 파티클 파이프라인, [13] 병렬).

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 도구 | 성격 | 쓰는 기법 |
|---|---|---|
| **NVIDIA Flow** | 실시간 연기/불 (sparse grid) | Eulerian, 희소 voxel grid, GPU |
| **NVIDIA FleX** | 통합 입자 솔버 | **PBF**(+PBD 강체/천) — [05]·[07]·[08] 한 솔버 |
| **UE Niagara Fluids** | 언리얼 내장 VFX 유체 | 2D/3D grid(Eulerian) + SPH 모듈, GPU compute |
| **UE Water plugin** | 게임용 바다·강·호수 | Gerstner/Tessendorf 파동(height-field) + 부력 |
| **Houdini (FLIP solver)** | 오프라인 영화 기준선 | FLIP/PIC, APIC, 비압축 정밀 projection |
| **RealFlow** | DCC 오프라인 유체 | SPH(Hybrido = FLIP 하이브리드) |
| **PhysX** | 산업 표준 물리 | GPU SPH/PBF 파티클 (FleX 계보 흡수) |

- **게임의 현실**: 게임플레이에 *영향을 주는* 3D 유체는 여전히 드물다. 대부분 (a) 시각용 GPU 파티클/Niagara, (b) 바다·강은 height-field·FFT, (c) 부력은 유체 시뮬 없이 **수면 높이 샘플 + 아르키메데스 근사**(→ [10] 부력/공력)로 푼다.
- **오프라인 기준선**: Houdini FLIP 가 사실상 영화 표준. 게임은 그 결과를 *flipbook/베이크* 로 굽거나 저해상 실시간 근사로 흉내 낸다.

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **수치 점성/소산이 진짜 적**: semi-Lagrangian·PIC 보간은 매 스텝 디테일을 뭉갠다. 연기가 "안개"가 되면 FLIP/APIC 비율을 올리거나 vorticity confinement 로 잃은 소용돌이를 되박는다. ([08-fluids/02](08-fluids/02-eulerian-grid.md))
- **Poisson 풀이가 비용 정점**: 격자 유체 한 프레임의 최대 항. 반복 솔버(CG/multigrid)의 수렴 횟수를 고정하지 않으면 프레임 시간이 출렁인다 — 상한을 걸어라. ([08-fluids/02](08-fluids/02-eulerian-grid.md))
- **CFL 조건**: 명시적 advection·약압축 SPH·height-field 모두 `Δt` 상한이 있다. 입자가 한 스텝에 셀/이웃반경을 넘어 날아가면 폭발한다. Stable Fluids·PBF 는 이 제약을 푸는 게 핵심 가치. ([08-fluids/02](08-fluids/02-eulerian-grid.md) · [08-fluids/04](08-fluids/04-position-based-fluids.md) · [08-fluids/05](08-fluids/05-height-field.md))
- **SPH 압축성-스텝 트레이드오프**: WCSPH 의 강성을 올릴수록 음속↑ → `Δt`↓. 비압축이 중요하면 PCISPH/IISPH/PBF 로 가라. ([08-fluids/03](08-fluids/03-lagrangian-sph.md))
- **SPH 커널 혼용 주의**: 밀도·압력 그래디언트·점성에 같은 커널을 쓰면 입자 군집/불안정이 생긴다. 항마다 맞는 커널(poly6/spiky/viscosity). ([08-fluids/03a](08-fluids/03a-sph-kernels.md))
- **부동소수점 합산 순서(→ [12])**: SPH/PBF 의 이웃 합 `Σ_j` 는 이웃을 *정렬된 결정적 순서* 로 누적해야 한다. GPU atomic add 는 비결정적 순서 → 같은 입력에 다른 출력. lockstep 네트워킹에선 치명적. ([08-fluids/03](08-fluids/03-lagrangian-sph.md) · [08-fluids/04](08-fluids/04-position-based-fluids.md))
- **공간 해시 순회·솔버 조기 종료의 비결정성(→ [12])**: 공간 해시 충돌 순회 순서, 반복 솔버의 수렴 조기 종료도 비결정성의 원천. 결정론이 필요하면 반복 횟수를 *고정* 하고 이웃 순서를 정렬로 못 박는다. ([08-fluids/02](08-fluids/02-eulerian-grid.md) · [08-fluids/03](08-fluids/03-lagrangian-sph.md))
- **시뮬레이션 상수는 CVar 금지**: 커널 `h`, `ρ0`, `Δt` 는 결정론에 직결 — CVar 로 흔들지 말고 헤더 상수로 고정(프로젝트 컨벤션의 `HktSimulationLimits` 원칙과 동일). ([08-fluids/03](08-fluids/03-lagrangian-sph.md))
- **현실적 권고**: 대부분의 게임 유체는 *순수 시각 효과* 이므로 게임플레이 상태와 분리해 결정론 요구에서 빼는 게 가장 싸고 안전하다. 결정론이 필요한 건 부력처럼 게임플레이에 닿는 저차원 근사뿐인 경우가 많다(→ [10]).

---

## 6. 더 읽기 / 관련 노드

**형제 노드 (Concepts 00~13)**
[00-foundations.md](00-foundations.md) ·
[01-kinematics.md](01-kinematics.md) ·
[02-dynamics.md](02-dynamics.md) ·
[03-time-integration.md](03-time-integration.md) ·
[04-collision-detection.md](04-collision-detection.md) ·
[05-constraint-solving.md](05-constraint-solving.md) ·
[06-joints-articulation.md](06-joints-articulation.md) ·
[07-deformable-bodies.md](07-deformable-bodies.md) ·
**08-fluids.md (이 문서)** ·
[09-particles.md](09-particles.md) ·
[10-specialized-systems.md](10-specialized-systems.md) ·
[11-spatial-structures.md](11-spatial-structures.md) ·
[12-determinism-networking.md](12-determinism-networking.md) ·
[13-performance-parallelism.md](13-performance-parallelism.md)

**직접 의존**
- [03-time-integration.md](03-time-integration.md) — 모든 유체 스텝의 시간 전진·고정 timestep·CFL.
- [11-spatial-structures.md](11-spatial-structures.md) — 입자 이웃 탐색(공간 해시·균일 그리드).

**연관 노드**
- [05-constraint-solving.md](05-constraint-solving.md) · [07-deformable-bodies.md](07-deformable-bodies.md) — PBF 의 밀도 구속은 PBD/XPBD 와 동일 계열(통합 솔버).
- [09-particles.md](09-particles.md) · [13-performance-parallelism.md](13-performance-parallelism.md) — GPU 입자 파이프라인·병렬 projection.
- [10-specialized-systems.md](10-specialized-systems.md) — 부력/공력(수면 높이 샘플 근사).

**외부 레퍼런스**
- Robert Bridson, *Fluid Simulation for Computer Graphics* — 격자·FLIP·projection 의 정전(定本).
- Jos Stam, "Stable Fluids" (SIGGRAPH 1999) — semi-Lagrangian + projection 파이프라인.
- Müller, Charypar, Gross, "Particle-Based Fluid Simulation for Interactive Applications" (2003) — 실시간 SPH.
- Solenthaler & Pajarola, "Predictive-Corrective Incompressible SPH" (2009) / Ihmsen 외, IISPH (2014).
- Macklin & Müller, "Position Based Fluids" (SIGGRAPH 2013).
- Jiang 외, "The Affine Particle-In-Cell Method" (APIC, 2015).
- Jerry Tessendorf, "Simulating Ocean Water" — FFT 바다 표면.
