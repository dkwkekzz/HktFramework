# [11] 공간·가속 구조 (Spatial & Acceleration Structures)

> "어디 근처에 무엇이 있는가"를 O(n²) 전수 비교 없이 답하기 위한 횡단 자료구조 — broad phase·이웃 탐색·raycast 의 공통 엔진.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [00-foundations.md](00-foundations.md) · **사용처**: [04-collision-detection.md](04-collision-detection.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md)

---

## 1. 위치와 역할

공간·가속 구조(spatial & acceleration structures)는 특정 솔버에 속하지 않고 **여러 분기를 가로지르는 횡단(cross-cutting) 자료구조**다. 같은 "가까운 것 찾기" 문제가 세 곳에서 동시에 나타난다:

- **[04] 충돌 감지의 broad phase** — n개 물체에서 겹칠 *가능성*이 있는 쌍(pair)만 추려 narrow phase(GJK/SAT)로 넘긴다. 전수 비교는 O(n²) — 수천 개만 되어도 무너진다.
- **[08] 유체(SPH/PBF)의 이웃 탐색(neighbor search)** — 입자 i 의 smoothing 반경 h 안에 든 이웃 입자들을 매 스텝 찾아야 한다. 커널 합산의 전제.
- **[09] 파티클의 충돌·force field 질의** — 대량 입자의 셀 분류, 상호작용 범위 질의.

공통 추상은 단 두 가지다: **(a) 객체 집합을 공간으로 색인(index)** 하고, **(b) 질의(query)** — "이 점/박스/광선 근처/안에 무엇이?"에 빠르게 답한다. 그래서 README 의 DAG 에서 `[11]` 은 `04·08·09` 로 동시에 가지를 뻗는 노드로 그려진다.

```
[11 공간 구조] ──┬─→ [04 충돌 감지]   (broad phase: 후보 쌍 추출)
                 ├─→ [08 유체]         (이웃 탐색: 반경 h 내 입자)
                 └─→ [09 파티클]       (셀 분류 · 범위 질의)
```

선택의 핵심 축은 두 개다 — **정적 vs 동적**(객체가 매 프레임 움직이는가)과 **균등 vs 비균등 분포**(객체 밀도가 공간상 고른가). 이 두 축이 아래 모든 구조의 적합성을 가른다.

---

## 2. 핵심 이론

### 2.1 균등 그리드 / 공간 해시 (Uniform Grid / Spatial Hashing)

공간을 일정 크기 cell 로 자르고, 각 객체를 자기가 겹치는 cell 들의 버킷에 등록한다. 질의는 "관련 cell 들만" 훑어 그 안의 객체끼리만 비교한다.

**cell 크기 선택**이 성능을 좌우한다. 경험칙:

```
cell_size ≈ 평균 객체 지름  (또는 2 × 평균 반경)
```

- 너무 작으면 → 한 객체가 많은 cell 에 걸쳐 등록 비용·중복 검출 증가.
- 너무 크면 → 한 cell 에 객체가 몰려 cell 내 비교가 다시 O(k²)로 퇴화.
- 객체 크기 편차가 크면 단일 cell 크기로는 안 됨 → **계층 그리드(hierarchical grid)** 또는 BVH 류로 전환.

**무한·희소 공간용 공간 해시(spatial hashing, Teschner 2003).** cell 좌표를 실제 배열에 매핑하지 않고 해시 함수로 고정 크기 해시 테이블에 사상한다. 빈 공간에 메모리를 쓰지 않으므로 경계 없는(unbounded) 월드·희소 분포에 적합.

```
# 정수 cell 좌표 (x,y,z) → 해시 버킷 인덱스
h(x, y, z) = ( x*p1  XOR  y*p2  XOR  z*p3 )  mod  table_size
   p1=73856093, p2=19349663, p3=83492791   # Teschner 큰 소수
   table_size 는 입자 수에 비례한 소수/2의 거듭제곱

# SPH 이웃 탐색 (반경 h) — cell_size = h 로 두면 인접 27셀만 본다
for cell in 3x3x3 neighborhood of cell_of(particle_i):
    for j in bucket[h(cell)]:
        if |x_i - x_j| < radius: collect j as neighbor
```

