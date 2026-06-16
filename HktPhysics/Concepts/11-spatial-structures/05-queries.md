# [11·2.5] 질의 — ray · range · k-NN · frustum (Queries)

> 위 구조들 위에서 도는 질의의 종류. 같은 트리/그리드라도 "무엇을 묻는가"에 따라 순회 전략이 다르다.
> **상위 노드**: [11-spatial-structures.md](../11-spatial-structures.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-grid-spatial-hash](01-grid-spatial-hash.md) · [02-bvh-dbvt](02-bvh-dbvt.md) · [03-octree-bsp](03-octree-bsp.md)

---

공간 구조는 "객체를 색인한다"는 절반이고, 나머지 절반은 그 위에서 **질의(query)** 에 답하는 것이다. 같은 BVH 라도 광선을 던지느냐, 박스 안을 묻느냐에 따라 순회 방식이 갈린다.

## Raycast / shapecast traversal

광선(또는 swept shape)을 트리/그리드로 따라가며 **교차 후보만** 검사한다.

- **BVH/트리** — 노드 AABB **슬랩(slab) 테스트**로 광선이 그 노드를 통과하는지 본다. 통과 안 하면 그 서브트리 전체를 가지치기한다. 가장 가까운 hit 만 원하면 **거리순 traversal**(가까운 자식 먼저) + 이미 찾은 hit 보다 먼 노드는 조기 종료(early-out).
- **그리드** — 광선이 통과하는 cell 만 *순서대로* 방문하는 **3D-DDA(Amanatides–Woo)**. 광선을 cell 격자로 정수 스텝 진행시켜 통과 cell 을 하나씩 산출하므로, 가까운 cell 부터 검사해 첫 hit 에서 멈춘다.

용도: 라인오브사이트(line-of-sight), 시각화/오클루전, CCD 의 swept 검사([04-collision-detection](../04-collision-detection.md)).

## Range query

주어진 **AABB/구(sphere) 안의 객체 전부**를 모은다. 트리에서는 질의 볼륨과 겹치는 노드만 내려가고, 그리드에서는 질의 볼륨이 덮는 cell 들을 훑는다.

- **SPH 이웃 탐색이 반경 range query 의 특수형** — `cell_size = h` 그리드에서 인접 27셀만 보는 것이 반경 `h` range query 의 가속이다([01-grid-spatial-hash](01-grid-spatial-hash.md)·[08-fluids](../08-fluids.md)).

## k-NN (k-nearest neighbors)

**가장 가까운 k개**를 찾는다. "범위"가 아니라 "개수"가 기준이라 가지치기 방식이 다르다.

- **kd-tree + 우선순위 큐(best-first)** — 가까울 가능성이 큰 가지부터 내려가며 현재까지의 k번째 거리를 반경으로 삼아, 분할면까지의 거리가 그보다 멀면 반대쪽 가지를 통째로 건너뛴다([03-octree-bsp](03-octree-bsp.md) 가 k-NN 에 강한 이유).
- **그리드** — 중심 cell 에서 시작해 **동심으로 셀을 확장**하며, 이미 모은 k개의 최대 거리가 다음 셀 링까지의 거리보다 작아지면 멈춘다.

## Frustum / overlap query

**절두체(frustum)·박스와 겹치는 객체**를 찾는다 — 렌더 컬링, 트리거 볼륨, 영역 효과(AoE). 트리에서 노드 AABB 와 절두체의 겹침(보통 평면 6개 대 AABB 검사)으로 서브트리를 가지치기한다.

## 시간복잡도 — 구조 × 질의

| 구조 | 빌드 | 점/소박스 질의(평균) | 동적 갱신 | 적합 |
|---|---|---|---|---|
| 균등 그리드 | O(n) | O(1)~O(k) | O(1)/객체 | 균등 분포·입자·동적 |
| 공간 해시 | O(n) | O(k) 인접셀 | O(1)/객체 | 무한/희소·입자(SPH) |
| BVH (SAH) | O(n log n) | O(log n) | refit O(n) | 정적·레이트레이싱 |
| DBVT | O(n log n) | O(log n) | incremental O(log n)/객체 | **동적 강체 broad phase** |
| Octree/kd-tree | O(n log n) | O(log n) | 비쌈(주로 정적) | 비균등·정적 |
| SAP (incremental) | O(n log n) 초기 | O(k) 보고 | ~O(n) (coherence) | 중규모 동적·안정 분포 |

> `k` = 질의 결과/셀 내 객체 수. 표의 "질의"는 점/소박스 기준이며, **광선·범위 질의는 통과하는 노드/셀 수에 비례**한다(트리 깊이 단독으로 결정되지 않음).

## 정적 vs 동적 — 구조 선택 가이드

```
정적 지오메트리(레벨, 트라이앵글 수프)      → BVH(SAH) · kd-tree · BSP   (한 번 빌드, 질의 최적)
동적 강체 다수 broad phase                  → DBVT · incremental SAP
대량 입자(균등·반경 질의: SPH/파티클)        → 균등 그리드 · 공간 해시 (+GPU sort)
거대 빈 공간 + 국소 밀집(비균등 동적)        → loose octree · 계층 그리드
레이트레이싱(시각화·라인오브사이트)           → BVH(SAH)  (Embree)
```

---

**관련 함정** (전체 체크리스트는 [11-spatial-structures §5](../11-spatial-structures.md#5-함정--결정론-체크리스트)):
- **traversal 순서 = 결과 순서**: broad phase 가 후보 쌍을 *어떤 순서*로 넘기느냐가 [05] 구속 해법의 contact 처리 순서를, 나아가 PGS/sequential impulse 수렴을 미세하게 바꾼다 → 같은 입력에 같은 순서 보장([12](../12-determinism-networking.md)).
- **거리순 조기 종료 누락**: 가장 가까운 hit 만 필요한데 전부 순회하면 raycast 가 느려진다 → 거리순 + early-out.

**다음**: 허브로 복귀 → [11-spatial-structures.md](../11-spatial-structures.md). 1차 소비자는 [04-collision-detection](../04-collision-detection.md).
