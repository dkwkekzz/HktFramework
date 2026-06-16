# [05] 구속 해법 (Constraint Solving) — 허브

> 충돌·조인트가 만든 **구속(constraint)** 을 임펄스/위치 보정으로 풀어, 물체가 서로 파고들지 않고 붙잡혀 있게 만드는 시뮬레이션의 심장 — 한 프레임에서 가장 무겁고, 가장 안정성·결정론에 민감한 단계.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [05-constraint-solving/](05-constraint-solving/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
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

## 2. 하위 문서 인덱스 (세부 이론)

구속 해법은 직관 단위로 분할되어 있다. 권장 순서는 위에서 아래 — 접촉이 *무엇을* 요구하는지(2.1) → 그 요구를 *수학으로* 적는 법(2.2) → 그 식을 *반복으로 푸는* 게임 주류(2.3) → 그 반복이 사실 *무슨 문제*를 푸는지(2.4) → 더 강성·안정한 *현대형*(2.5) → 임펄스를 건너뛴 *위치 직접*(2.6) → 전체 *조립*(2.7).

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [05-constraint-solving/01-contact-model.md](05-constraint-solving/01-contact-model.md) | 접촉 모델 | 비침투·restitution·Coulomb 마찰뿔·Baumgarte·slop·CFM/ERP |
| 2.2 | [05-constraint-solving/02-jacobian-formulation.md](05-constraint-solving/02-jacobian-formulation.md) | 자코비안과 구속 정식화 | `C(x)`·`Jv`·`J^Tλ`·effective mass·등식/부등식 |
| 2.2a | [05-constraint-solving/02a-why-jacobian.md](05-constraint-solving/02a-why-jacobian.md) | 자코비안 심화 — 왜 J로 임펄스를 푸는가 | 가상일·법선의 일반화·`J^T`·effective mass의 정체 |
| 2.3 | [05-constraint-solving/03-sequential-impulse.md](05-constraint-solving/03-sequential-impulse.md) | impulse 기반 (SI) | sequential impulse·누적 클램핑·warm start·split impulse |
| 2.3a | [05-constraint-solving/03a-pgs-convergence.md](05-constraint-solving/03a-pgs-convergence.md) | PGS·Jacobi 수렴 심화 | Gauss–Seidel vs Jacobi·왜 순차가 빨리 수렴·강성↔반복수 |
| 2.4 | [05-constraint-solving/04-lcp-mlcp.md](05-constraint-solving/04-lcp-mlcp.md) | LCP·MLCP 관점 | 상보성·Delassus·boxed LCP·Dantzig·왜 게임은 안 쓰나 |
| 2.5 | [05-constraint-solving/05-tgs-substepping.md](05-constraint-solving/05-tgs-substepping.md) | TGS·substepping | 시간축 Gauss–Seidel·substep·soft·relax pass |
| 2.6 | [05-constraint-solving/06-position-based.md](05-constraint-solving/06-position-based.md) | position-based (PBD·XPBD) | 위치 직접 투영·compliance·강체 PBD |
| 2.7 | [05-constraint-solving/07-solver-structure.md](05-constraint-solving/07-solver-structure.md) | 솔버 구조 (전체 조립) | island·manifold 연결·warm 캐시·반복 예산·순서 |

---

## 3. 한눈 요약 — 기법 비교

구속 해법에서 선택지가 갈리는 도구들을 한 표로 모았다. 상세는 각 하위 문서.

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

**등식 vs 부등식 구속** — 솔버 동작을 가르는 가장 근본적인 분기:

| 종류 | 식 | 예 | λ 제약 |
|---|---|---|---|
| 등식(equality) | `C = 0`, `J v = 0` | 조인트, 거리 고정 | `λ ∈ (-∞, ∞)` |
| 부등식(inequality) | `C ≥ 0`, `J v ≥ 0` | 접촉 비침투, 조인트 한계 | `λ ≥ 0` (밀기만, 당기지 못함) |

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

UE Chaos 기준 실무 팁: solver iteration / position iteration 카운트, joint stiffness/compliance, contact offset(speculative margin) 같은 노브가 안정성을 좌우한다. 본 저장소 컨벤션대로라면 이런 임계값·반복수는 매직넘버로 박지 말고 `hkt.Physics.Solver.*` 형태의 CVar로 노출하는 것이 맞다(단, 결정론에 영향을 주는 값은 헤더 상수로 고정 — 아래 5절·[12]). 자세한 솔버 조립은 [05-constraint-solving/07-solver-structure.md](05-constraint-solving/07-solver-structure.md).

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **순서 의존성(PGS의 본질)** — Gauss–Seidel은 구속을 푸는 *순서*에 따라 결과가 달라진다. 결정론([12])을 원하면 island 수집·구속 정렬 순서를 **완전히 고정**(포인터 주소 정렬 금지 — 안정 키로 정렬). 멀티스레드 island 분배 순서도 재현 가능해야. ([05-constraint-solving/03a](05-constraint-solving/03a-pgs-convergence.md), [07](05-constraint-solving/07-solver-structure.md))
- **부동소수점 비결정성** — 같은 구속이라도 누산 순서/SIMD/FMA/컴파일러에 따라 결과가 갈린다. lockstep 멀티플레이라면 fixed-point 또는 엄격한 부동소수점 규약 필요([12]). ([05-constraint-solving/03](05-constraint-solving/03-sequential-impulse.md))
- **Baumgarte 에너지 추가** — bias를 진짜 속도에 더하면 물체가 스스로 튀어오름 → split impulse/pseudo-velocity로 분리. ([05-constraint-solving/01](05-constraint-solving/01-contact-model.md), [03](05-constraint-solving/03-sequential-impulse.md))
- **Restitution 지터** — 작은 접근 속도에 반발을 적용하면 resting 물체가 영원히 떨린다 → 속도 임계값 아래선 restitution 0. ([05-constraint-solving/01](05-constraint-solving/01-contact-model.md))
- **마찰 비등방** — friction pyramid(box)는 축 방향과 대각 방향의 최대 마찰이 다르다(√2 편차). 정밀 시뮬은 faceted cone 또는 cone 투영. ([05-constraint-solving/01](05-constraint-solving/01-contact-model.md))
- **PBD/XPBD 강성 함정** — 순수 PBD는 강성이 반복수·timestep에 의존 → 프레임레이트가 바뀌면 거동이 변함(결정론·이식성 모두 깨짐). XPBD compliance로 분리하거나 **고정 substep 수**를 강제. ([05-constraint-solving/06](05-constraint-solving/06-position-based.md))
- **TGS substep 수 = 결정론 인자** — substep/반복 카운트는 시뮬 상수다. 런타임에 흔들면 재현 불가. CVar로 노출하더라도 결정론 경로에선 고정값으로 잠근다. ([05-constraint-solving/05](05-constraint-solving/05-tgs-substepping.md))
- **과제약(over-constrained) / 모순 구속** — 닫힌 루프(예: 4링크 루프)나 빡빡한 스택은 PGS가 완전히 수렴 못 함 → 약간의 떨림/물렁함은 정상. 반복을 늘리거나 soft로 완화. ([05-constraint-solving/03a](05-constraint-solving/03a-pgs-convergence.md), [04](05-constraint-solving/04-lcp-mlcp.md))
- **Warm start 캐시 오염** — manifold feature id가 프레임 간 안 맞으면 잘못된 λ를 적용해 튄다. [04]에서 id 안정성 보장 필수. ([05-constraint-solving/03](05-constraint-solving/03-sequential-impulse.md), [07](05-constraint-solving/07-solver-structure.md))
- **침투 깊이 폭주** — 빠른 물체가 깊게 박히면 Baumgarte가 과한 bias로 쏘아낸다 → slop·CCD([04] speculative contact)와 병행. ([05-constraint-solving/01](05-constraint-solving/01-contact-model.md))
- **sleeping 경계 깜빡임** — island가 잠들고 깨는 임계에서 떨림. 히스테리시스(서로 다른 sleep/wake 임계) 적용. ([05-constraint-solving/07](05-constraint-solving/07-solver-structure.md))

---

## 6. 더 읽기 / 관련 노드

**의존(이 문서가 전제하는 것)**
- [02-dynamics.md](02-dynamics.md) — 질량/관성텐서, 운동량·임펄스 (effective mass의 `M⁻¹`)
- [03-time-integration.md](03-time-integration.md) — timestep `h`, symplectic 적분, 고정 timestep (substep·결정론)
- [04-collision-detection.md](04-collision-detection.md) — contact manifold·feature id·speculative contact (구속의 입력)

**이 문서를 전제하는 것**
- [06-joints-articulation.md](06-joints-articulation.md) — 조인트(같은 솔버 공유), motor/limit, Featherstone 축소 좌표
- [07-deformable-bodies.md](07-deformable-bodies.md) — cloth/soft body의 PBD/XPBD ([05-constraint-solving/06](05-constraint-solving/06-position-based.md)과 직결)
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
