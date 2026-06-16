# [04] 충돌 감지 (Collision Detection)

> 두 형상이 **언제·어디서·얼마나** 겹치는지를 찾아 충돌 정보(접촉점·법선·침투깊이)를 만들어, 구속 해법([05])이 풀 입력을 준비하는 단계다. broad phase 로 후보를 추리고 narrow phase 로 정밀 검사한다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [00-foundations.md](00-foundations.md) · [11-spatial-structures.md](11-spatial-structures.md)

---

## 1. 위치와 역할

한 프레임의 물리 스텝에서 충돌 감지는 적분([03])과 구속 해법([05]) 사이에 끼는 단계다.

```
forces → [03] 적분 → [04] 충돌 감지 → [05] 구속 해법 → commit
                       └ broad phase → narrow phase → contact manifold
```

- **입력**: 적분으로 갱신된(혹은 갱신 *예정*인) 강체들의 변환(transform)과 형상(collider).
- **출력**: 충돌 쌍별 **contact manifold** — 접촉점(contact point), 접촉 법선(normal), 침투깊이(penetration depth). 이것이 [05] 의 비관통(non-penetration) 구속·마찰 구속 입력이 된다.
- **왜 두 단계인가**: 모든 쌍을 정밀 검사하면 O(n²) × (값비싼 narrow phase). 그래서 **broad phase** 가 싸게 "겹칠 *수도* 있는" 후보 쌍만 추리고(false positive 허용, false negative 금지), **narrow phase** 가 후보만 정밀 검사한다.
- 이 문서는 **충돌에 가속 구조를 어떻게 쓰는가**에 집중한다. 구조 자체(BVH·DBVT·그리드·octree 의 빌드/갱신/메모리 레이아웃)는 [11-spatial-structures.md](11-spatial-structures.md) 로 위임한다.
- 충돌 감지는 "기하 질의(geometric query)"이지 "물리 풀이"가 아니다. 침투를 *해소*하는 것은 [05] 의 일이고, 04 는 침투를 *측정*만 한다. 이 경계를 흐리면(여기서 위치를 밀어내면) 결정론과 솔버 안정성이 깨진다.

---

## 2. 핵심 이론

### 2.1 Broad phase — 후보 쌍 추리기

목표: n 개 객체에서 brute-force O(n²) 쌍 검사를 피하고, 실제로 겹칠 가능성이 있는 **쌍의 집합**만 만든다. 보통 각 객체의 느슨한 AABB(약간 부풀린 bounding box, "fat AABB")로 추린다.

**Sweep-and-Prune (SAP, sort-and-sweep)**
- 각 객체 AABB 의 한 축(예: x) 투영 구간 `[min, max]` 끝점을 정렬한 뒤, 한 번 훑으며(sweep) 구간이 겹치는 쌍만 후보로. 한 축에서 겹치는 쌍에 대해 나머지 축도 검사.
- 프레임 간 객체가 조금씩만 움직이면 정렬이 거의 유지됨 → **insertion sort 로 점진 갱신**하면 평균 O(n + k)(k=실제 겹침 수). 이 "temporal coherence(시간적 일관성)" 활용이 SAP 의 핵심.
- 약점: 모든 객체가 한 축에 몰리면(예: 바닥에 줄지어 쌓인 박스 → x 축 투영이 다 겹침) degenerate. 다축 SAP / 그리드 혼용으로 완화.

**동적 BVH / DBVT (dynamic bounding volume tree)**
- AABB 들을 이진 트리로 묶음. 질의(query)·쌍 찾기는 O(n log n) 수준, 광선/형상 캐스트(ray/shape cast)도 같은 트리로 처리.
- 동적 씬에선 fat AABB 로 잎(leaf)을 부풀려 두면 객체가 그 안에서 움직이는 동안 **트리 재삽입 없이 버틴다** → 갱신 비용 절감. 부풀린 박스를 벗어날 때만 remove+reinsert. (Bullet 의 `btDbvt`, Box2D 의 동적 트리가 이 방식.)
- 정적/혼합 씬에 강함. 크기 편차가 큰 씬(작은 총알 + 거대한 지형)에서 그리드보다 유리.

**균등 그리드(uniform grid)**
- 공간을 고정 셀로 나눠 객체를 셀에 담고, 같은/인접 셀의 객체끼리만 검사. 셀 크기가 평균 객체 크기에 맞고 분포가 균일하면 거의 O(n + k).
- 약점: 객체 크기 편차가 크거나 공간이 희소(sparse)하면 메모리·낭비 셀 폭증. "teapot in a stadium" 문제.

