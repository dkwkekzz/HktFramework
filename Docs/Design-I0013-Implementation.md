# I-0013 성장을 위한 재료 — Voxel spawn 능력 구현 상태

[I-0013 의도 문서](intents/I-0013.md) 의 구현 진척·격차·임시 결정·레거시 처리 메모를 분리해 보관한다. 의도(왜) 문서가 일감 추적기로 비대해지는 것을 막기 위한 디자인 문서다.

> **이력 메모**: 본 문서는 옛 의도 구조의 `I-0014 (Voxel spawn 능력)` 로 작성·운영되어 왔다. 의도 구조 재정의 후 같은 *왜* 가 `I-0013 (성장을 위한 재료)` 로 이관됨에 따라 ID 만 갱신한다. 본문 내 `I-0013` 단서 / Phase 표기는 모두 *옛 I-0014 산출물* 과 1:1 대응.

관련 모듈 디자인: [HktGameplay/Source/HktTerrain/TerrainSpawner.design.md](../HktGameplay/Source/HktTerrain/TerrainSpawner.design.md)

**사용법 (디자이너용)**: [Howto-VoxelSpawnRules.md](Howto-VoxelSpawnRules.md) — VoxelSpawnRules 설정·튜닝·디버깅 절차.

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
[Entity Lifecycle]                            (Entity 가 발생한 직후 자체 Story 부착)
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
| **Catalog** | World 별 `SpawnTemplateMap[uint16 templateId → FGameplayTag StoryTag]` 를 baked asset 에 포함. 라이브러리가 *닫혀 있어야* (결합 무결성 원칙) 죽은 id / 미참조 voxel 검출 가능. |
| **시드 계약** | template 안에서 PRNG 시드는 *voxel 좌표 한 곳* 으로 한정. `SlotHash31`, `contextId` 등 보조 입력은 *흡수* 만 — 혼합 금지 (결정론 안의 다양성 원칙 보장). |
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
| NPC GameplayTag 체계 (`Entity.NPC.Goblin/Skeleton/Zombie`) + `Story_NPCLifecycle.json` (사망 → 드롭 → 제거) | `HktStory/Public/HktStoryTags.h:22-23` · `Story_NPCLifecycle.json` |
| **I-0013 Voxel spawn attribution 완성** — Bake 시점에 `FHktTerrainBakedConfig::VoxelTypeSpawnTemplate` (TMap<int32 VoxelTypeID, FGameplayTag>) 매핑으로 attribution 자동 산출, 런타임 read-only. baked chunk `SpawnTemplateAttribution` (TMap<uint16 packedLocalCoord, uint16 templateId>) + baked asset `SpawnTemplateCatalog` (TMap<uint16, FGameplayTag>). `IHktTerrainDataSource::GetChunkVoxelAttribution` + `FHktVoxelAttributionView` POD. `FHktTerrainSystem::Process` 가 voxel 한 점마다 *template StoryTag* 를 EventTag 로 직접 dispatch (SlotHash31 = voxel 좌표 해시). BakeVersion v4→v5. **레거시 일괄 제거** — chunk-level Placement Story 분기 (PlacementStoryTag / FHktTerrainChunkContext / TryGetChunkContext / TryGetSurfaceContext / HktTerrainEventTags::ChunkLoaded / HktEventBuilder::ChunkLoaded / ChunkLoadedParams / surface meta BiomeId·SurfaceVoxelZ·SlotHash 필드 / Placement_TranquilWilds.json) 모두 삭제. | `HktTerrainBakedAsset.h/.cpp` (v5 + `VoxelTypeSpawnTemplate`) · `HktTerrainBakeLibrary.cpp` (column scan + catalog/attribution 산출) · `HktTerrainDataSource.h` (`FHktVoxelAttributionView`, `GetChunkVoxelAttribution`) · `HktTerrainProvider.h/.cpp` (카탈로그 해석) · `HktStoryEventParams.h` (`VoxelTemplateParams::`, `HktEventBuilder::VoxelTemplateActivated`) · `HktSimulationSystems.h/.cpp` (voxel 평가 패스) |
| **I-0013 Phase C — 트리거 채널 단일 진입점** — `HktEventBuilder::VoxelTemplateActivatedAt(StoryTag, VoxelWorld{X,Y,Z}, VoxelSizeCm)` 단일 빌더 + `HktEventBuilder::ComputeVoxelSlotHash31(X,Y,Z)` 시드 단일 출처. 자연 발생/트리거 두 입구가 동일 빌더 통과로 voxel 한 점에서 합류 — attribution 슬롯은 건드리지 않는 read-only 모델 유지. Provider 의 SlotHash31 산출도 동일 함수로 통합. | `HktStoryEventParams.h` (`VoxelTemplateActivatedAt`, `ComputeVoxelSlotHash31`) · `HktTerrainProvider.cpp` (시드 함수 위임) |
| **I-0013 동작 검증 자동화 테스트** — 두 입구가 동일 voxel 좌표 입력에 대해 형식적으로 동일한 `FHktEvent` 를 산출함을 검증. SlotHash31 결정성·31bit 범위·인접 voxel 분기 + Param 슬롯 매핑 (VoxelTemplateParams::) 준수도 함께 검증. 5개 테스트 추가, RunOpcodeTests 에 등록. | `HktAutomationTests/Private/Tests/HktI0014VoxelAttributionTests.cpp` · `HktAutomationTestsRunner.cpp` |
| **결합 무결성 1차 정적 검증** — BakeRegion 후처리에서 catalog ↔ attribution 결합 무결성 체크. 어떤 voxel 도 참조하지 않는 catalog templateId (디자이너 매핑 오타 / region 에 부재한 voxel type) 를 WARN 으로 가시화. | `HktTerrainBakeLibrary.cpp` (orphan catalog detection) |
| **인게임 검증 콘텐츠** — Phase B 베이크 자동 채움 → 런타임 read-only spawn 의 검증 스토리. *spawn 주체 = 나무 + NPC* (재료 = entity, item 이 아님). voxel 한 점 → ① Oak 1본 + Oak_Lifecycle dispatch, ② Slime NPC 1마리 + NPC.Lifecycle dispatch. 두 spawner 모두 `CountByTag<N` 글로벌 cap 으로 voxel 다수 attribute 시 spawn 폭주 차단. Lifecycle 은 기존 (Oak_Lifecycle: State.Dead → Branch drop / OakSaplingSeed, NPC.Lifecycle: State.Dead → 랜덤 loot / DestroyEntity) 재사용. | `Content/Stories/Natural/Tree_Spawn.json` + `.spec.json` · `Content/Stories/Natural/Slime/Slime_Spawn.json` + `.spec.json` · `HktCoreTags.h/.cpp` (`HktNaturalStoryTags::TreeSpawn`/`SlimeSpawn`) · `HktStoryTags.h/.cpp` (`Entity_NPC_Slime`) |
| **v6 다양성 확장 — VoxelSpawnRules** | "voxel type 1개당 spawner 1개" 의 단조성 해소. `VoxelTypeSpawnTemplate` (TMap<int32,FGameplayTag>) 폐기 → `VoxelSpawnRules` (TArray<FHktVoxelSpawnRule {VoxelTypeID, StoryTag, Weight}>) 도입. 동일 voxel type 에 *복수* 후보 + weight 선언 가능. invalid StoryTag = skip 슬롯 (해당 weight 만큼 spawn 없음 확률). BakeRegion 이 voxel 좌표 시드 (`ComputeVoxelSlotHash31`) 로 결정론적 weighted-pick → 동일 voxel 재방문 동일 결과 (결정론 안의 다양성 원칙). BakeVersion v5→v6. `bake_terrain.py` 기본 후보: Snow(40 Tree / 10 Slime / 50 skip), Gravel(50 Tree / 50 skip), Clay(50 Slime / 10 Tree / 40 skip), Sand(30 Slime / 70 skip). | `HktTerrainBakedAsset.h` (`FHktVoxelSpawnRule` USTRUCT, `FHktTerrainBakedConfig::VoxelSpawnRules`, `CurrentBakeVersion=6`) · `HktTerrainBakeLibrary.cpp` (bucket 빌드 + cumulative-weight + `HktEventBuilder::ComputeVoxelSlotHash31` 호출) · `Content/Python/bake_terrain.py` (`default_voxel_spawn_rules`, `apply_voxel_spawn_rules`) |

