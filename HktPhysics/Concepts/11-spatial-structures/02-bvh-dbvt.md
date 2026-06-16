# [11·2.2] BVH · DBVT — 경계 볼륨 계층 (Bounding Volume Hierarchy / Dynamic AABB Tree)

> 객체를 감싸는 AABB 를 트리로 묶어 비균등 분포를 다룬다. 정적은 SAH BVH, 동적 강체 broad phase 의 사실상 표준은 fat-margin DBVT.
> **상위 노드**: [11-spatial-structures.md](../11-spatial-structures.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) · [01-grid-spatial-hash](01-grid-spatial-hash.md)

---

균등 그리드는 비균등 분포에서 무너진다([01-grid-spatial-hash](01-grid-spatial-hash.md)). 해법은 공간/객체를 **트리로 재귀 분할**해 밀도에 적응하는 것. 그 중 강체 물리의 주력이 BVH 와 그 동적 변형 DBVT 다.

## BVH (Bounding Volume Hierarchy)

객체를 감싸는 bounding volume(보통 AABB)을 트리로 묶는다. 부모 노드의 볼륨은 자식 전체를 감싼다. 핵심 성질은 **객체 분할(object partitioning)** 이라는 점 — 공간을 자르는 octree/BSP 와 달리 *객체 집합*을 둘로 나누므로, **같은 객체가 두 노드에 중복되지 않는다**(잎 = 객체 하나, 깔끔한 1:1). 대신 형제 노드의 AABB 가 공간상 겹칠 수는 있다.

빌드 전략:

- **Median split** — 가장 긴 축을 골라 객체 centroid 의 중앙값에서 양분. 빠르지만 품질 보통. 빌드 O(n log n).
- **SAH (Surface Area Heuristic)** — 분할 후보의 *기대 traversal 비용*을 표면적 확률 모델로 추정해 최소가 되는 분할을 선택. 질의가 빨라지지만 빌드가 비싸다. 레이트레이싱 정적 BVH 의 사실상 표준.

```
# SAH 비용 모델 — split 후보 평가
cost(split) = C_trav
            + (SA(L)/SA(node)) * N_L * C_isect
            + (SA(R)/SA(node)) * N_R * C_isect
   SA = surface area,  N_L/N_R = 좌/우 프리미티브 수
   → 모든 후보 중 cost 최소인 분할 채택 (binned SAH 로 O(n log n) 근사)
```

> 📐 **심화**: "왜 *표면적*이 traversal 비용을 예측하는가, 왜 면적비가 곧 광선이 그 자식으로 들어갈 *확률*인가"는 직관 장벽이 높다 — 기하확률(geometric probability)로 근본부터 푼 전용 문서 → [02a-sah-surface-area-heuristic](02a-sah-surface-area-heuristic.md).

**refit vs rebuild** — 객체가 움직이면 트리를 갱신해야 한다:
- *Refit* — 트리 위상(topology)은 두고 잎→루트로 AABB 만 갱신. O(n), 매우 저렴. 하지만 큰 움직임이 쌓이면 형제 AABB 가 헐거워져(겹침 증가) 질의 품질이 점진 악화.
- *Rebuild* — 트리를 다시 짓는다. 품질 회복, 하지만 비쌈. 실무는 **주기적 rebuild + 매 프레임 refit 혼용**.

## DBVT (Dynamic AABB Tree, Bullet `btDbvt`)

동적 씬을 위한 BVH 변형. 전체 재빌드 없이 **incremental** 하게 노드를 insert/remove/update 한다. 동적 강체 broad phase 가 매 프레임 수천 객체를 갱신해야 하므로, "한 객체가 움직였을 때 트리 전체가 아니라 그 근방만 손보는" 점진성이 핵심이다.

**Fat AABB margin — 핵심 트릭.** 객체의 실제 AABB 를 약간 부풀린(fat) AABB 로 트리에 넣는다. 객체가 fat 박스 *안에서* 움직이는 동안은 트리를 전혀 건드리지 않는다 — 작은 움직임에 대한 갱신을 흡수한다. 박스를 벗어날 때만 remove → reinsert.

```
update(node, new_aabb):
    if fat_aabb(node) contains new_aabb: return    # margin 이 흡수 → no-op
    remove(node)
    fat = expand(new_aabb, margin + velocity*dt*k)  # 이동 방향 예측 확장
    insert(node, fat)
```

margin 에 속도 예측(`v·dt`)을 더해 다음 프레임 이동을 미리 흡수하는 것이 흔한 최적화다.

**점진적 재균형.** 매 갱신마다 트리를 다시 짓지 않으므로, 위상이 점점 나빠지지 않도록 국소적으로 균형을 유지해야 한다. DBVT 는 삽입 시 **표면적 증가가 최소인 자식으로 내려가는 탐욕적 선택**을 하고, 갱신 시 노드 **회전(rotation, 부모-자식-조카 재배치)** 으로 트리 깊이를 국소적으로 줄인다. 전역 SAH 빌드만큼 최적은 아니지만 매 프레임 싸게 유지된다.

> DBVT 는 **동적 강체 broad phase 의 사실상 표준**(Bullet·Box2D 동등물 `b2DynamicTree`·PhysX 옵션). fat margin 덕에 "거의 안 움직이는 다수 + 일부 빠른 객체" 시나리오에서 갱신 비용이 낮다. 약점은 **순간이동·대규모 재배치** — 대량 reinsert 로 프레임 스파이크가 난다.

## 병렬·GPU 빌드 — Morton/LBVH

대규모 동적(입자·파괴 조각)에서는 SAH 의 순차 빌드가 병목이다. 객체 중심을 **Morton 코드(Z-order curve)** 로 정렬하면 공간적으로 가까운 객체가 1D 상에서도 가까워진다. 이 정렬된 키 위에서 트리를 **병렬·선형 시간**에 빌드하는 것이 LBVH(Karras)다. 품질은 SAH 보다 낮지만 GPU 에서 매 프레임 재빌드가 가능하다.

---

**관련 함정** (전체 체크리스트는 [11-spatial-structures §5](../11-spatial-structures.md#5-함정--결정론-체크리스트)):
- **refit 품질 누적 악화**: refit 만 계속하면 AABB 가 헐거워져 질의가 느려진다 → 주기적 rebuild 병행.
- **temporal coherence 깨짐**: 순간이동·스폰 폭발·대규모 재배치는 DBVT 대량 reinsert 를 유발 → 프레임 스파이크. 대규모 재배치 시 부분 rebuild 고려.
- **병렬 빌드 순서 비결정성**: 멀티스레드 빌드의 쌍 수집·노드 배치 순서가 플랫폼마다 다르면 결과 순서가 흔들린다 → 결정론이 필요하면 순서 고정([12](../12-determinism-networking.md)·[13](../13-performance-parallelism.md)).

**다음**: [02a-sah-surface-area-heuristic](02a-sah-surface-area-heuristic.md) — "왜 표면적이 비용을 예측하나"의 심화. 또는 다른 트리가 궁금하면 [03-octree-bsp](03-octree-bsp.md).
