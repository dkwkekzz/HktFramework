# Runtime Pipeline — User Input → Game Running

> **상태**: 본 문서는 검증된 코드 기반 트레이스. 추측 없이 file:line 인용.
> **범위**: 컨셉 텍스트 입력에서 시뮬레이션 틱이 스토리를 실행하기까지의 전체 경로.
> **참조**: [HktGameplay/Source/HktTerrain/TerrainSpawner.design.md](../HktGameplay/Source/HktTerrain/TerrainSpawner.design.md), [HktGameplay/CLAUDE.md](../HktGameplay/CLAUDE.md).

---

## 0. 한눈에 보기

```
[A] Generator (MCP, LLM)            — 컨셉 텍스트 → .uasset / Story bytecode
[B] Terrain Bake (Editor, 1회)      — Generator config → UHktTerrainBakedAsset
[C] Level Setup (Editor, 수동)      — 액터 배치 + UPROPERTY 편집
[D] Bootstrap (Play 클릭)           — InitGame → Subsystem/Provider 와이어링
[E] Simulation Tick (30Hz)          — 스토리 bytecode 실행 ★ 실재생 지점
[F] Presentation                    — FHktWorldView → 시각 액터/VFX
```

각 단계의 입력·출력과 코드 위치를 명시하여 어디서 멈췄는지 추적 가능하게 함.

---

## [A] 컨셉 → 에셋 생성 (Generator, MCP 서버)

런타임 외부. Claude Code 슬래시 커맨드로 호출.

| 스텝 | 입력 | 출력 | 출력 경로 | 비고 |
|---|---|---|---|---|
| `/concept-design` | 사용자 자유 텍스트 | terrain_spec + feature_outlines | `.hkt_steps/{pid}/concept_design/output.json` | JSON intent |
| `/feature-design` | feature_outlines | features[].stories[].story_tag + expected_assets | `.hkt_steps/{pid}/feature_design/output.json` | JSON intent |
| `/story-gen` | features.stories[] | Story V2 JSON + 런타임 등록 | `HktGameplay/Content/Stories/*.json` | ★ .uasset 아님 — 모듈 로드 시 `FHktVMProgramRegistry` 등록 |
| `/asset-discovery` | story_files | characters[]/items[]/vfx[] 명세 | `.hkt_steps/{pid}/asset_discovery/output.json` | 메타데이터만 |
| `/char-gen` | characters[] | 캐릭터 BP | `/Game/Generated/Characters/{Name}/BP_{Name}.uasset` | ConventionPath |
| `/item-gen` | items[] | 아이템 StaticMesh | `/Game/Generated/Items/{Cat}/SM_{Sub}.uasset` | ConventionPath |
| `/vfx-gen` | vfx[] | Niagara System | `/Game/Generated/VFX/NS_{Name}.uasset` | ConventionPath |
| `/texture-gen` | texture intents | Texture2D | `/Game/Generated/Textures/*.uasset` | SD WebUI |
| `/map-gen` | terrain_spec | HktMap JSON | `.hkt_maps/{id}.json` | ⚠️ **dead path** — `UHktMapStreamingSubsystem::LoadMap` 호출자 0건 |

