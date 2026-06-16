# [05·2.1] 접촉 모델 (Contact Model)

> 접촉 구속이 솔버에게 *무엇을* 요구하는지 — 비침투, 반발(restitution), 쿨롱 마찰(마찰뿔), 그리고 이미 파고든 침투의 보정(Baumgarte·slop·soft) — 을 정의한다. 솔버가 *어떻게* 푸는가는 다음 문서들의 몫.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [04-collision-detection](../04-collision-detection.md) (manifold) · [02-dynamics](../02-dynamics.md) (임펄스)

---

접촉(contact)은 게임 물리에서 가장 흔하고 가장 까다로운 구속이다. [04]가 준 manifold(접촉점·법선 `n`·침투 깊이 `d`)를 받아, 한 접촉점에 대해 솔버가 만족시켜야 할 **세 가지 요구**를 정의한다: ① 파고들지 마라(비침투), ② 정해진 만큼 튕겨라(restitution), ③ 마찰만큼만 미끄러져라(Coulomb). 그리고 ④ 이미 박힌 것은 살살 밀어내라(침투 보정).

## 비침투 (non-penetration)

법선 `n` 방향 상대속도 `v_n` 이 분리되는 방향(`≥ 0`)이도록 만든다. 침투를 막는 게 1차 목표다. 접촉은 **부등식 구속** — 바닥은 물체를 *밀어내기만* 하고 잡아당기지 못한다. 그래서 정규 임펄스는 항상

```
λ_n ≥ 0          (밀기만, 당기지 못함)
```

으로 **클램핑**된다. 분리 중인 접촉(`v_n > 0`)에는 임펄스가 0이어야 한다 — 이 "밀거나 0" 의 동시 조건이 [04-lcp-mlcp](04-lcp-mlcp.md)에서 보는 상보성(complementarity)의 본질이다.

## 반발계수 (restitution, e)

튕김. 충돌 후 분리 속도를 충돌 전 접근 속도의 `e`배로 만든다. 솔버에는 **목표 속도 bias**로 주입한다.

```
v_n_target = -e · v_n_approach          (v_n_approach < 0, 즉 접근 중일 때만)
```

`e=0` 완전 비탄성(딱 멈춤), `e=1` 완전 탄성(에너지 보존). **실무에서는 작은 접근 속도엔 restitution을 꺼서(임계값) 지터를 막는다** — 안 그러면 바닥에 가만히 놓인(resting) 물체가 미세 접근 속도에 영원히 튄다.

## 쿨롱 마찰 (Coulomb friction)

접선 임펄스 `λ_t` 는 정규 임펄스 `λ_n` 에 **묶인다**.

```
|λ_t| ≤ μ · λ_n          (μ = 마찰계수)
```

- `|λ_t| < μ λ_n` : **정지 마찰(static)** — 상대 접선속도 0 유지(붙음).
- `|λ_t| = μ λ_n` : **운동 마찰(kinetic)** — 미끄러짐, 임펄스가 한계에 포화.

3D에서 허용 마찰력 집합은 법선축을 중심으로 한 **마찰뿔(friction cone)**:

```
√(λ_t1² + λ_t2²) ≤ μ λ_n
```

이건 원뿔(2차 제약)이라 LCP에 직접 넣기 어렵다. 실무는 두 직교 접선축을 **독립 클램핑**하는 **마찰 피라미드(friction pyramid)** 근사(box friction)를 쓴다 — 빠르지만 마찰력이 방향에 따라 `~√2` 만큼 비등방(anisotropic). 더 정확히는 뿔을 다각형으로 분할(faceted cone)한다.

핵심 난점: `μ λ_n` 의 `λ_n` 이 *같은 반복 안에서 계속 갱신*되므로 마찰 한계가 떠돈다 → SI는 매 반복 직전의 누적 `λ_n` 으로 마찰 한계를 다시 잡는다([03-sequential-impulse](03-sequential-impulse.md)).

## 침투 보정 (positional drift correction)

속도만 풀면 이미 파고든 침투 `d`(>0)는 안 사라진다. 보정 기법 세 갈래:

**Baumgarte stabilization** — 침투 깊이를 속도 bias로 되먹임.

```
v_bias = (β / h) · d        (β ≈ 0.1~0.2,  보통 slop 차감 후)
J v ≥ -v_bias              → 침투를 부드럽게 밀어냄
```

문제: `v_bias` 가 *진짜 운동 에너지로* 더해져 물체가 "튀어오르는" 에너지 추가(energy gain) 부작용. β를 키우면 빠르지만 불안정. → 해법은 보정 속도를 진짜 속도와 분리하는 **split impulse / pseudo-velocity**([03-sequential-impulse](03-sequential-impulse.md)).

**Slop (허용 침투)** — `d` 에서 작은 여유 `slop`(예 0.5cm)을 빼고 보정. 미세 떨림/지터를 죽인다.

```
d_corrected = max(d - slop, 0)
```

**Soft constraint (Catto) / CFM·ERP (ODE 용어)** — 구속을 강체(딱딱)가 아니라 *감쇠 스프링*으로 모델. ODE는 두 손잡이로 노출한다:

- **ERP (Error Reduction Parameter)** — Baumgarte β 에 해당, 한 스텝에 위치 오차를 얼마나 줄일지(0~1).
- **CFM (Constraint Force Mixing)** — 대각에 `γ` 를 더해 구속을 "물렁하게". `CFM>0` 이면 약간의 위반을 허용하는 대신 수치적으로 안정.

```
(J M⁻¹ J^T + γ) λ = -(J v + bias)      ← γ 가 CFM (soft)
```

Catto의 soft constraint는 이 ERP/CFM 한 쌍을 **stiffness/damping(ω, ζ)** 으로 재매개화하여 Baumgarte의 에너지 추가 문제를 크게 줄였다 — 현대 Box2D **TGS soft**의 기반([05-tgs-substepping](05-tgs-substepping.md)).

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **Restitution 지터**: 작은 접근 속도에 반발을 적용하면 resting 물체가 영원히 떨린다 → 속도 임계값 아래선 restitution 0.
- **마찰 비등방**: friction pyramid(box)는 축/대각 방향 최대 마찰이 다르다(√2 편차) → 정밀 시뮬은 faceted cone.
- **Baumgarte 에너지 추가**: bias를 진짜 속도에 더하면 자기 튐 → split impulse/pseudo-velocity로 분리.
- **침투 깊이 폭주**: 빠른 물체가 깊게 박히면 Baumgarte가 과한 bias로 쏘아낸다 → slop·CCD([04] speculative contact) 병행.

**다음**: [02-jacobian-formulation](02-jacobian-formulation.md) — 이 세 요구를 한 줄의 수학(`J v = bias`)으로 적는 법.