**공간 해시(spatial hashing)**
- 무한/희소 공간용 그리드. 셀 좌표를 해시 → 버킷에 담아 점유된 셀만 메모리 사용. 큰 오픈 월드에 적합. 해시 충돌·셀 크기 튜닝이 관건. (입자/유체 이웃 탐색에서도 동일 구조 사용 → [08]·[09] 와 공유.)

**octree / loose octree / BSP**
- 계층 공간 분할. 정적·계층적 씬에 좋지만 동적 갱신은 BVH 보다 까다로움. 상세는 [11].

**시간복잡도·선택 가이드**

| 구조 | 빌드/갱신 | 쌍 질의 | 강점 | 약점 |
|---|---|---|---|---|
| SAP | O(n log n) / 점진 O(n) | O(n + k) | coherence 큰 씬 | 한 축 쏠림 |
| DBVT | 점진 재삽입 | O(n log n) | 크기 편차·캐스트 | 트리 회전 비용 |
| Uniform grid | O(n) | O(n + k) | 균일·밀집 씬 | 크기 편차·희소 |
| Spatial hash | O(n) | O(n + k) | 희소·오픈월드 | 셀 튜닝·충돌 |
| Octree/BSP | 느림 | O(log n) | 정적·계층 | 동적 갱신 |

> 실전에선 단일 구조가 아니라 **하이브리드**가 흔하다. 정적 지오메트리는 BVH(빌드 1회), 동적 객체는 SAP/DBVT, 입자는 공간 해시.

### 2.2 Bounding volume — 형상을 감싸는 대리 도형

narrow phase 전, 또는 broad phase 의 잎으로 쓰는 근사 도형. **타이트할수록 false positive 가 줄지만 겹침 테스트가 비싸다.**

| BV | 타이트함 | 겹침 테스트 비용 | 회전 갱신 | 비고 |
|---|---|---|---|---|
| **Sphere** | 낮음 | 가장 쌈 (거리 비교) | 불필요(회전 불변) | 빠른 초기 reject |
| **AABB** | 중 | 쌈 (축별 구간 비교) | 회전 시 재계산 필요 | broad phase 표준 |
| **Capsule** | 중상(길쭉한 것) | 쌈(선분-선분 거리) | 회전 따라감 | 캐릭터에 인기 |
| **OBB** | 높음 | 비쌈 (SAT 15축) | 회전 같이 돎 | 타이트하지만 검사 무거움 |
| **k-DOP** | 높음(k↑) | 중(k/2 슬랩) | 회전 시 재계산 | 8/14/18/26-DOP, BVH 잎에 |

- **AABB 겹침**: 세 축 모두 구간이 겹치면 충돌. 분기 거의 없는 6 비교 — broad phase 가 AABB 를 쓰는 이유.
- **k-DOP**: AABB(=6-DOP)를 일반화. 고정된 k 개 방향 슬랩(slab)으로 감싼다. AABB 보다 타이트하면서 OBB 보다 검사 싸서 BVH 잎에 자주 쓰임.
- **OBB 겹침**은 SAT(아래) 15 축(3+3 면법선 + 9 엣지 외적)으로 판정.

### 2.3 Narrow phase — 정밀 검사

후보 쌍을 실제 형상으로 정밀 판정. 볼록(convex) 형상이 핵심 — 비볼록은 볼록 분해(convex decomposition)로 처리.

#### SAT — 분리축 정리 (Separating Axis Theorem)

> 두 볼록 형상이 겹치지 *않는다* ⟺ 두 형상의 투영이 분리되는 **축(separating axis)이 하나라도 존재한다.** 그런 축을 못 찾으면 겹친 것.

- **후보 축**: 볼록 다면체는 (a) 각 형상의 **면 법선(face normal)**, (b) 두 형상의 **엣지 쌍 외적(edge × edge)** 만 검사하면 충분. 2D 박스는 4축(각 박스 2면 법선), 3D OBB-OBB 는 15축(3+3+9).
- 각 축에 두 형상을 투영해 1D 구간을 만들고 겹치는지 검사. 한 축이라도 분리되면 **즉시 종료**(early-out) → 비겹침은 보통 싸게 판정.
- 겹친 경우, **분리거리(=겹침이 최소인 축)가 침투 깊이**가 되고 그 축이 충돌 법선이 된다(이게 manifold 생성으로 이어짐).
- 장점: 박스/다각형 같은 적은 면 형상에서 매우 빠르고 견고. 2D 엔진의 주력.
- 단점: 면·엣지 수가 많으면 축 폭증. 곡면(구/캡슐)에는 직접 적용 곤란 → GJK 가 유리.

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

