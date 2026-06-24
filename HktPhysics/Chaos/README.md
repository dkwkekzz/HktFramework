# Unreal Chaos 코드 분석 지도 (Chaos)

> **목적**: 언리얼 내장 물리 엔진 **Chaos** 를, "모든 것을 안다"고 말할 수 있을 만큼 **소스 코드 레벨**에서 깊이 이해한다.
> 옆 폴더 [`../Concepts/`](../Concepts/README.md) 가 *이론(무엇을 풀어야 하는가)* 지도라면, 이 폴더는 *구현(산업 엔진은 그 이론을 실제로 어떻게 풀었는가)* 지도다.
> **읽기 전 이 지도에서 위치 · 의존 · 대응 이론을 먼저 확인할 것.**

---

## 0. 분석 베이스라인 (고정)

| 항목 | 값 |
|---|---|
| 엔진 | **UE 5.7** (`HktProto.uproject` EngineAssociation `5.7`) |
| 엔진 루트 | `E:\WS\UE_5.7\Engine` |
| 핵심 모듈 | `Source/Runtime/Experimental/Chaos` — **792 파일** (시뮬레이션 본체) |
| 기반 모듈 | `Source/Runtime/Experimental/ChaosCore` — 38 파일 (수학·핵심 타입·로깅) |
| 엔진 연동 | `Source/Runtime/Experimental/ChaosSolverEngine` — 25 파일 (Solver Actor/Component) |
| GT 브리지 | `Source/Runtime/PhysicsCore/Public/Chaos` — 게임 스레드 ↔ 물리 스레드 인터페이스 |

> 분석 문서는 **버전을 고정**한다. 5.7 기준 파일·라인이 후속 버전에서 바뀌면, 옮기지 말고 새 버전 노트를 추가한다 (Chaos 는 Experimental 이라 API 변동이 잦다).

---

## 1. 분석 원칙 (어떻게 쓰는가)

1. **실물 코드가 권위다.** 모든 주장은 `파일:라인` 으로 앵커링한다. 추측·기억 금지 — 열어서 읽고 인용한다.
2. **이론 → 구현 대응을 명시한다.** 각 챕터는 대응하는 `Concepts/NN-*` 문서를 머리에 링크하고, "이론에선 X 라 부르는 것을 Chaos 는 `클래스Y` 로 구현했다" 를 1:1 로 적는다.
3. **데이터 흐름을 추적한다.** 정적 클래스 나열이 아니라, **한 프레임의 물리 스텝이 코드를 어떻게 통과하는가**(advance → integrate → detect → solve → commit)를 따라가며 읽는다.
4. **결정론·스레딩 메모는 항상 남긴다** — Chaos 는 async/physics-thread/resim 구조라, 게임 스레드와의 경계가 모든 챕터에 횡단한다 (→ [Concepts 12](../Concepts/12-determinism-networking.md)).
5. **본문 한국어**, 타입·매크로·CVar 는 원어 그대로.

---

## 2. 모듈 지형도 (코드가 어디 있는가)

```
Chaos 생태계 (UE 5.7)
│
├─ 본체 (이 로드맵의 90%) ──────────────────────────────
│   ├─ ChaosCore .................. FReal/FVec3/FRotation3/Transform · Pair · 로깅 · Defines
│   ├─ Chaos ...................... 시뮬레이션 본체 (Particle·Geometry·Collision·Solver·Evolution·Joint·Island)
│   └─ ChaosSolverEngine .......... AChaosSolverActor · UWorld 통합 진입점
│
├─ 게임 스레드 경계 ──────────────────────────────────
│   ├─ PhysicsCore/...Chaos ....... Body/Shape 인터페이스, 쿼리 결과 타입
│   └─ Engine 측 Physics Proxy ..... GT 액터 ↔ PT 파티클 마샬링
│
├─ 변형·천 (Deformable) ──────────────────────────────
│   ├─ Chaos/Deformable (본체 내) .. XPBD soft-body 솔버
│   ├─ ChaosCloth / ChaosClothAsset  천 시뮬 (→ Concepts 07)
│   └─ ChaosFlesh .................. FEM 살/근육
│
├─ 특화 시스템 (Specialized) ─────────────────────────
│   ├─ GeometryCollection / Field .. 파괴(Destruction) · 클러스터링 (→ Concepts 10)
│   ├─ ChaosVehicles / ChaosModularVehicle  차량 (→ Concepts 10)
│   └─ Chaos/Character (본체 내) ... character ground constraint
│
├─ 통합·효과 ─────────────────────────────────────────
│   ├─ ChaosNiagara ............... 파티클·필드 연동 (→ Concepts 09)
│   └─ ChaosCaching ............... 시뮬 캐시·재생
│
└─ 도구 (Tooling) ───────────────────────────────────
    ├─ ChaosVD (Visual Debugger) .. 프레임별 시뮬 상태 기록·재생
    └─ ChaosInsights .............. Unreal Insights 트레이스 통합
```

