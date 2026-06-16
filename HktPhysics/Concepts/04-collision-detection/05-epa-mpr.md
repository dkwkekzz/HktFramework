# [04·2.5] EPA·MPR — 침투 깊이와 법선 뽑기 (Penetration: EPA / MPR)

> GJK 가 "겹친다"만 알려준 뒤, **얼마나·어느 방향으로** 겹쳤는지(침투 깊이·충돌 법선·접촉점)를 뽑는 단계. EPA 는 GJK 후속 표준, MPR 은 단순 대안.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [04-gjk.md](04-gjk.md)

---

[04-gjk](04-gjk.md) 의 한계: 충돌이면 원점이 Minkowski 차 *내부*에 있어 GJK 의 simplex 만으론 침투 깊이를 못 준다. 이 단계가 그 깊이와 법선을 채워, contact manifold 생성([06-contact-manifold](06-contact-manifold.md))과 솔버([05](../05-constraint-solving.md))의 입력을 완성한다.

## EPA — Expanding Polytope Algorithm (GJK 후속)

GJK 가 충돌(원점 포함)을 확인한 뒤, 침투 깊이와 법선을 뽑는다.

- GJK 가 끝낸 simplex(원점을 감싼 사면체)를 시작 polytope 로 삼아, **원점에 가장 가까운 면**을 찾고 그 면 법선 방향으로 새 support 점을 추가하며 polytope 를 *확장*한다.
- 더 멀어지지 않을 때까지 반복 → 수렴한 "원점에서 가장 가까운 표면 면"의 거리 = **침투 깊이**, 그 면의 법선 = **충돌 법선**, barycentric 으로 **접촉점**을 복원.
- 비용은 GJK 보다 크다(반복적 polytope 확장). 그래서 보통 *충돌이 확인된 쌍에만* 호출한다.

> 📐 **심화: 왜 "원점에 가장 가까운 표면 면"이 침투인가** — EPA 가 원점에서 표면을 향해 다면체를 부풀리는 과정과, GJK 의 종료 simplex 가 EPA 의 시작 polytope 가 되는 한 흐름은 [04a-gjk-epa-geometric §5](04a-gjk-epa-geometric.md#5-epa--침투를-파내는-후속-expanding-polytope-algorithm) 에서 그림으로 푼다.

## MPR — Minkowski Portal Refinement (XenoCollide)

GJK+EPA 의 대안. Minkowski 차 내부 한 점(예: 두 형상 중심 차)에서 원점으로 **"portal"(삼각형)**을 만들어, 그 portal 을 표면으로 정제(refine)하며 침투·법선을 한 번에 추출한다.

- 구현이 단순하고 견고하다(EPA 의 polytope 관리가 없음).
- 정확도/일반성은 GJK+EPA 가 우세. 간단 형상이나 견고함이 우선인 경우에 실용적.

## 한눈 비교

| 기법 | 입력 | 산출 | 장점 | 단점 |
|---|---|---|---|---|
| **EPA** | GJK 종료 simplex | 침투깊이·법선·접촉점 | 정확·일반(곡면 포함) | polytope 확장 비용, degenerate 취약 |
| **MPR** | 차집합 내부 한 점 | 침투·법선(한 번에) | 단순·견고 | 정확도/일반성 낮음 |

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **EPA 수치 안정성**: 차집합 표면에 거의 평행한 면·degenerate simplex 에서 EPA 가 발산하거나 법선이 어긋난다 → 충돌 margin, epsilon, polytope 정리(degenerate face 제거)로 방어.
- **얕은↔깊은 경계 법선 튐**: GJK 거리(얕은 분리)와 EPA(침투)를 경계에서 매끄럽게 못 이으면 법선이 불연속. speculative contact 가 이 경계를 우회하는 한 이유([07-ccd](07-ccd.md)).

**다음**: [06-contact-manifold](06-contact-manifold.md) — "겹침 + 법선 + 침투"를 솔버가 쓸 다중 접촉점으로 정리.
