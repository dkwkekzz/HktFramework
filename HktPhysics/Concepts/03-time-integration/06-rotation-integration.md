# [03·2.6] 회전 적분 — 사원수 적분과 정규화 (Rotation / Quaternion Integration)

> 병진은 좌표별 스칼라 적분이면 충분하지만, 자세는 사원수라 특수하다 — `q̇ = ½ω⊗q`, 매 스텝 재정규화, 자이로스코픽 항의 비선형성.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-taxonomy](02-taxonomy.md) · [00-foundations/03-rotations](../00-foundations/03-rotations.md) · [00-foundations/03a-quaternions-geometric](../00-foundations/03a-quaternions-geometric.md)

---

병진(translation)은 앞의 적분기를 좌표별로 그대로 쓰면 된다. **회전(rotation)은 특수하다** — 자세를 단위 사원수 `q`(unit quaternion)로 표현하기 때문이다(회전 표현 자체는 [00-foundations/03-rotations](../00-foundations/03-rotations.md), 기하학적 근본은 [00-foundations/03a](../00-foundations/03a-quaternions-geometric.md), 운동학 표현은 [01-kinematics.md](../01-kinematics.md)).

각속도 `ω`(월드/바디 프레임 벡터)로 자세의 시간변화율은:

```
q'(t) = ½ · ω_quat ⊗ q          (ω_quat = (0, ωx, ωy, ωz), ⊗ = quaternion 곱)
```

이를 semi-implicit 으로 적분하면(강체 표준):

```
ω_{n+1} = ω_n + α_n · dt                       ← 각가속도로 각속도 갱신 (Euler 회전식 풀이)
q_{n+1} = q_n + (½ · ω_{n+1}_quat ⊗ q_n) · dt   ← 자세 갱신
q_{n+1} = normalize(q_{n+1})                    ← 재정규화 필수!
```

병진의 semi-implicit Euler 와 같은 골격(새 ω 로 자세를 민다)이지만, 세 가지 미묘함이 따라붙는다.

**미묘함 1 — 재정규화(re-normalization)**: 위 1차 갱신은 단위 사원수를 *단위가 아닌* 사원수로 밀어낸다(수치적으로 `|q| ≠ 1` 로 드리프트 — `q` 가 S³ 표면을 살짝 벗어남, [00-foundations/03a §3](../00-foundations/03a-quaternions-geometric.md)). 매 스텝 `q ← q/|q|` 로 다시 단위화하지 않으면 자세가 서서히 찌그러진다(비균등 스케일/전단 행렬화). 재정규화는 사원수가 회전 행렬보다 싼 결정적 이유이기도 하다(행렬은 그람-슈미트 재직교화가 필요). 단 재정규화는 결정론에도 영향 — 연산 순서를 고정해야 한다([12-determinism-networking.md](../12-determinism-networking.md)).

**미묘함 2 — 각운동량 비선형성**: 강체의 회전 운동방정식 `τ = Iα + ω×(Iω)` 에는 **자이로스코픽 항 `ω×Iω`** 이 있다(상세: [02-dynamics.md](../02-dynamics.md)). 이 항은 explicit 으로 적분하면 자유 회전체(외부 토크 0)의 에너지를 키워 *불안정*해진다(특히 비대칭 관성텐서에서 격렬 — 던진 책이 흔들리는 Dzhanibekov/테니스 라켓 효과 근방에서 발산). PhysX 등은 이 항만 **암묵적으로(gyroscopic implicit)** 따로 처리한다.

**미묘함 3 — 정확 지수사상 vs 1차 근사**: `q_{n+1} = exp(½ω·dt) ⊗ q_n` 의 정확 지수사상(exponential map, [00-foundations/03a §8](../00-foundations/03a-quaternions-geometric.md))을 쓰면 재정규화 없이 단위가 보존되고 큰 각속도에서 더 정확하다. 비용은 더 크다(`exp` 는 `sin/cos` 호출). 게임은 보통 1차 근사 + 재정규화로 충분하다고 본다.

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **quaternion 재정규화 누락** — 자세가 서서히 찌그러진다. 그리고 재정규화 *연산 순서*를 고정하지 않으면 결정론 깨짐.
- **자이로스코픽 항을 explicit 으로** — 비대칭 관성텐서 자유 회전에서 에너지 발산. 그 항만 implicit 으로 분리하라.

**다음**: [07-stability-energy](07-stability-energy.md) — 폭발·드리프트·발산의 직관을 한 곳에.
