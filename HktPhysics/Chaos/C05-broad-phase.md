# C05 — broad phase (잠재 충돌 쌍 추리기)

> **이 챕터가 답하는 질문**: C04 가 AABB 들을 담는 *그릇*(공간 가속 구조)을 놓았다. 이제 그 그릇을 실제로 *흔들어* "겹칠 가능성이 있는 쌍"을 쏟아내야 한다. 어떻게 각 물체를 질의해 후보 쌍을 뽑고, 안 부딪힐 쌍을 싸게 걸러내며, 그 결과를 정밀 검사(narrow phase)로 넘기는가?
> **대응 Concepts**: [04 — 충돌 검출](../Concepts/04-collision-detection.md)
> **선행 챕터**: [C04 — spatial acceleration](./C04-spatial-acceleration.md) (Overlap 질의·visitor·inflated bounds), [C02](./C02-particle-rigid-body.md) (`WorldSpaceInflatedBounds`·`HasCollision`), [C03](./C03-implicit-geometry.md) (Union of shapes)

---

## 왜 이 챕터를 여섯 번째로 읽는가

C04 는 "AABB 들을 담고 질의하는 자료구조"를 만들었지만, 그것을 *굴리지는* 않았다. C05 는 그 구조를 실제로 돌려 잠재 충돌 쌍을 뽑는 **broad phase 단계**다. C04 가 그릇이라면 C05 는 그 그릇을 흔들어 쌍을 쏟는 손이다.

그런데 여기서 대부분의 물리 교과서와 다른 점이 하나 나온다 — 교과서는 broad phase → narrow phase 두 단계지만, **Chaos 는 broad → mid → narrow 세 단계**다(§4). 이유는 C03 에 있다: 강체 하나가 여러 shape 의 Union 일 수 있어서, "몸 대 몸"(broad)과 "shape 대 shape"(narrow) 사이를 잇는 중간 층이 필요하다. 이 mid phase 가 C05 의 숨은 주인공이고, 접촉을 프레임 너머로 나르는 지속성(persistence)의 자리(§5)이기도 하다.

이 챕터가 답하는 것은 결국 세 가지다 — 어떻게 후보를 *질의*하고(§2), 안 부딪힐 쌍을 어떻게 *거르며*(§3), 살아남은 쌍을 어떤 형태로 narrow phase 에 *넘기는가*(§4~6).

> **참고: 죽은 헤더에 속지 말 것.** README 가 든 `ParticlePairBroadPhase.h` 는 실제로는 `// TO BE REMOVED` 한 줄만 남은 폐기 파일이다. 살아있는 broad phase 는 `FSpatialAccelerationBroadPhase`(가속 구조 기반, 프로덕션 경로)와 `FBasicBroadPhase`(주어진 쌍 목록을 그냥 훑는 단순판) 둘이다. 이 챕터는 전자를 따라간다.

---

## 1. 파이프라인 전체 지도 — Detector 가 축이다

broad phase 는 홀로 돌지 않는다. 그것을 감싸 narrow phase 까지 이어주는 조율자가 `FCollisionDetector`(`Collision/CollisionDetector.h`)다. 이 추상 클래스의 핵심은 두 가지다 — 순수 가상 `DetectCollisions(Dt, ResimCache)`, 그리고 그것이 결과를 쏟아 넣는 `FPBDCollisionConstraints& CollisionContainer`(충돌 구속 컨테이너, C07 의 주제).

프로덕션 구현 `FSpatialAccelerationCollisionDetector`(`SpatialAccelerationCollisionDetector.h`)를 보면 한 프레임의 충돌 검출이 **두 단계로 쪼개져** 있다:

```cpp
void DetectCollisions(Dt, ResimCache) {
    RunBroadPhase(Dt, ResimCache);    // 겹치는 쌍마다 mid phase 객체 생성
    RunNarrowPhase(Dt, ResimCache);   // 각 mid phase 가 실제 접촉 생성 → 수집
}
```

