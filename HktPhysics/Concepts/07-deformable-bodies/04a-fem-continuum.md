# [07·2.4a] FEM 연속체역학 — 변형 구배·strain·강성행렬을 근본부터 (Continuum Mechanics for FEM, from the ground up)

> "왜 `F=∂x/∂X` 한 행렬이 변형의 전부를 담는가", "왜 strain 이 `FᵀF`(회전을 빼낸 순수 변형)에서 나오는가", "강성행렬 `K` 는 무엇을 모은 것인가", "왜 선형 FEM 이 큰 회전에서 *폭발*하는가"를 **연속체역학의 직관으로 근본부터** 푼다.
> **상위 노드**: [04-fem.md](04-fem.md) · [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)(선형대수·극분해) · [05-constraint-solving.md](../05-constraint-solving.md)

---

## 0. 한 문장 요약

> **물질의 한 점이 어떻게 변형되는가는 그 점 *주변의 미세한 화살표들이 어떻게 기울고 늘어났는가*로 전부 결정된다 — 그 정보를 담은 3×3 행렬이 변형 구배 `F`다.** `F` 안에는 "회전"과 "순수한 늘어남(stretch)"이 섞여 있고, 변형률(strain)은 그중 **회전을 뺀 순수 stretch만** 골라낸 양이다. 선형 FEM 이 큰 회전에서 폭발하는 이유는 이 분리를 *근사로 대충* 해서 회전을 변형으로 착각하기 때문이고, co-rotational FEM 은 회전을 **정확히 극분해로 떼어내** 그 병을 고친다.

아래는 이 문장을 한 걸음씩 푸는 과정이다.

---

## 1. 변형 구배 `F` — "주변 화살표가 어떻게 변했나"

연속체란 물질을 점들의 연속으로 본 것이다. 변형은 **사상(map)** `X → x(X)` — rest 형상의 점 `X` 가 현재 어디(`x`)로 갔는가 — 로 표현된다.

한 점에서의 변형은 *그 점이 어디로 갔나(이동)* 가 아니라 ***주변이 어떻게 일그러졌나*** 다. rest 에서 점 `X` 옆에 작은 화살표 `dX` 를 그리면, 변형 후 그 화살표는 `dx` 가 된다. 둘을 잇는 선형 사상이 바로 변형 구배:

```
dx = F dX,        F = ∂x/∂X      (3×3 행렬)
```

> 직관: `F` 는 "rest 의 작은 화살표를 현재의 작은 화살표로 바꾸는 변환기"다. 점의 이동(translation)은 미분하면 사라지므로 `F` 에 안 들어온다 — `F` 는 **순수하게 국소 일그러짐만** 담는다. 이것이 "한 행렬이 변형의 전부"인 이유: 늘어남·전단·회전이 전부 이 3×3 안에 있다.

요소(tet)는 rest 와 현재의 모서리 벡터를 모은 행렬 `Dm`, `Ds` 로 `F` 를 상수로 만든다(요소 안에서 변형이 일정하다고 가정 — 1차 요소):

```
F = Ds Dm^{-1}      (Dm^{-1} = rest 모서리, 미리 역행렬 계산)
```

`Dm` 이 rest 의 세 모서리, `Ds` 가 현재의 세 모서리다. "현재 화살표 = F × rest 화살표" 를 세 모서리에 한꺼번에 쓴 것이 `Ds = F Dm`, 풀면 위 식.

---

## 2. `F` 안엔 회전이 섞여 있다 — 그래서 strain 이 `FᵀF` 에서 나온다

여기가 FEM 직관의 핵심이다. **회전만 한 물체는 변형이 0이어야 한다**(고무를 돌리기만 하면 힘이 안 생긴다). 그런데 회전도 화살표를 바꾸므로 `F` 에 들어온다. `F = R`(순수 회전)이어도 `F ≠ I` 다. 따라서 `F` 를 그대로 "변형량"으로 쓰면 **회전을 변형으로 착각**한다.

회전을 걸러내려면? 회전 `R` 은 길이를 보존한다(`RᵀR = I`). 그래서 `F` 에서 `FᵀF` 를 만들면 회전이 **상쇄**된다:

```
F = R S  (극분해: R=회전, S=대칭 stretch) 라 하면
FᵀF = (RS)ᵀ(RS) = Sᵀ RᵀR S = Sᵀ S = S²     ← R 이 사라졌다!
```

`FᵀF` 는 회전과 무관하게 **순수한 늘어남(stretch) `S` 의 제곱**만 남긴다. 그래서 변형률을 여기서 정의한다:

```
Green strain : E = (1/2)(FᵀF − I)      # F=R(순수 회전)이면 FᵀF=I ⟹ E=0 ✔ (회전엔 strain 0)
```

> 직관: `FᵀF − I` 는 "rest 에서 내적이 보존됐는가"를 잰다. 회전만 했으면 모든 화살표 길이·각이 그대로라 `FᵀF=I`, strain 0. 늘리거나 전단했을 때만 0이 아니다. **strain = F 에서 회전을 도려낸 순수 일그러짐.**

응력(stress)은 strain 에 물성(탄성 텐서 `ℂ`, 영률 E·푸아송비 ν 로 결정)을 곱한 것 — "이만큼 일그러지면 이만큼 되민다":

```
σ = ℂ : ε     (Hooke 의 연속체 판)
```

푸아송비 ν 가 "한쪽으로 늘리면 옆이 얼마나 줄어드는가"(부피 보존 경향)를 쥔다 — PBD volume constraint([02](02-pbd-xpbd.md))가 흉내내던 바로 그것의 물리적 원본.

