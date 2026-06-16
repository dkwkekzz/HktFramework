# [08] 유체 (Fluids)

> 연속체 유동(continuum flow)을 격자(Eulerian)·입자(Lagrangian)·높이장(height-field)으로 이산화해 물·연기·바다를 시뮬레이션하는 분기.
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

## 2. 핵심 이론

### 2.1 Navier–Stokes 방정식 (비압축)

게임 유체는 거의 항상 **비압축**(incompressible)·뉴턴 유체(Newtonian)를 가정한다. 운동량 보존 + 질량 보존이 전부다.

```
운동량 (momentum):
  ∂u/∂t = -(u·∇)u  -  (1/ρ)∇p  +  ν ∇²u  +  f
            └ 이류 ┘  └ 압력 ┘   └ 점성 ┘   └ 외력

비압축 조건 (mass / divergence-free):
  ∇·u = 0
```

| 항 | 이름 | 물리 의미 | 수치 처리 |
|---|---|---|---|
| `-(u·∇)u` | 이류 (advection) | 유체가 자신의 속도를 *자기 자신을 따라* 실어 나름 — 비선형 핵심 | semi-Lagrangian, FLIP, SPH 커널 |
| `-(1/ρ)∇p` | 압력 (pressure) | 압축을 막는 복원력. `∇·u=0` 을 강제하는 라그랑주 승수 역할 | Poisson 풀이(projection) / EOS |
| `ν ∇²u` | 점성 (viscosity) | 속도 확산, 운동 에너지를 열로 소산. `ν`=동점성계수 | 명시적 라플라시안 / 암시적 확산 |
| `f` | 외력 (external) | 중력·부력·사용자 힘·소용돌이 강제(vorticity confinement) | 직접 가산 |

`ρ`=밀도(density), `p`=압력(pressure), `u`=속도장(velocity field). 비압축 가정에서 `ρ` 는 상수로 두는 게 보통이다.

> **핵심 통찰**: 비압축 조건 `∇·u=0` 은 명시적 미분 방정식이 아니라 *구속*(constraint)이다. 압력 `p` 에는 독립적인 시간 발전 방정식이 없다 — 압력은 "발산을 0 으로 만들기 위해 필요한 만큼" 매 스텝 풀어내는 미지수다. 이것이 Eulerian 솔버의 **pressure projection** 과 Lagrangian 솔버의 **상태방정식/밀도 구속** 으로 갈리는 분기점이다.

### 2.2 Eulerian — 격자 (grid)

#### MAC grid (staggered grid)

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

왜 어긋나게? 모든 양을 셀 중심에 두면(collocated) 압력 그래디언트 `∇p` 가 인접 셀을 건너뛰어 **체커보드(checkerboard) 압력 모드**가 새는데, staggered 배치는 `∇p` 와 `∇·u` 가 인접 셀 사이에서 자연스럽게 정의되어 이 문제를 제거한다.

#### Stam "Stable Fluids" — 무조건 안정 파이프라인

Jos Stam(1999)이 그래픽스를 바꾼 분해. 한 스텝을 **연산자 분리(operator splitting)** 로 쪼갠다.

```
한 스텝 (operator splitting):
  1. add force      u ← u + Δt · f
  2. advect         u ← SemiLagrangian(u, Δt)     // 이류
  3. diffuse        u ← ImplicitDiffuse(u, ν, Δt)  // 점성(선택)
  4. project        u ← u - (1/ρ)∇p,  s.t. ∇·u = 0 // 압력
```

- **semi-Lagrangian advection**: 격자점에서 속도장을 *시간 거꾸로* 추적해(`x_back = x - Δt·u`) 그 위치의 값을 보간해 가져온다. CFL 조건과 무관하게 폭발하지 않는다 — 이게 "Stable" 의 정체. 대가는 **수치 점성/소산**(numerical diffusion): 보간이 매 스텝 디테일을 뭉개 연기가 흐릿해진다.
- **pressure projection (Poisson 풀이)**: 발산을 0 으로 만드는 압력은 포아송 방정식의 해다.

```
∇·u* = ∇²p · (Δt/ρ)   →   ∇²p = (ρ/Δt) ∇·u*   (Poisson)
그 후:  u = u* - (Δt/ρ)∇p
```

  큰 희소(sparse) 대칭 양정치 선형계 — **Conjugate Gradient**(전형적으로 MIC(0) preconditioner), 멀티그리드(multigrid), 또는 GPU 에서 red-black Gauss–Seidel/Jacobi 로 푼다. 보통 한 프레임 비용의 최대 항.

#### FLIP / PIC (하이브리드 입자-격자)

Eulerian advection 의 소산이 싫으면 입자를 섞는다.