- **`RunBroadPhase`** → `BroadPhase.ProduceOverlaps(...)`. 가속 구조를 질의해 **겹치는 파티클 쌍마다 mid phase 객체를 하나씩** 만든다(또는 재사용, §5).
- **`RunNarrowPhase`** → `BroadPhase.ProduceCollisions(Dt)` 로 각 mid phase 가 실제 접촉을 생성하고, `GatherConstraints(...)` 로 그것을 결정론적 순서로 컨테이너에 수집한다.

즉 C05 의 무대는 `RunBroadPhase` 이고, C06(narrow phase)의 무대는 `RunNarrowPhase` 안에서 mid phase 가 부르는 GJK 다. 산출물은 언제나 하나 — C07 이 소비할 `FPBDCollisionConstraints`.

---

## 2. broad phase 의 한 걸음 — inflated AABB 로 가속 구조를 질의

`FSpatialAccelerationBroadPhase`(`SpatialAccelerationBroadPhase.h:334`)가 하는 일의 골자는 단순하다. **각 파티클마다, 그 파티클의 부풀린 AABB 로 가속 구조에 "이 상자와 겹치는 게 누구냐"를 묻는다.**

```cpp
const FAABB3 Box1 = Particle1->WorldSpaceInflatedBounds();   // :835 — C02 의 그 열
InSpatialAcceleration.Overlap(Box1, OverlapVisitor);         // :840 — C04 의 그 질의
```

두 줄에 C02·C04 가 맞물린다. `WorldSpaceInflatedBounds()` 는 C02 §3 에서 파티클이 들고 있던 *부풀린* 바운드 열이고(§왜 부풀렸나는 C04 §4 의 inflated bounds), `Overlap(...)` 은 C04 의 공간 구조 질의다. 질의는 결과를 배열로 받지 않고 **visitor** 에 흘려보낸다(C04 §2 의 그 패턴) — `FSimOverlapVisitor::VisitOverlap`(`:259`)이 겹치는 후보를 하나씩 받아 목록에 쌓는다.

`ProduceOverlaps` 는 가속 구조의 *구체 타입*에 따라 분기한다 — `AABBTree` 냐 `BoundingVolume` 이냐 `AABBTreeBV` 냐(`:381,385,389`, C04 §3 의 세 구현). 폴리모픽 인터페이스지만, 뜨거운 경로라 타입별로 특수화해 가상 호출 오버헤드를 피한다.

한 걸음을 요약하면: **파티클 → 그 부풀린 AABB → 가속 구조 Overlap 질의 → visitor 가 겹치는 후보들을 수집.** 이걸 모든 (움직이는) 파티클에 대해 돌리면 "겹치는 AABB 쌍"의 전체 목록이 나온다.

---

## 3. 세 겹의 필터 — 싼 것부터 쳐낸다

AABB 가 겹친다고 다 충돌 후보는 아니다. broad phase 는 narrow phase 로 넘기기 전에 여러 겹의 싼 필터로 쓸데없는 쌍을 쳐낸다. `FSimOverlapVisitor` 안에서 순서가 보인다.

**(1) `HasCollision` — 충돌이 꺼진 물체.** `FBasicBroadPhase` 의 경로에서 명시적으로 보듯(`BasicBroadPhase.h`), 한쪽이라도 충돌 비활성이면 즉시 반환한다. 가장 싼 컷.

**(2) `ShouldIgnore` — 자기 자신.** `Instance.Payload.UniqueIdx() == ParticleUniqueIdx`(`SpatialAccelerationBroadPhase.h:285`)면 건너뛴다. 파티클은 자기 AABB 에 자기가 걸리므로, `UniqueIdx`(C02 의 그 영구 ID) 비교로 self-overlap 을 가장 이른 시점에 쳐낸다.

**(3) `PrePreFilter` — 게임이 정한 충돌 규칙.** `PrePreSimFilter(SimFilterData)`(`:300~`)로 **collision filter data**(채널·마스크)를 본다. "플레이어와 카메라는 안 부딪힘" 같은 게임플레이 규칙이 여기서 걸러진다. 이름이 `PrePre` 인 건, narrow phase 의 정밀 필터보다도 앞선 *가장 이른* 컷이라는 뜻이다.