#### GJK — Gilbert–Johnson–Keerthi

볼록 A, B 의 **Minkowski 차** `A ⊖ B = { a − b }` 가 **원점을 포함하면 충돌**이라는 사실을 이용. 차집합을 명시적으로 만들지 않고 **support 함수**로만 탐색한다.

- **support 함수** `support(S, d)` = 형상 S 에서 방향 d 로 가장 먼 점. Minkowski 차의 support 는 `support(A,d) − support(B,−d)`. 형상별로 싸게 계산(다면체=정점 중 max, 구=중심+r·d, 캡슐=선분 끝+r·d) → 임의 볼록을 통일된 인터페이스로 다룬다.
- **simplex 진화**: 최대 4 점(3D: 점→선→삼각형→사면체) simplex 를 키우며 원점을 향해 전진. 매 반복 새 support 점을 추가하고, 원점에 가장 가까운 부분 simplex 만 남긴 뒤 다음 탐색 방향을 그쪽으로 갱신.

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

- **거리/최근접점**: 충돌이 아니어도 GJK 는 simplex 의 원점 최근접점으로 **두 형상 간 거리·최근접점 쌍**을 준다. 이게 speculative contact·CCD·근접 질의에 직접 쓰인다.
- 장점: 곡면 포함 임의 볼록을 통일 처리, 빠르고 견고. 단점: **겹친 경우 침투 깊이는 못 준다**(원점이 차집합 내부) → EPA 가 필요.

#### EPA — Expanding Polytope Algorithm (GJK 후속)

GJK 가 충돌(원점 포함)을 확인한 뒤, **침투 깊이와 법선**을 뽑는다.

- GJK 가 끝낸 simplex(원점을 감싼 사면체)를 시작 polytope 로 삼아, **원점에 가장 가까운 면**을 찾고 그 면 법선 방향으로 새 support 점을 추가하며 polytope 를 *확장*한다.
- 더 멀어지지 않을 때까지 반복 → 수렴한 "원점에서 가장 가까운 표면 면"의 거리 = **침투 깊이**, 그 면의 법선 = **충돌 법선**, barycentric 으로 **접촉점** 복원.
- 비용은 GJK 보다 큼(반복적 polytope 확장). 그래서 보통 *충돌이 확인된 쌍에만* 호출.

#### MPR — Minkowski Portal Refinement (XenoCollide)

GJK+EPA 대안. Minkowski 차 내부 한 점에서 원점으로 "portal(삼각형)"을 만들어 표면으로 정제(refine)하며 침투/법선을 한 번에 추출. 구현이 단순하고 견고하나 정확도/일반성은 GJK+EPA 가 우세. 간단 형상에서 실용적.

#### 비볼록과 볼록 분해

GJK/SAT 는 **볼록 전제**. 오목 메시는 (a) **삼각형 수프**(각 삼각형 vs 볼록)로 풀거나, (b) **convex decomposition**(예: V-HACD)으로 여러 볼록 조각으로 쪼개 각 조각을 볼록 narrow phase 로 처리한다. 정적 지형은 보통 BVH-of-triangles.

### 2.4 Contact manifold 생성

narrow phase 가 "충돌함 + 법선 + 침투"를 줘도, 솔버([05])는 **안정적 적층(stacking)**을 위해 면-면 접촉의 **여러 접촉점**이 필요하다. 한 점만 주면 박스가 한 점으로 비틀거린다.

- **manifold = {접촉점들, 공유 법선, 점별 침투깊이}.** 면-면 접촉은 4점(박스), 엣지-면은 2점, 점 접촉은 1점이 흔하다.
- **clipping (Sutherland–Hodgman)**: 한 형상의 충돌 면(reference face)에 다른 형상의 면(incident face)을 투영해 **참조 면의 옆면(side plane)으로 잘라** 겹치는 다각형을 얻고, 참조 면 아래로 침투한 정점만 접촉점으로 채택. SAT 기반 박스 충돌의 표준 manifold 생성법(Box2D 가 교과서적).
- **manifold persistence / contact caching**: 프레임마다 접촉을 처음부터 만들지 않고, 이전 프레임 접촉점을 **id(형상 feature 조합)로 매칭**해 누적·갱신·낡은 점 제거. 이렇게 보존한 접촉에 **이전 프레임의 충격량(impulse)을 초깃값으로 재사용 = warm start** → [05] 솔버 수렴이 극적으로 빨라지고 적층이 안정. *충돌 감지(04)가 솔버(05)와 만나는 가장 중요한 접점*이다.
- 접촉점 id 의 **결정론적 생성**이 중요(5절). feature id 가 프레임마다 흔들리면 warm start 가 깨진다.