---

## 3. 절점 힘과 강성행렬 `K` — 에너지를 위치로 미분한 것

요소 하나의 변형 에너지는 strain·stress 로 적분된다(`U = ∫ (1/2) ε:σ dV`). **힘은 에너지의 음의 기울기**(`f = −∂U/∂x`)라는 물리의 기본에서 절점 힘이 나온다:

```
f_node = −∂U/∂x        # 에너지를 절점 위치로 미분
```

작은 변형에서 이 관계를 선형화하면 `f = −K (x − x_rest)` 형태가 되고, 여기서 **강성행렬(stiffness matrix) `K`** 가 등장한다. `K` 의 정체:

> `K` 는 "절점을 조금 움직이면 어느 절점에 얼마의 복원력이 생기는가"의 **연결망 전체**다. `K[i][j]` = j 절점을 밀면 i 절점에 생기는 힘 계수. 요소마다 작은 `K_local`(12×12, tet 4절점×3) 을 만들고, 공유 절점에서 합쳐 **전역 sparse `K`** 로 조립(assembly)한다.

스프링 망([01](01-mass-spring.md))의 implicit Euler 가 만들던 강성 Jacobian `∂F/∂x` 와 **정확히 같은 역할**이다 — mass-spring 은 그것을 스프링 단위로, FEM 은 연속체 요소 단위로 쌓을 뿐. implicit FEM 은 이 `K` 로 큰 sparse 선형계를 매 스텝 CG 로 푼다([05-constraint-solving.md](../05-constraint-solving.md)) — FEM 이 비싼 핵심 이유.

---

## 4. 왜 선형 FEM 이 큰 회전에서 *폭발*하는가

선형(small-strain) FEM 은 §2 의 strain 을 비싼 `FᵀF` 대신 **선형 근사**로 대체한다:

```
선형 strain : ε = (1/2)(F + Fᵀ) − I
```

이 근사는 `F ≈ I`(작은 변형) 근처에서만 맞다. 문제는 **회전**이다. 90° 회전한 요소를 보자 — 변형은 0이어야 하는데:

```
R(90°) 의 선형 strain ε = (1/2)(R + Rᵀ) − I ≠ 0      # 회전인데 strain 이 0 이 아니다!
```

선형 근사는 회전을 strain 으로 **착각**한다. 그 가짜 strain 이 가짜 응력 → 가짜 힘을 만들고, 회전이 클수록 힘이 엉뚱한 방향으로 커져 **요소가 부풀거나 폭발(blow-up)** 한다. 빠르게 도는 캐릭터 팔다리의 살이 풍선처럼 부푸는 그 artifact.

**co-rotational FEM 의 처방**: §2 의 극분해를 *근사 없이 정확히* 써서 회전을 떼어낸다.

```
F = R S                                    # polar decomposition 으로 R 추출
f_elem = −R K_local (Rᵀ x − x_rest)        # x 를 R 로 "되돌려" 회전 없는 좌표에서 선형 탄성 적용 후 다시 R 로
```

`Rᵀ x` 가 현재 형상을 **회전만 제거한 좌표**로 끌어와, 거기서는 변형이 작아 선형 탄성이 정확하다. 힘을 구한 뒤 `R` 로 다시 회전시켜 돌려보낸다. 회전이 아무리 커도 strain 은 순수 stretch 만 보므로 안 폭발한다. R 추출이 사원수·극분해와 같은 도구임은 [00-foundations](../00-foundations.md) 회전 분기 참조.

> 한 줄 정리: 선형 FEM = "회전도 변형이라 착각" → 큰 회전에서 폭발. co-rotational = "회전을 정확히 도려내고 순수 stretch 에만 탄성" → 안정. 그래서 실시간 soft body FEM 의 표준이 co-rotational 이다.

---

## 5. 함정 (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트))

- **선형 FEM 큰 회전 폭발**: §4 그대로 — 회전을 strain 으로 오인. **co-rotational** 필수.
- **inverted element**: tet 이 뒤집히면 `det F < 0`, 극분해의 R 이 반사(reflection)를 물어 힘이 잘못된 방향으로 폭발 → invertible/stable FEM(SVD 기반) 또는 한계 처리.
- **polar decomposition 결정론**: R 추출(반복법/SVD)의 반복 수·sqrt 가 플랫폼 간 비트 차이 → 고정 반복·fixed-point([12](../12-determinism-networking.md)).
- **assembly 합산 순서**: 전역 `K`·힘 조립 시 절점별 합산 순서가 멀티스레드에서 갈리면 결정론 깨짐 → 고정 순서/그래프 컬러링([13](../13-performance-parallelism.md)).

---

## 6. 더 읽기

- [04-fem](04-fem.md) — FEM 개요(이 문서의 상위 절).
- [01-mass-spring](01-mass-spring.md) — implicit Euler 의 강성 Jacobian `∂F/∂x`(여기 `K` 와 같은 역할).
- [02-pbd-xpbd](02-pbd-xpbd.md) — volume constraint(푸아송비 ν 의 위치 구속 판).
- [00-foundations.md](../00-foundations.md) — 극분해·SVD·회전(R 추출의 토대).
- [05-constraint-solving.md](../05-constraint-solving.md) — sparse 선형계·CG(implicit FEM 풀이).
- Sifakis & Barbič, *FEM Simulation of 3D Deformable Solids* (SIGGRAPH course) — FEM·co-rotational 입문 정석.
- Müller et al., *Real-Time Simulation of Deformable Objects* — co-rotational 의 실시간 적용.
