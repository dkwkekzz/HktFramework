# [10·2.5] 파괴 / 분쇄 (Destruction / Fracture)

> 물체를 조각으로 쪼개 무너지게 하는 시스템 — 사전 분할(왜 표준인가), 연결 그래프와 island 분리, 런타임 vs 베이크, 디브리 관리. 공간을 셀로 가르는 *Voronoi 분할*은 별도 심화로.
> **상위 노드**: [10-specialized-systems.md](../10-specialized-systems.md) · **상위 지도**: [README.md](../README.md) · **의존**: [11-spatial-structures](../11-spatial-structures.md) (island) · [04-collision-detection](../04-collision-detection.md) (충돌)

---

물체를 조각으로 쪼개 무너지게 하는 시스템. 런타임에 메시를 즉석에서 자르는 건 매우 비싸므로 *사전 분할(pre-fracture)* 이 표준이다 — 조각과 결합을 미리 구워두고, 런타임엔 "어디가 끊겼나"만 판정한다.

## 사전 분할 (pre-fracture) — 왜 표준인가

메시 내부에 점을 뿌리고 공간을 셀로 나눠 미리 조각 메시를 만들어 둔다. 가장 널리 쓰는 방식이 **Voronoi 분할** — 뿌린 점마다 "그 점에 가장 가까운 영역"을 셀로 삼아 자연스러운 파편 모양을 만든다. 클러스터링으로 큰 덩어리 → 작은 조각의 계층(다단계 파괴)을 굽기도 한다.

> 📐 **Voronoi 분할 심화**: "왜 가장 가까운 점이 자연스러운 파편을 만드는가 · Voronoi 다이어그램과 셀 경계(수직 이등분면) · 점 분포가 파편 패턴을 어떻게 결정하나 · 클러스터링으로 다단계 파괴를 굽는 법"을 모은 전용 문서 → [05a-voronoi-fracture.md](05a-voronoi-fracture.md).

## 연결 그래프 / island (connectivity graph)

조각들이 어떻게 붙어 있는지를 그래프로 둔다(노드 = 조각, 엣지 = 결합 bond). 충격이 결합을 끊으면, 끊긴 뒤 *연결 성분(connected component)* 을 다시 계산해 분리된 덩어리(island, [11](../11-spatial-structures.md)·[13](../13-performance-parallelism.md) 의 island 개념과 연결)를 동적 강체로 풀어준다.

**핵심 — support 판정**: 고정점(벽·바닥 등 움직이지 않는 앵커)에 *연결된* island 은 떨어지지 않는다. 충격으로 그 연결이 끊긴 조각들만 중력에 풀려 무너진다. 그래서 "어느 조각이 아직 support 에 연결돼 있나"가 무너짐의 모양을 결정한다 — 벽 아랫부분을 부수면 윗부분이 통째로 주저앉는 식.

## 런타임 vs 베이크 파괴

- **베이크(baked)**: 모든 조각·결합을 사전 계산. 저비용·결정적이지만 변형 패턴이 고정된다.
- **런타임(runtime)**: 충격 위치에 맞춰 즉석에서 절단. 다양하지만 고비용이고 결정성·성능 위험이 크다.

게임 대부분은 **베이크 + 약간의 런타임 island 분리** — 미리 구운 조각을 충격에 따라 끊어 떨어뜨리되, 메시 절단 자체는 런타임에 하지 않는다.

## 디브리 (debris) 관리

깨진 조각 수가 폭발하므로 비용 관리가 필수다.

- 수명·거리 기반 컬링(culling).
- 작은 조각의 강체 → 파티클([09](../09-particles.md)) 강등.
- sleeping([13](../13-performance-parallelism.md)) 으로 멈춘 조각의 시뮬을 중단.

이런 관리 없이는 debris 폭발이 프레임을 잡아먹는다.

## 실무

- **UE5 Chaos Destruction** : Geometry Collection 에디터로 Voronoi 사전 분할 + 다단계 클러스터링을 베이크, 런타임에 연결 그래프 기반 island 분리로 무너뜨린다.
- **NVIDIA Blast** : 파괴 전용 미들웨어. asset-time 사전 분할(`NvBlastAuthoring`) + runtime 그래프 손상/island 분리(`NvBlast`) + debris/액터 관리(`NvBlastTk`)로 계층화. Chaos 이전 세대 AAA 파괴의 표준.

---

**관련 함정** (전체 체크리스트는 [10-specialized-systems §5](../10-specialized-systems.md#5-함정--결정론-체크리스트)):
- **island 재계산 비결정성**: 연결 그래프 순회 순서에 의존하면 클라마다 다른 잔해가 나온다 → 순회 순서 고정 또는 시각 전용 분리.
- **런타임 절단 비결정성**: 특히 멀티플레이에선 베이크 결과만 동기화하거나 효과를 시각 전용으로 분리.
- **debris 폭발**: 컬링/강등/sleeping 없이는 프레임을 잡아먹는다.

**다음**: [05a-voronoi-fracture](05a-voronoi-fracture.md) — 가장 가까운 점이 자연스러운 파편을 만드는 원리.
