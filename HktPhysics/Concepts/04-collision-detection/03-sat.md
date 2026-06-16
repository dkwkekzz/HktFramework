# [04·2.3] SAT — 분리축 정리 (Separating Axis Theorem)

> 두 볼록 형상이 겹치지 *않는다* ⟺ 두 형상의 투영이 분리되는 **축(separating axis)이 하나라도 존재한다.** 그런 축을 못 찾으면 겹친 것.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)(내적·투영)

---

narrow phase 는 후보 쌍을 실제 형상으로 정밀 판정한다. 볼록(convex) 형상이 핵심 — 비볼록은 볼록 분해(convex decomposition)로 처리한다([04-gjk §비볼록](04-gjk.md) 참조). SAT 는 그중 면이 적은 형상(박스·다각형)에 강한 고전 기법이다.

**핵심 아이디어** — 두 볼록을 어떤 방향 축에 투영하면 각각 1D 구간이 된다. 두 구간이 한 축에서라도 안 겹치면 그 축이 "분리축"이고 두 형상은 떨어져 있다. 어떤 축에서도 분리되지 않으면 겹친 것. 즉 SAT 는 3D 겹침 판정을 **여러 1D 구간 겹침 판정**으로 환원한다.

**후보 축 — 무한히 많은 방향을 유한 개로 줄인다**

가능한 축은 무한하지만, 볼록 다면체끼리는 다음만 검사하면 충분하다:
- (a) 각 형상의 **면 법선(face normal)**
- (b) 두 형상의 **엣지 쌍 외적(edge × edge)**

> 📐 **심화: 왜 이 두 종류 축만으로 충분한가** — "면 법선 + 엣지 외적이면 모든 분리 상황을 잡는다"는 SAT 의 정당성은 직관 장벽이 높다(왜 엣지-엣지 외적이 필요하고, 왜 그게 전부인지). Minkowski 차의 면/엣지와 연결해 기하학적으로 푼 전용 문서 → [03a-sat-intuition.md](03a-sat-intuition.md).

구체적 축 개수:
- **2D 박스**: 4축(각 박스의 2개 면 법선). 사실상 각 박스의 두 변 방향.
- **3D OBB-OBB**: **15축** = 면 법선 3(A) + 3(B) + 엣지 외적 9(A의 3엣지 × B의 3엣지).

**알고리즘 — 분리 즉시 종료, 안 되면 최소 겹침이 답**

```
SAT_overlap(A, B):
  for axis in faceNormals(A) ∪ faceNormals(B) ∪ edgeCross(A,B):
      [aMin,aMax] = project(A, axis); [bMin,bMax] = project(B, axis)
      if aMax < bMin or bMax < aMin:
          return SEPARATED          # 분리축 발견 → 충돌 아님, 즉시 종료
      overlap = min(aMax,bMax) - max(aMin,bMin)
      track minimum overlap & its axis
  return COLLIDING(minOverlapAxis = 법선, minOverlap = 침투깊이)
```

- 각 축에 두 형상을 투영해 구간을 만들고 겹치는지 본다. **한 축이라도 분리되면 즉시 종료**(early-out) → 비겹침은 보통 싸게 판정된다.
- 끝까지 분리축이 없으면 겹친 것이고, 이때 **겹침이 최소인 축**이 충돌 법선, 그 **최소 겹침량이 침투 깊이**가 된다. 이 결과가 그대로 contact manifold 생성([06-contact-manifold](06-contact-manifold.md))으로 이어진다 — 최소 겹침 축이 reference face 를 정한다.

**트레이드오프**
- 장점: 박스/다각형처럼 면이 적은 형상에서 매우 빠르고 견고. **2D 엔진의 주력**(Box2D).
- 단점: 면·엣지 수가 많으면 축이 폭증한다. 곡면(구·캡슐)에는 직접 적용이 곤란 → 통일된 볼록 처리가 필요하면 [04-gjk](04-gjk.md) 가 유리.

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **엣지 외적 0 벡터**: 두 엣지가 평행하면 외적이 영벡터 → 정규화 시 NaN. 길이 epsilon 체크 후 그 축은 건너뛴다.
- **얕은 침투 법선 안정성**: 최소 겹침 축이 두 후보 사이에서 진동하면 법선이 프레임마다 튄다 → hysteresis/일관된 tie-break 필요.

**다음**: [04-gjk](04-gjk.md) — 곡면 포함 임의 볼록을 통일 인터페이스로 다루는 GJK(Minkowski 차·support·simplex).
