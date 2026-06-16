# [11·2.4] Sweep-and-Prune — 정렬 기반 broad phase (SAP)

> 트리 대신 AABB 끝점을 축별로 정렬해 둔다. 프레임 간 거의-정렬 상태를 insertion sort 로 갱신 — temporal coherence 의 교과서.
> **상위 노드**: [11-spatial-structures.md](../11-spatial-structures.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)

---

SAP 는 트리를 짓지 않는다. 각 객체 AABB 의 끝점(min/max)을 **축별로 정렬된 리스트**로 관리하고, 한 축에서 구간이 겹치는 쌍만 다음 단계로 통과시켜 후보를 좁힌다. "한 축에서 `[min,max]` 구간이 안 겹치면 3D 에서도 절대 안 겹친다"는 단순한 사실이 가지치기의 근거다.

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

`min` 끝점을 만나면 현재 "열려 있는"(active) 모든 구간과 겹친다 — 그 쌍들을 후보로 보고하고 자신을 active 에 넣는다. `max` 를 만나면 닫는다. 한 번의 sweep 으로 한 축의 모든 겹침 구간 쌍이 나온다.

- **1축 vs 3축** — 분포가 한 축으로 길게 퍼지면(예: 바닥에 깔린 물체들) 1축 sweep 만으로도 후보가 충분히 줄지만, 3축 모두에서 겹치는 쌍만 최종 보고하면 false positive 가 더 줄어든다.

## 핵심 이점 — Incremental SAP (temporal coherence)

SAP 가 강력한 진짜 이유는 한 번의 정렬이 아니라 **프레임 간 갱신의 싸기**다. 물체는 한 프레임에 조금씩만 움직이므로, 지난 프레임에 정렬해 둔 끝점 리스트는 이번 프레임에도 **거의 정렬된(nearly sorted)** 상태다.

- 거의 정렬된 배열에 **insertion sort** 는 거의 O(n) 이다(이동 거리가 짧음) — 이것이 temporal coherence 의 활용.
- 끝점이 **swap 될 때만** 그 두 객체 쌍의 겹침 상태가 바뀌므로, 그 순간에만 쌍의 추가/제거를 갱신한다. 가만히 있는 다수 객체는 비용이 0 에 가깝다.

```
# incremental 갱신: 끝점 위치를 갱신하고 인접만 재정렬
for ep in endpoints:
    ep.value = current_aabb_endpoint(ep)
# 거의 정렬됨 → insertion sort 로 인접 swap 만
# swap(a, b) 발생 시: a,b 의 [min,max] 겹침 상태가 토글되면 쌍 add/remove
```

## 약점

- **Clustering(군집)** — 객체가 한 축에 몰리면 같은 좌표 근처 끝점이 빽빽해져 swap 이 폭증한다. 정렬이 거의-정렬이 아니게 되어 incremental 이점이 사라진다.
- **크기 편차** — AABB 가 매우 다른 크기로 섞이면 큰 객체의 긴 구간이 많은 쌍과 겹쳐 false positive 가 늘고 효율이 떨어진다.
- **temporal coherence 깨짐** — 순간이동·스폰 폭발이면 거의-정렬 가정이 무너져 swap 이 폭발한다.

> **Box2D 초기·Bullet 의 `btAxisSweep3`** 가 대표 구현. 안정적 분포·중간 규모에 좋고, incremental 갱신이 **결정론 친화적**이다 — swap 순서가 끝점 좌표로 명확히 정해지므로 연산 순서가 재현 가능하다(동률 tie-break 만 객체 ID 로 고정하면). 대규모·고밀도 동적은 DBVT([02-bvh-dbvt](02-bvh-dbvt.md))가 우세하다.

---

**관련 함정** (전체 체크리스트는 [11-spatial-structures §5](../11-spatial-structures.md#5-함정--결정론-체크리스트)):
- **clustering swap 폭증**: 한 축 군집 시 끝점 swap 이 폭발 → 분포가 나쁘면 트리로 전환.
- **정렬 tie 비결정성**: 같은 끝점 좌표의 정렬 순서가 흔들리면 후보 쌍 순서가 달라진다 → **안정 정렬** + 객체 ID tie-break([12](../12-determinism-networking.md)).
- **부동소수점 끝점 비교**: float 끝점의 플랫폼 간 미세 차이가 swap 유무를 바꿔 후보 집합이 달라질 수 있다 → 결정론 필요 시 fixed-point/엄격 정책([12](../12-determinism-networking.md)·[00](../00-foundations.md)).

**다음**: [05-queries](05-queries.md) — 위 구조들 위에서 도는 질의(ray·range·k-NN·frustum)의 종류.