> **전략**: 위성 플러그인을 먼저 건드리지 않는다. **본체 3모듈(ChaosCore→Chaos→ChaosSolverEngine)** 을 끝까지 이해하면 나머지는 "그 위에 올라탄 특화 솔버"로 빠르게 읽힌다.

---

## 3. 학습 DAG (어떤 순서로 읽는가)

각 노드는 한 분석 챕터 = 한 문서(`CNN-*.md`). 화살표 `A → B` = "A 를 알아야 B 가 읽힌다".

```
[C00 모듈·빌드 지형]
      │
      ▼
[C01 코어 타입·수학] ──────────────────────────────────────┐
      │  (FReal·FVec3·FRotation3·FRigidTransform · ISPC/SIMD) │
      ▼                                                       │
[C02 파티클·강체 표현] (SOA · ParticleHandle · 질량/관성)      │
      │                                                       │
      ├──────────────┬───────────────────────────────┐       │
      ▼              ▼                                ▼       │
[C03 임플리싯       [C04 공간 가속]                 (C01 수학에
 지오메트리]        (AABBTree·BV·SpatialHash)          전부 의존)
 (Box·Convex·       │                                          
  HeightField·      ▼                                          
  TriMesh·Union)  [C05 Broad phase]                            
      │              │                                          
      └──────┬───────┘                                          
             ▼                                                   
      [C06 Narrow phase] (GJK·EPA·SAT·manifold·contact gen)      
             │                                                   
             ▼                                                   
      [C07 충돌 구속·충돌 솔버] (PBDCollisionConstraint/Solver · CCD)
             │                                                   
             ▼                                                   
      [C08 구속 솔버 프레임워크] (SolverBody·ConstraintContainer·GroupSolver)
             │                                                   
      ┌──────┼───────────────┐                                  
      ▼      ▼               ▼                                  
[C09 아일랜드  [C10 조인트]   (둘 다 C08 위)                      
 ·그래프 색칠]  (Joint solver·                                   
 ·sleeping]     motor·limit)                                    
      └──────┬───────────────┘                                  
             ▼                                                   
      [C11 Evolution / 적분 루프] (PBDRigidsEvolution · TGS substep · advance)
             │                                                   
             ▼                                                   
      [C12 Solver 프런트엔드·스레딩] (PBDRigidsSolver · async · marshalling · dirty)
             │                                                   
      ┌──────┼───────────────┐                                  
      ▼      ▼               ▼                                  
[C13 결정론  [C14 GT 인터페이스]  (코어 완성 후)                  
 ·resim]     (Proxy·Interface·                                   
             BodyInstance 브리지)                                
                                                                 
─── 본체 완료선 ───────────────────────────────────────────────
                                                                 
[C15 변형체·천]   [C16 특화: 파괴·차량·캐릭터]   [C17 도구: ChaosVD·Insights·CVar]
 (C07,C11 위)      (C11,C12 위)                  (전체 횡단·관찰용)
```

---

## 4. 챕터 인덱스 (= 작성 예정 문서)

