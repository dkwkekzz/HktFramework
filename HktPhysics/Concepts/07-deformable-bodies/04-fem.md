# [07·2.4] FEM (유한요소법, 연속체) (Finite Element Method)

> *이산* 모델(mass-spring/PBD)을 넘어, **연속체역학(continuum mechanics)** 을 메시 요소 위에서 이산화한다. 물성(영률·푸아송비)을 직접 넣어 가장 정확하지만 가장 비싸다. 게임 본편보다 오프라인·GPU·실험 기능의 영역.
> **상위 노드**: [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-matrices-transforms 분기(00)](../00-foundations.md) · [03-time-integration.md](../03-time-integration.md) · [05-constraint-solving.md](../05-constraint-solving.md)

---

mass-spring([01](01-mass-spring.md))/PBD([02](02-pbd-xpbd.md))가 *이산* 모델 — "질점을 스프링·구속으로 잇는다" — 이라면, FEM 은 물질을 **연속체(continuum)** 로 보고 그 연속체역학을 메시 요소 위에서 이산화한다. 물성(영률 Young's modulus E, 푸아송비 ν)을 **직접** 넣을 수 있어 물리적으로 가장 정확하다. 보통 **tetrahedral mesh**(3D) 또는 triangle mesh(2D cloth)를 쓴다.

핵심 흐름은 **변형 → 변형률(strain) → 응력(stress) → 절점 힘** 이다. 아래는 그 골격이고, "왜 이 양들이 이렇게 정의되는가"의 근본은 심화 문서로 미룬다.

**변형 구배 (deformation gradient) F.** 변형의 모든 국소 정보를 담는 핵심량. 기준 형상(rest) `X` → 현재 형상 `x` 의 사상에 대해

```
F = ∂x / ∂X          (3×3 행렬)
```

요소(tet) 단위로는 현재 모서리 행렬 `Ds` 와 기준 모서리 행렬 `Dm` 으로

```
F = Ds * Dm^{-1}      (Dm^{-1} 은 rest 상태에서 미리 계산)
```

**변형률(strain)과 응력(stress).**

```
Green strain : E = (1/2)(Fᵀ F - I)         # 비선형(큰 변형에 정확)
선형 strain  : ε = (1/2)(F + Fᵀ) - I        # 작은 변형 가정
응력         : σ = ℂ : ε  (Hooke, ℂ=탄성 텐서; E·ν 로 결정)
```

요소 변형 에너지를 위치로 미분하면 절점 힘이 나오고, 모으면 전역 강성행렬 `K`(sparse)가 된다.

> 📐 **심화**: "왜 `F=∂x/∂X` 가 변형의 전부를 담는가 · 왜 strain 이 `FᵀF`(회전을 빼낸 순수 변형)에서 나오는가 · 강성행렬 `K` 가 무엇을 모은 것인가 · 왜 선형 FEM 이 큰 회전에서 폭발하는가"를 연속체역학의 직관으로 푼 전용 문서 → [04a-fem-continuum.md](04a-fem-continuum.md).

**선형 FEM vs co-rotational FEM.** 선형(small-strain) FEM 은 빠르지만 **큰 회전에서 망가진다** — 회전을 변형으로 오인해 요소가 부풀거나 폭발한다(artifact). **Co-rotational FEM** 은 각 요소의 회전 성분 R 을 `F = R*S` 로 극분해(polar decomposition)해 *떼어내고*, 나머지 순수 변형 `S - I` 에만 선형 탄성을 적용한다:

```
F = R S                      # polar decomposition (R=회전, S=대칭 stretch)
f_elem = -R * K_local * (Rᵀ x - x_rest)   # 회전을 보정한 절점 힘
```

회전이 큰 캐릭터 살·고무에서 안정적이라 **실시간 soft body FEM 의 사실상 표준**이다. (R 추출이 사원수 극분해와 같은 도구임은 [00-foundations](../00-foundations.md) 회전 분기 참조.)

**비용.** 전역 강성행렬 조립 + (implicit 이면) 큰 sparse 선형 시스템 풀이가 매 스텝 든다([05-constraint-solving.md](../05-constraint-solving.md) 의 CG 와 같은 도구). tet 수가 늘면 비싸지고, 결정론·캐시 친화성도 나빠 게임 본편 루프엔 부담. GPU FEM 으로 일부 완화한다. 그래서 FEM 은 영화/CAD/일부 GPU 데모·UE 의 실험 기능(Chaos Flesh) 영역이고, 천·soft 의 게임 주류는 여전히 XPBD([02](02-pbd-xpbd.md))다.

---

**관련 함정** (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트)):
- **FEM 큰 회전 artifact**: 선형 FEM 은 회전을 변형으로 오인해 폭발 → **co-rotational** 필수.
- **inverted element**: tet 이 뒤집히면(det F < 0) 힘이 잘못된 방향으로 폭발 → invertible/stable FEM 기법 또는 한계 처리.
- **결정론**: polar decomposition/sqrt/CG 반복 수가 플랫폼 간 비트 차이 → fixed-point 또는 결정론 모드([12](../12-determinism-networking.md)).

**다음**: [04a-fem-continuum](04a-fem-continuum.md) — 변형 구배·strain·강성행렬의 근본 심화. (또는 [05-shape-matching](05-shape-matching.md) 로.)
