# C06 — narrow phase (정확히 어떻게 닿았나)

> **이 챕터가 답하는 질문**: C05 의 mid phase 가 "이 shape 과 저 shape 을 검사하라"고 골라 넘겼다. 이제 남은 건 정밀 계산이다 — 이 두 shape 이 **실제로 겹쳤는가? 얼마나 깊이? 어느 방향으로? 정확히 어디서?** 이 네 값을 어떻게 구하는가?
> **대응 Concepts**: [04 — 충돌 검출](../Concepts/04-collision-detection.md)
> **선행 챕터**: [C03 — implicit geometry](./C03-implicit-geometry.md) (support 함수·margin), [C05 — broad phase](./C05-broad-phase.md) (mid phase 가 shape쌍·warm start 상태를 넘김)

---

## 왜 이 챕터를 일곱 번째로 읽는가

충돌 파이프라인의 마지막 정밀 단계다. 세 단계를 한 줄로 대비하면 — broad(C05)는 "**누구와 누가**", mid(C05)는 "**어느 shape 과 어느 shape**", narrow(C06)는 "**그 둘이 정확히 어떻게 닿았나**". 앞의 두 단계가 후보를 소수로 줄였기에, 여기서 비싼 정밀 계산을 감당할 수 있다.

narrow phase 의 산출물은 **접촉(contact)** 이다 — 두 shape 이 얼마나 겹쳤고(관통 깊이), 어느 방향으로 밀어내야 하며(법선), 어느 점에서 닿았는지. 이 값들이 다음 단계 C07(충돌 솔버)의 입력이 되어, 실제로 물체를 밀어내 겹침을 푼다. 그러니 여기서 계산이 틀리면 물리 전체가 틀린다.

C06 의 핵심은 **세 개의 기하 알고리즘 — GJK · EPA · SAT** 이다. 이름은 낯설지만 각자 딱 한 가지 질문에 답한다: GJK 는 "겹쳤나, 아니면 얼마나 떨어졌나", EPA 는 "(겹쳤다면) 얼마나 깊이", SAT 는 "어떤 특징(면·모서리·꼭짓점)으로 닿았나". 그리고 이 셋의 결과를 **manifold**(접촉점 여러 개)로 묶어 안정적 접촉을 만든다. 이 챕터는 그 네 조각을 직관부터 풀어간다.

---

## 1. 먼저 산출물을 보자 — contact 와 manifold

알고리즘에 들어가기 전에, 이 단계가 *무엇을 만드는지*부터 못박으면 나머지가 쉽다. 하나의 접촉은 `TContactPoint`(`Collision/ContactPoint.h:41`)로 표현되고, 딱 네 값이다:

- **`Phi`** — 두 shape 사이의 부호 있는 분리 거리. **음수면 그만큼 관통**(겹침), 양수면 그만큼 떨어짐. C03 §1 의 SDF `φ` 와 같은 부호 규약이다.
- **`ShapeContactNormal`** — 밀어낼 방향(shape 1 에서 바깥으로).
- **`ShapeContactPoints[2]`** — 두 body 각각의 표면에서 닿은 점.
- **`ContactType`** — 이 접촉이 면-꼭짓점인지 모서리-모서리인지 등(`EContactPointType`, `:15`).

그런데 접촉점 **하나로는 안정적이지 않다.** 상자가 바닥에 평평하게 놓였는데 접촉점이 한 점뿐이면, 그 점을 축으로 덜덜 흔들린다. 그래서 Chaos 는 한 shape 쌍에 대해 **최대 4개의 접촉점을 묶은 manifold** 를 만든다 — `FManifoldPoint`(`ContactPoint.h:96`), 상한은 `Chaos_Collision_MaxManifoldPoints`(`Collision/PBDCollisionConstraint.h:42`, 기본 4). 4점이면 면접촉을 네 귀퉁이로 눌러 안정적으로 지탱한다. **narrow phase 의 진짜 목표는 "가장 깊은 한 점"이 아니라 "이 면접촉을 지탱할 최대 4점의 manifold"** 다.

