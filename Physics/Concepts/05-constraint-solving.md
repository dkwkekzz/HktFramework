# [05] 구속 해법 (Constraint Solving)

> 충돌·조인트가 만든 **구속(constraint)** 을 임펄스/위치 보정으로 풀어, 물체가 서로 파고들지 않고 붙잡혀 있게 만드는 시뮬레이션의 심장. 한 프레임에서 가장 무겁고, 가장 안정성·결정론에 민감한 단계다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md)

---

## 1. 위치와 역할

한 프레임의 물리 스텝에서 구속 해법은 적분과 충돌 감지 사이/뒤에 끼는 단계다.

```
forces 적용 → [03] 적분(속도 예측) → [04] 충돌 감지(manifold 생성)
   → [05] 구속 해법(contact + joint 임펄스 반복) → 위치 적분/commit → sleeping/islands
```

- **입력**: [04]가 만든 contact manifold(접촉점·법선·침투 깊이)와 [06]의 조인트, 그리고 [02]/[03]이 준 각 강체의 질량·관성·속도.
- **출력**: 비침투·비관통·조인트 만족을 위해 속도(또는 위치)에 가해질 **임펄스(impulse) λ** 들. 적용 후 물체는 서로 안 파고들고, 조인트 한계를 지키며, 마찰로 미끄러짐이 제한된다.
- **왜 어려운가**: 접촉은 *부등식 구속*(파고들면 안 되지만 떨어지는 건 자유)이고, 마찰은 법선력에 *결합*되며, 여러 접촉이 *동시에* 만족돼야 한다 → 일반적으로 **LCP(Linear Complementarity Problem)**. 게임은 정확한 해 대신 반복 근사로 "충분히 안정적인" 해를 실시간에 뽑는다.

구속 해법은 [02 동역학](02-dynamics.md)의 운동량 보존을 임펄스 형태로 쓰고, [03 적분](03-time-integration.md)이 정한 timestep `h` 위에서 작동하며, [04 충돌 감지](04-collision-detection.md)의 manifold 품질에 결과가 직결된다. 아래 [06 조인트](06-joints-articulation.md)는 같은 솔버를 공유한다.

---

## 2. 핵심 이론

### 2.1 구속의 수학 — 위치 구속에서 속도 구속으로

구속은 보통 **위치 함수** `C(x) = 0` (또는 부등식 `C(x) ≥ 0`)으로 정의한다. `x` 는 모든 물체의 일반화 위치(위치+방향).

예: 두 점이 거리 `L`로 묶인 distance 구속

```
C(x) = |p2 - p1| - L = 0
```

솔버는 위치를 직접 풀기 어려우므로 보통 **속도 수준**에서 푼다. `C`를 시간 미분하면 일반화 속도 `v`에 대한 선형식이 나온다.

```
Ċ = (∂C/∂x) · ẋ = J v = 0          ← 속도 구속 (velocity constraint)
```

여기서 `J = ∂C/∂x` 가 **Jacobian**. 행 하나가 구속 하나에 대응하고, "어느 자유도가 이 구속을 위반시키는 방향인가"를 가리킨다. 강체 한 쌍의 경우 `J`는 보통 `[ -n^T, -(r1×n)^T, n^T, (r2×n)^T ]` 형태(법선 `n`, 접촉점까지의 팔 `r`).

**구속력**은 `J^T` 방향으로만 작용한다(가상일 원리 / Lagrange 승수):

```
f_constraint = J^T λ            (λ = Lagrange 승수 = 임펄스 크기)
```

#### Effective mass (유효 질량)

뉴턴 식 `M v̇ = J^T λ` 와 속도 구속 `J v = 0` 을 결합하면, 한 구속을 만족시키는 데 필요한 임펄스는

```
λ = -(J M⁻¹ J^T)⁻¹ (J v)
m_eff = (J M⁻¹ J^T)⁻¹           ← effective mass
```