### 2.5 CCD — 연속 충돌 감지 (Continuous Collision Detection)

discrete 충돌 감지는 **프레임 끝 위치 한 스냅샷만** 검사한다. 빠른 물체는 한 스텝에 얇은 벽을 *건너뛰어*(tunneling) 충돌이 통째로 누락된다.

- **tunneling 조건**: 물체 이동거리 > 자기 두께. 총알·얇은 벽·고속 입자에서 발생.
- **swept volume**: 시작→끝 사이를 형상이 쓸고 간 부피를 만들어 그것과 충돌 검사. 정확하나 비쌈.
- **ray / shape cast**: 작은 물체는 광선(또는 형상) 캐스트로 경로 상 첫 충돌 시각(TOI)을 찾음. 가속 구조([11])의 캐스트 질의 재사용.
- **conservative advancement (CA)**: GJK 의 거리 질의를 이용. 현재 분리거리만큼은 충돌 없이 전진해도 안전 → 그만큼 시간을 진행, 다시 거리 재고 반복하여 **최초 접촉 시각(Time Of Impact, TOI)**을 안전하게 좁힌다(Brian Mirtich). 물체를 TOI 까지만 적분.
- **speculative contacts (보수적 접근의 대세)**: 형상을 *부풀린* AABB 로 미리 접촉 후보를 잡고, 솔버에 "이 거리 이상 다가오지 말라"는 구속을 **미리** 넣는다. swept volume 도 별도 TOI 루프도 없이 *기존 솔버가* 침투를 막음 → 구현 단순·저비용·다중 동시 충돌에 강함. 단점: 너무 일찍 멈춰 보이는 "ghost contact"(공중 정지) 아티팩트 → 부풀림 거리(margin)·속도 임계 튜닝 필요. (Erin Catto GDC 발표, Box2D/대다수 모던 엔진.)
- **sub-stepping**: 한 프레임을 작은 스텝으로 쪼개 매 sub-step 마다 discrete 검사. CCD 대용이자 솔버 정확도 향상. 비용은 sub-step 수배.

**비용/언제 켜는가**: CCD 는 비싸다. 보통 **선택적**으로 — 고속 동적 객체(총알·발사체)에만 켜고, 일반 객체는 discrete + speculative 로 둔다. 엔진은 보통 per-body "CCD enabled" 플래그 + 속도 임계로 게이팅.

---

## 3. 주요 기법/도구

| 단계 | 기법 | 쓰임 |
|---|---|---|
| Broad | SAP / DBVT / grid / spatial hash | 후보 쌍, ray/shape cast |
| BV | AABB · sphere · OBB · capsule · k-DOP | 빠른 reject, BVH 잎 |
| Narrow | SAT | 박스/다각형(2D 주력) |
| Narrow | GJK | 임의 볼록 충돌/거리 |
| Narrow | EPA | 침투 깊이·법선 (GJK 후속) |
| Narrow | MPR | 단순 대안 |
| Manifold | Sutherland–Hodgman clipping | 다중 접촉점, warm-start id |
| CCD | conservative advancement · speculative · cast · sub-step | tunneling 방지 |

- 거의 모든 narrow phase 구현은 **충돌 margin**(작은 표면 두께)을 둔다 — GJK/EPA 의 수치 안정성과 speculative contact 의 여유를 동시에 확보.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