---

## 2. 진입점과 디스패치 — shape쌍 종류마다 다른 길

narrow phase 의 대문은 `Collisions::UpdateConstraint(Constraint, ShapeWorldTransform0, ShapeWorldTransform1, Dt)`(`CollisionResolution.h`)이다 — 두 shape 의 월드 변환을 받아, constraint 위의 manifold 를 갱신한다.

첫 일은 **shape 쌍의 종류를 판별**하는 것이다 — `CalculateShapePairType(...)` → `EContactShapesType`(`CollisionResolutionTypes.h:54`). 값이 아주 구체적이다: `SphereSphere`, `SphereCapsule`, `SphereHeightField`, `CapsuleHeightField`, `BoxHeightField`, `ConvexConvex`, `ConvexHeightField`, `GenericConvexConvex`, `TriangleMesh`, ….

왜 이렇게 잘게 나누는가? **종류마다 최선의 알고리즘이 다르기 때문**이다:

- **단순 프리미티브 쌍**(SphereSphere 등)은 **해석적 공식**으로 즉답한다. 구-구는 GJK 가 필요 없다 — 중심 거리 빼기 반지름 합이면 끝(C03 §1). 가장 싸고 정확하다.
- **일반 볼록 쌍**(GenericConvexConvex)은 **GJK/EPA**(§3~4)로 푼다.
- **비볼록**(TriangleMesh·HeightField)은 **전용 mesh generator**(§7)로 삼각형 단위로 처리한다.

즉 `UpdateConstraint` 는 종류를 보고 알맞은 contact 함수로 분기하는 교환수다. 아래 세 절이 그 분기의 세 갈래다.

---

## 3. GJK — 겹쳤나, 아니면 얼마나 떨어졌나

일반 볼록 두 개가 겹쳤는지 어떻게 아는가? 순진하게 모든 면·모서리를 맞대보면 조합이 폭발한다. **GJK**(Gilbert–Johnson–Keerthi)는 이걸 우아하게 푼다.

**핵심 발상: Minkowski 차(差).** 두 볼록 A, B 에 대해 "A 의 모든 점에서 B 의 모든 점을 뺀" 차집합을 상상한다(CSO, Configuration Space Obstacle). 이 차 공간에는 마법 같은 성질이 있다 — **A 와 B 가 겹칠 필요충분조건은, 이 차집합이 원점(0)을 품는 것**이다. 두 물체가 닿았다는 문제가 "이 한 덩어리가 원점을 포함하나"라는 단일 질문으로 바뀐다.

GJK 는 그 차집합을 통째로 만들지 않는다(그건 비싸다). 대신 **support 함수**(C03 §3 의 그것 — "이 방향으로 가장 먼 꼭짓점")만으로, 원점을 감싸려 시도하는 작은 **simplex**(점→선→삼각형→사면체)를 조금씩 굴린다. 매 반복마다 "원점 쪽으로 더 가까운 support 점"을 하나 추가하며 사면체가 원점을 가두는지 본다. 가두면 → 겹침. 못 가두고 더 못 다가가면 → 분리, 이때 simplex 가 **가장 가까운 거리와 두 표면의 최근접점**까지 준다.

진입 함수는 `GJKPenetration(A, B, BToATM, OutPenetration, OutClosestA, OutClosestB, OutNormal, …)`(`GJK.h:1428`)이다. 입력은 두 geometry + 상대 변환, 출력은 관통/거리·양쪽 최근접점·법선. 내부는 오직 `A.SupportCore(...)`/`B.SupportCore(...)` 호출로만 돈다 — GJK 가 "모양의 종류를 몰라도 되는" 이유이자, C03 이 볼록마다 support 함수를 둔 이유가 여기서 회수된다. 그리고 C05 에서 본 warm start 가 여기 꽂힌다 — 지난 프레임의 simplex(`TGJKSimplexData`)에서 출발하면 몇 반복 만에 수렴한다.