`M⁻¹` 는 역질량 행렬(`diag(1/m, I⁻¹, …)`). 1차원 접촉이면 `J M⁻¹ J^T` 는 스칼라라 `m_eff` 도 스칼라가 된다 — SI 솔버의 핵심 양. 이 값은 한 구속 안에서 timestep 내내 변하지 않으므로 **warm start 캐시·반복 전 미리 계산**한다.

#### 등식 vs 부등식 구속

| 종류 | 식 | 예 | λ 제약 |
|---|---|---|---|
| 등식(equality) | `C = 0`, `J v = 0` | 조인트, 거리 고정 | `λ ∈ (-∞, ∞)` |
| 부등식(inequality) | `C ≥ 0`, `J v ≥ 0` | 접촉 비침투, 조인트 한계 | `λ ≥ 0` (밀기만, 당기지 못함) |

접촉의 본질은 **부등식**이다 — 바닥은 물체를 *밀어내기만* 하고 잡아당기지 못한다. 그래서 정규 임펄스는 항상 `λ_n ≥ 0` 로 **클램핑**된다.

### 2.2 접촉 모델 (contact model)

#### 비침투 (non-penetration)

법선 `n` 방향 상대속도 `v_n = J_n v` 가 분리되도록(`≥ 0`) 만든다. 침투를 막는 게 1차 목표.

#### 반발계수 (restitution, e)

튕김. 충돌 후 분리 속도를 충돌 전 접근 속도의 `e`배로. 목표 속도에 **bias**로 주입.

```
v_n_target = -e · v_n_approach          (v_n_approach < 0 일 때만)
```

`e=0` 완전 비탄성(딱 멈춤), `e=1` 완전 탄성(에너지 보존). 실무에서는 작은 접근 속도엔 restitution을 꺼서(임계값) 지터를 막는다(resting contact에서 영원히 튀는 것 방지).

#### 쿨롱 마찰 (Coulomb friction)

접선 임펄스 `λ_t` 는 정규 임펄스 `λ_n` 에 묶인다.

```
|λ_t| ≤ μ · λ_n          (μ = 마찰계수)
```

- `|λ_t| < μ λ_n` : **정지 마찰(static)** — 상대 접선속도 0 유지(붙음).
- `|λ_t| = μ λ_n` : **운동 마찰(kinetic)** — 미끄러짐, 임펄스가 한계에 포화.

3D에서 허용 마찰력 집합은 법선축을 중심으로 한 **마찰뿔(friction cone)**: `√(λ_t1² + λ_t2²) ≤ μ λ_n`. 이건 원뿔(2차)이라 LCP에 직접 넣기 어렵다. 실무는 두 직교 접선축을 독립 클램핑하는 **마찰 피라미드(friction pyramid)** 근사(box friction)를 쓴다 — 빠르지만 마찰력이 방향에 따라 `~√2` 만큼 비등방. 더 정확히는 뿔을 다각형으로 분할(faceted cone). 핵심 문제: `μ λ_n` 의 `λ_n` 이 *같은 반복 안에서 계속 갱신*되므로 마찰 한계가 떠돈다 → SI는 매 반복 직전의 누적 `λ_n` 으로 한계를 다시 잡는다.

#### 침투 보정 (positional drift correction)

속도만 풀면 이미 파고든 침투(penetration)는 안 사라진다. 보정 기법:

**Baumgarte stabilization** — 침투 깊이 `d`(>0)를 속도 bias로 되먹임.

```
v_bias = (β / h) · d        (β ≈ 0.1~0.2,  보통 slop 차감 후)
J v ≥ -v_bias              → 침투를 부드럽게 밀어냄
```

문제: `v_bias` 가 *진짜 운동 에너지로* 더해져 물체가 "튀어오르는" 에너지 추가(energy gain) 부작용. β를 키우면 빠르지만 불안정.

**Slop (허용 침투)** — `d` 에서 작은 여유 `slop`(예 0.5cm)을 빼고 보정. 미세 떨림/지터를 죽인다.

```
d_corrected = max(d - slop, 0)
```

