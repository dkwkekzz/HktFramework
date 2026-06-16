# [05·2.4] LCP·MLCP 관점 (Linear Complementarity Problem)

> 접촉 전체를 동시에 보면 **선형 상보성 문제(LCP)** 다 — "분리 중이면 임펄스 0, 임펄스 작동하면 정확히 닿음" 이라는 *둘 중 하나* 조건. 마찰을 넣으면 boxed LCP / MLCP, 마찰뿔까지면 NCP. 그리고 **왜 게임은 정확한 LCP를 안 푸는가**.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-jacobian-formulation](02-jacobian-formulation.md) (`A = J M⁻¹ J^T`) · [01-contact-model](01-contact-model.md) (부등식·마찰)

---

## 상보성 — "둘 중 하나" 조건

[03a-pgs-convergence](03a-pgs-convergence.md)에서 풀어야 할 큰 계가 `A λ = b` 임을 보았지만, 접촉의 `λ_n ≥ 0` 클램핑 때문에 이건 단순 선형계가 아니다. 정규 접촉만 보면:

```
w = A λ + b
0 ≤ λ  ⟂  w ≥ 0          (상보성: λ_i · w_i = 0 각 i)
A = J M⁻¹ J^T (Delassus operator),  b = J v_free + bias
```

`w_i` 는 접촉 `i` 의 분리 속도(또는 잔여 위반), `λ_i` 는 그 정규 임펄스. 상보성 `λ_i · w_i = 0` 의 해석:

> 접촉마다 둘 중 하나다 — **분리 중(`w_i>0`)이면 임펄스 0(`λ_i=0`)**, 또는 **임펄스 작동(`λ_i>0`)이면 정확히 닿음(`w_i=0`)**. 둘 다 0일 순 있어도 둘 다 양수일 순 없다. (밀고 있으면 안 떨어져 있고, 떨어져 있으면 안 민다.)

이 "켜짐/꺼짐이 미리 안 정해진" 성질이 LCP를 단순 선형계보다 어렵게 만든다 — 어느 접촉이 active인지(`λ>0`)를 *푸는 도중에* 정해야 한다.

## 마찰을 넣으면 — boxed LCP / MLCP / NCP

마찰을 넣으면 마찰 한계가 `λ_n` 에 묶여 **boxed LCP / MLCP(Mixed LCP)** 가 된다: 일부 변수는 등식(조인트, `λ` 자유), 일부는 `[lo, hi]` box로 제한 — 접선 임펄스는 `hi = μλ_n`, `lo = −μλ_n` 인 box 변수.

```
조인트 행:     w_i = 0           (등식, λ_i 자유)
정규 접촉 행:   0 ≤ λ_i ⟂ w_i ≥ 0  (상보성)
마찰 행:       λ_t ∈ [−μλ_n, μλ_n] (box, 한계가 λ_n에 의존)
```

마찰 한계가 *다른 변수* `λ_n` 에 의존하므로 box 경계가 고정이 아니다 — 그래서 풀이 중 갱신한다([03-sequential-impulse](03-sequential-impulse.md)). 마찰**뿔**까지 정확히 넣으면(`√(λ_t1²+λ_t2²) ≤ μλ_n`, 2차 제약) 더 이상 LCP가 아니라 **NCP(비선형 상보성)** 다 — 그래서 실무는 피라미드(box) 근사로 LCP에 머문다([01-contact-model](01-contact-model.md)).

## 풀이 방식 — 직접 vs 반복

- **Dantzig / pivoting (direct LCP)** — ODE의 큰-island용. active set을 명시적으로 키우며 정확한 해를 찾는다. 정확하지만 `O(n³)` 경향, 마찰뿔/큰 스택에서 비현실적.
- **반복법(PGS)** — [03-sequential-impulse](03-sequential-impulse.md)의 SI가 **바로 boxed LCP의 PGS(Projected Gauss–Seidel) 반복해** 다. 매 단계의 투영(`max(λ,0)` / box 클램프)이 상보성·box 조건을 근사적으로 만족시킨다. 부정확해도 빠르고, 수렴 실패해도 "그럭저럭" 동작한다(graceful degradation).

## 왜 게임은 정확한 LCP를 안 쓰는가

1. **실시간 예산** — 직접 LCP는 비용·최악 복잡도(`O(n³)`)가 폭발. 수백 접촉이면 한 프레임 예산 초과.
2. **강건성** — PGS는 모순된/과제약(over-constrained) 구속(닫힌 루프, 빡빡한 스택)에도 발산하지 않고 적당히 타협한다. 직접 LCP는 특이/모순에 깨지기 쉽다.
3. **warm start와 궁합** — 반복법은 전 프레임 해에서 이어 풀 수 있다([03a-pgs-convergence](03a-pgs-convergence.md) §4). 직접법은 매번 처음부터.
4. **시각적 충분성** — 몇 반복의 근사로 눈에 그럴듯하면 끝. 정확도보다 **안정성·예측 가능한 비용** 이 우선.

> 요컨대 LCP는 접촉 문제의 *정확한 수학적 정체* 이지만, 게임은 그것을 **정확히 푸는 대신 PGS로 근사** 한다. LCP 관점은 "SI가 도대체 무엇을 푸는가" 를 알려주는 *이론적 좌표* 이지, 실제 코드 경로가 아니다.

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **과제약/모순 구속**: 닫힌 루프나 빡빡한 스택은 PGS도 직접 LCP도 완전 만족 못 함 → 약간의 떨림/물렁함은 정상. soft로 완화.
- **direct LCP를 게임에**: `O(n³)`·취약성 때문에 부적합. 큰 island에 한정해 ODE류에서만.
- **마찰뿔=NCP**: box 근사를 떠나 정확한 뿔을 LCP에 넣으려 하면 비선형이 되어 표준 LCP 솔버로 못 푼다.

**다음**: [05-tgs-substepping](05-tgs-substepping.md) — 같은 PGS 반복을 시간축으로 분산해 더 강성·안정하게 만드는 현대형.