| # | 챕터 | 한 줄 | 핵심 소스 앵커 (5.7) | 대응 이론 |
|---|---|---|---|---|
| C00 | 모듈·빌드 지형 | 3모듈 경계 · `*.Build.cs` 의존 · Public/Private · ISPC/SIMD 토글 · CVar 규약 | `Chaos.Build.cs`, `ChaosCore.Build.cs` | — |
| C01 | 코어 타입·수학 | `FReal`(float/double 정책) · `FVec3` · `FRotation3` · `FRigidTransform3` · `Matrix` · ISPC | `ChaosCore/Public/Chaos/Core.h`, `Chaos/Public/Chaos/Math/` | [00](../Concepts/00-foundations.md)·[01](../Concepts/01-kinematics.md) |
| C02 | 파티클·강체 표현 | SOA 파티클 배열 · `TGeometryParticleHandle` · Dynamic/Kinematic/Static · 질량·관성텐서 저장 | `Particle/`, `GeometryParticles.h`, `DynamicParticles.h` | [02](../Concepts/02-dynamics.md) |
| C03 | 임플리싯 지오메트리 | `FImplicitObject` 계층 · Box/Sphere/Capsule/Convex/HeightField/TriangleMesh · Scaled/Transformed/Union | `ImplicitObject.h`, `Convex.h`, `HeightField.h` | [04](../Concepts/04-collision-detection.md) |
| C04 | 공간 가속 구조 | `TAABBTree` · `BoundingVolume` · `HierarchicalSpatialHash` · `ISpatialAcceleration` 추상 | `AABBTree.h`, `BoundingVolume.h`, `ISpatialAcceleration.h` | [11](../Concepts/11-spatial-structures.md) |
| C05 | Broad phase | 가속구조 질의 → 잠재 쌍 · `ParticlePairBroadPhase` · dirty grid | `Collision/BasicBroadPhase.h`, `ParticlePairBroadPhase.h` | [04](../Concepts/04-collision-detection.md) |
| C06 | Narrow phase·contact gen | `GJK`/`EPA`/`SAT` · `NarrowPhase` · manifold · `MeshContactGenerator` | `GJK.h`, `EPA.h`, `Collision/NarrowPhase.h`, `ContactPoint.h` | [04](../Concepts/04-collision-detection.md) |
| C07 | 충돌 구속·충돌 솔버 | `FPBDCollisionConstraint` · `FPBDCollisionSolver`(+Simd/Jacobi) · 마찰·반발 · CCD | `Collision/PBDCollisionConstraint.h`, `PBDCollisionSolver.h`, `CCDUtilities.h` | [05](../Concepts/05-constraint-solving.md) |
| C08 | 구속 솔버 프레임워크 | `FSolverBody` · `ConstraintContainer` · `ConstraintGroupSolver` · iteration 설정 | `Evolution/SolverBody.h`, `ConstraintGroupSolver.h`, `IndexedConstraintContainer.h` | [05](../Concepts/05-constraint-solving.md) |
| C09 | 아일랜드·그래프·sleeping | `FPBDConstraintGraph` · graph coloring · island 분할 · sleeping 임계 | `Island/`, `PBDConstraintGraph.h`, `PBDConstraintColor.h`, `GraphColoring.h` | [13](../Concepts/13-performance-parallelism.md) |
| C10 | 조인트 | `FPBDJointConstraints` · 6DOF · motor·limit · joint solver 수식 | `Joint/`, `PBDJointConstraints.h`, `PBDJointConstraintUtilities.h` | [06](../Concepts/06-joints-articulation.md) |
| C11 | Evolution·적분 루프 | `FPBDRigidsEvolution` · `FPBDMinEvolution` · integrate · **TGS substep** · advance 시퀀스 | `PBDRigidsEvolution.h`, `Evolution/PBDMinEvolution.h` | [03](../Concepts/03-time-integration.md)·[05](../Concepts/05-constraint-solving.md) |
| C12 | Solver 프런트엔드·스레딩 | `FPBDRigidsSolver` · sync/async · `ChaosMarshallingManager` · dirty data · 콜백 | `Framework/`, `ChaosMarshallingManager.h` | [13](../Concepts/13-performance-parallelism.md) |
| C13 | 결정론·resim/rewind | rewind buffer · `FEvolutionResimCache` · 재시뮬 결정성 보장 | `EvolutionResimCache.h`, `Framework/` rewind | [12](../Concepts/12-determinism-networking.md) |
| C14 | GT 인터페이스·Proxy | 게임 스레드 액터 ↔ 물리 파티클 마샬 · `Interface/` · BodyInstance 브리지 | `Interface/`, `PhysicsCore/.../Chaos` | [12](../Concepts/12-determinism-networking.md) |
| C15 | 변형체·천 | `Deformable/` XPBD soft · ChaosCloth 솔버 구조 | `Chaos/Deformable/`, `Plugins/ChaosCloth` | [07](../Concepts/07-deformable-bodies.md) |
| C16 | 특화: 파괴·차량·캐릭터 | GeometryCollection 클러스터·필드 · ChaosVehicles · `Character/` ground | `ClusterUnionManager.h`, `Plugins/.../ChaosVehicles`, `Character/` | [10](../Concepts/10-specialized-systems.md) |
| C17 | 도구: VD·Insights·CVar | ChaosVD 기록·재생 · Insights 트레이스 · `hkt`/`p.Chaos` CVar 카탈로그 · DebugDraw | `Plugins/ChaosVD`, `DebugDraw/`, `ChaosDebugDraw.h` | [13](../Concepts/13-performance-parallelism.md) |

