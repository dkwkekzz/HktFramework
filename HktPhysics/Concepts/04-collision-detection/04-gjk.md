# [04·2.4] GJK — Gilbert–Johnson–Keerthi

> 볼록 A, B 의 **Minkowski 차** `A ⊖ B = {a − b}` 가 **원점을 포함하면 충돌**. 차집합을 명시적으로 만들지 않고 **support 함수**로만 탐색한다 — 곡면 포함 임의 볼록을 통일 인터페이스로.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)(내적·외적·simplex)

---

SAT([03-sat](03-sat.md))가 분리축을 *미리 나열*해 검사한다면, GJK 는 같은 분리 판정을 **필요한 방향만 탐색**한다. 핵심 통찰은 두 형상의 겹침을 한 점(원점)과 한 집합(Minkowski 차)의 관계로 환원하는 것이다.

**Minkowski 차와 원점 포함 판정**

```
A ⊖ B = { a − b  |  a ∈ A, b ∈ B }
```

A 와 B 가 겹친다 ⟺ 어떤 `a = b` 인 점이 있다 ⟺ `a − b = 0` 이 차집합 안에 있다 ⟺ **`A ⊖ B` 가 원점을 포함한다.** A, B 가 볼록이면 `A ⊖ B` 도 볼록이라 이 판정이 깔끔하다.

문제: 차집합을 통째로 만들면 비싸다(정점 수의 곱). GJK 는 **만들지 않는다** — support 함수로 그때그때 필요한 경계점만 뽑는다.

**support 함수 — 임의 볼록을 통일하는 인터페이스**

`support(S, d)` = 형상 S 에서 방향 `d` 로 가장 먼 점(서포트 점). Minkowski 차의 support 는 한 줄로 합성된다:

```
support(A⊖B, d) = support(A, d) − support(B, −d)
```

형상별 support 는 싸다 — 다면체 = 정점 중 `d` 내적 최대, 구 = `center + r·d̂`, 캡슐 = 선분 끝 중 max `+ r·d̂`. **임의 볼록(곡면 포함)을 단 하나의 인터페이스로** 다루는 것이 GJK 의 일반성이다.

**simplex 진화 — 원점을 감싸려는 시도**

GJK 는 최대 4점(3D: 점 → 선 → 삼각형 → 사면체) **simplex** 를 키우며 원점을 향해 전진한다. 매 반복: 현재 방향으로 새 support 점을 추가하고, simplex 에서 원점에 가장 가까운 부분만 남긴 뒤, 다음 탐색 방향을 그 부분에서 원점 쪽으로 갱신한다.

```
GJK(A, B):
  d = (B.center - A.center)            # 임의 초기 방향
  simplex = [ support(A,B, d) ]
  d = -simplex[0]
  loop:
      P = support(A,B, d)              # support(A,d) - support(B,-d)
      if dot(P, d) < 0: return NO_INTERSECTION   # 새 점이 원점 못 넘음 → 분리
      simplex.add(P)
      if doSimplex(simplex, d):        # 원점 포함? 아니면 d 갱신 & 불필요 점 제거
          return INTERSECTION          # simplex 가 원점을 감쌈
```

종료 논리: 새 support 점 `P` 가 원점 방향으로 충분히 못 나아가면(`dot(P,d) < 0`) 그 방향에 분리 평면이 있다는 뜻 → **분리(충돌 아님)**. simplex 가 원점을 안에 가두면 → **충돌**.

> 📐 **근본부터 기하학적 심화**: "왜 Minkowski 차의 원점이 충돌과 같은가 · support 가 왜 차집합 경계를 정확히 짚는가 · simplex 가 어떻게 원점을 좁혀 가는가(doSimplex 의 영역 판정) · EPA 가 침투를 어떻게 파내는가"를 그림으로 풀어낸 전용 문서 → [04a-gjk-epa-geometric.md](04a-gjk-epa-geometric.md).

**거리·최근접점 모드** — 충돌이 아니어도 GJK 는 simplex 의 원점 최근접점으로 **두 형상 간 거리·최근접점 쌍**을 준다. 이게 speculative contact·CCD·근접 질의에 직접 쓰인다([07-ccd](07-ccd.md)).

**트레이드오프**
- 장점: 곡면 포함 임의 볼록을 통일 처리, 빠르고 견고. 거리 모드를 공짜로 얻음.
- 단점: **겹친 경우 침투 깊이는 못 준다**(원점이 차집합 *내부*라 방향이 모호) → [05-epa-mpr](05-epa-mpr.md) 의 EPA 가 필요.

**비볼록과 볼록 분해**

GJK/SAT 는 **볼록 전제**. 오목 메시는 (a) **삼각형 수프**(각 삼각형 vs 볼록)로 풀거나, (b) **convex decomposition**(예: V-HACD)으로 여러 볼록 조각으로 쪼개 각 조각을 볼록 narrow phase 로 처리한다. 정적 지형은 보통 BVH-of-triangles.

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **얕은 침투 vs 깊은 침투 경계**: GJK 거리 모드(얕은 분리)와 EPA(침투)를 경계에서 매끄럽게 잇지 못하면 법선이 튄다. speculative contact 가 이 경계를 우회하는 이유([07-ccd](07-ccd.md)).
- **충돌 margin**: 거의 모든 GJK 구현은 작은 표면 margin 을 둬 수치 안정성을 확보한다.

**다음**: [05-epa-mpr](05-epa-mpr.md) — GJK 가 확인한 충돌에서 침투 깊이·법선을 뽑는 EPA, 그리고 단순 대안 MPR.
