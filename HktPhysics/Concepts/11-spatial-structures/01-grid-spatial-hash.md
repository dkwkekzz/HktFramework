# [11·2.1] 균등 그리드 · 공간 해시 (Uniform Grid / Spatial Hashing)

> 공간을 일정 크기 cell 로 자르고 객체를 cell 버킷에 등록 — 빌드·질의가 단순하고 결정론적이라 broad phase·입자계가 가장 먼저 고려하는 구조.
> **상위 노드**: [11-spatial-structures.md](../11-spatial-structures.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)

---

가장 단순한 공간 색인이다. 공간을 일정 크기 cell 로 자르고, 각 객체를 자기가 겹치는 cell 들의 버킷에 등록한다. 질의는 "관련 cell 들만" 훑어 그 안의 객체끼리만 비교한다 — O(n²) 전수 비교를 cell 단위로 잘라낸 것.

## cell 크기 — 단 하나의 손잡이

균등 그리드의 성능은 **cell 크기 하나**가 거의 다 결정한다. 경험칙:

```
cell_size ≈ 평균 객체 지름  (또는 2 × 평균 반경)
```

- **너무 작으면** → 한 객체가 많은 cell 에 걸쳐 등록 비용·중복 검출이 늘고, 인접 cell 탐색 범위도 넓어진다.
- **너무 크면** → 한 cell 에 객체가 몰려 cell 내부 비교가 다시 O(k²)로 퇴화한다. 극단적으로 cell 하나가 전체 공간이면 brute-force 와 같다.
- **객체 크기 편차가 크면** 단일 cell 크기로는 둘 다 못 맞춘다 → **계층 그리드(hierarchical grid)** 또는 BVH 류로 전환([02-bvh-dbvt](02-bvh-dbvt.md)).

cell 크기를 객체 지름에 맞추면, 한 객체와 겹칠 수 있는 다른 객체는 자기 cell + 인접 cell(3D 26개, 2D 8개) 안에만 존재한다 — 이것이 그리드 가속의 본질이다.

## 무한·희소 공간용 공간 해시 (Spatial Hashing, Teschner 2003)

조밀한 배열 그리드는 경계(bound)가 있는 월드에만 쓸 수 있고, 빈 공간에도 메모리를 먹는다. **공간 해시**는 cell 좌표를 실제 배열 좌표로 매핑하지 않고 **해시 함수로 고정 크기 해시 테이블에 사상**한다. 빈 공간에 메모리를 쓰지 않으므로 경계 없는(unbounded) 월드·희소 분포에 적합하다.

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

서로 다른 cell 이 같은 버킷으로 충돌(collision)할 수 있으므로 버킷 안에서 실제 cell 좌표를 다시 확인하거나, 거리 검사로 false positive 를 걸러낸다.

## SPH·파티클 이웃 탐색의 표준 가속

`cell_size = h`(SPH smoothing 길이)로 잡으면 한 입자의 모든 이웃은 자기 cell 과 인접 26 cell(2D는 8) 안에만 존재한다 — 커널 합산이 전제하는 이웃 탐색이 인접 27셀 순회로 끝난다. 이것이 유체([08-fluids](../08-fluids.md))·파티클([09-particles](../09-particles.md)) 이웃 탐색의 표준 가속이다.

**GPU 패턴 — sort & count.** 해시 충돌 분기를 피하려고, GPU 에서는 입자를 cell 키로 **정렬(radix sort)** 한 뒤 cell 시작 오프셋 배열을 만든다. 같은 cell 의 입자가 메모리상 연속으로 모여 coalesced 접근이 되고, 버킷 자료구조의 포인터 추적 분기가 사라진다.

> 균등 그리드/해시는 **빌드·질의가 단순하고 결정론적**이라 broad phase 와 입자계 양쪽에서 가장 먼저 고려되는 구조다. 결정적 약점은 비균등 분포 — **"teapot in a stadium"**(거대 빈 공간 + 한 곳 밀집)에서 큰 cell 은 밀집부에서 퇴화하고 작은 cell 은 빈 공간을 헛돈다. 이때가 계층 구조로 넘어갈 신호다.

---

**관련 함정** (전체 체크리스트는 [11-spatial-structures §5](../11-spatial-structures.md#5-함정--결정론-체크리스트)):
- **cell 크기 미스매치**: 객체 크기 편차가 큰데 단일 그리드를 쓰면 큰 객체가 다수 cell 에 등록되어 중복·비용 폭증("teapot in a stadium") → 계층 그리드/BVH 로 전환.
- **중복 쌍(duplicate pair)**: 한 객체가 여러 cell 에 걸치면 같은 쌍이 여러 번 보고된다 → 보고 단계에서 `(id_a < id_b)` 정규화·중복 제거.
- **해시 버킷 순회 순서의 비결정성**: 버킷 순회·병렬 빌드의 쌍 수집 순서가 흔들리면 결과 순서가 달라진다 → 안정 정렬·객체 ID tie-break 강제([12](../12-determinism-networking.md)).

**다음**: [02-bvh-dbvt](02-bvh-dbvt.md) — 비균등 분포·동적 씬을 위한 트리 구조.
