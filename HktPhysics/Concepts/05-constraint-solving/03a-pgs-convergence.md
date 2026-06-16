# [05·2.3a] PGS·Jacobi 수렴 심화 (Convergence of Projected Gauss–Seidel)

> "왜 *한 구속씩 순차로* 푸는 게 *동시에* 푸는 것보다 빨리 수렴하나", "왜 반복을 늘려도 큰 스택은 끝까지 안 굳나(강성=반복수 의존)", "warm start가 무엇을 우회하나" 를 **선형 반복법의 눈으로** 푼다.
> **상위 노드**: [03-sequential-impulse.md](03-sequential-impulse.md) · [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02a-why-jacobian](02a-why-jacobian.md) (`A = J M⁻¹ J^T`)

---

## 0. 한 문장 요약

> **구속 해법은 결국 큰 선형계 `A λ = b` (`A = J M⁻¹ J^T`)를 *반복법*으로 푸는 것**이다. Jacobi는 모든 구속을 *지난 값*으로 동시에 갱신하고, Gauss–Seidel(=SI)은 *방금 갱신한 값을 즉시* 다음 구속에 쓴다 — 후자는 정보가 한 sweep 안에서 전파되어 더 빨리 수렴한다. 하지만 둘 다 **반복적**이라 유한 반복으로는 다 못 줄이고, 특히 멀리 떨어진 구속끼리 주고받는 *저주파 오차*가 느리게 사라진다. 그게 "반복을 늘려야 스택이 굳는" 이유이고, warm start는 그 저주파 오차를 *전 프레임 해에서 물려받아* 우회한다.

---

## 1. SI = 선형계의 Gauss–Seidel 반복

여러 구속을 묶으면 [02a-why-jacobian](02a-why-jacobian.md)에서 본 대로 풀어야 할 것은

```
A λ = b ,    A = J M⁻¹ J^T (Delassus),    b = -(J v_free + bias)
```

(접촉이면 여기에 `λ ≥ 0` 클램핑이 붙어 LCP — [04-lcp-mlcp](04-lcp-mlcp.md). 지금은 수렴 직관을 위해 등식부터 본다.) `A` 의 `i`행은 "구속 `i` 가 다른 구속들의 임펄스에 어떻게 반응하나" 다. 대각 `A_ii` 는 구속 `i` 자신의 `1/m_eff`, 비대각 `A_ij` 는 구속 `i`와 `j`가 같은 물체를 공유해 생기는 *결합(coupling)*.

**Gauss–Seidel** 한 sweep — 구속을 순서대로 돌며, 자신을 뺀 나머지의 *현재 최신값*으로 자기 임펄스를 갱신:

```
for i in 구속들(고정 순서):
    λ_i ← ( b_i - Σ_{j≠i} A_ij λ_j ) / A_ii
          └ j<i 는 이번 sweep에서 방금 갱신된 값, j>i 는 지난 값 ┘
    λ_i ← max(λ_i, 0)          # Projected: 부등식 투영
```

이게 정확히 [03-sequential-impulse](03-sequential-impulse.md)의 "한 구속 `Δλ = −m_eff(Jv+bias)` 풀고 즉시 `v` 갱신" 과 같다 — `v` 를 즉시 갱신한다는 것이 곧 "다음 구속이 방금 값을 본다" 는 Gauss–Seidel의 정의다. "Projected" 는 매 단계 `λ≥0` 투영(클램핑)을 뜻한다.

---

## 2. 왜 Gauss–Seidel(순차)이 Jacobi(동시)보다 빠른가

**Jacobi** 는 한 sweep 동안 *모든* `λ_i` 를 **지난 sweep의 값으로만** 계산하고 끝에 한꺼번에 교체한다:

```
for i: λ_i^new ← ( b_i - Σ_{j≠i} A_ij λ_j^old ) / A_ii      # 전부 old 사용
모두 끝난 뒤 한 번에 λ^old ← λ^new
```

차이의 직관 — **정보 전파 속도**:

- 구속 사슬 `1—2—3—…—N` (스택처럼)에서, 구속 1을 갱신해 생긴 변화가 Jacobi에선 **한 sweep에 이웃 하나씩** 밖에 못 간다(2는 다음 sweep에야 1의 새 값을 본다). N개 사슬이 정보가 끝까지 가려면 최소 N sweep.
- Gauss–Seidel은 한 sweep 안에서 1→2→3→… 순서로 돌므로, 구속 1의 변화가 **같은 sweep 안에 사슬 끝까지** 한 방향으로 전파된다. 한 sweep의 효과가 훨씬 크다.