**Soft constraint (Catto) / CFM·ERP (ODE 용어)** — 구속을 강체(딱딱)가 아니라 *감쇠 스프링*으로 모델. ODE는 두 손잡이로 노출:

- **ERP (Error Reduction Parameter)** — Baumgarte β 에 해당, 한 스텝에 위치 오차를 얼마나 줄일지(0~1).
- **CFM (Constraint Force Mixing)** — 대각에 `γ` 를 더해 구속을 "물렁하게". `CFM>0` 이면 약간의 위반을 허용하는 대신 수치적으로 안정.

```
(J M⁻¹ J^T + γ) λ = -(J v + bias)      ← γ 가 CFM (soft)
```

Catto의 soft constraint는 이 ERP/CFM 한 쌍을 **stiffness/damping(ω, ζ)** 으로 재매개화하여 Baumgarte의 에너지 추가 문제를 크게 줄였다 — 현대 Box2D TGS soft의 기반.

### 2.3 Impulse 기반 솔버 (게임 주류)

#### Sequential Impulse (SI) — Erin Catto

한 번에 한 구속씩, 그 구속만 정확히 만족시키는 임펄스를 풀고 즉시 속도에 적용하며 **순차적으로 반복**한다. 한 접촉의 정규 임펄스 유도:

```
목표:  J v_new = -v_bias            (bias = restitution + Baumgarte)
v_new = v + M⁻¹ J^T Δλ
대입:  J(v + M⁻¹ J^T Δλ) = -v_bias
풀면:  Δλ = -(J v + v_bias) / (J M⁻¹ J^T) = -m_eff (J v + v_bias)
```

핵심: **누적 임펄스 클램핑**. `Δλ` 자체가 아니라 누적값 `λ` 를 클램핑해야 부드럽다.

```
λ_old = λ
λ = max(λ_old + Δλ, 0)             ← 정규: λ ≥ 0
Δλ_applied = λ - λ_old            ← 실제 적용량
v += M⁻¹ J^T Δλ_applied
```

마찰은 같은 방식이되 한계가 `[-μλ_n, +μλ_n]` 양방향 클램프:

```
λ_t = clamp(λ_t_old + Δλ_t, -μ·λ_n, +μ·λ_n)
```

**bias velocity 분리(pseudo-velocity)** — Baumgarte bias를 실제 속도에 섞으면 에너지가 샌다. 그래서 보정용 *가짜 속도*를 별도 트랙으로 풀고 위치에만 반영, 진짜 속도엔 안 더하는 기법(split impulse, Bullet)을 쓴다.

#### PGS vs Jacobi, 수렴

SI 는 본질적으로 **Projected Gauss–Seidel(PGS)**: "Gauss–Seidel"(방금 갱신한 값을 다음 구속에 즉시 사용) + "Projected"(매 단계 `λ≥0` 등으로 투영). 대안인 **Jacobi**는 모든 구속을 *같은 시점 속도*로 동시에 풀고 한 번에 합산 — 병렬화엔 좋지만 수렴이 느리고 over-relaxation 없이는 발산하기 쉽다. 게임은 수렴 속도 때문에 PGS를 선호(다만 SIMD/GPU에선 블록 Jacobi/coloring 절충).

PGS는 한 번에 한 구속만 정확히 풀므로, 다른 구속이 방금 만든 위반을 다음 반복에서 다시 잡는다. 반복 `iter`(보통 4~10)를 늘리면 수렴하지만 강성(stiffness)이 *반복수에 의존* — 적게 돌리면 무거운 스택이 물렁해진다.

#### Warm starting (온시동)

전 프레임에서 수렴한 `λ` 를 이번 프레임 첫 반복의 초기값으로 재사용하고, 그 임펄스를 *먼저 한 번 적용*하고 시작한다. 같은 접촉이 유지되는 한(manifold ID 매칭) 1~2 반복으로 거의 수렴 → **안정성의 핵심**. 접촉점 ID(feature id)를 [04]의 manifold에서 안정적으로 줘야 캐시가 맞는다.