> GJK 는 shape 을 **core + margin**(C03 §5)으로 다룬다. 함수 인자의 `Thickness`(=margin)가 그것 — 살짝 줄인 core 로 support 를 구하고 margin 을 더해 둥근 모서리를 만든다. 뾰족한 꼭짓점에서의 수치 불안정을 피하는 장치다.

---

## 4. EPA — (겹쳤다면) 얼마나 깊이 파고들었나

GJK 가 "겹쳤다"고 하면 문제가 하나 남는다. GJK 는 "원점이 차집합 *안에* 있다"까지만 안다 — *얼마나 깊이* 안에 있는지, *어느 방향으로* 밀어내야 최소로 빠지는지는 모른다. 그 답을 주는 게 **EPA**(Expanding Polytope Algorithm)다.

**직관**: 원점이 차집합(CSO) 안에 있다. 그럼 "원점에서 이 덩어리 표면까지의 **가장 짧은** 거리·방향"이 곧 최소 관통 깊이·법선이다(그만큼 밀면 딱 표면에 닿아 겹침이 풀리니까). EPA 는 GJK 가 남긴 simplex 를 씨앗으로, **다면체를 원점에서 바깥으로 부풀리며** 원점에 가장 가까운 면을 찾아 들어간다. 매 반복 그 면 방향으로 새 support 점을 얻어 다면체를 넓히고, 더 가까운 면이 안 나오면 멈춘다 — 그 면이 최소 관통 면이다.

코드에선 `GJKPenetration` 이 두 shape 이 `Epsilon` 안쪽으로 가까우면 EPA 경로로 넘어간다(`GJK.h:1420~` 주석). EPA 본체는 `InitializeEPA`(`EPA.h:155,319`)로 초기 다면체를 세우고 `ComputeEPAResults`(`:378`)로 관통 깊이·방향·양 표면점을 뽑으며, 성공/퇴화 여부를 `EEPAResult`(`:420`)로 보고한다. **GJK 가 "닿았나/얼마나 머나"라면, EPA 는 "얼마나 깊나/어디로 빼나"** 다.

단 EPA 가 관통을 구하는 *유일한* 길은 아니다. 겹친 경우의 관통 깊이·방향은 **EPA 또는 SAT(§5)** 로 구할 수 있고, 어느 쪽을 쓸지는 shape 쌍 경로·CVar 로 갈린다 — 일반 볼록-볼록은 EPA, 박스·convex-triangle 은 SAT 가 기본이다(`CollisionOneShotManifolds.cpp:143~159` 의 전략 선택 주석·`p.Chaos.Collision.UseConvexTriangleGJKSAT`). 즉 **GJK 는 항상 첫 관문(분리 판정 + 최근접 특징)이고, 겹쳤을 때 깊이를 EPA 로 파낼지 SAT 로 잴지가 갈린다.** 다음 절이 그 SAT 다.

---

## 5. SAT — EPA 대신 관통을 재고, 특징(면·모서리·꼭짓점)을 판별

§4 끝에서 말했듯 SAT 는 **EPA 의 대안 경로**다. 겹친 두 볼록의 관통 깊이·방향을 EPA 처럼 구하되, 접근이 다르고 부산물로 **접촉 특징 종류**(면-면인가 모서리-모서리인가)까지 바로 준다. 박스·convex-triangle 처럼 면이 평평한 경우 SAT 가 EPA 보다 안정적이라 기본 경로로 쓰인다.

