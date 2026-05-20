# Voxel → Presentation 파이프라인

I-0014 voxel spawn attribution 으로 생성된 entity 가 **베이크 시점의 voxel** 부터 **클라이언트의 Presentation viewmodel** 까지 도달하는 end-to-end 경로를 정리한다. 단일 spawn (예: Tree_Spawn 의 Oak 1본) 의 lifecycle 을 따라간다.

관련 문서:
- [Design-VoxelSpawner.md](Design-VoxelSpawner.md) — voxel spawn 속성 데이터 모델·bake·런타임·콘텐츠 워크플로우 (단일 진실원)
- [Flow-DataAsset-Presentation-Pipeline.md](Flow-DataAsset-Presentation-Pipeline.md) — Tag → DataAsset → Actor 시각화 (본 문서 §7 의 상세)
- [../HktGameplay/Source/HktTerrain/CLAUDE.md](../HktGameplay/Source/HktTerrain/CLAUDE.md) — 지형 데이터 단일 출처 규약

## 전체 흐름

```
┌──────────────────────────────────────────────────────────────────────┐
│ §1. 베이크 (Editor 시점, 1회성)                                       │
│   UHktTerrainBakeLibrary::BakeRegion                                  │
│   ├ FHktTerrainGenerator::GenerateChunk × N → Oodle 압축              │
│   ├ surface column scan: top-most non-air voxel.TypeID 추출           │
│   └ VoxelSpawnRules 후보 + 좌표 시드 weighted-pick                    │
│       → SpawnTemplateAttribution (skip 슬롯 = 미부여)                 │
│       + SpawnTemplateCatalog (templateId → StoryTag)                  │
│   → /Game/Terrain/Baked/RegionDefault.uasset                          │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ (자산 영속화)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §2. 런타임 부트스트랩 (GameMode::InitGame)                            │
│   AHktVoxelTerrainActor.BeginPlay → UHktTerrainSubsystem.LoadBakedAsset│
│   AHktGameMode.InitGame                                                │
│     ├ Simulator = FHktWorldDeterminismSimulator (서버 권위)            │
│     └ Simulator.SetTerrainSource(MakeUnique<FHktTerrainProvider>(Sub)) │
│        (HktCore 가 IHktTerrainDataSource 만 본다 — HktTerrain 헤더 X)  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §3. 청크 스트림인 & 평가 (30Hz 시뮬 tick)                              │
│   FHktTerrainSystem::Process(WorldState, TerrainState, Source, …)     │
│     for newly-loaded chunk:                                            │
│       ├ Source.GenerateChunk(Coord, voxels)        ← cache/fallback   │
│       └ Source.GetChunkVoxelAttribution(Coord, scratchAttribViews)    │
│            for view : scratchAttribViews:                              │
│              EmittedSpawnerEvents.Add(                                 │
│                HktEventBuilder::VoxelTemplateActivated(view, VoxelCm)) │
│   (EventTag = view.StoryTag, Param0/1/3 = voxel cm,                    │
│    Param2 = ComputeVoxelSlotHash31(x,y,z))                             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ EmittedSpawnerEvents (TArray<FHktEvent>)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §4. VM 디스패치 (FHktWorldDeterminismSimulator::ProcessBatch)          │
│   merged = EmittedSpawnerEvents ⊕ Event.NewEvents                     │
│   VMBuildSystem.Process(merged, Frame, Pool, ActiveVMs, …)             │
│     for ev : merged:                                                   │
│       program = FHktVMProgramRegistry::FindProgram(ev.EventTag)        │
│       runtime = Pool.Acquire(); runtime.Init(program, ev, Self)        │
│       ActiveVMs.Add(runtime)                                           │
│   → VM 인터프리터가 Story bytecode 실행                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ (Tree_Spawn / Slime_Spawn 본문)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §5. SpawnEntity 옵코드 → WorldState 쓰기                              │
│   FHktVMInterpreter::Op_SpawnEntity(Runtime, TagIndex)                 │
│     ├ EntityId = WorldState.AllocateEntity()                          │
│     ├ archetype = FHktArchetypeRegistry.Get(ClassTag)                  │
│     │   → 기본 properties (CollisionLayer/Mass/MaxSpeed/…) 적용         │
│     ├ Spawned 레지스터에 EntityId 저장                                  │
│     └ 모든 쓰기는 FHktVMWorldStateProxy 경유 (dirty 추적)              │
│   이후 SaveConstEntity / AddTag / SetPosition 등으로                    │
│   Health, MaxHealth, Pos, NPC.Slime 태그 등 부착                        │
│   DispatchEventFrom OakLifecycle / NpcLifecycle → §4 재진입            │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §6. WorldState → WorldView (직렬화 + 브로드캐스트)                     │
│   FHktWorldState::NetSerialize                                         │
│     Spawned/Removed entities + PropertyDeltas + TagDeltas + OwnerDeltas│
│   서버: GameMode 가 PlayerController.Client_ReceiveWorldViewDelta RPC  │
│   클라: PC 가 FHktWorldView 합성 → OnWorldViewUpdated 델리게이트 발사  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ FHktWorldView (read-only 스냅샷)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ §7. Presentation viewmodel 갱신 (Client only)                         │
│   UHktPresentationSubsystem::OnWorldViewUpdated(view)                  │
│     ├ ProcessDiff(view) → PresentationState 갱신                      │
│     │    SpawnedEntities → State.AddEntity + AssetSubsystem 비동기 큐  │
│     │    PropertyDeltas/TagDeltas → SOA 슬롯 in-place update          │
│     └ Processors.Tick / Sync                                            │
│         FHktActorProcessor:                                             │
│           Tick: AssetSubsystem.LoadAssetAsync(VisualTag)              │
│           Sync: 자산 도착 시 SpawnActor + IHktPresentableActor 바인드 │
│         per-frame: Pos/Rot/Scale/Tag delta → Actor transform/anim     │
│   → 화면에 Oak/Slime Actor 출현                                         │
└──────────────────────────────────────────────────────────────────────┘
```

