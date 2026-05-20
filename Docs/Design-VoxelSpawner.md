# Voxel Spawner — 설계 단일 진실원

> **의도**: [I-0027 Voxel Spawner](intents/I-0027.md). 부모 의도: [I-0013 성장을 위한 재료](intents/I-0013.md).
>
> Terrain 을 생성할 때 각 voxel 에 *spawn 속성* 을 부여한다 — 자연물 / NPC / 트리거가 별도 actor 가 아니라 voxel 의 한 속성으로 합류한다.

## 한 줄 요약

```
[Bake]   VoxelSpawnRules (디자이너 매핑) → surface column top voxel 좌표 시드로 weighted-pick
                                            → 청크당 SpawnTemplateAttribution 슬롯 산출
[Runtime] 청크 로드 → attribution 슬롯 fan-out → voxel 한 점마다 Story dispatch (read-only)
```

베이크 결과가 런타임의 단일 입력. 런타임에는 attribution 을 쓰지 않는다 — 디자이너가 rule 을 바꾸면 *재베이크* 가 적용 경로.

## 데이터 모델

### 디자이너 입력 — `FHktVoxelSpawnRule`

`HktTerrain/Public/HktTerrainBakedAsset.h`

```cpp
USTRUCT(BlueprintType)
struct FHktVoxelSpawnRule
{
    EHktTerrainType VoxelType;  // Grass / Sand / Snow / Gravel / Clay / ...
    FGameplayTag    StoryTag;   // Story.Flow.Spawner.Natural.*  (None = skip 슬롯)
    int32           Weight;     // weighted-pick 가중치 (0 = 무시)
};
```

`FHktTerrainBakedConfig::VoxelSpawnRules` (TArray) 가 입력 시퀀스 — 동일 `VoxelType` 키에 *복수* 엔트리 허용. 그것이 다양성의 본질.

규칙:
- `VoxelType == Air` / `Weight <= 0` → orphan 으로 무시.
- `StoryTag` invalid (`None`) → "skip 슬롯". 해당 weight 만큼 *spawn 없음* 확률을 표현.
- 같은 voxel type 에 N 개 후보 → cumulative-weight pick → N 가지 결과가 voxel 좌표별로 분산.

### Bake 산출 — Catalog + Attribution

`UHktTerrainBakedAsset`:
- `SpawnTemplateCatalog: TMap<int32 templateId, FGameplayTag>` — World 별 닫힌 라이브러리.
- 청크별 `FHktTerrainBakedChunk::SpawnTemplateAttribution: TMap<int32 packedLocalCoord, int32 templateId>` — sparse. 키는 `PackLocalCoord(x,y,z)` (5+5+5 bit).

### 결정론 시드

베이크/런타임 양쪽 모두 `HktEventBuilder::ComputeVoxelSlotHash31(WorldX, WorldY, WorldZ)` 단일 함수 사용. voxel 좌표 한 곳에서만 시드를 파생 — 동일 voxel 재방문 시 동일 출현 (I-0017).

## Bake 흐름

`HktTerrainBakeLibrary.cpp::BakeRegion`:

```
1. VoxelSpawnRules 순회 → unique StoryTag 에 templateId 부여 → SpawnTemplateCatalog
                       → VoxelType 별 bucket (cumulative weights)
2. surface chunk 만 순회 (bIsSurfaceChunk == true)
3. 청크의 32×32 column 마다 top-most non-air voxel 찾기
4. Seed = ComputeVoxelSlotHash31(worldX, worldY, worldZ)
   Roll = Seed % Bucket.TotalWeight
   → cumulative-weight 로 후보 선정
5. templateId > 0 → Chunk.SpawnTemplateAttribution.Add(PackedLocalCoord, templateId)
   templateId == 0 (skip 슬롯) → 미부여
6. 후처리: orphan catalog (어떤 attribution 도 참조 안 함) WARN
```

