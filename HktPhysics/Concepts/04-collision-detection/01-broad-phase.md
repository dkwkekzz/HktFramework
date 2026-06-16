# [04·2.1] Broad phase — 후보 쌍 추리기 (Broad Phase)

> n 개 객체의 brute-force O(n²) 쌍 검사를 피하고, *겹칠 수도 있는* 후보 쌍만 싸게 추린다 — false positive 는 허용, false negative 는 금지.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) · [11-spatial-structures.md](../11-spatial-structures.md)

---

충돌 감지를 두 단계로 나누는 이유가 여기 있다. 모든 쌍을 정밀 검사하면 O(n²) × (값비싼 narrow phase) 다. broad phase 는 싸게 "겹칠 *수도* 있는" 후보 쌍의 집합만 만들고, narrow phase 가 그 후보만 정밀 검사한다.

핵심 계약: **false positive(실제론 안 겹치는데 후보로 올림)는 허용, false negative(실제로 겹치는데 누락)는 금지.** 놓친 충돌은 그대로 관통(penetration)으로 표출되기 때문이다. 그래서 보통 각 객체를 약간 부풀린 AABB("fat AABB")로 감싸 안전 여유를 둔다.

> 이 문서는 **충돌에 가속 구조를 어떻게 쓰는가**에 집중한다. 구조 자체(빌드/갱신/메모리 레이아웃)는 [11-spatial-structures.md](../11-spatial-structures.md) 가 권위다.

**Sweep-and-Prune (SAP, sort-and-sweep)**

- 각 객체 AABB 의 한 축(예: x) 투영 구간 `[min, max]` 끝점을 정렬한 뒤, 한 번 훑으며(sweep) 구간이 겹치는 쌍만 후보로 올린다. 한 축에서 겹치는 쌍에 대해 나머지 축도 검사.
- 프레임 간 객체가 조금씩만 움직이면 정렬이 거의 유지된다 → **insertion sort 로 점진 갱신**하면 평균 O(n + k)(k = 실제 겹침 수). 이 "temporal coherence(시간적 일관성)" 활용이 SAP 의 핵심이다.
- 약점: 모든 객체가 한 축에 몰리면(예: 바닥에 줄지어 쌓인 박스 → x 축 투영이 다 겹침) degenerate 해져 O(n²) 로 붕괴. 다축 SAP / 그리드 혼용으로 완화.

**동적 BVH / DBVT (dynamic bounding volume tree)**

- AABB 들을 이진 트리로 묶는다. 쌍 질의(query)는 O(n log n) 수준, 광선/형상 캐스트(ray/shape cast)도 같은 트리로 처리한다.
- 동적 씬에선 fat AABB 로 잎(leaf)을 부풀려 두면 객체가 그 안에서 움직이는 동안 **트리 재삽입 없이 버틴다** → 갱신 비용 절감. 부풀린 박스를 벗어날 때만 remove + reinsert. (Bullet 의 `btDbvt`, Box2D 의 동적 트리가 이 방식.)
- 정적/혼합 씬에 강하다. 크기 편차가 큰 씬(작은 총알 + 거대한 지형)에서 그리드보다 유리.

**균등 그리드(uniform grid)**

- 공간을 고정 셀로 나눠 객체를 셀에 담고, 같은/인접 셀의 객체끼리만 검사. 셀 크기가 평균 객체 크기에 맞고 분포가 균일하면 거의 O(n + k).
- 약점: 객체 크기 편차가 크거나 공간이 희소(sparse)하면 메모리·낭비 셀 폭증. "teapot in a stadium" 문제.

**공간 해시(spatial hashing)**

- 무한/희소 공간용 그리드. 셀 좌표를 해시 → 버킷에 담아 점유된 셀만 메모리를 쓴다. 큰 오픈 월드에 적합. 해시 충돌·셀 크기 튜닝이 관건. (입자/유체 이웃 탐색에서도 동일 구조 → [08-fluids](../08-fluids.md)·[09-particles](../09-particles.md) 와 공유.)

**octree / loose octree / BSP**

- 계층 공간 분할. 정적·계층적 씬에 좋지만 동적 갱신은 BVH 보다 까다롭다. 상세는 [11](../11-spatial-structures.md).

**시간복잡도·선택 가이드**

| 구조 | 빌드/갱신 | 쌍 질의 | 강점 | 약점 |
|---|---|---|---|---|
| SAP | O(n log n) / 점진 O(n) | O(n + k) | coherence 큰 씬 | 한 축 쏠림 |
| DBVT | 점진 재삽입 | O(n log n) | 크기 편차·캐스트 | 트리 회전 비용 |
| Uniform grid | O(n) | O(n + k) | 균일·밀집 씬 | 크기 편차·희소 |
| Spatial hash | O(n) | O(n + k) | 희소·오픈월드 | 셀 튜닝·충돌 |
| Octree/BSP | 느림 | O(log n) | 정적·계층 | 동적 갱신 |

> 실전에선 단일 구조가 아니라 **하이브리드**가 흔하다. 정적 지오메트리는 BVH(빌드 1회), 동적 객체는 SAP/DBVT, 입자는 공간 해시.

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **fat AABB margin 부족**: margin 이 객체 속도 대비 부족하면 빠른 객체가 broad phase 에서 누락(false negative) → 관통.
- **degenerate broad phase**: 모든 객체가 한 평면/한 축에 정렬되면 SAP 가 O(n²) 로 붕괴. 다축/그리드 혼용으로 방어.
- **결정론**: 후보 쌍의 **생성 순서**가 부동소수점 누적 순서를 바꿔 결과를 흔든다. 쌍 리스트를 객체 id 기준 **안정 정렬**, 멀티스레드 수집은 결정론적으로 직렬화, SAP 정렬의 tie-break 도 결정론적이어야 함 (→ [12](../12-determinism-networking.md)).

**다음**: [02-bounding-volumes](02-bounding-volumes.md) — broad phase 의 잎이자 narrow phase 의 1차 reject 로 쓰는 대리 도형.