## 레이어별 상세

### §1. 베이크 — `UHktTerrainBakeLibrary::BakeRegion`

| 단계 | 파일:라인 | 책임 |
|---|---|---|
| 영역 순회 + 청크 생성 | `HktTerrain/Private/HktTerrainBakeLibrary.cpp:69-142` | `FHktTerrainGenerator::GenerateChunk` 호출 → 32³ voxel raw → Oodle 압축 |
| Surface 마킹 | `HktTerrainBakeLibrary.cpp:145-194` | top-most non-air voxel 존재 시 `bIsSurfaceChunk=true` (attribution 게이트) |
| Attribution 산출 | `HktTerrainBakeLibrary.cpp:200-355` | `VoxelSpawnRules` (디자이너 후보 + weight) → voxel type 별 cumulative-weight bucket → 매 top voxel 마다 `ComputeVoxelSlotHash31(worldX,Y,Z) % totalWeight` 로 결정론적 픽 → `SpawnTemplateAttribution[PackLocalCoord]=templateId` + `SpawnTemplateCatalog[templateId]=StoryTag`. skip 슬롯 (invalid StoryTag) 선정 시 미부여 |
| I-0015 정적 검증 | `HktTerrainBakeLibrary.cpp:290-324` | orphan catalog templateId (미참조) 검출 → WARN |

**산출물**: `UHktTerrainBakedAsset.uasset` — `Chunks[]` (압축 voxel + attribution 슬롯) + `SpawnTemplateCatalog` + `GeneratorConfig` (폴백 재생성용).

### §2. 런타임 부트스트랩 — `GameMode::InitGame`

| 단계 | 파일:라인 | 책임 |
|---|---|---|
| 베이크 자산 로드 | `HktVoxelTerrain/Public/HktVoxelTerrainActor.h:183-184` | `BakedAsset` (TSoftObjectPtr) → `UHktTerrainSubsystem::LoadBakedAsset` 비동기 로드 |
| 시뮬레이터 생성 | `HktRule/Private/HktServerRule.cpp` (PendingWorldInit) | `FHktWorldDeterminismSimulator` 인스턴스화 (서버 권위) |
| TerrainSource 주입 | `HktRuntime/Private/Actors/HktGameMode.cpp` | `Simulator->SetTerrainSource(MakeUnique<FHktTerrainProvider>(Subsystem, Cfg))` |

**HktCore 단방향 의존 보장**: HktCore 는 `IHktTerrainDataSource` (`HktCore/Public/Terrain/HktTerrainDataSource.h`) 만 보고, `FHktTerrainProvider` (`HktTerrain/Public/HktTerrainProvider.h:33`) 가 구현체. HktCore → HktTerrain 헤더 의존 0.