cell_size = h(smoothing 길이)로 잡으면 한 입자의 모든 이웃은 자기 cell 과 인접 26 cell(2D는 8) 안에만 존재한다 — 이것이 SPH([08])·파티클([09]) 이웃 탐색의 표준 가속이다. GPU 에서는 입자를 cell 키로 **정렬(radix sort)** 한 뒤 cell 시작 오프셋 배열을 만드는 "sort & count" 방식이 흔하다(해시 충돌 분기 없이 coalesced 접근).

> 균등 그리드는 **빌드/질의가 단순하고 결정론적**이라 broad phase 와 입자계 양쪽에서 가장 먼저 고려되는 구조다. 약점은 비균등 분포("teapot in a stadium" — 거대 빈 공간 + 한 곳 밀집).

### 2.2 계층 구조 (Hierarchical Structures)

비균등 분포·다양한 크기를 다루기 위해 공간/객체를 **트리**로 재귀 분할한다.

#### BVH (Bounding Volume Hierarchy)

객체를 감싸는 bounding volume(보통 AABB)을 트리로 묶는다. 부모 노드의 볼륨은 자식 전체를 감싼다. **객체 분할** 기반(공간 분할인 BSP/octree 와 대비) — 같은 객체가 두 노드에 중복되지 않는다.

빌드 전략:

- **Median split** — 가장 긴 축을 골라 중앙값(centroid 기준)에서 양분. 빠르지만 품질 보통. 빌드 O(n log n).
- **SAH (Surface Area Heuristic)** — 분할 후보의 기대 traversal 비용을 표면적 확률 모델로 추정해 최소가 되는 분할을 선택. 질의가 빨라지지만 빌드가 비쌈(레이트레이싱 정적 BVH 의 사실상 표준).

```
# SAH 비용 모델 — split 후보 평가
cost(split) = C_trav
            + (SA(L)/SA(node)) * N_L * C_isect
            + (SA(R)/SA(node)) * N_R * C_isect
   SA = surface area,  N_L/N_R = 좌/우 프리미티브 수
   → 모든 후보 중 cost 최소인 분할 채택 (binned SAH 로 O(n log n) 근사)
```

**refit vs rebuild** — 객체가 움직이면:
- *Refit* — 트리 위상(topology)은 두고 잎→루트로 AABB 만 갱신. O(n), 매우 저렴. 하지만 큰 움직임이 쌓이면 AABB 가 헐거워져 질의 품질이 점진 악화.
- *Rebuild* — 트리를 다시 짓는다. 품질 회복, 하지만 비쌈. 실무는 주기적 rebuild + 매 프레임 refit 혼용.

#### DBVT (Dynamic AABB Tree, Bullet `btDbvt`)

동적 씬을 위한 BVH 변형. 전체 재빌드 없이 **incremental** 하게 노드를 insert/remove/update 한다.

- **Fat AABB margin** — 객체의 실제 AABB 를 약간 부풀린(fat) AABB 로 트리에 넣는다. 객체가 fat 박스 *안에서* 움직이는 동안은 트리를 건드리지 않는다 — 작은 움직임에 대한 갱신을 흡수한다. 박스를 벗어날 때만 remove → reinsert.
- 갱신 시 회전(rotation)·refit 으로 균형을 점진 유지. 삽입은 표면적 증가가 최소인 자식으로 내려가는 탐욕적 선택.

```
update(node, new_aabb):
    if fat_aabb(node) contains new_aabb: return    # margin 이 흡수 → no-op
    remove(node)
    fat = expand(new_aabb, margin + velocity*dt*k)  # 이동 방향 예측 확장
    insert(node, fat)
```

