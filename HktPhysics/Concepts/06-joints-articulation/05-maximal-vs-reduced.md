# [06·2.5] 최대 좌표 vs 축소 좌표 (Maximal vs reduced coordinates)

> 관절체를 푸는 두 패러다임. **최대 좌표** = 각 바디 6-DOF 자유 + 조인트를 구속으로(05 임펄스 재사용). **축소 좌표** = 허용된 관절 DOF 만 상태로, 구속은 좌표계가 보장(드리프트 0).
> **상위 노드**: [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-joint-as-jacobian](01-joint-as-jacobian.md) · [05-constraint-solving.md](../05-constraint-solving.md)

---

조인트가 사슬을 이루면(관절체, articulation) 06 은 두 갈래로 갈린다. 둘의 차이는 **"상태로 무엇을 들고 있느냐"** 한 줄로 압축된다.

- **최대 좌표(maximal)** — 각 강체를 자유 6-DOF 로 두고, 조인트를 *구속으로* 솔버에 넘긴다. [05](../05-constraint-solving.md) 의 임펄스 솔버([01-joint-as-jacobian](01-joint-as-jacobian.md))를 그대로 재사용. 구현 단순, 그러나 사슬이 길어지면 드리프트·불안정.
- **축소 좌표(reduced / generalized)** — 사슬의 *허용된* DOF 만 상태(`q, q̇`)로 들고, 구속은 좌표계 자체가 보장한다. 드리프트 0, 사슬에 강건. Featherstone/ABA 가 여기 산다.

**핵심 비교**

| 축 | 최대 좌표 (maximal) | 축소 좌표 (reduced / generalized) |
|---|---|---|
| 상태 변수 | 각 바디 풀 6-DOF (위치+회전) | 관절 DOF q, q̇ 만 (사슬당 base 6 + Σ joint DOF) |
| 조인트 | **구속으로** 솔버에 추가 | 좌표계가 **본질적으로 보장** (구속 불필요) |
| 드리프트 | 존재 (Baumgarte/soft 로 *보정*) | **없음** — 구속을 푸는 게 아니라 위반 자체가 불가능 |
| 솔버 | 05 임펄스/PGS 재사용 | Featherstone/ABA 전용 알고리즘 |
| 단가 | 조인트당 저렴, 사슬 길면 반복 多 | base+joint 단위 O(n), 한 패스로 정확 |
| 강건성 | 질량비/긴 사슬에 약함 | 긴 사슬·극단 질량비에 강함 |
| 자유도 추가/제거 | 런타임 쉽게 붙였다 뗌 | 위상(topology) 변경 비쌈 (사슬 재구성) |
| 충돌 | 자연스럽게 통합 | 충돌 임펄스를 별도로 articulation 에 투영해야 |

요약: **maximal = 일반성·단순함, reduced = 정확성·강건함**. 게임은 둘을 *혼용* 한다 — 일반 강체/접촉은 maximal 임펄스 솔버, 정확이 필요한 관절체(차량 드라이브트레인, 정밀 ragdoll, 로봇)는 reduced articulation.

**축소 좌표가 왜 드리프트가 없는가 — 직관**

maximal 은 "12개 DOF 를 자유로 두고 그중 6개를 도로 묶는" 방식이다. 반복마다 묶음이 조금씩 새고(위반), Baumgarte/soft 로 *보정* 한다 → 에너지 오차·드리프트가 남는다.

reduced 는 상태가 *관절각 `q` 그 자체* 다. ball-socket 이 "붙어 있다"는 사실은 풀어야 할 구속이 아니라 **좌표 정의에 내장**되어 있다 — 두 본을 떼어 놓는 상태가 애초에 *표현 불가능* 하므로, 떼어지는 드리프트가 0 이다. "보정할 위반이 없다"가 reduced 의 본질이다.

> 📐 **근본부터 심화**: 그럼 reduced 모델의 순방향 동역학(토크→가속도)을 *어떻게* 푸나, 왜 **O(n)** 인가, 공간 대수(spatial algebra)의 3-패스가 무엇인가 — 이 직관 장벽을 전용 문서가 푼다 → [05a-featherstone-aba.md](05a-featherstone-aba.md).

---

**관련 함정** (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)):
- **긴 사슬 = PGS 정보 전파 지연**: maximal/PGS 는 한 반복에 이웃끼리만 정보 교환 → n-링크 사슬은 정보가 끝까지 가는 데 ~n 반복 필요. 부족 시 "고무줄"처럼 늘어남(reduced/ABA 는 한 패스로 전체 전파 → 이 문제 없음).
- **reduced vs maximal 혼용**: 두 솔버의 부동소수점 경로가 달라 결정론 재현성 관리 포인트가 늘어난다.

**다음**: [05a-featherstone-aba](05a-featherstone-aba.md) — O(n) 순방향 동역학 ABA 의 근본 심화.
