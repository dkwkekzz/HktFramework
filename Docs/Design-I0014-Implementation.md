# I-0014 자연 Spawner 배치 — 구현 상태

[I-0014 의도 문서](intents/I-0014.md) 의 구현 진척·격차·기술 메모를 분리해 보관한다. 의도(왜) 문서가 일감 추적기로 비대해지는 것을 막기 위한 디자인 문서다.

관련 모듈 디자인: [HktGameplay/Source/HktTerrain/TerrainSpawner.design.md](../HktGameplay/Source/HktTerrain/TerrainSpawner.design.md)

## 핵심 흐름

```
[청크 로드]                                   (FHktTerrainSystem::Process)
   │
   ├─ Event.Terrain.ChunkLoaded emit          (HktEventBuilder::ChunkLoaded)
   │     Param2 = BiomeId, Param3 = SlotHash31
   ▼
[Placement Story]                             (Content/Stories/Natural/Placement_*.json)
   │  biome 분기 → spawner-story dispatch
   ▼
[Spawner Story]                               (Content/Stories/Natural/<Entity>/<Entity>_Spawn.json)
   │  Region 메모리 조회/갱신
   │  SpawnEntity opcode + 위치/속성 부여
   │  Lifecycle Story dispatch (DispatchEventFrom)
   ▼
[Entity Lifecycle]                            (I-0010, I-0011 연속)
```

코드 모델의 "Spawner" 는 별도 객체가 아니라 **spawner-story (자연 발생 정책을 담은 bytecode)** 의 추상 표현이다. 명시 배치/보스용 `FHktTerrainSpawnerSpec` 은 baked asset 의 정적 데이터로 존재하나 자연 발생 자동 채움에는 사용되지 않는다.

## 구현 완료

| 항목 | 위치 |
|---|---|
| 청크 로드 → `Event.Terrain.ChunkLoaded` 이벤트 emit (BiomeId, SlotHash31 인라인) | `HktCore/Private/HktSimulationSystems.cpp` |
| `HktEventBuilder::ChunkLoaded` 헬퍼 + `ChunkLoadedParams::` 별칭 | `HktCore/Public/HktStoryEventParams.h` |
| `IHktTerrainDataSource::TryGetChunkContext` (biome/surface/slotHash 조회) | `HktCore/Public/Terrain/HktTerrainDataSource.h` |
| `FHktTerrainBakedChunk` v3 (BiomeId / SurfaceVoxelZ / SlotHash / bIsSurfaceChunk) | `HktTerrain/Public/HktTerrainBakedAsset.h` |
| `IHktTerrainDataSource::GetChunkSpawners` 인터페이스 (명시 배치용) | `HktCore/Public/Terrain/HktTerrainDataSource.h` |
| `FHktTerrainSpawnerSpec` (명시 배치 데이터 모델, Param0~3 평탄화) | `HktTerrain/Public/HktTerrainBakedAsset.h` (Phase 4 TerrainSpawner.design.md) |
| 1태그 1프로그램 storyTag dispatch (`FHktVMProgramRegistry`) | `HktCore/Private/VM/HktVMProgram.cpp` |
| Placement Story 예제 (`Placement_TranquilWilds.json`) — Forest/Grassland → Oak/Birch | `HktGameplay/Content/Stories/Natural/Placement_TranquilWilds.json` |
| Spawner Story 패턴 (`Oak_Spawn.json`, `Birch_Spawn.json`) — Region 메모리 + lineage + 자식 spawn + Lifecycle dispatch | `HktGameplay/Content/Stories/Natural/{Oak,Birch}/` |
| Region 상태 메모리 (`FindOrCreateRegionAt`, `RegionMapRead/Write`, `RegionAddScalar`) — 누적·소진 정책 | HktCore VM opcode 군 |
| `SpawnerParams::` 별칭 컨벤션 + `HktEventBuilder::SpawnerFromView` | `HktCore/Public/HktStoryEventParams.h` |
| HktMapGenerator 어댑터 (`HktMapSpawnerAdapter::MapSpawnerToTerrainSpec`) — 레거시 마이그레이션 경로 | Phase 5 M5 부분 |
| **World 별 Placement 분리** — `Story.Placement.<WorldId>` 컨벤션 + baked asset `PlacementStoryTag` 필드 + 권위 시뮬레이터만 emit. BakeVersion v3→v4 | `HktTerrainBakedAsset.h` (v4) · `HktTerrainGeneratorConfig.h` · `HktTerrainDataSource.h:FHktTerrainChunkContext::DispatchTag` · `HktSimulationSystems.cpp` (DispatchTag 폴백 + `bIsAuthoritative` 게이트) · `Placement_TranquilWilds.json` |