- **Bullet** — broad phase 에 `btDbvtBroadphase`(동적 AABB 트리) 또는 SAP. narrow phase 는 **GJK + EPA**(`btGjkPairDetector`, `btGjkEpaPenetrationDepthSolver`), 박스-박스 등은 전용 알고리즘. persistent manifold(`btPersistentManifold`)로 접촉 누적·warm start. CCD 는 conservative advancement.
- **Box2D** — 2D 의 교과서. broad phase 는 동적 트리 + 쌍 매니저. narrow phase 는 **SAT + Sutherland–Hodgman clipping**으로 2점 manifold, feature id 로 warm start. CCD 는 **TOI(conservative advancement) + sub-stepping**. (Erin Catto)
- **PhysX (NVIDIA)** — SAP/그리드 기반 broad phase(다중 broad phase 지원), GJK/PCM(persistent contact manifold) narrow phase, **speculative contacts(SCD)**를 기본 CCD 경로로 제공(전통 sweep CCD 도 옵션). GPU broad/narrow phase.
- **Jolt** — 대규모 병렬·결정론 지향. quadtree 계열 broad phase, 볼록 narrow phase(GJK/EPA + EPA penetration), speculative contact, 우수한 sleeping/island. (Horizon Forbidden West)
- **Chaos (UE5)** — 언리얼 내장. broad phase 가속 구조 + GJK/EPA narrow phase, manifold 기반 접촉, CCD 옵션(per-body), 파괴(Chaos Destruction)용 충돌도 동일 파이프라인.

> 공통 패턴: **broad(트리/SAP) → GJK/EPA 또는 SAT+clipping → persistent manifold(warm start) → 선택적 speculative/CCD.**

---

## 5. 함정·결정론 주의

- **broad/narrow 책임 경계**: broad 는 false positive 허용, **false negative 금지**(놓친 충돌은 관통으로 표출). fat AABB margin 이 속도 대비 부족하면 빠른 객체가 broad phase 에서 누락된다.
- **결정론 ([12] 연계)**: 후보 쌍·접촉점의 **생성 순서가 부동소수점 누적 순서를 바꿔** 결과를 흔든다. 쌍 리스트·manifold 점을 **안정 정렬(stable, 객체 id 기준)**하고, 멀티스레드 broad phase 는 수집 순서를 결정론적으로 직렬화할 것. SAP 의 정렬도 tie-break 가 결정론적이어야 함.
- **접촉점 feature id**: warm start 가 동작하려면 접촉점 id 가 프레임 간 **안정적·결정론적**이어야 한다. id 가 흔들리면 캐시 미스 → 솔버가 매 프레임 차갑게 시작 → 지터·붕괴.
- **EPA 수치 안정성**: 차집합 표면에 거의 평행한 면·degenerate simplex 에서 EPA 가 발산/오법선. 충돌 margin 과 epsilon, polytope 정리(degenerate face 제거)로 방어.
- **얕은 침투 vs 깊은 침투**: GJK 거리 모드는 얕은 분리, EPA 는 침투 — 경계에서 둘을 매끄럽게 잇지 못하면 법선이 튄다. speculative contact 가 이 경계를 우회하는 한 이유.
- **CCD 비용 폭발**: 전역 CCD 는 대량 객체에서 TOI 루프가 캐스케이드(한 TOI 가 다음을 유발)되며 프레임을 잡아먹는다 → per-body 게이팅 + speculative 기본화.
- **margin 튜닝의 양날**: margin 이 크면 ghost contact(공중 정지), 작으면 tunneling/지터. 속도·크기에 맞춰 조정.
- **degenerate broad phase**: 모든 객체가 한 평면/한 축에 정렬되면 SAP 가 O(n²)로 붕괴. 다축/그리드 혼용.

---

## 6. 더 읽기 / 관련 노드

- **선행**: [00-foundations.md](00-foundations.md)(부동소수점·수치 안정성·선형대수) · [11-spatial-structures.md](11-spatial-structures.md)(BVH/DBVT·grid·octree 구조 상세).
- **후속**: [05-constraint-solving.md](05-constraint-solving.md) — manifold·warm start 가 contact/friction 구속의 입력. [03-time-integration.md](03-time-integration.md) — 고정 timestep·sub-stepping 이 CCD 와 직결.
- **횡단**: [12-determinism-networking.md](12-determinism-networking.md)(쌍·접촉 순서·feature id 결정론) · [13-performance-parallelism.md](13-performance-parallelism.md)(병렬 broad phase·SIMD·island).
- **공유**: [08-fluids.md](08-fluids.md)·[09-particles.md](09-particles.md) — 공간 해시 이웃 탐색을 04 와 공유.
- **레퍼런스**:
  - Christer Ericson, *Real-Time Collision Detection* — BV·BVH·GJK·거리 질의·clipping 의 표준 교과서.
  - Gino van den Bergen, *Collision Detection in Interactive 3D Environments* (및 GJK/SOLID, "Ray Casting against General Convex Objects") — GJK·conservative advancement.
  - Erin Catto, GDC 강연들 — SAT+clipping manifold, persistent contact, **speculative contacts**, TOI(Box2D).
  - Gary Snethen, *XenoCollide* — MPR.