```
시작 시:  v += M⁻¹ J^T λ_prev          (전 프레임 임펄스 미리 적용)
그 다음:  Δλ 반복으로 보정
```

#### TGS (Temporal Gauss–Seidel) / soft step — 현대 주류

전통 SI는 한 큰 스텝의 *속도*만 반복해 풀고 위치는 마지막에 한 번 적분 → 큰 회전/빠른 물체에서 부정확. **TGS**는 스텝을 `N`개 **substep**으로 쪼개고, 각 substep마다 (a) 소수 반복으로 속도 풀고 (b) **위치를 즉시 갱신**(Jacobian/팔 길이 재계산) 한다. 시간(temporal) 축으로도 Gauss–Seidel을 돌리는 셈.

```
for substep in 1..N:                  # h_sub = h / N
    적분(속도 예측, h_sub)
    for it in 1..iters_per_substep:   # 보통 1~2
        구속 속도 풀이(soft, bias 포함)
    위치 적분(h_sub) + Jacobian/제약 갱신
    relax pass(restitution 없이 한 번 더)  # 잔류 에너지 정리
```

효과: 더 적은 총 반복으로 더 강성한 스택, 빠른 회전에 강함. Box2D v3는 **TGS soft**(Catto soft constraint + substepping), PhysX는 **TGS solver**가 기본. substep은 timestep을 잘게 쪼개므로 [03]/[12] 결정론에 직접 영향(아래 5절).

### 2.4 LCP / MLCP 관점

접촉 전체를 동시에 보면 **선형 상보성 문제(LCP)**다. 정규 접촉만 보면:

```
w = A λ + b
0 ≤ λ  ⟂  w ≥ 0          (상보성: λ_i · w_i = 0 각 i)
A = J M⁻¹ J^T (Delassus operator),  b = J v_free + bias
```

해석: 접촉마다 둘 중 하나 — **분리 중(`w_i>0`)이면 임펄스 0**, 또는 **임펄스 작동(`λ_i>0`)이면 정확히 닿음(`w_i=0`)**. 둘 다 0일 순 있어도 둘 다 양수일 순 없다.

마찰을 넣으면 마찰 한계가 `λ_n` 에 묶여 **boxed LCP / MLCP(Mixed LCP)**: 일부 변수는 등식(조인트), 일부는 `[lo, hi]` box(`hi=μλ_n`)로 제한. 마찰뿔까지 정확히 넣으면 더 이상 LCP가 아니라 **NCP(비선형 상보성)**.

풀이 방식:
- **Dantzig / pivoting (direct LCP)** — ODE의 큰-island용. 정확하지만 `O(n³)` 경향, 마찰뿔/큰 스택에서 비현실적.
- **반복법(PGS)** — 위 2.3의 SI가 바로 boxed LCP의 PGS 반복해. 부정확해도 빠르고 수렴 실패해도 "그럭저럭" 동작(graceful degradation).

**왜 게임은 정확한 LCP를 안 쓰는가**: (1) 실시간 예산 — 직접 LCP는 비용·최악 복잡도가 폭발, (2) 강건성 — PGS는 모순된/과제약(over-constrained) 구속에도 발산하지 않고 적당히 타협, (3) warm start와 궁합, (4) 시각적으론 몇 반복의 근사로 충분. 정확도보다 **안정성·예측 가능한 비용**이 우선.

### 2.5 Position-Based Dynamics

#### PBD — Müller (2007)

속도/임펄스를 거치지 않고 **위치를 직접 투영**해서 구속을 만족시킨다. 적분으로 예측 위치 `p` 를 만든 뒤, 각 구속 `C` 에 대해 위치 보정 `Δp` 를 풀어 곧장 `p` 를 옮기고, 속도는 사후에 `(p_new - p_old)/h` 로 역산.

```
Δp_i = -s · w_i ∇_i C,    s = C(p) / Σ_j w_j |∇_j C|²
w_i = 1/m_i (역질량),   ∇_i C = C의 위치 기울기
```