## 부분 / 의도-구현 격차

| 갭 | 의도 표현 | 현 구현 |
|---|---|---|
| **"Spawner 배치"** 모델 | Placement → Spawner 배치 → Entity 생성 (2단계) | 실제: Placement → spawner-story dispatch → `SpawnEntity` opcode (1단계). 별도 "Spawner" 중간 객체 없음. `FHktTerrainSpawnerSpec` 은 보스/명시 배치 전용. |
| **자연 발생 baked 자동 채움** | spawner spec 이 BakeRegion 결과로 자동 채워짐 (Phase 3 설계) | 미구현 — `BakeRegion` 의 spawner slot 자동 추출 단계 부재. `Placement_*.json` 의 biome 분기 + spawner-story 가 동적으로 결정. |
| **결정론 RNG seed 활용** | SlotHash31 → 동일 청크 재로드 시 동일 출현 | `Param3 = SlotHash31` 까지 emit 완료. story-local PRNG 수단은 [I-0017 (결정론 안의 다양성)](intents/I-0017.md) 의 적용 영역에 위임. |
| **Placement 결합의 정적 검증** | 매핑 미스가 빌드/로드 시점에 차단 | 런타임 silent skip. 의도는 [I-0015 (콘텐츠와 시스템 결합의 무결성)](intents/I-0015.md) 의 placement 적용 영역. |
| **Placement 콘텐츠 자동 산출** | feature_design → Placement JSON 자동 생성 | Generator 파이프라인에 placement 단계 부재. 의도는 [I-0007 (콘텐츠 자동화)](intents/I-0007.md) 자체. |

## "PendingWorldInit" 레거시

`AHktGameMode::InitGame` 의 `WorldInitStoryTag` 1회 발동 경로 (`FHktDefaultServerRule::PendingWorldInit`) 는 본 시스템과 공존한다. 설계상 (TerrainSpawner.design.md §7) Phase 3 (BakeRegion 의 WorldInitLocation 자동 spawner slot 화) 완료 시 제거 예정이나 현재는 부트스트랩 호환성을 위해 보존.

## Setup 진단 — "아무것도 생성 안 됨" 체크리스트