베이크 로그 예:
```
BakeRegion: VoxelSpawnRules 처리 — Rules=12 (orphan=0), Buckets=4,
SurfaceChunks=25, AttributionsWritten=487, SkipPicks=623
```

## 밀도 제어 — "모든 voxel 에 spawner 가 붙지 않는다"

청크 1개 = 32768 voxel 이지만 실제 spawner 가 붙는 voxel 은 한 자릿수~수십 개. 4 단계 필터로 sparse 가 보장된다.

### 1. Surface column top voxel 만 후보 (구조적 제약)

`HktTerrainBakeLibrary.cpp::BakeRegion` 이 청크의 32×32 column 마다 *top-most non-air voxel 1점만* 검사:

```cpp
for (LocalY = 0..31)
for (LocalX = 0..31)
    for (LocalZ = 31 down to 0)
        if (RawVoxels[Idx].TypeID != 0) {
            // 본 column 의 surface voxel — pick 시도 후 break
            break;
        }
```

청크당 후보 voxel = **최대 1024개** (32×32). 지하 voxel, column 표면 아래 voxel 은 처음부터 배제.

### 2. Rule 미정의 voxel type → 자동 스킵

```cpp
const FRuleBucket* Bucket = Buckets.Find(TypeID);
if (Bucket && Bucket->TotalWeight > 0) { ... }
// 매핑 없는 voxel type 은 attribution 미부여
```

흔한 표면 (Grass/Dirt, 전체의 ~60%) 을 `VoxelSpawnRules` 에서 *의도적으로 비워두면* 해당 voxel 들은 자동으로 spawner 없음. 현 default 매핑은 희소 voxel (Snow/Gravel/Clay/Sand) 만 등록.

### 3. skip 슬롯 (`StoryTag=None`) — 확률적 비우기

같은 voxel type 안에서도 weight 비율로 비울 수 있다:

```python
unreal.HktTerrainType.SAND: [(SLIME, 30), (None, 70)],
# 30% Slime, 70% 빈 voxel
```

bake 시:

```cpp
if (PickedTemplateId > 0) {
    Chunk.SpawnTemplateAttribution.Add(Packed, PickedTemplateId);
} else {
    ++SkipPicks;  // skip 슬롯 선정 — attribution 미부여
}
```

skip 슬롯은 catalog 미등록 → 메모리/네트워크 부담 0.

### 4. Spawner Story 의 글로벌 cap (런타임 안전망)

`Tree_Spawn.json`, `Slime_Spawn.json` 본문에 `CountByTag < N` 가드가 있어 attribution 다수 발화 시에도 spawn 폭주 차단.

### 실측 밀도

현 default 매핑 + 5×5×3 청크 영역 베이크 로그:

```
BakeRegion: VoxelSpawnRules 처리 — Rules=12 (orphan=0), Buckets=4,
SurfaceChunks=25, AttributionsWritten=487, SkipPicks=623
```

→ 25 청크에 attribution 487 개 = **청크당 평균 ~19 spawner** (32768 voxel 중 0.06%).
→ `SkipPicks=623` = 후보 voxel 의 약 56% 가 skip 슬롯으로 비워짐.

### 디자이너 체크리스트

- 새 voxel type 에 rule 을 추가할 때는 반드시 `(None, weight)` skip 슬롯을 함께 두어 spawn 비율을 명시 — 100% spawn 은 의도된 경우에만.
- `AttributionsWritten` 이 청크당 100+ 면 매핑 재검토 — Story 의 `CountByTag` cap 즉시 도달로 디버그 가독성 저하.

## Runtime 흐름

`HktSimulationSystems.cpp::FHktTerrainSystem::Process` (서버 권위):