**SAT**(Separating Axis Theorem, 분리축 정리)의 원리는 이름 그대로 — 두 볼록이 안 겹치면, 둘을 완전히 갈라놓는 축(평면)이 반드시 존재한다. 그 후보 축은 각 shape 의 면 법선들과 모서리 쌍의 외적들뿐이라, 그것만 훑으면 된다. 겹친 경우엔 "분리 축이 없다" 대신 **"가장 덜 겹치는 축"** 이 나오는데, 그게 곧 최소 관통 방향·깊이이자 어떤 특징끼리 닿았는지다. 함수는 `SATPenetration(...)`(`SAT.h:237`), 결과는 `FSATResult`(`:20`)에 `ESATFeatureType`(`:11`, Plane / Edge / Vertex)로 담긴다.

즉 관통을 구하는 두 갈래가 이렇게 갈린다 — **EPA**(다면체를 부풀려 최단 표면까지)와 **SAT**(면·모서리 축을 훑어 최소 겹침 축까지). 결과의 형태(깊이·방향)는 같고, SAT 는 특징 분류를 덤으로 준다.

이 특징 타입은 그냥 정보가 아니다. `EContactPointType`(§1)으로 이어져 **솔버가 접촉을 푸는 우선순위**가 된다 — 헤더 주석(`ContactPoint.h:8~`)에 명시돼 있듯 "Plane 접촉을 Edge 보다, Edge 를 Vertex 보다 먼저" 푼다. 면접촉이 가장 안정적이라 먼저 해소하는 게 수렴에 좋기 때문이다.

---

## 6. manifold 생성 — 한 점을 넷으로

여기서 §1 의 문제로 돌아온다. GJK+EPA/SAT 는 본질적으로 **하나의 접촉 방향(법선)과 가장 깊은 한 점**을 준다. 하지만 평평한 면접촉을 한 점으로 지탱하면 흔들린다. 그래서 narrow phase 는 그 방향을 축으로 **면 전체를 대표하는 최대 4점 manifold** 로 확장한다.

방법은 **면 클리핑(clipping)** 이다 — 앞 단계가 준 접촉 법선이 정해지면, 그 법선에 가장 맞서는(most-opposing) 면을 두 shape 에서 각각 고르고(C03 의 `FindMostOpposingFace`), 그 두 면을 서로 잘라내(clip) 겹치는 다각형을 구한 뒤, 코너들에서 접촉점을 뽑아 최대 4개로 추린다. 이걸 매 프레임 한 방에 만든다고 해서 **one-shot manifold** 라 부른다(삼각형 대상 버전은 `Collision/ConvexTriangleContactPoint.h` 등에 있다). 여기에 C05 의 warm start 가 다시 작동한다 — 지난 프레임 manifold 점을 이번 것과 매칭해 재사용하고(`FManifoldPoint` 의 `bWasRestored` 플래그), 물체가 거의 안 움직였으면 아예 통째로 복원한다(C05 §5 의 `TryRestoreManifold`).

즉 GJK/EPA/SAT 가 "방향과 깊이와 특징"을 주면, manifold 생성이 그걸 "면을 지탱하는 점들의 집합"으로 살을 붙인다. 이 manifold 가 constraint 에 저장되어 C07 로 넘어간다.

---

## 7. 비볼록 특수 처리 — mesh 와 ghost collision

지금까지는 볼록 대 볼록이었다. 하지만 지형·거대 레벨 mesh 는 볼록이 아니다(C03 §4). 삼각형 수프에는 GJK 를 통째로 못 쓴다 — 볼록이 아니니 Minkowski 발상이 깨진다. 그래서 **삼각형 하나하나를 볼록으로 보고** 접촉을 생성하는 전용 경로가 있다 — `FMeshContactGenerator`(`Collision/MeshContactGenerator.h:248`), `GenerateMeshContacts`(`:287`).