**Story 등록 메커니즘** — 두 경로 모두 동일 레지스트리 사용.
- 정적 cpp: `HKT_REGISTER_STORY_BODY()` ([HktStory/Private/Definitions/*.cpp](../HktGameplay/Source/HktStory/Private/Definitions/)) → `FHktStoryRegistry::InitializeAllStories` ([HktStoryModule.cpp:53](../HktGameplay/Source/HktStory/Private/HktStoryModule.cpp)).
- 동적 JSON: `McpBuildStory` → `FHktStoryBuilder::Build` → `FHktVMProgramRegistry::Get().RegisterProgram` ([HktStoryBuilder.cpp:1510](../HktGameplay/Source/HktCore/Private/HktStoryBuilder.cpp)).

---

## [B] 지형 베이크 (UE5 Editor, 1회성)

선택적이지만 결정론·로드 비용 측면에서 권장. 미실행 시 런타임이 매번 Generator 폴백.

```
사용자 액션: 에디터에서 UHktTerrainBakeLibrary::BakeRegion 호출
            (Python 스크립트 또는 에디터 메뉴)
   ↓
입력: ChunkMin/Max(FIntVector), FHktTerrainGeneratorConfig
   ↓
[BakeRegion]  HktTerrainBakeLibrary.cpp:17-164
   ├─ 각 청크 GenerateChunk(Config, …)
   ├─ 압축 → Asset->Chunks[].Add
   ├─ Asset->BakeVersion = 2
   ├─ Asset->Spawners[] ❌ 비어있음 (Phase 3-d 미구현)
   └─ Asset->RebuildIndex()
   ↓
출력: UHktTerrainBakedAsset (.uasset, 기본 /Game/Baked/{name}.uasset)
```

베이크 후 사용자가 산출 `.uasset` 의 SoftObjectPath 를 [C] 의 액터 BakedAsset 슬롯에 할당.

---

## [C] 레벨 셋업 (Editor, 수동)

사용자가 World 또는 Level Blueprint 에 액터를 배치하고 UPROPERTY 를 채운다.

```
World Settings 또는 Outliner:
  AHktGameMode  (HktGameMode.h:38-50)
    UPROPERTY(EditAnywhere) FGameplayTag WorldInitStoryTag  ← 사용자 입력
    UPROPERTY(EditAnywhere) FVector      WorldInitLocation
```
```
Level 내 액터 (셋 중 하나, 또는 조합):
  AHktVoxelTerrainActor      (HktVoxelTerrainActor.h:259)
    UPROPERTY(EditAnywhere) TSoftObjectPtr<UHktTerrainBakedAsset> BakedAsset
  AHktSpriteTerrainActor      — 동일 패턴
  AHktLandscapeTerrainActor   — 동일 패턴
```

**현재 부트스트랩 진입점은 `WorldInitStoryTag` 단 하나.** 사용자가 여기에 박은 스토리가 첫 틱에 발화하고, 그 스토리 본문에서 `SpawnEntity`/`DispatchEvent` 등으로 후속 콘텐츠를 생성.

---

## [D] 런타임 부트스트랩 (Play 클릭 시)

```
AHktGameMode::InitGame                              HktGameMode.cpp:26-100
  ├─ GetServerRule()
  │     실패 → HKT_EVENT_LOG Error "ServerRule is null"
  │
  ├─ UHktTerrainSubsystem::Get(this)
  │     ★ Subsystem 부재 시 silent 진행 — 이후 RebindTerrainProvider 에서 폴백 로그
  │
  ├─ Sub->SetFallbackConfig(SettingsCfg)            line 82
  │     ProjectSettings → FHktTerrainGeneratorConfig 주입
  │
  ├─ AHkt*TerrainActor::BeginPlay (병렬)
  │   └─ Subsystem->LoadBakedAsset(SoftRef)         HktTerrainSubsystem.cpp:96-167
  │       ├─ Null SoftRef    → Warning "SoftRef 가 null — 폴백 경로만 동작"
  │       ├─ 이미 로드됨      → Log "이미 로드됨 — 즉시 결합"
  │       ├─ 비동기 완료      → Log "로드 완료 — ChunkCount=…"
  │       └─ 비동기 실패      → Warning "비동기 로드 실패 — 폴백 경로만 동작"
  │
  ├─ OnEffectiveConfigChanged 발화 → RebindTerrainProvider
  │     HktGameMode.cpp:139~  (구현부 시작)
  │     ├─ Subsystem 없음 → Log "UHktTerrainSubsystem 부재 — Provider 등록 생략"      (line 148)
  │     └─ 성공            → Log "Terrain Provider 재바인딩 — VoxelSizeCm=… ChunkSize=…" (line 169)
  │       └─ FHktTerrainProvider 생성 → Graph->SetTerrainSource(Provider)
  │             그룹별 시뮬레이터에 IHktTerrainDataSource 주입
  │
  └─ if (WorldInitStoryTag.IsValid())               line 96-99
      └─ Rule->OnEvent_GameModeInitWorld(Tag, Location)
            HktServerRule.cpp:237-241
            ├─ Tag invalid → silent return  ⚠️ 로그 없음
            └─ PendingWorldInit.Emplace(Tag, Location)
```

---

## [E] 시뮬레이션 틱 — 스토리가 실제 재생되는 순간

30Hz 고정 틱. `AHktGameMode::Tick` → `Rule->OnEvent_GameModeTick`.

```
FHktDefaultServerRule::OnEvent_GameModeTick         HktServerRule.cpp:247
  ├─ Frame.AdvanceFrame()
  ├─ Graph.UpdateRelevancy()
  ├─ NumGroups = Graph.NumRelevancyGroup()
  ├─ PendingGroupIntents.SetNum(NumGroups)
  │
  ├─ [현재 유일 active 부트스트랩 경로]
  │  PendingWorldInit 소비                          HktServerRule.cpp:327~
  │     Tag invalid                                  → Warning "WorldInit story 큐잉되지 않음"
  │     NumGroups==0 (RelevancyGroup 미생성)         → Warning 1회 + 큐 유지 (다음 틱 재시도)
  │     Success                                       → Log "dispatched: tag=… group=… eventId=…"
  │     E = HktEventBuilder::Spawner(Tag, X, Y)
  │     E.Location = WorldInitLocation
  │     E.EventId = ++ServerEventSequence
  │     PendingGroupIntents[group].Add(E)
  │
  └─ ParallelFor(groups) → Simulator.AdvanceFrame(GroupBatch)
        │  → FHktWorldDeterminismSimulator::ProcessBatch   HktWorldDeterminismSimulator.cpp:56
        │
        ├─ TerrainSystem.Process            ★ Phase 4 신규 hook
        │     HktSimulationSystems.cpp:510-626
        │     │
        │     ├─ 엔티티/이벤트 위치 → RequiredChunks 계산
        │     │
        │     ├─ for each Coord in RequiredChunks:
        │     │     if (!TerrainState.IsChunkLoaded(Coord))
        │     │         TerrainState.LoadChunk(Coord, Source)
        │     │         Source.GetChunkSpawners(Coord, OutViews)
        │     │             └─ FHktTerrainProvider::GetChunkSpawners
        │     │                  HktTerrainProvider.cpp:50-103
        │     │                  · BakedAsset 미로드 → 인스턴스당 1회 Log "Phase 4 dormant"
        │     │                  · Spawners[] 비어있음 → silent (의도된 경로)
        │     │         for view in OutViews:
        │     │             if (!view.StoryTag.IsValid()) ++SkippedInvalidSpawnerTags  → 프레임 단위 집계
        │     │             else EmittedSpawnerEvents.Add(SpawnerFromView(view))
        │     │
        │     │     EmittedFromThisChunk > 0       → Verbose "chunk loaded — emitted N spawner event(s)"
        │     │     SkippedInvalidSpawnerTags > 0  → Warning "N spawner skipped (invalid StoryTag)"
        │     │
        │     └─ Unload(필요 없는 청크)
        │
        ├─ MergedEvents = NewEvents + EmittedSpawnerEvents       line 75-88
        │
        ├─ VMBuildSystem.Process(MergedEvents, …)                line 240-340
        │     for each Event in MergedEvents:
        │         Program = FHktVMProgramRegistry::FindProgram(Event.EventTag)
        │         if (!Program)
        │             HKT_EVENT_LOG Error "No program for {tag} — Story 미등록"
        │         else
        │             VM Runtime 생성, Context.Event{Param0..3, TargetPosX/Y/Z} 채움
        │             ActiveVMs.Add(Handle)
        │
        ├─ VMProcessSystem.Process — bytecode 실행 (최대 4 라운드 DispatchEvent)
        │
        ├─ Gravity/Movement/Physics → 충돌·MoveEnd·Grounded 이벤트
        ├─ PendingExternalEvents 즉시 소비 (같은 프레임)
        └─ VMCleanupSystem + CaptureVMSnapshots (late-join 복구용)
```

---

## [F] 결과 가시화 (클라이언트)

```
서버 ProcessBatch 결과 → FHktSimulationEvent 배치 직렬화 → 클라 송신
   ↓
AHktIngamePlayerController::Client_ReceiveFrameBatch
   ↓
UHktPresentationSubsystem::OnWorldViewUpdated
   · 새 엔티티 GameplayTag 발견
   ↓
UHktAssetSubsystem::LoadAssetAsync(Tag)
   · Tag → ConventionPath → /Game/Generated/Characters/{Name}/BP_{Name}.uasset  ([A] 산출물)
   ↓
World->SpawnActor(BlueprintClass, Location)  — 읽기 전용 시각 액터
   + Niagara VFX 트리거 (HktVFX 모듈)
```

---

## 상태 매트릭스

| 단계 | 작동 | 비고 |
|---|---|---|
| [A] story-gen, char/item/vfx-gen | ✅ | story 는 bytecode, 나머지는 `.uasset` |
| [A] map-gen | ⚠️ dead | `HktMap` JSON 의 런타임 consumer 부재 |
| [B] BakeRegion (Chunks) | ✅ | `.uasset` 산출 |
| [B] BakeRegion (Spawners[]) | ❌ | Phase 3-d 미구현 — 항상 빈 배열 |
| [C] 레벨 셋업 | ✅ | 수동 |
| [D] 부트스트랩 와이어링 | ✅ | Subsystem + Provider + WorldInitStoryTag |
| [E] PendingWorldInit → Story | ✅ | **현재 유일 부트스트랩** |
| [E] Chunk-load → Spawner (Phase 4) | ⚠️ 데이터 부재 | 구조 완성, Asset.Spawners 가 비어 발화 0 |
| [F] Presentation | ✅ | Tag 기반 자동 로드 |

---

## Phase 4 활성화에 필요한 후속 작업

본 PR (Phase 4) 의 chunk-load → spawner dispatch 인프라는 완전하나, 데이터 공급자가 없어 dormant. 다음 중 어느 하나라도 들어오면 즉시 활성화:

1. **에디터 spawner 액터** (최소 변경) — `FHktTerrainSpawnerSpec` UPROPERTY 노출 액터를 만들어 `BeginPlay` 에서 Subsystem 의 in-memory 등록 큐에 추가. 10-20 줄.
2. **HktMap 어댑터 와이어링** (중간) — `HktMapSpawnerAdapter::MapSpawnerToTerrainSpec` 호출자 추가. 현재 호출 0 건.
3. **Phase 3-d** (정공법) — `BakeRegion` 가 표면/동굴/biome 경계 스캔해 spawner 슬롯 자동 추출.

---

## 디버깅 가이드 — 스토리가 안 뜨면 어디부터?

증상별 1차 진단 카테고리 (상세는 `Saved/Logs/{Project}.log` 의 해당 카테고리 grep).

| 증상 | grep 키워드 | 카테고리 / 레벨 |
|---|---|---|
| 첫 틱에 스토리가 안 뜸 — Tag 미설정 | `WorldInitStoryTag 가 비어있음` | `LogHktRuntime` Warning |
| 첫 틱에 스토리가 안 뜸 — Tag 오타 | `OnEvent_GameModeInitWorld: invalid StoryTag` | `LogHktRule` Warning |
| 스토리 큐는 됐는데 발화 안됨 | `PendingWorldInit 대기 중 ... RelevancyGroup 미생성` | `LogHktRule` Warning (1회) |
| 정상 발화 확인 | `PendingWorldInit dispatched: tag=…` | `LogHktRule` Log |
| "No program for X" | story-gen 미실행 또는 모듈 미로드 | `LogHktCore` Error (`HKT_EVENT_LOG`) |
| 청크 표면이 검정/빈공간 | `런타임 생성 폴백` | `LogHktTerrain` Warning |
| BakedAsset 못 찾음 | `BakedAsset 미지정` / `SoftRef 가 null` | `LogHktVoxelTerrain` / `LogHktTerrain` |
| Phase 4 spawner 가 안 뜸 | `GetChunkSpawners: BakedAsset 미로드 — Phase 4 dormant` | `LogHktTerrain` Log (인스턴스당 1회) |
| Spawner StoryTag invalid | `N spawner skipped ... bake 검증 누락 의심` | `LogHktCore` Warning (프레임당) |
| Presentation 만 빠짐 | ConventionPath 매핑 실패 | `LogHktAsset` |