### §3. 청크 평가 — `FHktTerrainSystem::Process`

**파일**: `HktCore/Private/HktSimulationSystems.cpp:558` (Process 진입), `:660-687` (voxel attribution 패스).

```cpp
// per newly-loaded chunk
Source.GetChunkVoxelAttribution(Coord.X, Coord.Y, Coord.Z, ScratchAttributions);
for (const FHktVoxelAttributionView& View : ScratchAttributions)
{
    EmittedSpawnerEvents.Add(
        HktEventBuilder::VoxelTemplateActivated(View, VoxelSizeCm));
    // → EventTag = View.StoryTag
    //   Param0/1/3 = voxel center cm, Param2 = ComputeVoxelSlotHash31(x,y,z)
}
```

`FHktVoxelAttributionView` (`HktCore/Public/Terrain/HktTerrainDataSource.h`) — POD: `{StoryTag, VoxelWorldX/Y/Z}`. Provider 가 baked chunk attribution 슬롯 + catalog 를 해석해 view 시퀀스로 변환.

### §4. VM 디스패치 — `FHktWorldDeterminismSimulator::ProcessBatch`

**파일**: `HktCore/Private/HktWorldDeterminismSimulator.cpp:62`.

1. `TerrainSystem.Process(...)` → `EmittedSpawnerEvents` 수확
2. 외부 입력 (`Event.NewEvents`) 과 머지
3. `VMBuildSystem::Process(merged, ...)` 호출 — `HktSimulationSystems.cpp:232`

VMBuildSystem 은 매 이벤트에 대해:
- `FHktVMProgramRegistry::FindProgram(EventTag)` — `HktCore/Private/VM/HktVMProgram.cpp` — 1태그 1프로그램 매핑
- Pool 에서 VM runtime 획득, 컨텍스트 (Self/Source/Target/Param) 주입
- ActiveVMs 에 등록 → 다음 tick 에 인터프리트

**1태그 1프로그램 규약**: voxel attribution 이 fire 한 `Story.Flow.Spawner.Natural.Tree` 같은 tag 는 등록된 단일 program (Tree_Spawn.json 컴파일 산출물) 로 즉시 라우팅.

### §5. SpawnEntity — VM 인터프리터 → WorldState 쓰기

**파일**: `HktCore/Private/VM/HktVMInterpreterActions.cpp:40`.

```cpp
// Op_SpawnEntity
EntityId = WorldState.AllocateEntity();
archetype = FHktArchetypeRegistry::Get(ClassTag);
// Team inheritance, CollisionLayer/Mask, Mass, MaxSpeed 기본값
runtime.SetReg(Reg::Spawned, EntityId);
```

이후 story bytecode 가 `SaveConstEntity` / `AddTag` / `SetPosition` / `SetStance` 호출 → 전부 **`FHktVMWorldStateProxy::SetPropertyDirty`** 경유 (절대 원칙 §4). proxy 가 dirty set 누적, frame 종료 시 commit.

`DispatchEventFrom OakLifecycle` 같은 후속 호출은 `NewEvents` 에 push → 다음 tick §4 로 재진입 → `Story.Flow.Natural.Oak.Lifecycle` program 실행 (State.Dead 폴링).

### §6. WorldState → WorldView 직렬화

**파일**:
- `HktCore/Public/HktWorldState.h:270` — `NetSerialize`
- `HktCore/Public/HktWorldView.h:14` — `FHktWorldView` POD

**전송 페이로드**: `SpawnedEntities` + `RemovedEntities` + `PropertyDeltas` + `TagDeltas` + `OwnerDeltas` + frame metadata.

**경로**:
- 서버: `AHktGameMode` 가 PlayerController 의 `Client_ReceiveWorldViewDelta` RPC 호출
- 클라: PC 가 페이로드 → `FHktWorldView` 합성 → `OnWorldViewUpdated` 델리게이트 발사

**미드조인**: `Client_ReceiveInitialState` → `RestoreWorldState` (`HktWorldDeterminismSimulator.cpp:503-516`) 가 전체 SOA 복원 (Region entity 포함, [Design-I0014 §점검 메모](Design-I0014-Implementation.md) 참조).

### §7. Presentation viewmodel — Client only

