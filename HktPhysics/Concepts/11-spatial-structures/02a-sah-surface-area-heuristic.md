# [11·2.2a] SAH — 표면적 휴리스틱, 근본부터 (Surface Area Heuristic, from the ground up)

> "왜 *표면적*이 BVH traversal 비용을 예측하는가", "왜 자식 AABB 면적의 *비율*이 곧 광선이 그 자식으로 들어갈 *확률*인가"를 기하확률(geometric probability)로 근본부터 푼다.
> **상위 노드**: [02-bvh-dbvt.md](02-bvh-dbvt.md) · [11-spatial-structures.md](../11-spatial-structures.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-bvh-dbvt](02-bvh-dbvt.md)

---

## 0. 한 문장 요약

> **광선이 어떤 볼록 영역과 교차할 확률은 그 영역의 표면적에 비례한다(조건부로는 면적의 *비율*).** 그래서 BVH 노드의 traversal 비용을 "자식으로 내려갈 확률 × 자식 안의 일거리"로 적으면, 확률 자리에 정확히 `SA(자식)/SA(부모)` 가 들어간다 — SAH 의 표면적은 마법이 아니라 기하확률의 직접 산물이다.

[02-bvh-dbvt](02-bvh-dbvt.md) 는 SAH 비용식을 공식으로 던졌다. 여기서는 그 식의 모든 항이 *어디서 오는지*를 한 걸음씩 세운다.

---

## 1. 무엇을 최소화하려는가 — 기대 비용

BVH 의 목적은 광선(또는 점/박스) 질의를 빠르게 처리하는 것이다. 한 질의가 트리를 타고 내려갈 때 드는 비용은 두 종류뿐이다:

- **traversal 비용 `C_trav`** — 노드의 AABB 와 광선이 교차하는지 검사하는 비용(slab test 한 번).
- **intersection 비용 `C_isect`** — 잎에 도달했을 때 실제 프리미티브(삼각형 등)와 광선을 교차 검사하는 비용.

좋은 트리란 "수많은 무작위 광선을 던졌을 때 **평균 비용이 최소**인 트리"다. 그래서 우리는 한 노드를 좌/우로 나누는 후보 split 마다 그 split 이 만들 **기대 비용(expected cost)** 을 추정하고, 최소인 것을 고른다.

기대 비용을 쓰려면 "광선이 이 노드에 들어왔다는 전제 하에, 왼쪽 자식으로도 들어갈 확률"이 필요하다. 그 확률이 SAH 의 핵심이다.

---

## 2. 결정적 사실 — 광선-볼록체 교차 확률 ∝ 표면적

기하확률(integral geometry)의 고전 결과:

> **공간에 균등하게(무작위 방향·위치) 흩뿌린 직선 중 하나가 볼록체(convex body) `K` 와 교차할 확률은 `K` 의 표면적 `SA(K)` 에 비례한다.**

직관: 볼록체를 향해 사방에서 날아오는 직선이 그것과 부딪히려면 결국 그 **겉면(표면)** 을 뚫어야 한다. 겉면이 넓을수록 더 많은 직선이 부딪힌다. 부피가 아니라 *표면적* 인 이유가 여기 있다 — 직선은 내부를 "채우는" 게 아니라 표면을 "통과"한다.

이제 **조건부 확률**로 좁히자. 큰 볼록체 `P`(부모 AABB) 안에 작은 볼록체 `C`(자식 AABB)가 들어 있다(`C ⊂ P`). "직선이 이미 `P` 와 교차한다는 전제 하에, 그 직선이 `C` 와도 교차할 조건부 확률"은:

```
P(광선이 C 와 교차 | 광선이 P 와 교차)  =  SA(C) / SA(P)
```

이것이 SAH 식에 등장하는 `SA(L)/SA(node)`, `SA(R)/SA(node)` 의 정체다 — **임의의 비례상수가 아니라 조건부 확률 그 자체**다. (전제: 자식이 부모 안에 들었고, 광선 분포가 균등.)

---

## 3. 비용식 조립

이제 부품이 다 모였다. 광선이 어떤 노드에 들어왔다고 하자. 이 노드를 왼쪽 자식 `L`(프리미티브 `N_L` 개)과 오른쪽 자식 `R`(`N_R` 개)으로 나눈 split 의 기대 비용:

```
cost(split) = C_trav                                  ← 두 자식 AABB 를 검사하는 고정 비용
            + P(들어감 L) * N_L * C_isect              ← 왼쪽으로 내려가 N_L 개를 검사할 기대 일
            + P(들어감 R) * N_R * C_isect              ← 오른쪽도 마찬가지

여기에 §2 를 대입:
            = C_trav
            + (SA(L)/SA(node)) * N_L * C_isect
            + (SA(R)/SA(node)) * N_R * C_isect
```

