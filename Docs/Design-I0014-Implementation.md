# I-0014 Voxel spawn 능력 — 구현 상태

[I-0014 의도 문서](intents/I-0014.md) 의 구현 진척·격차·임시 결정·레거시 처리 메모를 분리해 보관한다. 의도(왜) 문서가 일감 추적기로 비대해지는 것을 막기 위한 디자인 문서다.

관련 모듈 디자인: [HktGameplay/Source/HktTerrain/TerrainSpawner.design.md](../HktGameplay/Source/HktTerrain/TerrainSpawner.design.md)

## 핵심 흐름

본 의도가 고정한 모델 — *spawn 주체 = voxel · 정책 = template · 연결 = voxel attribution* — 으로 흐름을 표기한다.

```
[청크 로드]                                   (FHktTerrainSystem::Process)
   │
   ├─ Event.Terrain.ChunkLoaded emit          (HktEventBuilder::ChunkLoaded)
   │     Param2 = BiomeId, Param3 = SlotHash31
   ▼
[Placement Story]                             (Content/Stories/Natural/Placement_*.json)
   │  biome × World × 정책 분기
   │  → 대상 voxel 들에 SpawnTemplateId attribution 부여 (즉시 실행 X)
   ▼
[Voxel Attribution]                           (baked chunk + 런타임 덮어쓰기)
   │  voxel 평가 시점 (스트림인 / 청크 활성화)
   │  → 참조 template 활성화
   ▼
[Terrain Story Template]                      (Content/Stories/Natural/<Entity>/<Entity>_Spawn.json — voxel 이 참조하는 소수 라이브러리)
   │  Region 메모리 조회/갱신
   │  voxel 좌표 시드 → 결정론적 다양성 (보조 입력은 흡수, 혼합 금지)
   │  SpawnEntity opcode + 위치/속성 부여
   │  Lifecycle Story dispatch (DispatchEventFrom)
   ▼
[Entity Lifecycle]                            (I-0010 위임)
```

코드 모델의 "Spawner" 는 별도 객체가 아니라 **voxel 의 한 속성** 이다. 정책 자체는 *spawner-story (자연 발생 정책을 담은 bytecode)* 가 담당하지만, voxel attribution 으로 연결되어야 본 의도의 모델에 들어온다. 명시 배치 / 보스용 `FHktTerrainSpawnerSpec` 은 baked asset 의 정적 데이터로 존재하나 자연 발생 자동 채움에는 사용되지 않으며, 향후 voxel attribution 으로 일원화될 후보다.

## 부여 정책 — 임시 결정

> 첫 vertical slice 진입 직전 단계의 *임시* 결정. 실제 구현으로 검증되기 전까지 변경 가능. 이 섹션이 안정화되면 핵심 흐름 본문으로 흡수된다.

### 어떤 voxel 에 부여하는가

| 경로 | 후보 voxel | 부여 시점 |
|---|---|---|
| **자연 발생** (대다수: 나무·돌·일반 NPC) | *surface voxel 만* (`bIsSurfaceChunk == true` + `SurfaceVoxelZ` 좌표). 청크의 surface 집합 안에서 placement story 의 결정론 PRNG (voxel 좌표 시드) 로 sparse 샘플링. | 청크 활성화 시 placement story 가 attribution 데이터로 부여 |
| **명시 배치** (보스·시작 지점 등) | *임의 voxel* — 좌표 직접 지정. 기존 `FHktTerrainSpawnerSpec` 의 (PosX/Y/Z) 를 voxelCoord 로 정규화. | 베이크 시점에 baked asset 에 박힌 채로 로드 |
| **트리거 기반** (Quest / Cinematic / Encounter — 후속 단계) | 임의 voxel. 자연 발생과 같은 슬롯을 *런타임에 덮어쓰는* 형태로 합류. | 트리거 발사 시점에 attribution 갱신 opcode 로 |

세 경로 모두 *voxel 한 점* 으로 합류한다 — 부여 시점만 다르고, 평가 / 활성화 / 시드는 동일하다.