> DBVT 는 **동적 강체 broad phase 의 사실상 표준**(Bullet·Box2D 동등물·PhysX 옵션). margin 덕에 "거의 안 움직이는 다수 + 일부 빠른 객체" 시나리오에서 갱신 비용이 낮다.

#### Octree / Quadtree

공간을 재귀적으로 8(3D)·4(2D) 등분. 빈 영역은 깊이 내려가지 않아 비균등 분포에 유리. 단, 객체가 셀 경계에 걸치면 여러 노드에 등록되거나 상위 노드에 머문다.

- **Loose octree** — 각 노드의 경계를 (보통 2배) 느슨하게 확장해, 객체가 자기 중심이 속한 단일 노드에 항상 들어가도록 한다 → 경계 걸침으로 인한 상위 승격·중복 등록 문제 완화. 동적 객체에 octree 를 쓸 때 사용.

#### BSP / kd-tree

- **kd-tree** — 한 번에 한 축(보통 축 번갈아 또는 SAH 로 선택)으로 공간을 분할하는 이진 트리. 점/광선 질의·k-NN 에 강하고 메모리 효율적. 빌드/삽입 비용 때문에 **주로 정적** 데이터에 쓴다.
- **BSP (Binary Space Partitioning)** — 임의 평면(축 정렬 아닐 수 있음)으로 분할. 정적 레벨 지오메트리, PVS, 정렬된 폴리곤 순회(고전 렌더링)에 사용. 동적 씬엔 부적합.

### 2.3 정렬 기반 — Sweep-and-Prune (SAP)

각 객체 AABB 의 끝점(min/max)을 축별로 **정렬된 리스트**로 관리. 한 축에서 구간이 겹치는 쌍만 다음 축으로 통과시켜 후보를 좁힌다.

```
# 1축 SAP (한 축의 [min,max] 끝점 정렬)
sort endpoints along axis
active = {}
for ep in sorted endpoints:
    if ep is 'min':
        for o in active: report_overlap_candidate(ep.owner, o)  # 다른 축도 겹치면 진짜 쌍
        active.add(ep.owner)
    else:
        active.remove(ep.owner)
```

- **1축 vs 3축** — 분포가 한 축으로 퍼지면 1축이 충분하나, 3축 모두 겹치는 쌍만 최종 보고하면 false positive 감소.
- **Incremental SAP** — 핵심 이점. 프레임 간 객체가 조금씩 움직이면 정렬 리스트는 *거의 정렬*된 상태 → **insertion sort** 가 거의 O(n)(temporal coherence). 끝점 swap 이 일어날 때만 쌍의 추가/제거를 갱신.
- 약점: 객체가 한 축에 군집하면 끝점 swap 폭증("clustering"), AABB 가 매우 다른 크기로 섞이면 효율 저하.

> **Box2D 초기·Bullet 의 `btAxisSweep3`** 가 대표. 안정적 분포·중간 규모에 좋고 incremental 갱신이 결정론 친화적(연산 순서 명확).

### 2.4 질의 (Queries)

위 구조 위에서 도는 질의 종류:

- **Raycast / shapecast traversal** — 광선(또는 swept shape)을 트리/그리드로 따라가며 교차 후보만 검사. BVH 는 노드 AABB 슬랩(slab) 테스트로 가지치기; 그리드는 **DDA(3D-DDA, Amanatides–Woo)** 로 광선이 통과하는 cell 만 순서대로 방문. 가장 가까운 hit 을 원하면 거리순 traversal 로 조기 종료.
- **Range query** — 주어진 AABB/구(sphere) 안의 객체 전부. SPH 이웃 탐색이 반경 range query 의 특수형.
- **k-NN (k-nearest neighbors)** — 가장 가까운 k개. kd-tree + 우선순위 큐(best-first), 또는 그리드에서 동심 셀 확장.
- **Frustum / overlap query** — 절두체·박스와 겹치는 객체(컬링·트리거 볼륨).

#### 시간복잡도 표

