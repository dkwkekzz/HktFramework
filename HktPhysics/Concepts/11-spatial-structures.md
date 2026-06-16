# [11] 공간·가속 구조 (Spatial & Acceleration Structures) — 허브

> "어디 근처에 무엇이 있는가"를 O(n²) 전수 비교 없이 답하기 위한 횡단 자료구조 — broad phase·이웃 탐색·raycast 의 공통 엔진.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [11-spatial-structures/](11-spatial-structures/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
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

## 2. 하위 문서 인덱스 (세부 이론)

구조를 직관 단위로 분할했다. 각 문서는 정의 → 수식/알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래(그리드 → 트리 → 정렬 → 질의).

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [11-spatial-structures/01-grid-spatial-hash.md](11-spatial-structures/01-grid-spatial-hash.md) | 균등 그리드 · 공간 해시 | cell 크기·Teschner 해시·SPH 인접 27셀·GPU sort&count |
| 2.2 | [11-spatial-structures/02-bvh-dbvt.md](11-spatial-structures/02-bvh-dbvt.md) | BVH · DBVT(동적 트리) | 객체 분할·median/SAH·refit vs rebuild·fat AABB margin·Morton LBVH |
| 2.2a | [11-spatial-structures/02a-sah-surface-area-heuristic.md](11-spatial-structures/02a-sah-surface-area-heuristic.md) | SAH 표면적 휴리스틱 심화 | 광선 교차 확률 ∝ 표면적·면적비=조건부 확률·기대 비용·binned 근사 |
| 2.3 | [11-spatial-structures/03-octree-bsp.md](11-spatial-structures/03-octree-bsp.md) | Octree · BSP · kd-tree | 공간 분할·loose octree·kd-tree k-NN·BSP 정렬 순회 |
| 2.4 | [11-spatial-structures/04-sweep-and-prune.md](11-spatial-structures/04-sweep-and-prune.md) | Sweep-and-Prune (SAP) | 끝점 정렬·1축 vs 3축·incremental·temporal coherence |
| 2.5 | [11-spatial-structures/05-queries.md](11-spatial-structures/05-queries.md) | 질의 (ray·range·k-NN·frustum) | slab·3D-DDA·반경 range·best-first k-NN·복잡도 표 |

---

## 3. 한눈 요약 — 구조 비교

### 시간복잡도

| 구조 | 빌드 | 질의(평균) | 동적 갱신 | 적합 |
|---|---|---|---|---|
| 균등 그리드 | O(n) | O(1)~O(k) | O(1)/객체 | 균등 분포·입자·동적 |
| 공간 해시 | O(n) | O(k) 인접셀 | O(1)/객체 | 무한/희소·입자(SPH) |
| BVH (SAH) | O(n log n) | O(log n) | refit O(n) | 정적·레이트레이싱 |
| DBVT | O(n log n) | O(log n) | incremental O(log n)/객체 | **동적 강체 broad phase** |
| Octree/kd-tree | O(n log n) | O(log n) | 비쌈(주로 정적) | 비균등·정적 |
| SAP (incremental) | O(n log n) 초기 | O(k) 보고 | ~O(n) (coherence) | 중규모 동적·안정 분포 |

> k = 질의 결과/셀 내 객체 수. 표의 "질의"는 점/소박스 질의 기준이며, 광선·범위 질의는 통과하는 노드/셀 수에 비례한다. (상세: [05-queries](11-spatial-structures/05-queries.md))

### 정적 vs 동적 — 선택 가이드

```
정적 지오메트리(레벨, 트라이앵글 수프)      → BVH(SAH) · kd-tree · BSP   (한 번 빌드, 질의 최적)
동적 강체 다수 broad phase                  → DBVT · incremental SAP
대량 입자(균등·반경 질의: SPH/파티클)        → 균등 그리드 · 공간 해시 (+GPU sort)
거대 빈 공간 + 국소 밀집(비균등 동적)        → loose octree · 계층 그리드
레이트레이싱(시각화·라인오브사이트)           → BVH(SAH)  (Embree)
```

### 주요 기법/도구

- **Binned SAH** — SAH 후보를 연속 평가하지 않고 축을 N개 bin 으로 나눠 근사 → 빌드 O(n log n)로 단축(Embree·PhysX 정적 BVH). (→ [02a-sah](11-spatial-structures/02a-sah-surface-area-heuristic.md))
- **Morton code / Z-order LBVH** — 객체 중심을 Morton 코드로 정렬해 BVH 를 병렬·선형 시간에 빌드(GPU 친화, Karras LBVH). 입자·동적 대규모에 유리. (→ [02-bvh-dbvt](11-spatial-structures/02-bvh-dbvt.md))
- **Fat AABB margin** — DBVT 의 핵심 트릭. margin 에 속도 예측(`v·dt`)을 더해 다음 프레임 이동을 미리 흡수. (→ [02-bvh-dbvt](11-spatial-structures/02-bvh-dbvt.md))
- **Temporal coherence** — SAP·refit 모두 프레임 간 작은 변화를 전제로 한 incremental 갱신. 순간이동·대규모 재배치엔 약함. (→ [04-sweep-and-prune](11-spatial-structures/04-sweep-and-prune.md))
- **3D-DDA (Amanatides–Woo)** — 그리드 raycast 의 표준 voxel traversal. (→ [05-queries](11-spatial-structures/05-queries.md))
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

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **traversal 순서 = 결과 순서.** broad phase 가 후보 쌍을 *어떤 순서*로 narrow phase 에 넘기느냐는 [05] 구속 해법의 contact 처리 순서를 바꾸고, 이는 PGS/sequential impulse 의 수렴 결과를 미세하게 바꾼다. 같은 입력에 같은 순서를 보장해야 결정론이 선다. ([11-spatial-structures/05-queries](11-spatial-structures/05-queries.md), → [12](12-determinism-networking.md))
- **해시/정렬의 비결정성.** 공간 해시 버킷 순회 순서, 멀티스레드 병렬 빌드의 쌍 수집 순서, `std::sort` 의 동률(tie) 처리가 플랫폼/스레드마다 다르면 결과 순서가 흔들린다. **안정 정렬(stable sort)** 과 객체 ID 기반 결정론적 tie-break 를 강제하라. ([11-spatial-structures/01-grid-spatial-hash](11-spatial-structures/01-grid-spatial-hash.md) · [11-spatial-structures/04-sweep-and-prune](11-spatial-structures/04-sweep-and-prune.md))
- **부동소수점 AABB 경계.** fat margin·끝점 비교가 float 인 경우 플랫폼 간 미세 차이가 끝점 swap 유무를 바꿔 후보 쌍 집합 자체가 달라질 수 있다. 결정론이 필요하면 [12]·[00] 의 fixed-point/엄격 부동소수점 정책을 따른다. ([11-spatial-structures/04-sweep-and-prune](11-spatial-structures/04-sweep-and-prune.md))
- **temporal coherence 깨짐.** 순간이동·스폰 폭발·대규모 재배치는 SAP swap 폭증·DBVT 대량 reinsert 를 유발 → 프레임 스파이크. 대규모 재배치 시 부분 rebuild 고려. ([11-spatial-structures/02-bvh-dbvt](11-spatial-structures/02-bvh-dbvt.md) · [11-spatial-structures/04-sweep-and-prune](11-spatial-structures/04-sweep-and-prune.md))
- **cell 크기 미스매치.** 객체 크기 편차가 큰데 단일 그리드를 쓰면 큰 객체가 다수 cell 에 등록되어 중복·비용 폭증("teapot in a stadium"). 계층 그리드/BVH 로 전환. ([11-spatial-structures/01-grid-spatial-hash](11-spatial-structures/01-grid-spatial-hash.md))
- **중복 쌍(duplicate pair).** 한 객체가 여러 cell 에 걸치면 같은 쌍이 여러 번 보고된다 — 보고 단계에서 (id_a < id_b) 정규화·중복 제거 필요. ([11-spatial-structures/01-grid-spatial-hash](11-spatial-structures/01-grid-spatial-hash.md) · [11-spatial-structures/03-octree-bsp](11-spatial-structures/03-octree-bsp.md))
- **refit 품질 누적 악화.** refit 만 계속하면 AABB 가 헐거워져 질의가 느려진다 → 주기적 rebuild 병행. ([11-spatial-structures/02-bvh-dbvt](11-spatial-structures/02-bvh-dbvt.md))

---

## 6. 더 읽기 / 관련 노드

**형제 문서 (00–13)**

- [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md)
- [04-collision-detection.md](04-collision-detection.md) — **본 구조의 1차 소비자**(broad phase) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md)
- [08-fluids.md](08-fluids.md) — **이웃 탐색**(그리드/해시) · [09-particles.md](09-particles.md) — **셀 분류·범위 질의** · [10-specialized-systems.md](10-specialized-systems.md)
- [12-determinism-networking.md](12-determinism-networking.md) — **traversal 순서·부동소수점이 결과 순서에 미치는 영향** · [13-performance-parallelism.md](13-performance-parallelism.md) — 병렬 빌드·SIMD wide node

**이 문서의 위치** — `[11]` 은 특정 솔버에 매달리지 않고 **`04·08·09` 가 공유하는 횡단(cross-cutting) 구조**다. README DAG 에서 `[11] → 04·08·09` 로 그려진 이유다.

**외부 레퍼런스**

- **Ericson, *Real-Time Collision Detection* (RTCD)** — 그리드·BVH·SAP·트리 질의의 표준 교과서.
- **Teschner et al., *Optimized Spatial Hashing for Collision Detection of Deformable Objects* (2003)** — 무한 공간 공간 해시·큰 소수 해시 함수.
- **Amanatides & Woo, *A Fast Voxel Traversal Algorithm* (3D-DDA)** — 그리드 raycast.
- **Karras, *Maximizing Parallelism in the Construction of BVHs* (LBVH/Morton)** — GPU 병렬 BVH 빌드.
- **MacDonald & Booth, *Heuristics for Ray Tracing Using Space Subdivision* (1990)** — SAH 의 원전 (→ [02a-sah](11-spatial-structures/02a-sah-surface-area-heuristic.md)).
- **Bullet `btDbvt` / Box2D `b2DynamicTree`** 소스 — fat AABB 동적 트리 실구현.