장점: 무조건 안정(폭발 안 함), cloth/입자에 단순·빠름. **약점**: *강성이 반복 횟수와 timestep에 의존* — 같은 스프링도 반복을 늘리면 더 딱딱해지고, 프레임레이트가 바뀌면 거동이 변함. 강성 매개변수(`k`)가 물리적으로 의미가 약하다.

#### XPBD (Extended PBD) — Macklin (2016)

PBD에 **compliance `α`**(역강성, 단위 m/N)를 도입해 강성을 반복수·timestep과 **독립**으로 만든다. 라그랑주 승수 `λ` 를 위치 보정에 직접 누적.

```
α̃ = α / h²                                       (시간 정규화 compliance)
Δλ = ( -C - α̃ λ ) / ( Σ_i w_i |∇_i C|² + α̃ )
Δp_i = w_i ∇_i C · Δλ
λ ← λ + Δλ                                        (스텝당 누적)
```

`α=0` 이면 무한 강성(rigid) = 기존 PBD로 환원. `α>0` 이면 정해진 물리 강성으로 수렴하며 반복을 더 돌려도 *과도하게 딱딱해지지 않는다*. XPBD의 `λ` 누적은 사실상 implicit Euler의 soft constraint와 같은 결과 → [07 변형체](07-deformable-bodies.md)의 cloth/soft body와 직접 연결.

#### 강체 PBD (rigid body PBD) — Müller et al. (2020)

XPBD를 강체에 확장: 위치+방향(사원수)을 generalized로 보고, 접촉·마찰·조인트를 모두 위치 투영으로 처리(작은 substep 다수 + 구속당 1반복). substep을 잘게 쓰면 별도 안정화 없이 강성한 스택과 정확한 마찰을 얻는다. Jolt 등 일부 모던 솔버가 이 방향의 아이디어를 차용.

### 2.6 솔버 구조 (전체 조립)

- **Island** — 구속(접촉/조인트)으로 연결된 강체들의 연결 성분. island끼리는 독립이라 병렬 풀이·독립 sleeping이 가능([13]). 한 island를 한 솔버 단위로 돌린다.
- **Manifold 연결** — [04]가 준 접촉 manifold(접촉점·법선·feature id)가 구속의 입력. id 안정성이 warm start 적중률을 결정.
- **Warm start 캐시** — 접촉/조인트별 `λ` 를 프레임 간 보존(키 = 바디쌍 + feature id). manifold가 바뀌면 무효화.
- **반복 횟수 트레이드오프** — 속도 반복(velocity iters)은 침투 응답/마찰, 위치 반복(position iters)은 침투 제거. 늘리면 안정·비용↑. TGS는 substep으로 이 예산을 시간축에 분산.
- **순서 의존성** — PGS는 구속을 *푸는 순서*에 결과가 의존(Gauss–Seidel 특성). 결정론을 위해선 순서를 고정해야 한다(5절).

전형적 솔버 한 스텝:

```
1. island 수집 + 접촉/조인트 모음
2. warm start: 캐시된 λ 적용 (속도에 미리 반영)
3. for it in 1..velocity_iters:        # PGS, 구속 순회
4.     각 구속 Δλ 풀이 + 누적 클램핑 + 속도 갱신
5. 위치 적분 (또는 substep 루프 내 갱신)
6. for it in 1..position_iters:        # 침투/드리프트 제거(Baumgarte 대안)
7.     위치 보정(pseudo-velocity / NGS)
8. λ 캐시에 저장 (다음 프레임 warm start)
```

---

## 3. 주요 기법/도구