이 순서(HasCollision → self → filter)는 우연이 아니다 — **가장 싸고 가장 많이 걸러내는 것부터** 둔다. 그래야 뒤쪽의 비싼 검사에 도달하는 쌍이 최소가 된다. broad phase 의 존재 이유(N² 회피) 그 자체가 이 필터 계단에 압축돼 있다.

> 대칭 쌍(A–B 와 B–A)은 같은 충돌이므로 한 번만 처리해야 한다. 각 파티클이 자기 AABB 로 질의하면 한 쌍이 양쪽에서 두 번 잡히는데, `SearchParticle`/`UniqueIdx` 규칙으로 한쪽만 살린다(중복 mid phase 생성 방지).

---

## 4. 왜 mid phase 가 끼는가 — 복합체(여러 shape인 몸)를 복잡도별로 특수 처리

여기가 Chaos 가 2단계가 아니라 3단계인 이유다. 근본 문제는 **세 단계가 다루는 단위가 다르다**는 데 있다. broad phase 는 **몸(body) 단위**로 본다 — 물체 하나를 상자 하나로 감싸 "이 상자와 저 상자가 겹치나"만 묻는다. narrow phase(GJK)는 정반대로 **shape 하나 대 shape 하나**만 비교할 줄 안다. 그런데 C03 에서 봤듯 한 몸의 geometry 는 여러 shape 의 **Union** 일 수 있다(자동차 = 차체 + 바퀴 4개…). 그래서 broad 가 "**몸** A 와 **몸** B 의 바운드가 겹친다"고 해도 narrow 에 곧장 못 넘긴다 — narrow 는 "몸"을 모르고 "shape"만 아니까, *어느 shape 과 어느 shape 을 볼지* 누군가 골라줘야 한다. 이 간극 — 몸쌍(particle pair) ↔ shape쌍(shape pair) — 을 메우는 게 **mid phase** 다.

**왜 broad 나 narrow 에서 그냥 안 하나?** broad 에서 하려면 모든 shape 을 공간 구조(C04)에 낱개로 넣어야 하는데, 몸당 shape 이 여럿이면 원소 수가 폭발해 구조 갱신이 감당 안 된다 — 그래서 broad 는 일부러 몸당 상자 하나만 넣어 가볍게 굴린다. narrow 는 두 shape 비교 말고는 아무것도 관리하지 않는다. 그 사이의 관리자 자리가 비어 있어, mid phase 가 그것을 채운다. 비유하면 broad 는 "두 사람이 부딪힐 만큼 가깝다", mid 는 "그럼 A의 손과 B의 어깨처럼 실제로 가까운 부위끼리만 검사하자", narrow 는 "그 손이 정확히 닿았나·얼마나 깊이"다.

겹치는 파티클 쌍마다 `FParticlePairMidPhase`(`ParticlePairMidPhase.h:191`)가 하나 배정된다. 그 임무는 **몸쌍을 실제 충돌할 수 있는 shape 쌍들로 전개**하는 것 — 파티클 A 의 shape m개 × B 의 shape n개 중 바운드가 겹치는 조합만 골라 narrow phase 검출기(`FSingleShapePairCollisionDetector`, `:49`)에 넘긴다.

**여기가 이 단계의 핵심이다.** "몸이 얼마나 복잡한가"는 천차만별이다 — shape 하나짜리 단순한 공일 수도, 자동차처럼 shape 대여섯 개일 수도, 수만 삼각형짜리 지형 mesh 일 수도 있다. 이 복잡도에 따라 shape 쌍을 뽑는 최선의 방법이 완전히 다르다. **mid phase 는 복합체(compound, 여러 shape 로 이뤄진 몸)를 그 복잡도에 맞는 방식으로 특수 처리한다** — `EParticlePairMidPhaseType`(`ParticlePairMidPhase.h:29~42`)이 세 갈래로 갈리는 이유가 이것이다:

