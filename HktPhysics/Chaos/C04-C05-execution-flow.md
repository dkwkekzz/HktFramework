# C04–C05 실행 흐름 — 한 프레임의 충돌 검출 종단 추적

> **목적**: C04(spatial acceleration)와 C05(broad phase)에서 나눠 설명한 개념들을, *한 프레임의 실제 실행 순서*로 하나도 빠뜨리지 않고 이어붙인 배관도. 각 문서가 "무엇인가"를 설명했다면, 이 문서는 "언제 어떤 순서로 호출되는가"를 설명한다.
> **선행**: [C04 — spatial acceleration](./C04-spatial-acceleration.md), [C05 — broad phase](./C05-broad-phase.md). 용어·구조는 그쪽 참조.
> **범위**: 가속 구조 갱신 → broad phase → mid phase 배정 → narrow 실행·수집까지. narrow 내부(GJK)는 C06, 산출물 소비는 C07.

---

## 큰 그림 — 네 국면

한 프레임의 충돌 검출은 네 국면으로 돈다. 국면 ①은 broad phase가 돌기 *전에* 최신 구조가 준비돼 있도록 하는 사전 단계다.

```
① 구조 갱신(C04)  →  ② broad phase 질의(C05)  →  ③ mid phase 배정(C05)  →  ④ narrow 실행·수집(C05→C06)
```

---

## 국면 ① — 가속 구조를 최신으로 (C04, broad phase 이전)

물리 스레드가 질의하는 실제 구조는 `InternalAcceleration`(= `ISpatialAccelerationCollection`)이며, 접근자는 `GetSpatialAcceleration()`(`PBDRigidsEvolution.h:785`)이다. 매 프레임 두 갈래(증분 + 비동기 전체 재빌드)로 최신화한다.

1. **이동 → pending 큐 적재.** 적분으로 파티클이 움직이면(위치·`WorldSpaceInflatedBounds` 변화) 그 변경이 pending spatial data 큐(`FPendingSpatialDataQueue`)에 쌓인다. 추가·삭제·이동이 모두 엔트리로 들어간다.

2. **증분 반영 — `ComputeIntermediateSpatialAcceleration(bBlock)`**(`PBDRigidsEvolution.h:794`):
   - `FlushInternalAccelerationQueue()`(`:948`)가 pending 큐를 비우며 각 엔트리를 `ApplyParticlePendingData(...)`(`:1027`)로 현재 구조에 적용한다.
   - 적용은 C04 §4의 세 연산으로 내려간다 — 먼저 `NeedUpdateElement`(`ISpatialAcceleration.h:312`)가 "새 bounds가 기존 **inflated bounds**를 삐져나갔나"만 본다. 안 삐져나갔으면 **아무 일도 안 한다**(대부분의 프레임·대부분의 물체). 삐져나갔으면 `UpdateElement`/`RemoveElement`(`:317,306`)로 갱신하고, 그 원소는 본 트리를 헤집는 대신 **`DirtyElementTree`**(`AABBTree.h:3975`)로 간다. 어디를 고칠지는 역인덱스 `FAABBTreePayloadInfo`/`PayloadToInfo`(`:719,3988`)가 O(1)로 짚는다.

3. **전체 재빌드 — 비동기·time-slice.** dirty가 쌓이면 품질이 떨어지므로 별도 워커에서 구조를 처음부터 다시 짓는다. `FChaosAccelerationStructureTask`(`PBDRigidsEvolution.h:1039`)가 `DoTask`→`UpdateStructure`로 새 구조를 만들고, `ComputeIntermediateSpatialAcceleration`가 매 프레임 그 진행을 밀리초 예산 안에서 조금씩 굴린다(time-slicing). 완성되면 **`InternalAcceleration` ↔ Async 구조를 스왑**(double-buffer)한다. 짓는 동안에는 옛 구조로 계속 질의한다.

4. **bucket·global 유지.** 위 갱신은 Collection의 **bucket별**로 적용된다(정적 bucket은 거의 불변, 동적 bucket만 활발히 갱신 — C04 §5, 파티클 `MSpatialIdx`가 그 좌표). bounds 없는 무한 객체는 `GlobalPayloads`(`AABBTree.h:3987`)에 남아 모든 질의에 항상 포함된다.

이 국면이 끝나면 broad phase가 질의할 최신 구조가 준비된다.

---

## 국면 ② — broad phase: 겹치는 쌍 뽑기 (C05)

진입점: `FSpatialAccelerationCollisionDetector::DetectCollisions`(`SpatialAccelerationCollisionDetector.h`) → `RunBroadPhase` → `BroadPhase.ProduceOverlaps(...)`(`SpatialAccelerationBroadPhase.h:355`).

5. **구조 타입 디스패치.** `ProduceOverlaps`가 `InternalAcceleration`의 구체 타입을 `As<...>`로 판별해 분기(`:379~393`) — `AABBTree` / `BoundingVolume` / `AABBTreeBV`(C04 §3), 또는 `Collection`이면 `PBDComputeConstraintsLowLevel`이 **bucket마다** 이 함수를 다시 부른다. 가상 호출을 피하는 정적 분기.