여기서 비볼록 특유의 고약한 문제가 튀어나온다 — **internal edge / ghost collision.** mesh 는 평평한 바닥이라도 삼각형 여러 개로 쪼개져 있어, 삼각형 *경계*를 지날 때 이웃 삼각형의 모서리에 걸려 엉뚱한 법선이 생긴다. 그러면 평평한 바닥 위를 미끄러지는 물체가 이음새마다 "턱"에 걸린 듯 튄다. `FMeshContactGenerator` 는 이걸 **`FixContactNormal`(모서리·꼭짓점 접촉의 법선을 실제 면 법선 쪽으로 교정)** 과 **back-face culling**(`BackFaceCullTolerance`, 안쪽에서 뚫고 나오는 가짜 접촉 제거)으로 잡는다(`MeshContactGenerator.h:19~39`). 삼각형이 수만 개이므로 one-pass/two-pass 최적화(`:287~295`)로 훑는다. **비볼록 충돌의 어려움 절반이 이 "가짜 접촉 청소"** 라고 봐도 된다.

---

## 8. margin 과 CCD — 두 개의 곁가지

두 가지를 접어둔다.

- **margin(C03 §5)이 여기서 값을 한다.** §3 에서 봤듯 GJK 는 core + thickness 로 동작해 뾰족한 모서리를 둥글려 수치 안정을 얻는다. margin 이 관통 깊이·접촉 위치에 어떻게 반영되는지는 이 챕터의 `GJKPenetration` thickness 인자에 이미 들어 있다.
- **빠른 물체는 swept(CCD) 경로.** 총알처럼 빠른 물체는 한 프레임에 벽을 통째로 건너뛰어(터널링) 정지-검사로는 접촉을 놓친다. 이를 위해 `UpdateConstraintSwept`(`CollisionResolution.h`)와 `GJKRaycast`(`GJK.h:1449`, shape 을 이동 경로 따라 쓸며 최초 충돌 시각을 찾음)가 있고, 켤지 말지는 `ShouldUseCCD`(속도·크기 기준)가 정한다. CCD 를 솔버가 어떻게 처리하는지는 C07.

---

## 9. C03·C05·C07 과의 접속

- **C03 으로**: GJK/EPA 는 오직 **support 함수**로만 돈다 — C03 §3 의 볼록 support 가 여기서 쓰인다. **margin**(C03 §5)은 GJK 의 thickness 인자다. mesh 비볼록성(C03 §4)이 §7 의 특수 경로를 강요한다.
- **C05 로**: mid phase 가 넘긴 shape 쌍마다 이 narrow phase 가 한 번 돈다. warm start(GJKSimplexData·manifold 재사용)의 그 저장값을 여기서 소비한다.
- **C07 로**: 산출물 manifold(Phi·normal·접촉점 최대 4개)가 충돌 솔버의 입력이다. `ContactType` 은 솔버의 해소 우선순위가 된다.

---

## 10. 결정론·성능 메모

- **반복 알고리즘의 수렴·epsilon 이 결정론 변수.** GJK/EPA 는 반복 수렴이라 `GJKIterationLimit`·`Epsilon`(`GJK.h:1428`) 같은 임계에 결과가 민감하다. 거의 닿은(almost-touching) 경우 법선이 튀지 않도록 epsilon 을 신중히 잡는다(주석 `GJK.h:1420~`).
- **SIMD 벡터화.** GJK 는 support 함수 포인터 기반으로 대량 특수화를 피하면서 `VectorRegister4Float` 로 벡터화돼 있다(`GJK.h:44~`). SIMD 합산 순서는 스칼라 경로와 비트가 갈릴 수 있다(C01·C04 와 같은 주의).
- **manifold 상한과 warm start.** 4점 상한(`Chaos_Collision_MaxManifoldPoints`)과 지난 프레임 점 재사용(`bWasRestored`)이 접촉 품질·성능·안정을 동시에 좌우한다. 재사용은 resim(C13)에서 상태 복원 대상이다.
- **mesh 접촉 청소 비용.** `FixContactNormal`·back-face cull·삼각형 순회가 비볼록 충돌 비용의 큰 몫이며, 관련 튜닝은 대부분 CVar(→ C17).

