# [04] 충돌 감지 (Collision Detection) — 허브

> 두 형상이 **언제·어디서·얼마나** 겹치는지를 찾아 충돌 정보(접촉점·법선·침투깊이)를 만들어, 구속 해법([05](05-constraint-solving.md))이 풀 입력을 준비하는 단계. broad phase 로 후보를 추리고 narrow phase 로 정밀 검사한다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [04-collision-detection/](04-collision-detection/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [00-foundations.md](00-foundations.md) · [11-spatial-structures.md](11-spatial-structures.md)

---

## 1. 위치와 역할

한 프레임의 물리 스텝에서 충돌 감지는 적분([03](03-time-integration.md))과 구속 해법([05](05-constraint-solving.md)) 사이에 끼는 단계다.

```
forces → [03] 적분 → [04] 충돌 감지 → [05] 구속 해법 → commit
                       └ broad phase → narrow phase → contact manifold
```

- **입력**: 적분으로 갱신된(혹은 갱신 *예정*인) 강체들의 변환(transform)과 형상(collider).
- **출력**: 충돌 쌍별 **contact manifold** — 접촉점(contact point), 접촉 법선(normal), 침투깊이(penetration depth). 이것이 [05](05-constraint-solving.md) 의 비관통(non-penetration) 구속·마찰 구속 입력이 된다.
- **왜 두 단계인가**: 모든 쌍을 정밀 검사하면 O(n²) × (값비싼 narrow phase). 그래서 **broad phase** 가 싸게 "겹칠 *수도* 있는" 후보 쌍만 추리고(false positive 허용, false negative 금지), **narrow phase** 가 후보만 정밀 검사한다.
- 이 문서군은 **충돌에 가속 구조를 어떻게 쓰는가**에 집중한다. 구조 자체(BVH·DBVT·그리드·octree 의 빌드/갱신/메모리 레이아웃)는 [11-spatial-structures.md](11-spatial-structures.md) 로 위임한다.
- 충돌 감지는 "기하 질의(geometric query)"이지 "물리 풀이"가 아니다. 침투를 *해소*하는 것은 [05](05-constraint-solving.md) 의 일이고, 04 는 침투를 *측정*만 한다. 이 경계를 흐리면(여기서 위치를 밀어내면) 결정론과 솔버 안정성이 깨진다.

---

## 2. 하위 문서 인덱스 (세부 이론)

충돌 감지는 직관 단위로 분할되어 있다. 권장 순서는 위에서 아래 — broad 로 추리고, BV 로 거르고, narrow 로 정밀 판정한 뒤, manifold 로 솔버에 넘기고, CCD 로 고속 객체를 보강.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [04-collision-detection/01-broad-phase.md](04-collision-detection/01-broad-phase.md) | Broad phase — 후보 쌍 추리기 | SAP·DBVT·grid·공간해시·octree·temporal coherence |
| 2.2 | [04-collision-detection/02-bounding-volumes.md](04-collision-detection/02-bounding-volumes.md) | Bounding volume — 대리 도형 | AABB·OBB·sphere·capsule·k-DOP·타이트vs비용 |
| 2.3 | [04-collision-detection/03-sat.md](04-collision-detection/03-sat.md) | SAT — 분리축 정리 | 분리축·면법선·엣지외적·15축·최소겹침=침투 |
| 2.3a | [04-collision-detection/03a-sat-intuition.md](04-collision-detection/03a-sat-intuition.md) | SAT 심화 — 왜 그 축들만으로 충분한가 | 분리평면·feature 조합·엣지-엣지·Minkowski 다리 |
| 2.4 | [04-collision-detection/04-gjk.md](04-collision-detection/04-gjk.md) | GJK — Minkowski 차로 충돌/거리 | Minkowski 차·support·simplex 진화·거리 모드 |
| 2.4a | [04-collision-detection/04a-gjk-epa-geometric.md](04-collision-detection/04a-gjk-epa-geometric.md) | GJK·EPA 기하학적 심화 | 원점포함=충돌·support 분해·doSimplex·EPA 파내기 |
| 2.5 | [04-collision-detection/05-epa-mpr.md](04-collision-detection/05-epa-mpr.md) | EPA·MPR — 침투 깊이·법선 | polytope 확장·최근접면·portal·XenoCollide |
| 2.6 | [04-collision-detection/06-contact-manifold.md](04-collision-detection/06-contact-manifold.md) | Contact manifold 생성 | 다중 접촉점·Sutherland–Hodgman·persistence·warm start |
| 2.7 | [04-collision-detection/07-ccd.md](04-collision-detection/07-ccd.md) | CCD — 연속 충돌 감지 | tunneling·swept·cast·conservative advancement·speculative·sub-step |

---

## 3. 한눈 요약 — 단계별 기법

각 단계에서 선택지가 갈리는 기법을 한 곳에 모았다. 상세는 각 하위 문서.

**단계·기법 매핑**

| 단계 | 기법 | 쓰임 | 상세 |
|---|---|---|---|
| Broad | SAP / DBVT / grid / spatial hash | 후보 쌍, ray/shape cast | 2.1 |
| BV | AABB · sphere · OBB · capsule · k-DOP | 빠른 reject, BVH 잎 | 2.2 |
| Narrow | SAT | 박스/다각형(2D 주력) | 2.3 |
| Narrow | GJK | 임의 볼록 충돌/거리 | 2.4 |
| Narrow | EPA | 침투 깊이·법선 (GJK 후속) | 2.5 |
| Narrow | MPR | 단순 대안 | 2.5 |
| Manifold | Sutherland–Hodgman clipping | 다중 접촉점, warm-start id | 2.6 |
| CCD | conservative advancement · speculative · cast · sub-step | tunneling 방지 | 2.7 |

**broad phase 구조 비교**

| 구조 | 빌드/갱신 | 쌍 질의 | 강점 | 약점 |
|---|---|---|---|---|
| SAP | O(n log n) / 점진 O(n) | O(n + k) | coherence 큰 씬 | 한 축 쏠림 |
| DBVT | 점진 재삽입 | O(n log n) | 크기 편차·캐스트 | 트리 회전 비용 |
| Uniform grid | O(n) | O(n + k) | 균일·밀집 씬 | 크기 편차·희소 |
| Spatial hash | O(n) | O(n + k) | 희소·오픈월드 | 셀 튜닝·충돌 |
| Octree/BSP | 느림 | O(log n) | 정적·계층 | 동적 갱신 |

**bounding volume 비교**

| BV | 타이트함 | 겹침 테스트 비용 | 회전 갱신 | 비고 |
|---|---|---|---|---|
| Sphere | 낮음 | 가장 쌈 (거리 비교) | 불필요(회전 불변) | 빠른 초기 reject |
| AABB | 중 | 쌈 (축별 구간 비교) | 회전 시 재계산 | broad phase 표준 |
| Capsule | 중상(길쭉한 것) | 쌈(선분-선분 거리) | 회전 따라감 | 캐릭터에 인기 |
| OBB | 높음 | 비쌈 (SAT 15축) | 회전 같이 돎 | 타이트하지만 검사 무거움 |
| k-DOP | 높음(k↑) | 중(k/2 슬랩) | 회전 시 재계산 | 8/14/18/26-DOP, BVH 잎에 |

> 거의 모든 narrow phase 구현은 **충돌 margin**(작은 표면 두께)을 둔다 — GJK/EPA 의 수치 안정성과 speculative contact 의 여유를 동시에 확보한다.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

- **Bullet** — broad phase 에 `btDbvtBroadphase`(동적 AABB 트리) 또는 SAP. narrow phase 는 **GJK + EPA**(`btGjkPairDetector`, `btGjkEpaPenetrationDepthSolver`), 박스-박스 등은 전용 알고리즘. persistent manifold(`btPersistentManifold`)로 접촉 누적·warm start. CCD 는 conservative advancement.
- **Box2D** — 2D 의 교과서. broad phase 는 동적 트리 + 쌍 매니저. narrow phase 는 **SAT + Sutherland–Hodgman clipping**으로 2점 manifold, feature id 로 warm start. CCD 는 **TOI(conservative advancement) + sub-stepping**. (Erin Catto)
- **PhysX (NVIDIA)** — SAP/그리드 기반 broad phase(다중 broad phase 지원), GJK/PCM(persistent contact manifold) narrow phase, **speculative contacts(SCD)**를 기본 CCD 경로로 제공(전통 sweep CCD 도 옵션). GPU broad/narrow phase.
- **Jolt** — 대규모 병렬·결정론 지향. quadtree 계열 broad phase, 볼록 narrow phase(GJK/EPA + EPA penetration), speculative contact, 우수한 sleeping/island. (Horizon Forbidden West)
- **Chaos (UE5)** — 언리얼 내장. broad phase 가속 구조 + GJK/EPA narrow phase, manifold 기반 접촉, CCD 옵션(per-body), 파괴(Chaos Destruction)용 충돌도 동일 파이프라인.

> 공통 패턴: **broad(트리/SAP) → GJK/EPA 또는 SAT+clipping → persistent manifold(warm start) → 선택적 speculative/CCD.**

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **broad/narrow 책임 경계**: broad 는 false positive 허용, **false negative 금지**(놓친 충돌은 관통으로 표출). fat AABB margin 이 속도 대비 부족하면 빠른 객체가 broad phase 에서 누락된다. (04-collision-detection/01)
- **결정론 ([12] 연계)**: 후보 쌍·접촉점의 **생성 순서가 부동소수점 누적 순서를 바꿔** 결과를 흔든다. 쌍 리스트·manifold 점을 **안정 정렬(stable, 객체 id 기준)**하고, 멀티스레드 broad phase 는 수집 순서를 결정론적으로 직렬화할 것. SAP 의 정렬도 tie-break 가 결정론적이어야 함. (04-collision-detection/01·06)
- **접촉점 feature id**: warm start 가 동작하려면 접촉점 id 가 프레임 간 **안정적·결정론적**이어야 한다. id 가 흔들리면 캐시 미스 → 솔버가 매 프레임 차갑게 시작 → 지터·붕괴. (04-collision-detection/06)
- **SAT 엣지 외적 0/누락**: 평행 엣지 외적은 영벡터(NaN 위험)라 건너뛰되, 3D에서 엣지 외적 축 자체를 빼면 모서리 스침 분리를 놓쳐 헛겹침. (04-collision-detection/03·03a)
- **EPA 수치 안정성**: 차집합 표면에 거의 평행한 면·degenerate simplex 에서 EPA 가 발산/오법선. 충돌 margin 과 epsilon, polytope 정리(degenerate face 제거)로 방어. (04-collision-detection/05·04a)
- **얕은 침투 vs 깊은 침투**: GJK 거리 모드는 얕은 분리, EPA 는 침투 — 경계에서 둘을 매끄럽게 잇지 못하면 법선이 튄다. speculative contact 가 이 경계를 우회하는 한 이유. (04-collision-detection/04·05)
- **CCD 비용 폭발**: 전역 CCD 는 대량 객체에서 TOI 루프가 캐스케이드(한 TOI 가 다음을 유발)되며 프레임을 잡아먹는다 → per-body 게이팅 + speculative 기본화. (04-collision-detection/07)
- **margin 튜닝의 양날**: margin 이 크면 ghost contact(공중 정지), 작으면 tunneling/지터. 속도·크기에 맞춰 조정. (04-collision-detection/07)
- **degenerate broad phase**: 모든 객체가 한 평면/한 축에 정렬되면 SAP 가 O(n²)로 붕괴. 다축/그리드 혼용. (04-collision-detection/01)

---

## 6. 더 읽기 / 관련 노드

**관련 노드**
- **선행**: [00-foundations.md](00-foundations.md)(부동소수점·수치 안정성·선형대수) · [11-spatial-structures.md](11-spatial-structures.md)(BVH/DBVT·grid·octree 구조 상세).
- **후속**: [05-constraint-solving.md](05-constraint-solving.md) — manifold·warm start 가 contact/friction 구속의 입력. [03-time-integration.md](03-time-integration.md) — 고정 timestep·sub-stepping 이 CCD 와 직결.
- **횡단**: [12-determinism-networking.md](12-determinism-networking.md)(쌍·접촉 순서·feature id 결정론) · [13-performance-parallelism.md](13-performance-parallelism.md)(병렬 broad phase·SIMD·island).
- **공유**: [08-fluids.md](08-fluids.md)·[09-particles.md](09-particles.md) — 공간 해시 이웃 탐색을 04 와 공유.

**외부 레퍼런스**
- Christer Ericson, *Real-Time Collision Detection* — BV·BVH·GJK·거리 질의·clipping 의 표준 교과서.
- Gino van den Bergen, *Collision Detection in Interactive 3D Environments* (및 GJK/SOLID, "Ray Casting against General Convex Objects") — GJK·conservative advancement.
- Erin Catto, GDC 강연들 — SAT+clipping manifold, persistent contact, **speculative contacts**, TOI(Box2D).
- Casey Muratori, "Implementing GJK" — support·simplex·doSimplex 의 그림 해설.
- Gary Snethen, *XenoCollide* — MPR.