---

## 5. 권장 진행 순서

1. **지형 먼저** — C00 → C01 → C02. 타입(`FReal`/`FVec3`)과 파티클 SOA 레이아웃을 모르면 나머지 코드가 안 읽힌다.
2. **충돌 파이프라인 종단 추적** — C03 → C04 → C05 → C06 → C07. *한 쌍의 강체가 충돌→해소되는 전 과정*을 코드로 한 번 끝까지 따라간다(엔진을 "안다"의 핵심 마일스톤).
3. **솔버 골격** — C08 → C09 → C10 → C11. 충돌·조인트가 어떻게 island 로 묶여 한 evolution step 에서 풀리는가.
4. **프레임워크 경계** — C12 → C13 → C14. async/marshalling/resim 은 *코어 메커니즘을 이해한 뒤* 봐야 의미가 잡힌다.
5. **확장·도구** — C15~C17 은 필요 시. C17(ChaosVD)는 **조기에 도구만 띄워두면** C02~C11 검증에 즉시 쓰인다.

> **마일스톤 정의** — "Chaos 를 안다"의 합격 기준: C01~C12 까지 각 챕터가 (a) 핵심 클래스 책임, (b) 한 프레임 데이터 흐름에서의 위치, (c) 대응 이론 1:1, (d) 결정론/스레딩 메모를 갖출 때.

---

## 6. 문서 작성 규약 (각 `CNN-*.md` 의 고정 골격)

```
# CNN — 제목
> 한 줄 정의 · 대응 Concepts 링크 · 선행 챕터

1. 책임(Responsibility)   — 이 서브시스템이 푸는 문제 한 단락
2. 핵심 타입·진입점        — 클래스/함수 + 파일:라인, 1:1 이론 대응표
3. 데이터 흐름            — 한 프레임 스텝에서 입력→출력, 호출 순서
4. 핵심 알고리즘 해부      — 실제 코드 인용 + 수식 대조 (Concepts 의 수식이 코드 어디에)
5. 결정론·스레딩 메모      — GT/PT 경계, 부동소수점, 연산 순서
6. CVar·디버그 훅         — p.Chaos.* 토글, ChaosVD 로 무엇이 보이는가
7. 열린 질문 / 다음 챕터 연결
```

> 한 챕터가 너무 커지면 `CNN/` 하위 폴더로 분할(Concepts 가 `NN-*.md` + `NN-*/` 로 한 것과 동일 패턴).