## 부분 / 의도-구현 격차

Phase A → B → C 순서로 의존. 한 줄 라벨은 구현 순서 참조용.

| 갭 | 의도 표현 | 현 구현 | 단계 |
|---|---|---|---|
| ~~**Voxel attribution 슬롯**~~ | baked chunk 가 per-surface-voxel `SpawnTemplateId` 를 보유 (sparse) | **완료 (Phase A)** — `FHktTerrainBakedChunk::SpawnTemplateAttribution` (TMap<uint16, uint16>) + `PackLocalCoord` 5+5+5 비트 패킹. v5. | ✅ |
| ~~**Template 라이브러리 명시화**~~ | "이 World 의 spawn template 집합" 이 catalog 로 닫혀 있음 | **완료 (Phase A)** — `UHktTerrainBakedAsset::SpawnTemplateCatalog` (TMap<uint16, FGameplayTag>). Provider 가 해석 단계에서 lookup. 결합 무결성 정적 검증은 E 위임. | ✅ |
| ~~**Voxel 평가 → template 활성화 경로**~~ | 청크 스트림인 시점에 attribution 보유 voxel 들을 fan-out 해 template 활성화. 시드 = voxel 좌표. | **완료 (Phase A)** — `IHktTerrainDataSource::GetChunkVoxelAttribution` + `FHktTerrainSystem::Process` 의 voxel 평가 패스. attribution 비어 있지 않으면 voxel 한 점마다 template StoryTag 를 EventTag 로 직접 dispatch. SlotHash31 은 voxel 좌표 단위 해시 (결정론 안의 다양성 원칙 사전 적용). | ✅ |
| ~~**Placement Story 패턴 마이그레이션**~~ | placement 는 voxel 에 attribution 을 *기록* 만 한다 — 즉시 실행 금지. | **완료** — placement story 자체를 폐지하고 모든 잔존 코드 일괄 제거. BakeRegion 의 voxel type → template 매핑이 attribution 을 *bake 시점* 에 산출, 런타임은 읽기 전용. `SetVoxelTemplate` opcode 미도입 (트리거 경로용으로 Phase C 에서 도입 가능). | ✅ |
| ~~**자연 발생 baked 자동 채움**~~ | voxel attribution 이 BakeRegion 결과로 자동 채워짐 | **완료 (Phase B)** — `BakeRegion` 의 surface column scan + `VoxelTypeSpawnTemplate` 디자이너 매핑으로 자동 산출. | ✅ |
| ~~**트리거 경로**~~ | Quest / Cinematic / Encounter 가 voxel 한 점에 template 을 활성화 | **완료 (Phase C — 변형)** — read-only attribution 모델을 유지하며 attribution 슬롯을 *건드리지 않는* 방향으로 정의. 트리거 caller 가 `HktEventBuilder::VoxelTemplateActivatedAt(StoryTag, VoxelX, VoxelY, VoxelZ, VoxelSizeCm)` 를 직접 호출 → 자연 발생과 *동일 빌더* 통과로 두 입구가 voxel 한 점에서 합류. SlotHash31 계산은 `ComputeVoxelSlotHash31` 단일 출처. 실제 Quest opcode / GameMode 트리거 caller wiring 은 별도 PR. | ✅ |
| ~~**Placement 결합의 정적 검증 (1차)**~~ | 매핑 미스 / 죽은 template id / 미참조 voxel 이 빌드·로드 시점에 차단 | **완료 (BakeRegion 후처리)** — 미참조 catalog 엔트리 검출 → WARN 으로 디자이너에게 매핑 오타/over-spec 가시화. 본격 정적 검증 (HKT_INSIGHTS Build / cooker hook) 은 결합 무결성 원칙의 후속 작업으로 남김. | ✅ (부분) |
| ~~**결정론 RNG seed (voxel 좌표 일원화)**~~ | 동일 voxel 재방문 → 동일 출현 | **완료 (Phase C)** — `HktEventBuilder::ComputeVoxelSlotHash31(X,Y,Z)` 단일 출처. 자연 발생/트리거 두 입구 모두 본 함수를 통과 — automation test (`Test_VoxelTemplate_TriggerMatchesNaturalSeed`) 로 결정성·일치성 검증. | ✅ |
| **Placement 콘텐츠 자동 산출** | feature_design → Placement JSON / template 라이브러리 / voxel attribution 자동 생성 | Generator 파이프라인에 placement 단계 부재. 의도는 [I-0015 (콘텐츠 자동화 및 에셋 파이프라인)](intents/I-0015.md) 에 위임. | E (위임) |