[I-0014 의 동작 전제 6개 게이트](intents/I-0014.md#동작-전제-디자이너-책임) 가 충족됐는지 *기계적으로* 확인하는 절차. 위에서 아래로 순서대로 점검.

### 1. Baked Asset 이 로드되었는가

- 확인: `AHktGameMode` 또는 World Settings 에서 `UHktTerrainSubsystem::LoadBakedAsset(SoftRef)` 호출 위치
- 로그 검색: `[FloatRepro] LoadBakedAsset 비동기 완료`
- 콘솔: `hkt.Debug.BakedAsset` 또는 Insights `Terrain.Subsystem`
- **실패 증상**: `[TerrainProvider] GetChunkSpawners: BakedAsset 미로드` 로그. 청크 컨텍스트 자체가 없어 이벤트 emit 차단.

### 2. Baked Asset 이 v4 이고 PlacementStoryTag 가 채워져 있는가

- 확인: 에디터에서 `.uasset` 열기 → `GeneratorConfig` → `PlacementStoryTag` 필드
- 버전 확인: `CurrentBakeVersion == 4` (`HktTerrainBakedAsset.h:283`)
- v3 자산이면 재베이크 (`UHktTerrainBakeLibrary::BakeRegion`)
- **실패 증상**: 빈 태그 → `DispatchTag.IsValid() == false` → 폴백 `Event.Terrain.ChunkLoaded` 발화 (World 별 placement 미발화)

### 3. JSON storyTag 가 PlacementStoryTag 와 문자 일치하는가

- 확인: `Placement_<WorldId>.json` 의 `"storyTag": "Story.Placement.<WorldId>"` ↔ Baked asset 의 `PlacementStoryTag` 필드값
- **대소문자 구분, 공백·점 위치까지 정확히**
- **실패 증상**: 이벤트는 emit 되나 dispatch 매칭이 안 됨. 로그에 spawner 발화 메시지 부재.

### 4. StoryDirectories 가 ProjectSettings 에 지정되었는가

- 확인: `Project Settings → Game → Hkt Gameplay Settings → Story Directories`
- JSON 위치 (예: `/Game/HktGameplay/Content/Stories`) 등록 필요. 재귀 스캔.
- **실패 증상**: `FHktStoryJsonLoader::LoadAllFromContentDirectory` 가 파일을 못 찾음. "Loaded JSON story:" 로그 부재.

### 5. GameplayTag 가 등록되어 있는가

- 확인: 콘솔 `ShowGameplayTagManager` 또는 `Config/Tags/DefaultGameplayTags.ini` 에서 `Story.Placement.` 검색
- 미등록 시: 에디터에서 `UHktStoryEditorLibrary::RegenerateStoryTagsAndReload()` 호출 → `Config/Tags/HktStoryTags.ini` 자동 생성
- **실패 증상**: `Unknown GameplayTag 'Story.Placement.<WorldId>' — run UHktStoryEditorLibrary::RegenerateStoryTagsAndReload...` 경고 (`HktStoryJsonLoader.cpp:24-29`). Tag 가 invalid 라 매칭 실패.

### 6. 서버 권위 + 표면 청크 조건

- 확인: NetMode 가 Standalone / ListenServer / DedicatedServer 중 하나 (`EHktLogSource::Server`)
- 클라이언트 단독 PIE 는 `bIsAuthoritative=false` 로 emit 차단 (`HktWorldDeterminismSimulator.cpp`)
- `bIsSurfaceChunk == true` 인 청크만 발화 (`HktSimulationSystems.cpp:650-701`)
- **실패 증상**: ChunkLoaded emit 메시지 자체가 로그에 없음.

### 빠른 진단 순서

| 증상 | 가장 가능성 높은 게이트 |
|---|---|
| 로그에 ChunkLoaded emit 자체가 없음 | 1 (BakedAsset) 또는 6 (NetMode/표면) |
| `Unknown GameplayTag` 경고 | 5 (태그 등록) |
| `Loaded JSON story:` 로그 부재 | 4 (StoryDirectories) |
| emit 은 되는데 spawner 안 발화 | 2 (PlacementStoryTag 빈 태그) 또는 3 (문자 불일치) |
| 로그에 `Event.Terrain.ChunkLoaded` 가 보이지만 placement 안 됨 | 2 (PlacementStoryTag 빈 태그 → 폴백) |

### 자동화 제안

콘솔 명령 `hkt.Placement.Diagnose` 를 추가해 6개 게이트를 한 번에 검사·리포트하는 것이 [I-0015 (결합 무결성)](intents/I-0015.md) 의 placement 영역 구현으로 자연스럽다.

## 점검 완료 메모

- **Region 메모리 미드조인 동기화** (2026-05-18) — Region 데이터는 별도 자료구조가 아닌 `Entity.Region` / `Entity.RegionRecord.*` 태그의 일반 SOA entity 로 저장(`HktWorldState.h:53-56`, `HktWorldState.cpp:186-245`)되어 `FHktWorldState::NetSerialize`(`HktWorldState.cpp:402-522`) 가 자동 포함. 미드조인은 `Client_ReceiveInitialState`(`HktGameMode.cpp:288-296`) → `RestoreWorldState`(`HktWorldDeterminismSimulator.cpp:503-516`) 경로로 전체 복원. 별도 작업 불필요.