- 첫 항 `C_trav`: 일단 두 자식의 AABB 와는 무조건 교차 검사하므로 고정.
- 둘째·셋째 항: "그 자식으로 들어갈 확률" × "들어갔을 때 검사할 프리미티브 수" × "검사 단가". 즉 **확률로 가중한 기대 일거리**.

**해석.** SAH 가 선호하는 split 은 (a) 자식의 표면적을 작게 만들거나(확률↓), (b) 프리미티브가 많은 쪽의 박스를 *특히* 작게 만드는 split 이다. 즉 "일거리가 많은 자식일수록 광선이 거기 들어갈 확률을 낮춰라"가 SAH 의 한 줄 전략이다. median split 이 객체 *수*만 반반 맞추는 것과 달리, SAH 는 **빈 공간을 한쪽으로 몰아** 광선이 일거리 많은 영역을 자주 피해 가게 만든다.

---

## 4. 왜 빌드가 비싼가 — 그리고 binned 근사

이론상 최적 split 을 찾으려면 각 축에서 모든 프리미티브 경계를 split 후보로 놓고, 후보마다 양쪽 `SA·N` 을 평가해야 한다. 후보 정렬·누적까지 하면 노드당 O(n log n), 트리 전체로는 더 커진다 — 정적 오프라인 BVH 라면 감수하지만 실시간엔 무겁다.

**Binned SAH** — 축을 고정 개수(예: 12~32)의 **bin** 으로 나누고, 각 프리미티브를 centroid 가 속한 bin 에 한 번씩 떨군다. 그러면 bin 경계들만 split 후보가 되고, bin 별 AABB·개수를 한 번 누적(prefix/suffix sweep)해 모든 후보 비용을 O(n + bins) 에 평가한다. 결과적으로 빌드가 **O(n log n)** 으로 떨어지면서 풀 SAH 에 근접한 품질을 얻는다. Embree·PhysX 정적 BVH 가 이 방식이다([11-spatial-structures §3](../11-spatial-structures.md#3-한눈-요약--구조-비교)).

---

## 5. 한계 — SAH 가 전제하는 것

SAH 는 두 가정 위에 선다:
- **광선 분포가 균등**(모든 방향·위치가 동등). 실제 카메라/그림자 광선은 편향돼 있어 SAH 가 항상 최적은 아니다 — 그래도 경험적으로 매우 강력하다.
- **광선이 자식들과 독립적으로 교차**. 형제 AABB 가 크게 겹치면 한 광선이 양쪽 다 들어가 모델이 비용을 과소평가한다. 그래서 SAH 빌드는 자연히 형제 겹침을 줄이는 방향으로 작동한다.

점/박스 질의(broad phase)에는 광선 모델이 정확히 맞진 않지만, "표면적 ≈ 그 영역이 질의에 걸릴 빈도"라는 직관은 그대로 유효해 동적 트리의 삽입 휴리스틱(표면적 증가 최소화, [02-bvh-dbvt](02-bvh-dbvt.md) DBVT)에도 같은 원리가 쓰인다.

---

## 6. 함정 (전체 체크리스트는 [11-spatial-structures §5](../11-spatial-structures.md#5-함정--결정론-체크리스트))

- **면적비를 부피비로 착각**: 광선 교차 확률은 부피가 아니라 **표면적**에 비례. 부피로 가중하면 가늘고 긴 박스의 비용을 잘못 추정한다.
- **빈 split 무시**: 한쪽이 빈(프리미티브 0) split 도 빈 공간을 베어내 비용을 낮출 수 있다 — 후보에서 빼지 말 것(SBVH/spatial split 의 출발점).
- **binned 빌드 순서 비결정성**: bin 누적·tie 처리 순서가 스레드마다 다르면 트리가 달라져 traversal 순서가 흔들린다 → 결정론 필요 시 고정([12](../12-determinism-networking.md)).

---

## 7. 더 읽기

- [02-bvh-dbvt](02-bvh-dbvt.md) — BVH/DBVT 개요(이 문서의 상위 절), refit/rebuild·fat margin.
- [11-spatial-structures §3](../11-spatial-structures.md#3-한눈-요약--구조-비교) — Binned SAH·Morton LBVH 도구 요약.
- MacDonald & Booth, *Heuristics for Ray Tracing Using Space Subdivision* (1990) — SAH 의 원전.
- Wald, *On Fast Construction of SAH-based Bounding Volume Hierarchies* (2007) — binned SAH 실무 빌드.
- Santaló, *Integral Geometry and Geometric Probability* — 광선-볼록체 교차 확률의 수학적 토대.