## 구현 단계 (요약)

A → B → C 의 의존 사슬. 각 묶음이 PR 1개.

- ~~**A. Voxel attribution 인프라**~~ — per-surface-voxel `SpawnTemplateId` 슬롯 + template catalog + voxel 평가 패스. BakeVersion v4→v5. **✅ 완료**
- ~~**B. Placement Story 마이그레이션**~~ — 디자이너 의도 ("voxel type 별로 BakeAsset 에 물려놓고 런타임은 읽기만") 를 채택하여 **bake-시점 자동 채움** 으로 일원화. `VoxelTypeSpawnTemplate` 매핑 + `BakeRegion` surface column scan. 호환 어댑터·placement story·surface meta 필드·`PlacementStoryTag`·`HktTerrainEventTags::ChunkLoaded`·`FHktTerrainChunkContext`·`Placement_TranquilWilds.json` 등 폐기된 모든 잔존 코드/데이터를 일괄 제거. **✅ 완료**
- ~~**C. 트리거 채널**~~ — *변형 완료*: read-only attribution 모델에 맞추어 *런타임 덮어쓰기 없이* 트리거 경로 정의. `HktEventBuilder::VoxelTemplateActivatedAt` 단일 진입점 + `ComputeVoxelSlotHash31` 시드 단일 출처 — 자연 발생/트리거 두 입구가 동일 빌더 통과로 voxel 한 점에서 합류. Quest opcode / GameMode 트리거 caller wiring 은 별도 PR. **✅ 완료**
- **E. 횡단 원칙 / 인접 의도 위임** — 결합 무결성 정적 검증 (cooker hook / HKT_INSIGHTS Build) · 결정론 안의 다양성 원칙 (voxel 좌표 시드 일원화) · [I-0015 (콘텐츠 자동화 및 에셋 파이프라인)](intents/I-0015.md) 의 자동 산출 파이프라인.