- **`ShapePair`** — shape 가 소수인 흔한 몸(공·상자·자동차 등). 충돌 가능한 shape 쌍을 **미리 전부 펼쳐** 캐시한다. 조합이 적으니 통째로 전개하는 게 가장 빠르다.
- **`Generic`** — 한쪽이 거대한 mesh·BVH·Union of Unions 인 복잡한 계층. shape(삼각형)이 수만 개라 미리 다 펼칠 수 없어, C03 의 **내장 BVH 로 겹치는 부분만 그때그때 훑어** 좁힌다.
- **`SphereApproximation`** — 정밀 shape 대신 구 근사로 싸게 처리하는 경로.

즉 broad 가 "몸 A ~ 몸 B 근접"만 거칠게 알려주면, mid phase 가 **그 몸의 복잡도를 보고 알맞은 방식으로 shape 쌍을 골라** C06 의 GJK 에 넘긴다. 이 '복합체를 복잡도별로 특수 처리'가, 대부분 엔진이 2단계인데 Chaos 가 mid phase 를 별도 단계로 두는 진짜 이유다.

---

## 5. 지속성(persistence) — 프레임을 가로지르는 mid phase

mid phase 의 진짜 값어치는 전개만이 아니다. **프레임을 가로질러 살아남아 접촉 정보를 나른다**는 데 있다.

broad phase 는 매 프레임 겹치는 쌍을 새로 뽑지만, 같은 두 물체가 여러 프레임 붙어 있으면 그 mid phase 객체는 *재사용*된다 — 검출기가 새로 만들지 않고 allocator 에서 파티클 쌍을 키로 기존 것을 찾아 돌려준다(`GetMidPhase(ParticleA, ParticleB, …)`). 덕분에 지난 프레임의 상태가 살아남아 **warm start**(지난 프레임의 해를 이번 반복의 출발점으로 재사용하는 것)에 쓰인다.

**무엇이 저장되어 warm start 가 되는가.** mid phase 안의 충돌 constraint(`FPBDCollisionConstraint`)가 프레임을 넘겨 세 가지 기억을 이월한다:

- **`AccumulatedImpulse`** — 지난 프레임 이 접촉을 붙잡는 데 실제로 준 총 impulse(`Collision/PBDCollisionConstraint.h:762,826`). 솔버(C07)가 이 값에서 반복을 시작한다.
- **`SavedManifoldPoints`** — 지난 프레임의 접촉점 다양체(manifold — 두 shape 가 닿은 접점들의 집합)(`:727~739`).
- **`GJKWarmStartData`** — GJK 가 멈춘 위치(simplex)(`:702`). narrow phase(C06)의 GJK 가 여기서 다시 출발한다.

게다가 물체가 거의 안 움직였으면 `TryRestoreManifold`(`:696`)로 접촉을 새로 계산하지 않고 지난 것을 그대로 복원하기까지 한다. 요점은 이것이다 — 만약 `GetMidPhase` 가 매 프레임 새 객체를 준다면 이 값들이 전부 0으로 초기화되어 **warm start 자체가 불가능**해진다. 그래서 솔버(C07·C11)가 매번 0(cold start)이 아니라 지난 해에서 시작해 훨씬 적은 반복으로 안정적으로 수렴하는 것은, 순전히 이 **객체 재사용(persistence)이 그 기억을 살려두기 때문**이다. 재사용이 곧 기억의 생명줄이고, 그 기억이 warm start 를 만든다.

정리하면 **broad 단계가 직접 만드는 것**과 **파이프라인 전체가 내놓는 것**이 다르다. C05 가 직접 만드는 것은 이 mid phase 객체들 — 매 프레임 버려지지 않고, 같은 두 물체가 붙어 있는 한 계속 재사용되는 것들 — 이고, 그것을 narrow(C06)까지 굴려 최종적으로 나오는 것이 §1 의 `FPBDCollisionConstraints`(C07 입력)다. 이 '버리지 않고 재사용한다'는 점 하나가 broad phase 를 단순한 쌍 뽑기 이상으로 만든다 — 그 재사용이 warm start 를 통해 시뮬레이션 안정성을 떠받치기 때문이다. (접촉점을 실제로 어떻게 재사용·갱신하는지는 C06·C07 에서.)