### 어떻게 부여하는가

| 층 | 결정 |
|---|---|
| **신 opcode** | `SetVoxelTemplate(voxelCoord, templateId)` — placement story 안에서 voxel 한 점에 attribution 을 기록. 트리거 경로도 동일 opcode 사용 (런타임 덮어쓰기). |
| **Baked 표현 (1차)** | per-voxel `SpawnTemplateId` 슬롯을 *청크 전체* 가 아닌 *surface voxel set 만* 보유. `TMap<VoxelLocalCoord, uint16>` 형태로 sparse 저장 — 자연 발생 voxel 수가 surface 의 일부에 지나지 않으므로 메모리 폭발 방지. |
| **Baked 표현 (2차)** | 명시 배치용 별도 `TArray<FHktExplicitAttribution>` (voxelCoord + templateId). 보스·시작 지점처럼 *surface 밖 voxel* 까지 허용해야 하는 경우 흡수. |
| **Catalog** | World 별 `SpawnTemplateMap[uint16 templateId → FGameplayTag StoryTag]` 를 baked asset 에 포함. 라이브러리가 *닫혀 있어야* (`I-0015` 적용) 죽은 id / 미참조 voxel 검출 가능. |
| **시드 계약** | template 안에서 PRNG 시드는 *voxel 좌표 한 곳* 으로 한정. `SlotHash31`, `contextId` 등 보조 입력은 *흡수* 만 — 혼합 금지 (`I-0017` 보장). |
| **BakeVersion** | `FHktTerrainBakedConfig` v4 → v5 (per-voxel attribution + catalog 도입). |

이 표는 *어디서 어떻게 시작할 것인가* 의 임시 답이지, 최종 데이터 모델 결정이 아니다. 첫 PR (Phase A) 진행 중 surface-only 가정이 깨지거나 sparse map 의 베이크 비용이 부적합하면 조정한다.

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
| NPC GameplayTag 체계 (`Entity.NPC.Goblin/Skeleton/Zombie`) + `Story_NPCLifecycle.json` (사망 → 드롭 → 제거) | `HktStory/Public/HktStoryTags.h:22-23` · `Story_NPCLifecycle.json` |

## 부분 / 의도-구현 격차

Phase A → B → C 순서로 의존. 한 줄 라벨은 구현 순서 참조용.

| 갭 | 의도 표현 | 현 구현 | 단계 |
|---|---|---|---|
| **Voxel attribution 슬롯** | baked chunk 가 per-surface-voxel `SpawnTemplateId` 를 보유 (sparse) | 미구현 — `FHktTerrainBakedChunk` 는 BiomeId / SurfaceVoxelZ / SlotHash 까지만. voxel-level template 참조 슬롯 부재. | **A** (기반) |
| **Template 라이브러리 명시화** | "이 World 의 spawn template 집합" 이 catalog 로 닫혀 있음 | 부분 — `FHktVMProgramRegistry` 의 1태그 1프로그램 dispatch 가 사실상 template 역할이나, voxel attribution 으로 연결되지 않아 *어떤 template 이 어디서 쓰이는지* 의 정적 매핑이 부재. | **A** |
| **Voxel 평가 → template 활성화 경로** | 청크 스트림인 시점에 attribution 보유 voxel 들을 fan-out 해 template 활성화. 시드 = voxel 좌표. | 미구현 — 현재는 `Event.Terrain.ChunkLoaded` 1회 emit 후 Placement Story 가 *청크 단위로* 모두 처리. voxel 단위 평가 fan-out 없음. | **A** |
| **Placement Story 패턴 마이그레이션** | placement 는 voxel 에 attribution 을 *기록* 만 한다 — 즉시 실행 금지. | `Placement_TranquilWilds.json` 은 `DispatchEvent(OakSpawn)` 으로 *즉시 발사*. attribution 부여용 opcode (`SetVoxelTemplate`) 및 대상 voxel 집합 표현 부재 — 출력 형식 자체를 갈아엎어야 한다. | **B** |
| **자연 발생 baked 자동 채움** | voxel attribution 이 BakeRegion 결과로 자동 채워짐 | 미구현 — `BakeRegion` 단계에서 voxel 별 template id 산출 부재. 우선은 Placement Story 가 런타임에 attribution 부여, 베이크 자동화는 후속. | **B** (선택) |
| **트리거 경로 (런타임 attribution 덮어쓰기)** | Quest / Cinematic / Encounter 가 대상 voxel 의 `SpawnTemplateId` 를 갱신 → 다음 평가에서 활성화 | 미정의. `HktStoryEventParams.h` 에 채널 없음. 런타임 attribution 변경 opcode 부재. | **C** |
| **Placement 결합의 정적 검증** | 매핑 미스 / 죽은 template id / 미참조 voxel 이 빌드·로드 시점에 차단 | 런타임 silent skip. 의도는 [I-0015](intents/I-0015.md) 의 placement 적용 영역. voxel attribution 도입 시 두 갈래로 검증 항목 확장. | E (위임) |
| **결정론 RNG seed (voxel 좌표 일원화)** | 동일 voxel 재방문 → 동일 출현 | `Param3 = SlotHash31` 까지 emit 완료. story-local PRNG 수단은 [I-0017](intents/I-0017.md) 적용 영역. voxel 좌표 단위 축소는 attribution 도입 이후 가능. | E (위임) |
| **Placement 콘텐츠 자동 산출** | feature_design → Placement JSON / template 라이브러리 / voxel attribution 자동 생성 | Generator 파이프라인에 placement 단계 부재. 의도는 [I-0007](intents/I-0007.md) 자체. | E (위임) |

