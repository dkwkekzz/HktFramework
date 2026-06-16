# [05·2.6] Position-Based Dynamics (PBD · XPBD)

> 속도/임펄스를 거치지 않고 **위치를 직접 투영** 해 구속을 만족시키는 계열. **PBD**(무조건 안정, 강성=반복/dt 의존) → **XPBD**(compliance로 강성을 반복·dt와 독립화) → **강체 PBD**(작은 substep 다수). cloth/soft body의 사실상 표준이며 일부 모던 강체 솔버도 차용.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-jacobian-formulation](02-jacobian-formulation.md) (`∇C`, `w=1/m`) · [03-time-integration](../03-time-integration.md) (예측 위치)

---

## PBD — Müller (2007)

적분으로 예측 위치 `p` 를 만든 뒤, 각 구속 `C` 에 대해 위치 보정 `Δp` 를 풀어 곧장 `p` 를 옮기고, 속도는 사후에 `(p_new − p_old)/h` 로 역산한다. 임펄스/속도 단계가 없다.

```
Δp_i = -s · w_i ∇_i C,    s = C(p) / Σ_j w_j |∇_j C|²
w_i = 1/m_i (역질량),   ∇_i C = C의 위치 기울기
```

`s` 는 "이 구속을 0으로 만들려면 얼마나 옮겨야 하나" 의 스칼라 배율 — 분모가 [02-jacobian-formulation](02-jacobian-formulation.md)의 effective mass 항과 같은 꼴(`Σ w|∇C|² = J M⁻¹ J^T`)임에 주목. PBD는 사실 위치 공간에서 같은 Gauss–Seidel을 돈다.

- **장점**: 무조건 안정(explicit 적분처럼 폭발하지 않음 — 위치를 직접 제약 표면으로 투영하니까), cloth/입자에 단순·빠름.
- **약점**: **강성이 반복 횟수와 timestep에 의존** — 같은 스프링도 반복을 늘리면 더 딱딱해지고, 프레임레이트가 바뀌면 거동이 변한다. 강성 매개변수 `k` 가 물리적으로 의미가 약하다(0~1 "stiffness" 가 반복수에 묶임).

## XPBD (Extended PBD) — Macklin (2016)

PBD에 **compliance `α`**(역강성, 단위 m/N)를 도입해 강성을 반복수·timestep과 **독립** 으로 만든다. 라그랑주 승수 `λ` 를 위치 보정에 직접 누적한다.

```
α̃ = α / h²                                       (시간 정규화 compliance)
Δλ = ( -C - α̃ λ ) / ( Σ_i w_i |∇_i C|² + α̃ )
Δp_i = w_i ∇_i C · Δλ
λ ← λ + Δλ                                        (스텝당 누적)
```

- `α = 0` 이면 무한 강성(rigid) = 기존 PBD로 환원.
- `α > 0` 이면 정해진 *물리* 강성으로 수렴하며 반복을 더 돌려도 과도하게 딱딱해지지 않는다.
- `α̃` 의 분모에 더해지는 항이 [01-contact-model](01-contact-model.md)의 **CFM `γ`** 와 같은 역할 — XPBD compliance는 사실상 soft constraint를 위치 공간에서 한 것.

> XPBD의 `λ` 누적은 사실상 implicit Euler의 soft constraint와 같은 결과 → [07 변형체](../07-deformable-bodies.md)의 cloth/soft body와 직접 연결된다. 그래서 cloth는 강체 솔버가 아니라 XPBD 트랙으로 푼다.

## 강체 PBD (rigid body PBD) — Müller et al. (2020)

XPBD를 강체에 확장: 위치+방향(사원수)을 generalized 좌표로 보고, 접촉·마찰·조인트를 **모두 위치 투영** 으로 처리한다(작은 substep 다수 + 구속당 1반복). substep을 잘게 쓰면([05-tgs-substepping](05-tgs-substepping.md)과 같은 직관) 별도 안정화 없이 강성한 스택과 정확한 마찰을 얻는다. Jolt 등 일부 모던 솔버가 이 방향의 아이디어를 차용한다.

> 큰 그림: PBD/XPBD와 TGS는 *수렴*을 위해 같은 무기(substepping + soft/compliance)를 쓴다. 차이는 "속도+임펄스를 푸나(SI/TGS)" vs "위치를 직접 투영하나(PBD)" — 후자가 cloth처럼 *많은 가벼운 입자* 에 단순하고, 전자가 *무거운 강체 스택* 에 정밀하다.

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **PBD/XPBD 강성 함정**: 순수 PBD는 강성이 반복수·timestep에 의존 → 프레임레이트 바뀌면 거동 변화(결정론·이식성 깨짐). XPBD compliance로 분리하거나 **고정 substep 수** 강제.
- **속도 역산 부작용**: `v = (p_new−p_old)/h` 역산은 감쇠/에너지 손실을 숨길 수 있다 — 마찰·감쇠를 별도로 다뤄야.
- **강체 PBD substep 부족**: substep이 적으면 마찰·강성이 떨어진다 — TGS와 같은 substep 예산 필요.

**다음**: [07-solver-structure](07-solver-structure.md) — 지금까지의 조각들(접촉·SI·TGS·PBD)이 한 스텝에서 어떻게 조립되는가.