```
청크 로드 (TerrainSystem)
   │
   ▼
Source.GetChunkVoxelAttribution(X, Y, Z, OutEntries)
   │  (Provider 가 catalog × attribution 을 풀어 FHktVoxelAttributionView 시퀀스로 평탄화)
   ▼
for each view:
    HktEventBuilder::VoxelTemplateActivated(view, VoxelSizeCm)
       Param0 = voxel cm X       (VoxelTemplateParams::VoxelCmX)
       Param1 = voxel cm Y       (VoxelTemplateParams::VoxelCmY)
       Param2 = SlotHash31       (VoxelTemplateParams::SlotHash31 — 동일 함수)
       Param3 = voxel cm Z       (VoxelTemplateParams::VoxelCmZ)
       EventTag = view.StoryTag  (catalog 가 푼 결과)
   ▼
PendingGroupIntents 큐 → 기존 dispatch 경로 → Story bytecode 실행
```

런타임은 attribution 슬롯을 *읽기 전용* 으로만 사용한다. 변경 경로는 *재베이크* 뿐.

### Spawner Story 가 컨텍스트 읽는 방식

Schema 2 JSON 본문:

```json
{"op": "LoadStore", "dst": {"var":"posX"},      "prop": "Param0"},
{"op": "LoadStore", "dst": {"var":"posY"},      "prop": "Param1"},
{"op": "LoadStore", "dst": {"var":"slotHash"},  "prop": "Param2"},
{"op": "LoadStore", "dst": {"var":"posZ"},      "prop": "Param3"},
```

`slotHash` 를 `RandomInt` 시드로 사용하면 voxel 좌표 단위 다양성을 Story 내부에서 더 분기시킬 수 있다 (단, 시드는 *흡수* 만 — 외부 입력과 *혼합* 금지).

### 트리거 경로 (Quest / Cinematic / Encounter)

attribution 슬롯을 *건드리지 않는다*. caller 가 직접 `HktEventBuilder::VoxelTemplateActivatedAt(StoryTag, X, Y, Z, VoxelSizeCm)` 로 동일 형식 event 를 생성 → 동일 dispatch 경로 통과. SlotHash31 계산도 동일 함수 → 자연 발생/트리거가 voxel 한 점에서 합류한다.

## 콘텐츠 워크플로우

### 신규 Spawner Story 추가

1. **Story JSON 작성** — `HktGameplay/Content/Stories/Natural/<Name>/<Name>_Spawn.json` (schema 2). 패턴 참조: `Tree_Spawn.json`, `Slime/Slime_Spawn.json`.
2. **GameplayTag 선언** — `HktCore/Public/HktCoreTags.h` 의 `HktNaturalStoryTags` 에 `UE_DECLARE_GAMEPLAY_TAG_EXTERN` + cpp 에 `UE_DEFINE_GAMEPLAY_TAG_COMMENT` (TreeSpawn / SlimeSpawn 패턴 그대로). JSON 만 추가했고 네이티브 태그 변경 없으면 PIE 진입 시 자동 등록.
3. **Rule 후보 추가** — `bake_terrain.py` 의 `default_voxel_spawn_rules()` dict 에 weight 와 함께 등록.
4. **재베이크** — `py bake_terrain.py`.

### Rule 매핑 편집

영구 매핑은 `HktGameplay/Content/Python/bake_terrain.py` 의 `default_voxel_spawn_rules()` 에서 관리:

```python
def default_voxel_spawn_rules() -> dict[unreal.HktTerrainType, list[SpawnCandidate]]:
    TREE  = "Story.Flow.Spawner.Natural.Tree"
    SLIME = "Story.Flow.Spawner.Natural.Slime"
    return {
        # VoxelType : [(StoryTag or None=skip, weight), ...]
        unreal.HktTerrainType.SNOW:   [(TREE, 40), (SLIME, 10), (None, 50)],
        unreal.HktTerrainType.GRAVEL: [(TREE, 50),              (None, 50)],
        unreal.HktTerrainType.CLAY:   [(SLIME, 50), (TREE, 10), (None, 40)],
        unreal.HktTerrainType.SAND:   [(SLIME, 30),             (None, 70)],
    }
```