| 구조 | 빌드 | 질의(평균) | 동적 갱신 | 적합 |
|---|---|---|---|---|
| 균등 그리드 | O(n) | O(1)~O(k) | O(1)/객체 | 균등 분포·입자·동적 |
| 공간 해시 | O(n) | O(k) 인접셀 | O(1)/객체 | 무한/희소·입자(SPH) |
| BVH (SAH) | O(n log n) | O(log n) | refit O(n) | 정적·레이트레이싱 |
| DBVT | O(n log n) | O(log n) | incremental O(log n)/객체 | **동적 강체 broad phase** |
| Octree/kd-tree | O(n log n) | O(log n) | 비쌈(주로 정적) | 비균등·정적 |
| SAP (incremental) | O(n log n) 초기 | O(k) 보고 | ~O(n) (coherence) | 중규모 동적·안정 분포 |

> k = 질의 결과/셀 내 객체 수. 표의 "질의"는 점/소박스 질의 기준이며, 광선·범위 질의는 통과하는 노드/셀 수에 비례한다.

#### 정적 vs 동적 씬 — 선택 가이드

```
정적 지오메트리(레벨, 트라이앵글 수프)      → BVH(SAH) · kd-tree · BSP   (한 번 빌드, 질의 최적)
동적 강체 다수 broad phase                  → DBVT · incremental SAP
대량 입자(균등·반경 질의: SPH/파티클)        → 균등 그리드 · 공간 해시 (+GPU sort)
거대 빈 공간 + 국소 밀집(비균등 동적)        → loose octree · 계층 그리드
레이트레이싱(시각화·라인오브사이트)           → BVH(SAH)  (Embree)
```

---

## 3. 주요 기법/도구

- **Binned SAH** — SAH 후보를 연속 평가하지 않고 축을 N개 bin 으로 나눠 근사 → 빌드 O(n log n)로 단축(Embree·PhysX 정적 BVH).
- **Morton code / Z-order LBVH** — 객체 중심을 Morton 코드로 정렬해 BVH 를 병렬·선형 시간에 빌드(GPU 친화, Karras LBVH). 입자·동적 대규모에 유리.
- **Fat AABB margin** — DBVT 의 핵심 트릭. margin 에 속도 예측(`v·dt`)을 더해 다음 프레임 이동을 미리 흡수.
- **Temporal coherence** — SAP·refit 모두 프레임 간 작은 변화를 전제로 한 incremental 갱신. 순간이동·대규모 재배치엔 약함.
- **3D-DDA (Amanatides–Woo)** — 그리드 raycast 의 표준 voxel traversal.
- **Pair manager / overlap cache** — broad phase 가 만든 후보 쌍 집합을 프레임 간 유지하며 add/remove 만 narrow phase 에 통지(begin/end overlap 이벤트의 출처).

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 공간 구조 | 비고 |
|---|---|---|
| **Bullet** | `btDbvt` (동적 AABB tree), `btAxisSweep3`(SAP) | broad phase 선택 가능. `btDbvt` 가 기본·범용 |
| **Box2D** | Dynamic AABB tree (DBVT 동등) | fat AABB + 트리, 2D broad phase 표준 |
| **PhysX (NVIDIA)** | SAP + DBVT 계열(ABP/PABP), GPU broad phase | scene flag 로 broad phase 알고리즘 선택 |
| **Jolt** | Quad-tree(노드당 4자식 SIMD AABB) broad phase | 대규모 병렬·결정론 지향, wide-node 로 SIMD 친화 |
| **Chaos (UE5)** | 계층 그리드 + bounding volume, ISPC 가속 | 강체 broad phase·쿼리 |
| **Embree (Intel)** | BVH(SAH·binned), Morton LBVH | **레이** 전용 — 라인오브사이트·시각화·오클루전 |
| **SPH/파티클(공통)** | 균등 그리드 / 공간 해시 + GPU radix sort | cell_size=h, 인접 셀 이웃 탐색 |