| 기법 | 한 줄 | 강점 | 약점 |
|---|---|---|---|
| Sequential Impulse (PGS) | 한 구속씩 임펄스 풀이·즉시 적용 반복 | 단순·강건·warm start 궁합 | 강성↔반복수 의존, 순서 의존 |
| Jacobi / block Jacobi | 동시 풀이 후 합산 | 병렬·SIMD/GPU | 수렴 느림, 발산 위험 |
| TGS soft / substepping | 스텝 쪼개고 substep마다 위치 갱신 | 강성 스택·빠른 회전, 적은 반복 | substep 수 = 비용·결정론 영향 |
| Baumgarte | 침투를 속도 bias로 되먹임 | 구현 단순 | 에너지 추가, 떨림 |
| Split impulse / pseudo-velocity | 보정 속도를 진짜 속도와 분리 | 에너지 안 샘 | 약간 복잡 |
| Soft constraint (CFM/ERP) | 구속을 감쇠 스프링으로 | 안정·튜닝 가능 | 약간 물렁 |
| PBD | 위치 직접 투영 | 무조건 안정, cloth에 최적 | 강성=반복/dt 의존 |
| XPBD | compliance로 강성 독립화 | 물리적 강성, dt 독립 | 강체엔 substep 필요 |
| Warm starting | 전 프레임 λ 재사용 | 수렴 급가속·안정 | feature id 안정성 필요 |
| Friction pyramid | 마찰뿔을 box로 근사 | 빠름, LCP 호환 | 비등방(방향별 √2 편차) |
| Direct LCP (Dantzig) | 정확한 상보성 풀이 | 정확 | O(n³), 게임엔 과함 |

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 솔버 | 특징 |
|---|---|---|
| **Box2D** (Erin Catto) | SI(PGS) → v3에서 **TGS soft** | 교과서 기준. soft constraint·substepping의 발원지. warm start·split impulse 표준 구현 |
| **Bullet** | **PGS**(+ split impulse), Dantzig LCP 옵션, Featherstone | 오픈소스 3D. sequential impulse가 기본, 큰 island용 직접 LCP도 제공 |
| **PhysX** (NVIDIA) | **TGS** solver(기본), 구 PGS | 산업 표준. substep 기반 TGS, GPU rigid/cloth/입자 가속 |
| **Havok** | 고성능 SI 계열 + 결정론 옵션 | AAA 상용. 결정론 모드, 정교한 sleeping/island |
| **Jolt** (Horizon) | SI(PGS) + soft, 대규모 병렬 | 모던 오픈소스. 결정론 강조, 우수한 sleeping, 병렬 island |
| **Chaos** (UE5) | RBAN/PBD 계열 솔버 + 반복 임펄스 | 언리얼 내장. cloth(XPBD 계열), 차량, Chaos Destruction(파괴) |

요점:
- **거의 모든 게임 엔진의 코어는 SI(=PGS) 임펄스 솔버** — 정확한 LCP를 쓰는 곳은 사실상 없다.
- 현대 트렌드는 **TGS + soft constraint + substepping**(Box2D v3, PhysX). 같은 비용으로 더 강성·안정.
- **cloth/soft body**는 별 트랙으로 **PBD/XPBD**(Chaos cloth, PhysX cloth) — 강체 솔버와 분리.
- warm starting과 안정적 feature id는 **선택이 아니라 필수** — 없으면 스택이 떨린다.

UE Chaos 기준 실무 팁: solver iteration / position iteration 카운트, joint stiffness/compliance, contact offset(speculative margin) 같은 노브가 안정성을 좌우한다. 본 저장소 컨벤션대로라면 이런 임계값·반복수는 매직넘버로 박지 말고 `hkt.Physics.Solver.*` 형태의 CVar로 노출하는 것이 맞다(단, 결정론에 영향을 주는 값은 헤더 상수로 고정 — 아래 5절·[12]).

---

## 5. 함정·결정론 주의

