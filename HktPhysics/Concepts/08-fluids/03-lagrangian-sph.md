# [08·2.3] Lagrangian — SPH 계열 (Smoothed Particle Hydrodynamics)

> 격자를 버리고 유체를 따라다니는 입자 무리로 연속체를 표현한다. 장(field)을 커널 가중 합으로 보간 → 밀도·압력·점성 힘. EOS 의 약압축을 PCISPH/IISPH 가 정면 돌파.
> **상위 노드**: [08-fluids.md](../08-fluids.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-navier-stokes.md](01-navier-stokes.md) · [11-spatial-structures.md](../11-spatial-structures.md)

---

격자가 없다. 유체를 따라다니는 입자 무리로 연속체를 표현하며, 자유 표면(free surface)·튀는 물보라가 자연스럽다. 입자가 유체 알갱이를 따라가므로 [01a §1](01a-navier-stokes-terms.md) 의 **이류항이 공짜로 사라진다** — 대신 미분(`∇p`, `∇²u`)을 이웃 입자의 커널 합으로 근사해야 한다.

## SPH (Smoothed Particle Hydrodynamics)

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

핵심 발상: 매끈한 커널 `W` 가 입자 하나를 "주변에 부드럽게 퍼진 덩어리"로 본다. 어떤 점의 밀도는 *근처 입자들이 그 점에 얼마나 겹쳐 있는가* 의 합이고, 미분은 커널의 미분 `∇W` 로 옮겨 진다 — 그래서 격자 없이도 `∇p`·`∇²u` 를 입자만으로 계산할 수 있다.

> 📐 **커널과 밀도 추정의 직관을 근본부터**: "왜 보간이 커널 합이 되는가 · 왜 밀도·압력·점성에 *서로 다른* 커널(poly6/spiky/viscosity)을 쓰는가 · 왜 그렇게 안 하면 입자가 군집·폭발하는가 · 정규화 조건은 무엇인가"를 전용 문서에서 그림으로 푼다 → [03a-sph-kernels.md](03a-sph-kernels.md).

**EOS 의 역할.** 압력에는 [01a §3](01a-navier-stokes-terms.md) 대로 자기 방정식이 없다. SPH 는 비압축 구속(`ρ`=일정)을 **상태방정식(EOS)** 으로 근사한다 — "밀도가 목표 `ρ0` 를 넘으면 그만큼 압력을 올려 밀어낸다". 즉 격자의 포아송 projection 대신 *국소적·명시적* 으로 압력을 정한다.

**EOS-SPH(WCSPH)의 약점 — 압축성-시간스텝 트레이드오프.** 비압축을 *근사* 로만 강제한다. 단단하게(`k` 크게) 하면 음속이 올라가 CFL 상 `Δt` 가 잘게 쪼개져 매우 느려진다. 무르게 하면 유체가 출렁출렁 눌린다(스펀지 물). 이 딜레마가 다음 두 방법을 낳았다.

## PCISPH / IISPH (비압축 개선)

EOS 의 약압축을 정면 돌파한 비압축 SPH. 둘 다 "압력을 한 번에 못 맞히면 *반복* 으로 맞힌다"는 발상이다 — 격자 projection 의 입자 판.

- **PCISPH**(Predictive-Corrective Incompressible SPH, Solenthaler & Pajarola): 위치를 예측 → 밀도 오차 측정 → 압력을 *반복 보정* 해 밀도 오차가 허용치 아래로 떨어질 때까지 돌린다. 큰 `Δt` 에서도 비압축을 지킨다.
- **IISPH**(Implicit Incompressible SPH, Ihmsen 외): 비압축 압력을 **암시적 선형계**로 정식화해 relaxed Jacobi 로 푼다 — PCISPH 보다 큰 스텝에서 더 빠르고 안정적. 사실상 **SPH 판 pressure projection**.

> **선택 직관**: 시각용 물보라·소량 유체엔 WCSPH 가 단순해 충분. 비압축이 중요(부피 보존, 큰 `Δt`)하면 PCISPH/IISPH, 또는 위치 기반으로 다시 쓴 PBF([04](04-position-based-fluids.md))로 간다.

## 이웃 탐색 — 지배적 비용

SPH 의 모든 합 `Σ_j` 는 "반경 `h` 안의 이웃"에 대한 것이라, 매 스텝 이웃을 찾아야 한다. 순진하게 하면 `O(n²)`. 균일 그리드 또는 **공간 해시**(spatial hashing)로 `O(n)` 으로 떨군다. Morton/Z-order 정렬로 GPU 캐시 지역성을 살린다. 이것이 SPH 의 지배적 비용이며 자료구조는 [11-spatial-structures](../11-spatial-structures.md) 의 영역이다.

---

**관련 함정** (전체 체크리스트는 [08-fluids §5](../08-fluids.md#5-함정--결정론-체크리스트)):
- **압축성-스텝 트레이드오프**: WCSPH 강성↑ → 음속↑ → `Δt`↓. 비압축이 중요하면 PCISPH/IISPH/PBF.
- **커널 혼용**: 밀도·∇p·점성에 같은 커널을 쓰면 입자 군집/불안정 — 항마다 맞는 커널(상세 [03a](03a-sph-kernels.md)).
- **부동소수점 합산 순서(→ [12])**: 이웃 합 `Σ_j` 를 *정렬된 결정적 순서* 로 누적해야 한다. GPU atomic add 는 비결정적 순서 → 같은 입력에 다른 출력. lockstep 에 치명적.
- **시뮬레이션 상수 고정**: 커널 `h`·`ρ0`·`Δt` 는 결정론 직결 — CVar 금지, 헤더 상수로(프로젝트 `HktSimulationLimits` 원칙).
- **공간 해시 순회 순서**: 충돌 버킷 순회 순서가 비결정적이면 합산 순서가 흔들린다 — 정렬로 못 박기.

**다음**: [04-position-based-fluids](04-position-based-fluids.md) — SPH 의 밀도 비압축을 위치 구속으로 다시 쓴 PBF.