요지: **동적 강체 broad phase 는 트리(DBVT/quad-tree) 또는 SAP**, **대량 입자 이웃 탐색은 그리드/해시**, **정적·레이는 SAH BVH(Embree)** 로 갈린다. 한 엔진이 용도별로 여러 구조를 동시에 쓴다.

---

## 5. 함정·결정론 주의

- **traversal 순서 = 결과 순서.** broad phase 가 후보 쌍을 *어떤 순서*로 narrow phase 에 넘기느냐는 [05] 구속 해법의 contact 처리 순서를 바꾸고, 이는 PGS/sequential impulse 의 수렴 결과를 미세하게 바꾼다. 같은 입력에 같은 순서를 보장해야 결정론이 선다 → [12-determinism-networking.md](12-determinism-networking.md).
- **해시/정렬의 비결정성.** 공간 해시 버킷 순회 순서, 멀티스레드 병렬 빌드의 쌍 수집 순서, `std::sort` 의 동률(tie) 처리가 플랫폼/스레드마다 다르면 결과 순서가 흔들린다. **안정 정렬(stable sort)** 과 객체 ID 기반 결정론적 tie-break 를 강제하라.
- **부동소수점 AABB 경계.** fat margin·끝점 비교가 float 인 경우 플랫폼 간 미세 차이가 끝점 swap 유무를 바꿔 후보 쌍 집합 자체가 달라질 수 있다. 결정론이 필요하면 [12]·[00] 의 fixed-point/엄격 부동소수점 정책을 따른다.
- **temporal coherence 깨짐.** 순간이동·스폰 폭발·대규모 재배치는 SAP swap 폭증·DBVT 대량 reinsert 를 유발 → 프레임 스파이크. 대규모 재배치 시 부분 rebuild 고려.
- **cell 크기 미스매치.** 객체 크기 편차가 큰데 단일 그리드를 쓰면 큰 객체가 다수 cell 에 등록되어 중복·비용 폭증("teapot in a stadium"). 계층 그리드/BVH 로 전환.
- **중복 쌍(duplicate pair).** 한 객체가 여러 cell 에 걸치면 같은 쌍이 여러 번 보고된다 — 보고 단계에서 (id_a < id_b) 정규화·중복 제거 필요.

---

## 6. 더 읽기 / 관련 노드

**형제 문서 (00–13)**

- [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md)
- [04-collision-detection.md](04-collision-detection.md) — **본 구조의 1차 소비자**(broad phase) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md)
- [08-fluids.md](08-fluids.md) — **이웃 탐색**(그리드/해시) · [09-particles.md](09-particles.md) — **셀 분류·범위 질의** · [10-specialized-systems.md](10-specialized-systems.md)
- **[11-spatial-structures.md](11-spatial-structures.md)** (이 문서) · [12-determinism-networking.md](12-determinism-networking.md) — **traversal 순서·부동소수점이 결과 순서에 미치는 영향** · [13-performance-parallelism.md](13-performance-parallelism.md) — 병렬 빌드·SIMD wide node

**이 문서의 위치** — `[11]` 은 특정 솔버에 매달리지 않고 **`04·08·09` 가 공유하는 횡단(cross-cutting) 구조**다. README DAG 에서 `[11] → 04·08·09` 로 그려진 이유다.

**외부 레퍼런스**

- **Ericson, *Real-Time Collision Detection* (RTCD)** — 그리드·BVH·SAP·트리 질의의 표준 교과서.
- **Teschner et al., *Optimized Spatial Hashing for Collision Detection of Deformable Objects* (2003)** — 무한 공간 공간 해시·큰 소수 해시 함수.
- **Amanatides & Woo, *A Fast Voxel Traversal Algorithm* (3D-DDA)** — 그리드 raycast.
- **Karras, *Maximizing Parallelism in the Construction of BVHs* (LBVH/Morton)** — GPU 병렬 BVH 빌드.
- **Bullet `btDbvt` / Box2D `b2DynamicTree`** 소스 — fat AABB 동적 트리 실구현.