- **PIC**(Particle-In-Cell): 입자 → 격자로 속도 전사(P2G), 격자에서 압력 projection, 격자 → 입자로 되전사(G2P). 안정적이지만 P2G/G2P 보간이 PIC 도 **심하게 소산**시킨다.
- **FLIP**(Fluid-Implicit-Particle, Brackbill & Ruppel; Zhu & Bridson 가 유체로): 격자가 만든 속도 *그 자체* 가 아니라 **변화량(delta)** 만 입자로 되돌린다 → 거의 무소산, 출렁이는 물보라. 단, 노이즈가 끼어 보통 `α·FLIP + (1-α)·PIC` 로 섞어 안정화한다.
- **APIC**(Affine Particle-In-Cell, Jiang 외): 입자에 속도뿐 아니라 **국소 아핀(affine) 속도장 행렬**을 실어 P2G/G2P 시 각운동량을 보존 — FLIP 의 노이즈 없이 디테일을 살린다. MPM(Material Point Method) 의 토대이기도 하다.

### 2.3 Lagrangian — 입자 (SPH 계열)

격자가 없다. 유체를 따라다니는 입자 무리로 연속체를 표현하며, 자유 표면(free surface)·튀는 물보라가 자연스럽다.

#### SPH (Smoothed Particle Hydrodynamics)

임의의 장 `A` 를 이웃 입자의 **커널 가중 합**으로 보간한다.

```
보간 (커널 W, smoothing length h):
  A(x) ≈ Σ_j  m_j · (A_j / ρ_j) · W(x - x_j, h)

밀도 (density):
  ρ_i = Σ_j  m_j · W(x_i - x_j, h)

압력 (상태방정식 EOS, Tait/이상기체):
  p_i = k (ρ_i - ρ0)        // 선형
  p_i = (k·ρ0/γ)[(ρ_i/ρ0)^γ - 1]   // Tait, γ≈7 (약압축 WCSPH)

압력 힘 (운동량, 대칭형):
  f_i^pressure = -Σ_j  m_j (p_i/ρ_i² + p_j/ρ_j²) ∇W_ij

점성 힘 (Müller 2003 형):
  f_i^viscosity = μ Σ_j  m_j (u_j - u_i)/ρ_j · ∇²W_ij
```

- **커널 선택**: 밀도/보간엔 poly6, 압력 그래디언트엔 **spiky**(중심에서 폭발하는 군집을 막는 음의 그래디언트), 점성엔 라플라시안이 양수인 viscosity 커널 — 항마다 다른 커널을 쓰는 게 Müller 의 정석.
- **EOS-SPH(WCSPH)의 약점**: 비압축을 *근사*로만 강제한다. 단단하게(`k` 크게) 하면 음속이 올라가 CFL 상 `Δt` 가 잘게 쪼개져 매우 느려진다 — **압축성-시간스텝 트레이드오프**.

#### PCISPH / IISPH (비압축 개선)

EOS 의 약압축을 정면 돌파한 비압축 SPH.

- **PCISPH**(Predictive-Corrective Incompressible SPH, Solenthaler & Pajarola): 위치를 예측 → 밀도 오차 측정 → 압력을 *반복 보정*해 밀도 오차가 허용치 아래로 떨어질 때까지 돌린다. 큰 `Δt` 에서도 비압축을 지킨다.
- **IISPH**(Implicit Incompressible SPH, Ihmsen 외): 비압축 압력을 **암시적 선형계**로 정식화해 relaxed Jacobi 로 푼다 — PCISPH 보다 큰 스텝에서 더 빠르고 안정적. 사실상 SPH 판 pressure projection.

### 2.4 Position-Based Fluids (PBF)

Macklin & Müller(2013). SPH 의 밀도 비압축을 **위치 기반 구속**(position-based constraint)으로 다시 쓴 것 — [05]·[07] 의 PBD/XPBD 와 정확히 같은 계열이라, 강체·천·유체를 **하나의 통합 PBD 솔버**(NVIDIA FleX)에서 같은 반복 루프로 돌릴 수 있게 한 점이 결정적이다.

각 입자에 밀도 구속을 건다: `C_i(p_1...p_n) = ρ_i/ρ0 - 1 = 0`.

```
PBF 한 스텝:
  1. 예측 위치       p* = x + Δt·v + Δt²·f
  2. 이웃 탐색       (공간 해시 → [11])
  3. solver 반복 (보통 3~5회):
       각 입자 밀도 구속 C_i 계산
       라그랑주 승수 λ_i = -C_i / (Σ|∇C|² + ε)   // ε: CFM/완화항
       위치 보정 Δp_i = (1/ρ0) Σ_j (λ_i+λ_j+s_corr) ∇W_ij
       p* ← p* + Δp_i
  4. 속도 갱신       v = (p* - x)/Δt
  5. vorticity confinement + XSPH viscosity 로 후처리
  6. commit          x ← p*
```