6. **순회 대상 선택 — 움직이는 것만.** 하위 `ProduceOverlaps`(`:681`)는 정적 파티클을 순회하지 *않는다*. `GetNonDisabledDynamicView()`(깨어있는 동적+수면)와 `GetActiveDynamicMovingKinematicParticlesView()`(움직이는 kinematic) 중 **더 작은 쪽을 골라** 순회한다(`:696~709`). 정적 물체는 "질의 대상"으로 구조 안에만 있고 순회는 움직이는 쪽만 — 그래서 static-static 쌍은 아예 생기지 않는다.

7. **병렬 배치 분배.** `DispatchTasks`(`:734~`)가 순회 파티클을 배치로 쪼개 여러 `BroadphaseContexts`에 태스크로 뿌린다. 각 컨텍스트가 독립적으로 자기 배치를 처리한다.

8. **파티클 한 개 처리 — `ProduceParticleOverlaps<bOnlyRigid>`.** 상태 판정(kinematic / dynamic-awake / dynamic-asleep, `:805~814`), `bHasValidState` 아니면 건너뜀. 유효하면:
   - 질의 상자 `Box1 = Particle1->WorldSpaceInflatedBounds()`(`:835`) — C02의 그 열, C04 §4의 부풀린 bounds.
   - `InSpatialAcceleration.Overlap(Box1, OverlapVisitor)`(`:840`) — C04의 visitor 질의.

9. **visitor 필터 계단 — `FSimOverlapVisitor`.** 구조가 후보를 하나씩 흘려보내면 싼 순서대로 거른다:
   - `ShouldIgnore`(`:285`): `Payload.UniqueIdx() == ParticleUniqueIdx`면 self → 버림.
   - `PrePreFilter`(`:300`) → `PrePreSimFilter(SimFilterData)`: collision **filter data**(채널·마스크, 게임 규칙)로 조기 컷.
   - 통과하면 `VisitOverlap`(`:259`)이 `Context.Overlaps.Emplace(Particle1, Particle2, 0)`으로 쌓는다.

끝나면 각 컨텍스트의 `Overlaps` 배열에 "AABB가 겹친 파티클 쌍" 후보가 모인다(아직 mid phase 아님).

---

## 국면 ③ — mid phase 배정 (C05)

10. **오버랩 태스크 완료 대기 → `AssignMidPhases`**(`:908`, 컨텍스트별 병렬). 각 overlap에 대해:
    - `Overlap.ApplyFilter(IgnoreCollisionManager, bNeedsResim)`(`:924`): 충돌 허용 재확인 — **여기서 파티클 순서가 swap되기도** 한다(대칭 쌍 A–B/B–A를 한 방향으로 정규화).
    - `bCollisionsEnabled` 아니면 버림. one-way interaction 쌍(양쪽 다 one-way)도 버림(`:930~937`).
    - 살아남으면 **`ContextAllocator->GetMidPhase(P0, P1, SearchParticle, Context)`**(`:940`) — 파티클 쌍을 키로 **기존 mid phase를 재사용하거나 없으면 생성**. C05 §5 persistence 지점: 같은 객체가 돌아오므로 그 안의 constraint에 저장된 지난 프레임 상태 — 총 impulse `AccumulatedImpulse`(`Collision/PBDCollisionConstraint.h:762,826`), 접촉점 `SavedManifoldPoints`(`:727~739`), GJK simplex `GJKWarmStartData`(`:702`) — 가 살아 돌아온다. 이 값들이 국면④의 GJK·솔버 **warm start** 초기값이 된다(새 객체였다면 전부 0으로 초기화 → warm start 불가).
    - `Context.MidPhases`에 저장.

11. `CheckOverlapResults`(비쉬핑 검증), 통계 집계(`NumBroadPhasePairs`, `NumMidPhases`, `:429~437`).

---

## 국면 ④ — narrow 실행·결정론적 수집 (C05→C06 경계)

`RunNarrowPhase`(`SpatialAccelerationCollisionDetector.h`) 안에서:

12. **부하 재분배 → `ProduceCollisions(Dt)`**(`SpatialAccelerationBroadPhase.h:438`). 먼저 `RedistributeMidPhasesInContexts`로 컨텍스트 간 mid phase 수를 고르게 재분배(한 스레드 쏠림 방지). 그 뒤 컨텍스트별 `ProcessMidPhases` 태스크(`:951`, prefetch 포함)를 띄운다.

13. **mid phase 하나 처리 — 복합체를 복잡도별로 특수 처리해 몸쌍 → shape쌍 → narrow.** 각 `FParticlePairMidPhase`가:
    - `CalculateMidPhaseType`(`ParticlePairMidPhase.h:194`)로 **몸의 복잡도에 맞는 전략**을 고른다 — `ShapePair`(shape 소수: 충돌 가능 shape쌍을 미리 전부 펼침) / `Generic`(거대 mesh·BVH·Union of Unions: 내장 BVH로 겹치는 부분만 그때그때 좁힘) / `SphereApproximation`(구 근사)(`:29~42`).
    - 파티클 A의 shape들 × B의 shape들 중 bounds 겹치는 조합만 골라 `FSingleShapePairCollisionDetector`(`:49`)에 넘긴다.
    - `GenerateCollisions`(`:276`)가 각 shape쌍에 **narrow phase(GJK/EPA/SAT, C06)**를 돌려 접촉을 생성. persistence 덕에 지난 프레임 manifold를 warm start로 재사용.