---

## 6. narrow phase 로 넘기기 — 생성과 결정론적 수집

broad phase 가 mid phase 들을 준비하면, 그 뒤처리는 엄밀히는 `RunNarrowPhase` 단계에 속한다(§1 의 두 번째 함수). 하지만 "broad 가 뽑은 것을 어떻게 매듭짓는가"를 한자리에서 보는 게 낫기에 여기서 짚는다. `RunNarrowPhase` 는 두 동작으로 마무리한다:

- **`ProduceCollisions(Dt)`**(`SpatialAccelerationBroadPhase.h:438`) — 각 mid phase 가 자기 shape 쌍들에 대해 실제 narrow phase(GJK/manifold, C06)를 돌려 접촉을 생성한다.
- **`GatherConstraints(bIsDeterministic)`**(`:470`) — 생성된 충돌 구속을 컨테이너에 수집한다. 이때 **결정론 플래그가 켜지면 정렬**해 순서를 고정한다.

정렬이 필요한 이유는 병렬성 때문이다. broad phase 는 여러 워커에서 **컨텍스트별 allocator**로 병렬 수행되고(`:477~639` 의 다중 컨텍스트 merge/sort), 각 워커가 쌍을 잡는 순서는 실행마다 다르다. 그대로 두면 솔버가 구속을 푸는 순서가 비결정적이 되어(부동소수점 합산 순서가 바뀜) 리플레이·네트워크 재현이 깨진다. 그래서 수집 단계에서 안정 정렬로 순서를 못박는다 — C04 §7 의 결정론 주의가 여기서 구체적 코드가 된다(→ C13).

---

## 7. C04·C02·C03·다음 챕터와의 접속

- **C04 로**: broad phase 는 C04 의 가속 구조를 `Overlap` visitor 질의로 굴린다. 타입별 분기(AABBTree/BV/AABBTreeBV)도 C04 §3 그대로다. C04 가 "도구", C05 가 "사용".
- **C02 로**: 질의 상자는 파티클의 `WorldSpaceInflatedBounds`, self-컷은 `UniqueIdx` — 둘 다 C02 에서 미뤄둔 열의 실사용처다.
- **C03 으로**: mid phase 가 파티클을 shape 로 전개할 때 다루는 대상이 C03 의 Union·trimesh·BVH 다.
- **C06·C07 으로**: mid phase 가 부르는 shape쌍 정밀 검사가 **C06(narrow phase)**, 그 산출물 `FPBDCollisionConstraints` 를 푸는 게 **C07(충돌 솔버)**. C05 는 그 사이 배관이다.

---

## 8. 결정론·스레딩·성능 메모

- **병렬 broad phase → merge/sort 로 결정론 회복.** 컨텍스트별 병렬 수집(`:477~639`)은 빠르지만 순서가 비결정적이다. `GatherConstraints` 의 정렬이 이를 되돌린다. 결정론이 꺼지면 정렬을 건너뛰어 더 빠르다(트레이드오프).
- **persistence 가 재현성의 양날.** mid phase 재사용은 warm start 로 성능·안정을 주지만, "지난 프레임 상태"에 의존하므로 resim(C13)에서는 그 상태를 정확히 복원·저장해야 한다(`RunNarrowPhase` 의 `ResimCache` 분기가 그 저장/복원 지점).
- **필터 계단이 성능의 핵심.** HasCollision → self → filter data 순의 조기 컷이 narrow phase 부담을 결정한다. 필터가 헐거우면 GJK 호출이 폭증한다.
- **inflated 여유의 대가.** C04 에서 봤듯 바운드를 크게 부풀리면 재삽입은 줄지만 broad phase 후보 쌍이 늘어 mid/narrow 비용이 는다. 그 균형점이 broad phase 처리량을 좌우한다.

---