## 구현 단계 (요약)

A → B → C 의 의존 사슬. 각 묶음이 PR 1개.

- **A. Voxel attribution 인프라** — per-surface-voxel `SpawnTemplateId` 슬롯 + template catalog + voxel 평가 패스. BakeVersion v4→v5. 기존 Oak/Birch 동작은 어댑터로 호환 유지.
- **B. Placement Story 마이그레이션** — `SetVoxelTemplate` opcode 도입, `Placement_TranquilWilds.json` 신 형식 재작성, Oak/Birch 가 attribution 부여로. 호환 어댑터 제거.
- **C. 트리거 채널** — 런타임 attribution 덮어쓰기 + `Event.NPC.Spawn.Requested` 등 트리거 채널 정의. 두 입구가 voxel 한 점에서 합류함을 검증.
- **E. 일반 의도 위임** — [I-0015](intents/I-0015.md) 정적 검증 · [I-0017](intents/I-0017.md) voxel 좌표 시드 · [I-0007](intents/I-0007.md) 자동 산출 파이프라인.

## "PendingWorldInit" 레거시

`AHktGameMode::InitGame` 의 `WorldInitStoryTag` 1회 발동 경로 (`FHktDefaultServerRule::PendingWorldInit`) 는 본 시스템과 공존한다. 설계상 (TerrainSpawner.design.md §7) Phase 3 (BakeRegion 의 WorldInitLocation 자동 spawner slot 화) 완료 시 제거 예정이나 현재는 부트스트랩 호환성을 위해 보존. Phase A 의 명시 배치 attribution (`FHktExplicitAttribution`) 가 도입되면 자연스럽게 흡수된다.

## 점검 완료 메모

- **Region 메모리 미드조인 동기화** (2026-05-18) — Region 데이터는 별도 자료구조가 아닌 `Entity.Region` / `Entity.RegionRecord.*` 태그의 일반 SOA entity 로 저장(`HktWorldState.h:53-56`, `HktWorldState.cpp:186-245`)되어 `FHktWorldState::NetSerialize`(`HktWorldState.cpp:402-522`) 가 자동 포함. 미드조인은 `Client_ReceiveInitialState`(`HktGameMode.cpp:288-296`) → `RestoreWorldState`(`HktWorldDeterminismSimulator.cpp:503-516`) 경로로 전체 복원. 별도 작업 불필요.