- `s_corr`: **인공 표면장력/응집(tensile instability) 보정** — 입자가 응어리지지 않고 표면을 매끈히 유지하게 한다.
- 반복 횟수로 *비압축성↔비용* 을 직관적으로 조절. CFL 에 덜 민감해 **큰 고정 timestep**([03])에서 잘 버틴다 → 게임 실시간에 인기.
- XPBD 정식화를 쓰면 강성(stiffness)이 timestep 에 독립적이 되어 [07] 의 천/소프트바디와 강성 단위를 통일할 수 있다.

### 2.5 Height-field — 수면 한 장

3D 전체를 풀지 않고 수면 높이 `h(x, y)` 한 층만 본다. 차원이 하나 줄어 압도적으로 싸다.

#### Shallow Water Equations (SWE)

수심이 파장보다 얕다는 가정. 수직 속도를 무시하고 깊이 평균한 2D 방정식 — 호수·강·로컬 물웅덩이의 출렁임/잔물결(ripple), 노 젓기 상호작용에 쓴다. 가장 단순한 게임용 근사는 2D **파동 방정식**(wave equation) 격자:

```
2D 파동 방정식 (격자, 명시적):
  h^{n+1}_ij = 2h^n_ij - h^{n-1}_ij
             + c²(Δt/Δx)² (h_{i+1,j}+h_{i-1,j}+h_{i,j+1}+h_{i,j-1} - 4h_ij)
  ※ 안정 조건: c·Δt/Δx ≤ 1 (CFL)
```

#### Tessendorf FFT ocean

넓은 바다는 시뮬이 아니라 **통계적 스펙트럼 합성**으로 만든다. Phillips 스펙트럼으로 주파수 영역의 높이장을 깔고 **역 FFT**로 공간 영역 변위/법선을 얻는다 — 타일링되는 무한 바다, 게임/영화 표준(예: *Assassin's Creed* 의 바다, UE Water). 실제 유동 시뮬은 아니고 *그럴듯한 파면* 재현이다.

---

## 3. 주요 기법/도구

| 문제 | Eulerian | Lagrangian | Height-field |
|---|---|---|---|
| 시간 전진 | operator splitting + projection | EOS 적분 / PBD 반복 | 명시적 stencil / FFT |
| 비압축 강제 | Poisson projection (CG/multigrid) | PCISPH·IISPH·PBF λ 보정 | (자동, 단일 층) |
| 이류 소산 | FLIP/APIC 로 완화 | (입자라 본질적 무소산) | 해당 없음 |
| 이웃/가속 | 격자 그 자체 | **공간 해시·그리드 → [11]** | 2D 격자 |
| 표면 추출 | level set / marching cubes | metaball + marching cubes | 높이장 → 메시 직접 |
| 가속 | GPU red-black, multigrid → [09]·[13] | GPU 입자 정렬·이웃 → [09]·[13] | GPU FFT/compute |

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

## 5. 함정·결정론 주의

- **수치 점성/소산이 진짜 적**: semi-Lagrangian·PIC 보간은 매 스텝 디테일을 뭉갠다. 연기가 "안개"가 되면 FLIP/APIC 비율을 올리거나 vorticity confinement 로 잃은 소용돌이를 되박는다.
- **Poisson 풀이가 비용 정점**: 격자 유체 한 프레임의 최대 항. 반복 솔버(CG/multigrid)의 수렴 횟수를 고정하지 않으면 프레임 시간이 출렁인다 — 상한을 걸어라.
- **CFL 조건**: 명시적 advection·약압축 SPH·height-field 모두 `Δt` 상한이 있다. 입자가 한 스텝에 셀/이웃반경을 넘어 날아가면 폭발한다. Stable Fluids·PBF 는 이 제약을 푸는 게 핵심 가치.
- **SPH 압축성-스텝 트레이드오프**: WCSPH 의 강성을 올릴수록 음속↑ → `Δt`↓. 비압축이 중요하면 PCISPH/IISPH/PBF 로 가라.
- **결정론(→ [12])**:
  - **부동소수점 합산 순서**가 결과를 바꾼다. SPH/PBF 의 이웃 합 `Σ_j` 는 이웃을 *정렬된 결정적 순서* 로 누적해야 한다. GPU atomic add 는 비결정적 순서 → 같은 입력에 다른 출력. lockstep 네트워킹에선 치명적.
  - **공간 해시 충돌 순회 순서**, 반복 솔버의 **수렴 조기 종료** 도 비결정성의 원천. 결정론이 필요하면 반복 횟수를 *고정* 하고 이웃 순서를 정렬로 못 박는다.
  - 시뮬레이션 상수(커널 `h`, `ρ0`, `Δt`)는 CVar 로 흔들지 말고 헤더 상수로 고정 — 결정론에 직결(프로젝트 컨벤션의 `HktSimulationLimits` 원칙과 동일).
  - **현실적 권고**: 대부분의 게임 유체는 *순수 시각 효과* 이므로 게임플레이 상태와 분리해 결정론 요구에서 빼는 게 가장 싸고 안전하다. 결정론이 필요한 건 부력처럼 게임플레이에 닿는 저차원 근사뿐인 경우가 많다.

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
