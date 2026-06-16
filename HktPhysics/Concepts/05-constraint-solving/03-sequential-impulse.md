# [05·2.3] Impulse 기반 솔버 — Sequential Impulse (Sequential Impulse / SI)

> 게임 물리의 사실상 표준. **한 번에 한 구속씩** 그 구속만 정확히 만족시키는 임펄스를 풀어 즉시 속도에 적용하고 순차 반복한다. 핵심 디테일은 **누적 임펄스 클램핑**, **warm starting**, **split impulse**.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-jacobian-formulation](02-jacobian-formulation.md) (`m_eff`, `J^T`) · [01-contact-model](01-contact-model.md) (bias·클램프)

---

## Sequential Impulse (SI) — Erin Catto

[02-jacobian-formulation](02-jacobian-formulation.md)에서 한 구속을 정확히 만족시키는 임펄스가 `λ = −m_eff(Jv + bias)` 임을 보았다. SI는 이걸 구속마다 **순차로** 적용하고 여러 번 반복한다. 한 접촉의 정규 임펄스 유도:

```
목표:  J v_new = -v_bias            (bias = restitution + Baumgarte)
v_new = v + M⁻¹ J^T Δλ
대입:  J(v + M⁻¹ J^T Δλ) = -v_bias
풀면:  Δλ = -(J v + v_bias) / (J M⁻¹ J^T) = -m_eff (J v + v_bias)
```

## 누적 임펄스 클램핑 (핵심)

`Δλ` 자체가 아니라 **누적값 `λ` 를 클램핑**해야 부드럽다. 한 반복에서 음의 `Δλ` 가 나오더라도, 이전까지 쌓은 양의 임펄스를 *되돌리는* 것은 허용하되 전체 누적이 음수로는 못 가게 한다.

```
λ_old = λ
λ = max(λ_old + Δλ, 0)             ← 정규: λ ≥ 0
Δλ_applied = λ - λ_old            ← 실제 적용량
v += M⁻¹ J^T Δλ_applied
```

> 왜 `Δλ`가 아니라 누적 `λ`를 클램핑하나: 접촉이 한 반복에선 분리(`Δλ<0`)처럼 보여도 다음 반복에서 다시 눌릴 수 있다. 매 반복 `Δλ≥0` 만 강제하면 한 번 들어간 임펄스를 못 빼 과도하게 뻣뻣해진다. 누적 클램프는 "이번 프레임 총 임펄스" 의 부호만 지키므로 자연스럽게 분리/접촉을 오간다.

마찰은 같은 방식이되 한계가 `[-μλ_n, +μλ_n]` 양방향 클램프:

```
λ_t = clamp(λ_t_old + Δλ_t, -μ·λ_n, +μ·λ_n)
```

마찰 한계의 `λ_n` 은 *방금 그 반복까지 누적된 정규 임펄스* 를 쓴다 — 그래서 마찰은 보통 정규 임펄스를 푼 *뒤* 같은 반복에서 푼다([01-contact-model](01-contact-model.md)의 "마찰 한계가 떠돈다" 문제).

## Split impulse / pseudo-velocity (bias 분리)

Baumgarte bias를 실제 속도에 섞으면 에너지가 샌다([01-contact-model](01-contact-model.md)의 에너지 추가). 그래서 보정용 **가짜 속도(pseudo-velocity)** 를 별도 트랙으로 풀고 **위치에만 반영**, 진짜 속도엔 안 더하는 기법(**split impulse**, Bullet)을 쓴다. 진짜 속도 트랙은 restitution만, 가짜 속도 트랙은 침투 보정만 담당해 둘이 섞이지 않는다.

## Warm starting (온시동)

전 프레임에서 수렴한 `λ` 를 이번 프레임 첫 반복의 초기값으로 재사용하고, **그 임펄스를 먼저 한 번 적용하고 시작**한다. 같은 접촉이 유지되는 한(manifold ID 매칭) 1~2 반복으로 거의 수렴 → **안정성의 핵심**. 접촉점 ID(feature id)를 [04]의 manifold에서 안정적으로 줘야 캐시가 맞는다.

```
시작 시:  v += M⁻¹ J^T λ_prev          (전 프레임 임펄스 미리 적용)
그 다음:  Δλ 반복으로 보정
```

warm start가 왜 그렇게 효과적인지 — PGS의 느린 저주파 수렴을 어떻게 우회하는지 — 는 [03a-pgs-convergence](03a-pgs-convergence.md).

## SI는 곧 PGS

> 📐 **심화: 왜 순차가 동시(Jacobi)보다 빨리 수렴하고, 왜 강성이 반복수에 의존하나** — SI는 본질적으로 **Projected Gauss–Seidel**의 한 반복이다. 그 수렴 직관(방금 갱신값을 즉시 쓰는 이득, 저주파 오차의 느린 소멸, 반복수=강성)을 푼 전용 문서 → [03a-pgs-convergence.md](03a-pgs-convergence.md).

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **`Δλ` 클램핑(잘못)**: 누적 `λ` 가 아니라 증분 `Δλ` 를 클램프하면 과도하게 뻣뻣하거나 분리를 못 한다.
- **Warm start 캐시 오염**: manifold feature id가 프레임 간 안 맞으면 잘못된 λ를 적용해 튄다 → [04] id 안정성 필수.
- **부동소수점 비결정성**: 누산 순서/SIMD/FMA에 따라 임펄스가 갈린다 → lockstep이면 순서 고정·엄격 빌드([12]).
- **bias를 진짜 속도에 혼입**: 에너지 추가 → split impulse로 분리.

**다음**: [03a-pgs-convergence](03a-pgs-convergence.md) — 순차 반복이 왜·얼마나 수렴하는가. 또는 [04-lcp-mlcp](04-lcp-mlcp.md) — SI가 사실 무슨 문제의 반복해인지.