---

## 11. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **narrow phase 는 shape 쌍 종류별로 분기**(`UpdateConstraint`→`EContactShapesType`)해 접촉을 계산한다 — 단순 프리미티브는 해석적, 일반 볼록은 GJK/EPA, 비볼록 mesh 는 전용 generator. 둘째, **GJK 가 항상 첫 관문**(겹쳤나/얼마나 머나, Minkowski 차 + support 함수)이고, 겹쳤을 때 관통 깊이·방향은 **EPA(다면체 확장) 또는 SAT(분리축)** 중 shape 쌍 경로에 맞는 쪽으로 구한다(SAT 는 특징 종류도 덤으로 줌) — 그 법선을 축으로 **most-opposing 면을 클리핑해 최대 4점 manifold** 로 살붙인다. 셋째, **비볼록 mesh 는 삼각형 단위 + ghost collision 청소**(FixContactNormal·back-face cull)라는 별도 난제를 가지며, warm start·margin·CCD 가 이 단계를 관통한다.

다음은 **C07 — 충돌 구속·충돌 솔버** 다. narrow phase 가 만든 manifold(Phi·normal·접촉점)를 받아, **실제로 물체를 밀어내 겹침을 푸는** PBD 충돌 solver(마찰·반발 포함)를 본다. C06 이 "정확히 어떻게 닿았나를 *측정*"이었다면, C07 은 "그 겹침을 *해소*"다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| 접촉 표현 `TContactPoint`(Phi·normal·양 표면점·타입) | `Chaos/Public/Chaos/Collision/ContactPoint.h:41,15` |
| manifold 점 `FManifoldPoint`(최대 4, warm start 플래그) | `ContactPoint.h:96`; 상한 CVar `Collision/PBDCollisionConstraint.h:42` |
| narrow phase 진입 `Collisions::UpdateConstraint` | `Chaos/Public/Chaos/CollisionResolution.h`(UpdateConstraint) |
| shape쌍 종류 판별 `CalculateShapePairType`→`EContactShapesType` | `CollisionResolution.h`(CalculateShapePairType); `CollisionResolutionTypes.h:54` |
| GJK 진입 `GJKPenetration`(support 함수 기반, thickness=margin) | `Chaos/Public/Chaos/GJK.h:1428`; SIMD/support 포인터 `:44~` |
| GJK warm start simplex `TGJKSimplexData` | `GJK.h`(GJKPenetrationSameSpace2 인근, `:1074`대) |
| EPA(관통 깊이·방향) InitializeEPA/ComputeEPAResults/EEPAResult | `Chaos/Public/Chaos/EPA.h:155,319,378,420` |
| SAT = EPA 대안(관통+특징) `SATPenetration`/FSATResult/ESATFeatureType | `Chaos/Public/Chaos/SAT.h:237,20,11` |
| EPA vs SAT 경로 선택(convex-triangle 등) CVar | `Private/Chaos/CollisionOneShotManifolds.cpp:143~159`(`p.Chaos.Collision.UseConvexTriangleGJKSAT`) |
| manifold 클리핑용 most-opposing 면 | `Chaos/Public/Chaos/ImplicitObject.h`(FindMostOpposingFace, C03) |
| ContactType 우선순위(Plane>Edge>Vertex) | `Collision/ContactPoint.h:8~,15` |
| 비볼록 mesh generator + ghost collision 청소 | `Chaos/Public/Chaos/Collision/MeshContactGenerator.h:248,287`; FixContactNormal·cull `:19~39` |
| swept/CCD 경로 UpdateConstraintSwept·GJKRaycast·ShouldUseCCD | `CollisionResolution.h`(UpdateConstraintSwept/ShouldUseCCD); `GJK.h:1449` |
| deprecated stub `NarrowPhase.h`(TO BE REMOVED) | `Chaos/Public/Chaos/Collision/NarrowPhase.h` |