수렴률로도: 두 방법 다 반복행렬의 스펙트럼 반경 `ρ` 가 1보다 작아야 수렴하는데, 대칭 양정치 `A` (물리 구속이 보통 그렇다)에서 Gauss–Seidel의 `ρ` 는 Jacobi의 *제곱* 에 가깝다 — 거칠게 말해 **Jacobi 2 sweep ≈ Gauss–Seidel 1 sweep**. 그래서 게임은 PGS를 선호한다. Jacobi는 발산하기도 쉬워(over-relaxation 없이는) over-relaxation 계수나 블록 처리가 필요하다.

> **트레이드오프**: Gauss–Seidel의 "방금 값 즉시 사용" 은 **순차 의존**이라 병렬화가 어렵다(구속 `i` 가 `i−1` 을 기다림). Jacobi는 모두 독립이라 SIMD/GPU에 자연스럽다. 그래서 병렬 솔버는 **그래프 컬러링(coloring)** 으로 서로 안 닿는 구속끼리 묶어 색 안에서는 Jacobi(병렬), 색끼리는 Gauss–Seidel(순차)로 도는 절충을 쓴다([13]).

---

## 3. 왜 반복을 늘려도 끝까지 안 굳나 — 저주파 오차와 강성=반복수

PGS는 한 sweep에 **이웃 구속과의 위반은 잘 지우지만(고주파 오차)**, 스택 전체에 걸친 **느린 출렁임(저주파 오차)** 은 더디게 줄인다. 높이 `N`짜리 박스 스택을 생각하면:

- 맨 위 박스의 무게가 맨 아래까지 "전달" 되려면 정보가 사슬을 타고 내려가야 하는데, PGS 한 sweep은 그 전파를 제한적으로만 한다.
- 그래서 **반복 횟수가 부족하면 아래 접촉 임펄스가 위 무게를 다 못 받아** 스택이 *물렁* 해진다(가라앉음/스며듦). 반복(보통 4~10)을 늘리면 점점 굳지만, **강성(stiffness)이 반복수에 의존** 하게 된다 — 같은 장면도 iter 4와 iter 20에서 단단함이 다르다.

이건 PGS가 "정확한 해" 가 아니라 "유한 반복의 근사" 라서 생기는 본질적 한계다. 닫힌 루프(4링크 루프)나 과제약 스택은 애초에 완전 수렴이 안 돼 약간의 떨림/물렁함이 정상([04-lcp-mlcp](04-lcp-mlcp.md)의 "graceful degradation").

대응 세 갈래:
1. **warm start**(§4) — 저주파 오차를 새로 풀지 않고 물려받는다.
2. **substepping / TGS**([05-tgs-substepping](05-tgs-substepping.md)) — 시간을 쪼개 한 substep당 위반을 작게 만들면 적은 반복으로도 따라잡는다.
3. **multigrid / 블록 솔버** — 저주파를 거친 격자에서 따로 푼다(게임엔 드묾).

---

## 4. warm start가 우회하는 것

전 프레임의 수렴한 `λ` 는 *이미 저주파 오차가 거의 빠진* 해다. 접촉이 프레임 간 거의 안 변하면(대부분의 resting 스택), 이번 프레임의 정답도 거기서 약간 떨어져 있을 뿐 — 고주파 보정 1~2 sweep이면 된다.

> warm start = "PGS가 느리게 줄이는 저주파 성분을 *전 프레임 해에서 통째로 상속*" 하는 것. PGS의 느린 수렴(§3)을 정면 돌파하는 대신 *우회*한다. 그래서 안정적 feature id로 캐시를 맞히는 것이 솔버 안정성의 사실상 전제다([03-sequential-impulse](03-sequential-impulse.md), [07-solver-structure](07-solver-structure.md)).

---

## 5. 순서 의존성과 결정론

Gauss–Seidel의 "방금 값 즉시 사용" 은 **구속을 푸는 순서에 결과가 의존** 한다는 뜻이다(같은 장면도 순서 바꾸면 다른 임펄스). 시각적으로는 무해하지만 **결정론([12])에는 치명적** — lockstep이면:

- island 수집·구속 정렬 순서를 **완전히 고정**(포인터 주소로 정렬 금지 — 바디쌍+feature id 같은 *안정 키* 로 정렬).
- 멀티스레드 island 분배·컬러링 순서도 재현 가능해야.
- 누산 순서/SIMD/FMA 차이까지 통제해야 비트 동일([12]).

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **순서 의존(PGS 본질)**: 결정론 원하면 구속 순서를 안정 키로 완전 고정.
- **Jacobi 발산**: over-relaxation/블록 처리 없이 순수 Jacobi는 결합이 강하면 발산.
- **반복 부족=물렁**: 무거운 스택은 iter↑ 또는 substep으로. 강성이 iter에 묶이지 않게 하려면 TGS soft/XPBD.

**다음**: [04-lcp-mlcp](04-lcp-mlcp.md) — 이 반복이 사실 푸는 상보성 문제. 또는 [05-tgs-substepping](05-tgs-substepping.md) — 반복 예산을 시간축으로 분산하는 현대형.