14. **결정론적 수집 → `GatherConstraints(bIsDeterministic)`**(`SpatialAccelerationBroadPhase.h:470`). 컨텍스트별로 흩어진 결과를 모으는데, 병렬 수집(`:477~639` multi-context merge)은 순서가 비결정적이므로 **결정론 플래그가 켜지면 안정 정렬**로 순서를 못박는다(C04 §7·C05 §6, → C13).

15. **마감.** `EndDetectCollisions()`로 컨테이너를 닫고, resim이면 `ResimCache`에 접촉을 저장/복원(`SpatialAccelerationCollisionDetector.h`의 `ResimCache` 분기).

최종 산출물은 `FPBDCollisionConstraints` — 다음 단계 **C07(충돌 솔버)**의 입력이다.

---

## 한눈 요약 — 데이터 변환 사슬

```
이동한 파티클 → pending 큐
      │ FlushInternalAccelerationQueue → NeedUpdate?→Update/Remove → DirtyElementTree
      │   (+ async 전체 재빌드 time-slice → 완성 시 swap)
      ▼
최신 InternalAcceleration (bucket별, GlobalPayloads 포함)
      │ ProduceOverlaps: (움직이는 파티클) → WorldSpaceInflatedBounds → Overlap(visitor)
      │   visitor 필터: self(UniqueIdx) → filter data → Emplace
      ▼
Overlaps[] (겹친 파티클 쌍 후보)
      │ AssignMidPhases: ApplyFilter(순서 정규화) → GetMidPhase(재사용/생성)
      ▼
MidPhases[] (수명 있는 객체, persistence)
      │ ProduceCollisions: 재분배 → 몸쌍→shape쌍 전개 → GJK(C06) → 접촉 생성
      │ GatherConstraints: 결정론 정렬
      ▼
FPBDCollisionConstraints  → C07
```

**핵심 관문 셋**만 기억하면 흐름이 잡힌다:
- **inflated bounds** — 국면①에서 "갱신할지 말지"를 가르고(NeedUpdateElement), 국면②에서 "질의 상자"가 된다.
- **visitor 필터 계단** — self(UniqueIdx) → filter data 로 후보를 조기에 쳐낸다.
- **mid phase persistence** — 국면③의 `GetMidPhase` 재사용이 국면④의 warm start를 만든다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 단계 | 앵커 |
|---|---|
| 현재 구조 접근자 `GetSpatialAcceleration`(InternalAcceleration) | `Chaos/Public/Chaos/PBDRigidsEvolution.h:785` |
| 증분 갱신 틱 `ComputeIntermediateSpatialAcceleration` | `PBDRigidsEvolution.h:794` |
| pending 큐 flush → 구조 적용 | `PBDRigidsEvolution.h:948`(FlushInternalAccelerationQueue), `:1027`(ApplyParticlePendingData) |
| NeedUpdate/Update/Remove(3연산) | `ISpatialAcceleration.h:312,317,306` |
| dirty tree / 역인덱스 / global | `AABBTree.h:3975,719,3988,3987` |
| 비동기 전체 재빌드 태스크(time-slice·swap) | `PBDRigidsEvolution.h:1039`(FChaosAccelerationStructureTask) |
| broad phase 진입 `ProduceOverlaps` | `Collision/SpatialAccelerationBroadPhase.h:355` |
| 구조 타입 디스패치(AABBTree/BV/AABBTreeBV/Collection) | `SpatialAccelerationBroadPhase.h:379~393` |
| 순회 대상(동적/움직이는 kinematic view) | `SpatialAccelerationBroadPhase.h:681,696~709` |
| 병렬 배치 분배 DispatchTasks | `SpatialAccelerationBroadPhase.h:734~` |
| 파티클별 질의(inflated bounds + Overlap) | `SpatialAccelerationBroadPhase.h:835,840` |
| visitor 필터(self / PrePreFilter / VisitOverlap) | `SpatialAccelerationBroadPhase.h:285,300,259` |
| mid phase 배정(ApplyFilter → GetMidPhase) | `SpatialAccelerationBroadPhase.h:908,924,940` |
| narrow 실행 ProduceCollisions(재분배·ProcessMidPhases) | `SpatialAccelerationBroadPhase.h:438,951` |
| mid phase 종류·전개·생성 | `Collision/ParticlePairMidPhase.h:194,29~42,49,276` |
| 결정론 수집 GatherConstraints + merge | `SpatialAccelerationBroadPhase.h:470,477~639` |
| detector 두 단계(RunBroadPhase/RunNarrowPhase) + resim | `Collision/SpatialAccelerationCollisionDetector.h` |