## "PendingWorldInit" 레거시

`AHktGameMode::InitGame` 의 `WorldInitStoryTag` 1회 발동 경로 (`FHktDefaultServerRule::PendingWorldInit`) 는 본 시스템과 공존한다. 설계상 (TerrainSpawner.design.md §7) Phase 3 (BakeRegion 의 WorldInitLocation 자동 spawner slot 화) 완료 시 제거 예정이나 현재는 부트스트랩 호환성을 위해 보존. Phase A 의 명시 배치 attribution (`FHktExplicitAttribution`) 가 도입되면 자연스럽게 흡수된다.

## 점검 완료 메모

- **Region 메모리 미드조인 동기화** (2026-05-18) — Region 데이터는 별도 자료구조가 아닌 `Entity.Region` / `Entity.RegionRecord.*` 태그의 일반 SOA entity 로 저장(`HktWorldState.h:53-56`, `HktWorldState.cpp:186-245`)되어 `FHktWorldState::NetSerialize`(`HktWorldState.cpp:402-522`) 가 자동 포함. 미드조인은 `Client_ReceiveInitialState`(`HktGameMode.cpp:288-296`) → `RestoreWorldState`(`HktWorldDeterminismSimulator.cpp:503-516`) 경로로 전체 복원. 별도 작업 불필요.