## 9. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **broad phase 는 각 파티클의 부풀린 AABB 로 C04 가속 구조를 Overlap 질의해 겹치는 쌍을 뽑고**, HasCollision → self(UniqueIdx) → filter data 의 싼 필터 계단으로 쓸데없는 쌍을 쳐낸다. 둘째, **Chaos 는 broad→mid→narrow 3단계**이며, mid phase 가 **복합체(여러 shape 인 몸)를 복잡도별로 특수 처리**해 "몸쌍"을 "shape쌍"으로 전개한다(소수 shape 면 `ShapePair` 로 미리 다 펼치고, 거대 mesh 면 `Generic` 으로 내장 BVH 로 좁힘). 또 그 mid phase 객체가 **프레임을 넘겨 재사용되어 warm start** 를 가능하게 한다. 셋째, **산출물은 `FPBDCollisionConstraints`** 이며, 병렬 수집 후 결정론 정렬로 순서를 못박아 narrow phase(C06)·솔버(C07)로 넘긴다.

다음은 **C06 — narrow phase** 다. mid phase 가 넘긴 각 shape 쌍에 대해, 실제로 겹쳤는지·얼마나·어디서를 계산하는 GJK/EPA/SAT 와 contact manifold 생성을 본다. C05 가 "누구와 누가 부딪힐 수 있나"였다면, C06 은 "그 둘이 정확히 어떻게 닿았나"다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| 조율자 `FCollisionDetector`(DetectCollisions + CollisionContainer) | `Chaos/Public/Chaos/Collision/CollisionDetector.h` |
| 프로덕션 detector = broad + narrow 두 단계 | `Chaos/Public/Chaos/Collision/SpatialAccelerationCollisionDetector.h`(RunBroadPhase/RunNarrowPhase/DetectCollisions) |
| broad phase 본체 클래스 | `Chaos/Public/Chaos/Collision/SpatialAccelerationBroadPhase.h:334` |
| 파티클마다 inflated AABB 로 Overlap 질의(visitor) | `SpatialAccelerationBroadPhase.h:835,840,259` |
| 가속 구조 타입별 분기(AABBTree/BV/AABBTreeBV) | `SpatialAccelerationBroadPhase.h:381,385,389` |
| 필터: self-컷(UniqueIdx) ShouldIgnore | `SpatialAccelerationBroadPhase.h:285` |
| 필터: collision filter data PrePreFilter/PrePreSimFilter | `SpatialAccelerationBroadPhase.h:300~` |
| 필터: HasCollision 조기 반환 | `Chaos/Public/Chaos/Collision/BasicBroadPhase.h`(ProduceOverlaps) |
| mid phase = 복합체를 복잡도별 특수 처리(몸쌍 → shape쌍 전개), 재사용 객체 | `Chaos/Public/Chaos/Collision/ParticlePairMidPhase.h:191` |
| mid phase 3종(Generic/ShapePair/SphereApproximation) | `ParticlePairMidPhase.h:29~42` |
| shape쌍 narrow 검출기 | `ParticlePairMidPhase.h:49`(FSingleShapePairCollisionDetector) |
| mid phase 재사용(persistence, GetMidPhase 키=파티클쌍) | `BasicBroadPhase.h`(GetMidPhase); `SpatialAccelerationBroadPhase.h:940` |
| warm start 로 이월되는 상태(impulse·manifold·GJK simplex·복원) | `Collision/PBDCollisionConstraint.h:762,826`(AccumulatedImpulse), `:727~739`(SavedManifoldPoints), `:702`(GJKWarmStartData), `:696`(TryRestoreManifold) |
| narrow 실행 + 결정론 수집 | `SpatialAccelerationBroadPhase.h:438`(ProduceCollisions), `:470`(GatherConstraints) |
| 병렬 컨텍스트 merge/sort | `SpatialAccelerationBroadPhase.h:477~639` |
| 산출물 컨테이너 `FPBDCollisionConstraints`(→C07) | `Chaos/Public/Chaos/Collision/CollisionDetector.h`(CollisionContainer) |
| 폐기된 `ParticlePairBroadPhase.h`(TO BE REMOVED) | `Chaos/Public/Chaos/Collision/ParticlePairBroadPhase.h` |