- **순서 의존성(PGS의 본질)** — Gauss–Seidel은 구속을 푸는 *순서*에 따라 결과가 달라진다. 결정론([12])을 원하면 island 수집·구속 정렬 순서를 **완전히 고정**해야 한다(포인터 주소 정렬 금지 — 안정 키로 정렬). 멀티스레드 island 분배 순서도 재현 가능해야 한다.
- **부동소수점 비결정성** — 같은 구속이라도 누산 순서/SIMD/FMA/컴파일러에 따라 결과가 갈린다. lockstep 멀티플레이라면 fixed-point 또는 엄격한 부동소수점 규약 필요([12]).
- **Baumgarte 에너지 추가** — bias를 진짜 속도에 더하면 물체가 스스로 튀어오름. split impulse/pseudo-velocity로 분리.
- **Restitution 지터** — 작은 접근 속도에 반발을 적용하면 resting 물체가 영원히 떨린다. 속도 임계값 아래선 restitution 0.
- **마찰 비등방** — friction pyramid(box)는 축 방향과 대각 방향의 최대 마찰이 다르다(√2 편차). 정밀 시뮬은 faceted cone 또는 cone 투영.
- **PBD/XPBD 강성 함정** — 순수 PBD는 강성이 반복수·timestep에 의존 → 프레임레이트가 바뀌면 거동이 변함(결정론·이식성 모두 깨짐). XPBD compliance로 분리하거나 **고정 substep 수**를 강제.
- **TGS substep 수 = 결정론 인자** — substep/반복 카운트는 시뮬 상수다. 런타임에 흔들면 재현 불가. CVar로 노출하더라도 결정론 경로에선 고정값으로 잠근다.
- **과제약(over-constrained) / 모순 구속** — 닫힌 루프(예: 4링크 루프)나 빡빡한 스택은 PGS가 완전히 수렴 못 함 → 약간의 떨림/물렁함은 정상. 반복을 늘리거나 soft로 완화.
- **Warm start 캐시 오염** — manifold feature id가 프레임 간 안 맞으면 잘못된 λ를 적용해 튄다. [04]에서 id 안정성 보장 필수.
- **침투 깊이 폭주** — 빠른 물체가 깊게 박히면 Baumgarte가 과한 bias로 쏘아낸다 → slop·CCD([04] speculative contact)와 병행.
- **sleeping 경계 깜빡임** — island가 잠들고 깨는 임계에서 떨림. 히스테리시스(서로 다른 sleep/wake 임계) 적용.

---

## 6. 더 읽기 / 관련 노드

**의존(이 문서가 전제하는 것)**
- [02-dynamics.md](02-dynamics.md) — 질량/관성텐서, 운동량·임펄스 (effective mass의 `M⁻¹`)
- [03-time-integration.md](03-time-integration.md) — timestep `h`, symplectic 적분, 고정 timestep (substep·결정론)
- [04-collision-detection.md](04-collision-detection.md) — contact manifold·feature id·speculative contact (구속의 입력)

**이 문서를 전제하는 것**
- [06-joints-articulation.md](06-joints-articulation.md) — 조인트(같은 솔버 공유), motor/limit, Featherstone 축소 좌표
- [07-deformable-bodies.md](07-deformable-bodies.md) — cloth/soft body의 PBD/XPBD (2.5와 직결)
- [10-specialized-systems.md](10-specialized-systems.md) — ragdoll·vehicle(타이어 마찰), active ragdoll
- [12-determinism-networking.md](12-determinism-networking.md) — 순서·부동소수점 결정론(5절 전반)
- [13-performance-parallelism.md](13-performance-parallelism.md) — island·sleeping·SIMD·GPU 병렬 솔버

**형제 문서 전체**
[00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · **[05] 구속 해법** · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)

**외부 레퍼런스**
- Erin Catto — *Sequential Impulses* / *Soft Constraints* / *Solver2D* (GDC 슬라이드, Box2D)
- Müller et al. — *Position Based Dynamics* (2007), *Detailed Rigid Body Simulation with XPBD* (2020)
- Macklin et al. — *XPBD: Position-Based Simulation of Compliant Constrained Dynamics* (2016)
- Kenny Erleben — *Stable, Robust, and Versatile Multibody Dynamics Animation* (LCP/박스 마찰)
- David Baraff — *Fast Contact Force Computation* (LCP/Dantzig)
- ODE 매뉴얼 — ERP/CFM, Dantzig LCP