규칙:
- 튜플 `(StoryTag, Weight)`. `StoryTag` 가 `None` 이면 skip 슬롯.
- weight 합 자유 — 비율만 맞으면 됨.
- 같은 voxel type 에 후보 N 개 → N 가지 결과가 voxel 좌표별로 분산.
- 흔한 surface (Grass/Dirt) 는 skip 비중을 높여 spawn 폭주 차단.

수정 후 UE Editor Python 콘솔에서 `py bake_terrain.py` 재실행.

CLI 옵션:
```
py bake_terrain.py                                  # 기본 영역 (-2,-2,0)~(2,2,3), seed=42
py bake_terrain.py --min=-1,-1,0 --max=1,1,2        # 작은 영역 (빠른 검증)
py bake_terrain.py --seed 100 --save /Game/Terrain/Baked/RegionAlt
py bake_terrain.py --no-spawn-templates             # rule 미적용 (빈 attribution)
```

산출 후 액터 wiring: Outliner 의 `AHktVoxelTerrainActor` 의 `Baked Asset` 슬롯에 산출된 `.uasset` 지정 → PIE 진입.

### UI 직접 편집 (실험용)

특정 voxel rule 만 즉시 바꾸고 싶을 때:
1. Content Browser → 베이크 자산 더블클릭
2. **Generator Config → Placement → Voxel Spawn Rules** 펼치기
3. `+` 로 rule 추가 (`Voxel Type` = enum drop-down, `Story Tag` = `Story.Flow.Spawner.Natural.*`, `Weight`)
4. 저장 → `BakeRegion` 재실행 (Editor Utility 또는 Python).

⚠️ UI 편집은 *일회성* — `py bake_terrain.py` 재실행 시 덮어쓰기됨. 영구 매핑은 Python 으로 관리.

## 디자인 가이드

| 변수 | 권장 |
|---|---|
| 흔한 voxel (Grass/Dirt, 표면의 ~60%) | skip 비중 70~80%. 아니면 attribution 폭증 + spawner story 의 `CountByTag` cap 즉시 도달 → 잔여 fire 가 모두 no-op |
| 희소 voxel (Snow/Gravel/Clay/Sand) | skip 비중 40~50%. 환경의 정체성을 entity 로 표현 |
| 후보 종 수 | voxel type 당 2~4 개 권장. 5+ 는 환경 일관성 저하 |
| weight 분포 | "주력 1개 (50~60) + 보조 1~2개 (10~20) + skip 슬롯" 패턴이 안정적 |
| 결정론 | weight 비율은 좌표 분포에 의해 *근사적으로* 실현. 100 voxel 미만이면 편차 큼 — 영역 크기로 보정 |

## 디버깅

베이크 로그:

| 증상 | 확인 |
|---|---|
| `Rules=0` | Python 스크립트가 `cfg.voxel_spawn_rules` 미설정. `--no-spawn-templates` 여부 / HktTerrain 모듈 Editor 빌드 로드 |
| `Rules>0, orphan>0` | `Weight<=0` / `VoxelType=Air` entry — 매트릭스 점검 |
| `Buckets=N, AttributionsWritten=0` | 해당 voxel type 이 region 표면에 없음. 시드/영역 변경 또는 흔한 type (Grass) 으로 테스트 |
| `AttributionsWritten=N, SkipPicks=0` | skip 슬롯 없음 — `(None, weight)` 추가 |
| `BakeRegion: catalog templateId=… 가 어떤 voxel 도 참조하지 않음` WARN | 후보로 들어갔으나 한 번도 안 뽑힘 — weight 너무 낮거나 다른 후보에 밀림 |
| 베이크는 되는데 PIE 에서 spawn 없음 | ① Tag 미등록 → *Tools → HktStory → Regenerate Story Tags and Reload* / ② Story JSON `storyTag` 가 catalog tag 와 일치하는지 / ③ BakedAsset 슬롯이 액터에 할당됐는지 |