**파일**:
- `HktPresentation/Public/HktPresentationSubsystem.h:27` — LocalPlayer subsystem
- `HktPresentation/Private/HktPresentationSubsystem.cpp:226` — `ProcessDiff`
- `HktPresentation/Private/Processors/HktActorProcessor.h:17` (구현 `.cpp:28,95`)

**ProcessDiff 흐름**:
1. `SpawnedEntities` → `PresentationState.AddEntity(*WorldState, EntityId, AssetSub)` + visual tag asset 비동기 로드 큐
2. `PropertyDeltas`/`TagDeltas`/`OwnerDeltas` → in-place SOA 슬롯 갱신 (절대 원칙 §3: read-only 모델 유지)

**ActorProcessor 흐름** (per-frame):
- **Tick phase**: `AssetSubsystem->LoadAssetAsync(VisualTag)` — Entity.Natural.Oak / Entity.NPC.Slime 의 SkeletalMesh / BP 비동기 로드
- **Sync phase**: 자산 도착 시 `World->SpawnActor` → `IHktPresentableActor` 바인드 → SOA Pos/Rot/Scale/Tag delta 를 Actor transform/animation 으로 적용

**HktPresentation ↔ HktUI 단방향** (plugin-local 제약 §3): UI 는 interface/delegate 만 통해 entity 데이터를 받음. Presentation 직접 의존 금지.

## 결정론 / 권위 / 단방향 의존 정리

| 보장 | 어디서 | 무엇을 |
|---|---|---|
| **서버 권위** | §2 GameMode | `FHktWorldDeterminismSimulator` 만이 SpawnEntity. 클라는 §6 view 수신만 |
| **결정론 시드** | §3 `ComputeVoxelSlotHash31` | 자연 발생/트리거 두 입구 모두 voxel 좌표 한 곳 → 동일 시드 (I-0017) |
| **HktCore 순수성** | §2-§5 | UObject/UWorld/HktTerrain 의존 0. `IHktTerrainDataSource` 만 본다 |
| **VM dirty 추적** | §5 | 모든 쓰기 `FHktVMWorldStateProxy` 경유 — 직접 WorldState 쓰기 금지 (절대 §4) |
| **Read-only attribution** | §1-§3 | 베이크 시점 자동 채움, 런타임은 catalog/attribution 모두 read-only |
| **1태그 1프로그램** | §4 | `FHktVMProgramRegistry` 가 EventTag → 단일 program — 디스패치 라우팅 일원화 |

## 디버깅 진입점

| 증상 | 첫 확인 | 명령어 / 카테고리 |
|---|---|---|
| 베이크 후 attribution 없음 | `BakeRegion` 로그 — `AttributionsWritten=0` | `LogHktTerrain` |
| Tag 매핑 오타 / over-spec | `BakeRegion: catalog templateId=…가 어떤 voxel 도 참조하지 않음` | WARN — I-0015 정적 검증 |
| 청크 로드 후 spawn 없음 | `FHktTerrainSystem::Process` 의 `EmittedSpawnerEvents.Num()` | `hkt.EventLog.Dump` |
| Story 미발견 | `FHktVMProgramRegistry::FindProgram` 의 nullptr | `LogHktStoryJsonLoader` — "Unknown GameplayTag" |
| Actor 미출현 | `FHktActorProcessor::Sync` 의 asset load 상태 | `LogHktPresentation` + `hkt.insights.dump Presentation` |

## 본 파이프라인을 건드릴 때 체크리스트

1. **베이크 포맷 변경** → `UHktTerrainBakedAsset::CurrentBakeVersion` +1, `bake_terrain.py` 갱신, 자산 재베이크.
2. **신규 Spawner Story** → JSON 추가 + `UE_DEFINE_GAMEPLAY_TAG_COMMENT` 선언 + `bake_terrain.py` 매핑 + `RegenerateStoryTagsAndReload` 1회.
3. **신규 Entity 클래스** → `HktNaturalEntityTags`/`HktStoryTags` 에 tag 선언 + archetype 등록 + Presentation DataAsset 매핑 (Flow-DataAsset-Presentation-Pipeline.md §2-3).
4. **`IHktTerrainDataSource` 확장** → 호출부 (`FHktTerrainState::LoadChunk`) + 모든 구현체 동기 갱신 (HktTerrain CLAUDE.md 변경 시 메모).