추가 진단:
- 콘솔: `hkt.EventLog.Start` → 시뮬 시작 → `hkt.EventLog.Dump` 로 `Story.Flow.Spawner.Natural.*` dispatch 확인.
- Insights: `Window → HKT Gameplay Log` 에서 `Spawner` 카테고리 필터.

## 빠른 검증

```
py bake_terrain.py --min=-1,-1,0 --max=1,1,2
```

→ 3×3 청크 (XY) × 3 (Z) 작은 영역. 로그에 `Rules=N Buckets=N AttributionsWritten>0 SkipPicks>0` 가 찍히면 OK. PIE 진입 → 표면에 Tree/Slime 결정론 분포 확인. 동일 seed/영역 재베이크 시 동일 결과 (자동화 테스트 `HktI0014VoxelAttributionTests.cpp` 가 검증).

## 파일 진입점

| 영역 | 파일 |
|---|---|
| 데이터 모델 | `HktTerrain/Public/HktTerrainBakedAsset.h` (`FHktVoxelSpawnRule`, `FHktTerrainBakedConfig::VoxelSpawnRules`, `FHktTerrainBakedChunk::SpawnTemplateAttribution`, `UHktTerrainBakedAsset::SpawnTemplateCatalog`) |
| Voxel Type Enum | `HktTerrain/Public/HktTerrainVoxelTypes.h` (`EHktTerrainType`) |
| Bake 산출 | `HktTerrain/Private/HktTerrainBakeLibrary.cpp::BakeRegion` (rule → bucket → weighted-pick) |
| Provider 어댑터 | `HktTerrain/Private/HktTerrainProvider.cpp` (`GetChunkVoxelAttribution`) |
| 런타임 dispatch | `HktCore/Private/HktSimulationSystems.cpp::FHktTerrainSystem::Process` |
| Event Param 컨벤션 | `HktCore/Public/HktStoryEventParams.h` (`VoxelTemplateParams::`, `HktEventBuilder::VoxelTemplateActivated[At]`, `ComputeVoxelSlotHash31`) |
| Python 디자이너 입력 | `HktGameplay/Content/Python/bake_terrain.py` (`default_voxel_spawn_rules`, `apply_voxel_spawn_rules`) |
| Story 콘텐츠 | `HktGameplay/Content/Stories/Natural/Tree_Spawn.json`, `Slime/Slime_Spawn.json` |
| 자동화 테스트 | `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktI0014VoxelAttributionTests.cpp` |

## 인접 문서

- [Design-VoxelTerrain-Simulation.md](Design-VoxelTerrain-Simulation.md) — Voxel 지형 시뮬레이션 (청크 로드/언로드, OpCode, 지면 스냅)
- [Design-Entity-Item-System.md](Design-Entity-Item-System.md) — Spawn 된 entity 의 라이프사이클
- [Flow-Voxel-To-Presentation.md](Flow-Voxel-To-Presentation.md) — voxel → entity → viewmodel end-to-end

## 레거시 / 폐기 메모

- **placement story (chunk-level)** — v4 에서 `Event.Terrain.ChunkLoaded` 이벤트 + biome switch JSON 으로 시도되었으나 v5 에서 폐기. voxel attribution 이 단일 진입점.
- **`VoxelTypeSpawnTemplate` (1-tag-per-type)** — v5 의 단조성. v6 에서 `VoxelSpawnRules` (다양성 + weight) 로 교체.
- **`VoxelTypeID: int32`** — v6 의 정수 키. v7 에서 `EHktTerrainType` UENUM 으로 교체 (디자이너 UI 의미화).
- **`PendingWorldInit`** — `AHktGameMode::InitGame` 의 1회성 `WorldInitStoryTag` 발동 경로. 부트스트랩 호환성 유지를 위해 보존 — voxel attribution 모델과 공존. 명시 배치 (`FHktTerrainSpawnerSpec`) 의 BakeRegion 자동 산출이 완성되면 자연 흡수 예정.
