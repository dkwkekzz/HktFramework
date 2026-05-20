# Voxel Spawner — 설계 단일 진실원

> **의도**: [I-0027 Voxel Spawner](intents/I-0027.md). 부모 의도: [I-0013 성장을 위한 재료](intents/I-0013.md).
>
> Terrain 을 생성할 때 각 voxel 에 *spawn 속성* 을 부여한다 — 자연물 / NPC / 트리거가 별도 actor 가 아니라 voxel 의 한 속성으로 합류한다.

## 핵심 패러다임

```
[기존]  Spawner = (Position, EntityTag, Rule:enum, Count, Respawn)  — 정적 데이터 (폐기)
[현재]  Spawner = voxel 의 한 속성 = (VoxelCoord, StoryTag, Param0~3)  — Story 이벤트
```

- 스폰 패턴 (웨이브·매복·패트롤·연쇄·조건부·환경반응) 은 **전부 Story bytecode**. archetype 정형 분류 도입 금지 (→ [부록 B Archetype ADR](#부록-b-archetype-라이브러리를-도입하지-않는다-adr)).
- `EHktSpawnRule` enum 폐기.
- 진입 메커니즘은 기존 `FHktEvent` + `PendingGroupIntents` 큐 그대로 — 별도 VM 진입 API 없음 (→ [Runtime 진입 메커니즘](#진입-메커니즘--fhktevent-단일-경로)).
- `Param0~3` 슬롯 별칭은 `SpawnerParams::` / `VoxelTemplateParams::` 네임스페이스 (`HktStoryEventParams.h`) — 컨벤션 헤더 (강제 분류 아님).
- Bake 시점 결정 → 정적 직렬화 → 런타임 결정론 0 비용.
- HktCore 는 `IHktTerrainDataSource` 로만 spawner 메타를 소비 (단방향 의존 원칙).

## 한 줄 요약

```
[Bake]   VoxelSpawnRules (디자이너 매핑) → surface column top voxel 좌표 시드로 weighted-pick
                                            → 청크당 SpawnTemplateAttribution 슬롯 산출
                                          + 명시 배치 (Spawners[]) 직렬화 (보스/랜드마크)
[Runtime] 청크 로드 → attribution + Spawners[] fan-out → voxel 한 점마다 Story dispatch (read-only)
```

베이크 결과가 런타임의 단일 입력. 런타임에는 attribution 을 쓰지 않는다 — 디자이너가 rule 을 바꾸면 *재베이크* 가 적용 경로.

## 두 경로

같은 voxel 한 점에서 합류한다.

| 경로 | 후보 voxel | 부여 시점 | 데이터 |
|---|---|---|---|
| **자연 발생** (대다수: 나무·돌·일반 NPC) | surface column 의 top-most non-air voxel | 베이크 시점에 `VoxelSpawnRules` 가중치 픽으로 자동 산출 | `FHktTerrainBakedChunk::SpawnTemplateAttribution` |
| **명시 배치** (보스·시작 지점·랜드마크) | 임의 voxel — 좌표 직접 지정 | 베이크 시점에 baked asset 에 박힌 채로 로드 | `UHktTerrainBakedAsset::Spawners` (`FHktTerrainSpawnerSpec[]`) |
| **트리거** (Quest / Cinematic / Encounter) | 임의 voxel | 런타임 caller 가 직접 event 생성 (attribution 미터치) | `HktEventBuilder::VoxelTemplateActivatedAt(...)` |

## 데이터 모델

### 디자이너 입력 — `FHktVoxelSpawnRule` (자연 발생)

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

### 명시 배치 — `FHktTerrainSpawnerSpec`

보스·시작 지점·랜드마크처럼 *임의 voxel 좌표를 직접 지정* 해야 하는 경우. `HktTerrainBakedAsset.h`:

```cpp
USTRUCT()
struct FHktTerrainSpawnerSpec
{
    // 결정론 위치 (FHktFixed32 raw, Q16.16) — UE float 누설 금지
    int32 PosXRaw, PosYRaw, PosZRaw;

    // 행동
    FGameplayTag StoryTag;          // 실행할 Story (schema 2)

    // Story 진입 인자 — 4-슬롯 평탄화. FHktEvent::Param0~3 으로 1:1 매핑.
    // archetype 별 의미는 SpawnerParams::* (HktStoryEventParams.h) 에서 별칭 정의.
    int32 Param0, Param1, Param2, Param3;

    // 인덱싱
    FIntVector ChunkCoord;
    uint32     SlotHash;            // = hash(ChunkCoord, SlotIndex)
    int32      BiomeId;             // 베이크 시점 biome (런타임 검증)
};
```

`UHktTerrainBakedAsset::Spawners` (TArray) 가 보유. 청크좌표 → spawner 인덱스 다중맵 (`ChunkCoordToSpawnerIndex`) 은 `PostLoad/RebuildIndex` 에서 비직렬화 구축.

> **설계 결정**: `TMap<FName, ...> EntryArgs` / `FGameplayTagContainer ContextTags` 같은 별도 진입-args 메커니즘은 **폐기**. 이유:
>   - 청크 로드 시 일제 dispatch 에서 spawner 당 TMap 2개 힙 블롭 → 캐시미스 폭발.
>   - `FHktEvent::Param0~3` + `Location` + `HktEventBuilder` 가 이미 동일 컨텍스트를 인라인 POD 로 표현 — 별도 진입 경로 도입은 중복.
>   - archetype 별 4-슬롯이 부족하면 `SpawnerParams::` 네임스페이스에 별칭 추가로 충분.

### `IHktTerrainDataSource` 인터페이스 (HktCore)

```cpp
class IHktTerrainDataSource
{
public:
    // 자연 발생 — catalog × attribution 을 풀어 평탄화
    virtual void GetChunkVoxelAttribution(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                          TArray<FHktVoxelAttributionView>& Out) const = 0;

    // 명시 배치 — HktTerrain 헤더 직접 include 금지
    virtual void GetChunkSpawners(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                  TArray<FHktTerrainSpawnerView>& Out) const = 0;
};
```

`FHktVoxelAttributionView` / `FHktTerrainSpawnerView` 는 HktCore 측 plain POD (UObject 0). `FHktTerrainProvider` 가 어댑터.

### 결정론 시드

베이크/런타임 양쪽 모두 `HktEventBuilder::ComputeVoxelSlotHash31(WorldX, WorldY, WorldZ)` 단일 함수 사용. voxel 좌표 한 곳에서만 시드를 파생 — 동일 voxel 재방문 시 동일 출현 (I-0017).

명시 배치는 `SlotHash = hash(ChunkCoord, SlotIndex)` (slot index 포함으로 좌표 다중 슬롯 충돌 방지).

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

명시 배치 (`Spawners[]`) 는 별도 단계 — Generator 가 산출한 `(world position, StoryTag, Param0~3)` 시퀀스를 그대로 직렬화. 청크 경계 검증 + StoryTag 존재 확인.

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

### 진입 메커니즘 — `FHktEvent` 단일 경로

청크 로드 시 자연 발생 / 명시 배치 두 입력 모두 `FHktEvent` 로 변환되어 동일 `PendingGroupIntents` 큐에 enqueue. VM 측 변경 0, 새 진입 API 0, 별도 prefill 0.

`HktSimulationSystems.cpp::FHktTerrainSystem::Process` (서버 권위):

```
청크 로드 (TerrainSystem)
   │
   ├──────────────────────────────────────────┐
   │                                          │
   ▼                                          ▼
Source.GetChunkVoxelAttribution(...)    Source.GetChunkSpawners(...)
   │ (자연 발생)                         │ (명시 배치)
   ▼                                          ▼
for each FHktVoxelAttributionView:       for each FHktTerrainSpawnerView:
  HktEventBuilder::                        HktEventBuilder::
     VoxelTemplateActivated(view, VS)        SpawnerFromView(view)
        EventTag = view.StoryTag                EventTag = view.StoryTag
        Param0/1/3 = voxel cm X/Y/Z             Param0/1 = PosRaw → cm
        Param2 = SlotHash31                     Param2/3 = view.Param2/3
   │                                          │
   └──────────────┬───────────────────────────┘
                  ▼
   PendingGroupIntents[Graph.CalculateRelevancyGroupIndex(Location)].Add(E)
                  ▼
   기존 dispatch (HktDefaultServerRule::OnEvent_GameModeTick)
                  ▼
   Story bytecode 실행 (SOA WorldState dirty proxy)
                  ▼
   FHktWorldView 갱신 (절대 원칙 3: 서버 권위)
                  ▼
   [Client] FHktWorldView 수신 → HktPresentation 렌더
```

런타임은 attribution / Spawners[] 슬롯을 *읽기 전용* 으로만 사용한다. 변경 경로는 *재베이크* 뿐.

### Spawner Story 가 컨텍스트 읽는 방식

`SpawnerParams::` / `VoxelTemplateParams::` 별칭은 두 입구에서 동일한 슬롯 의미를 갖는다 — Story 본문은 어느 경로로 들어왔는지 구분할 필요 없음.

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

### 청크 언로드 정책 (미결)

청크가 `SimMaxChunksLoaded` LRU 에서 제거될 때 해당 spawner 가 시작한 Story VM 인스턴스 / 이미 spawn 된 엔티티 처리는 *결정 보류*. 현 단계는 dispatch 까지만 다룬다 — 옵션 (유지 / spawner 연동 정리 / per-archetype 정책) 은 별도 작업.

### 결정론

`SlotHash31` 을 RNG seed 로 사용 → 동일 voxel 재방문 시 동일 출현. "재방문" 은 시뮬레이션 의미가 아니라 메모리 캐시 의미 (시뮬레이션 상태는 영속).

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

### Generator 파이프라인 (명시 배치 — LLM)

보스·랜드마크 등 *임의 좌표 직접 지정* 이 필요한 spawner 는 Generator 가 산출:

```
concept-design   →  terrain_spec + encounter_intent (biome별 출현 의도)
                              ↓
   map-gen       →  region별 spawner 후보 슬롯 추출 (terrain feature 기반)
                              ↓
spawner-design   →  슬롯별 (world position, schema 2 story JSON, Param0~3) 직접 작성
                              ↓                              ↓
   terrain-bake                                          story-gen
   (Spawners[] 직렬화)                                   (schema 2 JSON 컴파일)
                              ↓
   검증: StoryTag 존재 / Param 슬롯 본문 일관성 / biome 일치 / 위치 유효성
```

- `concept-design` → `terrain_spec` 에 `encounter_intent[]` 필드: `{ "biome": "mountain", "intent": "ambush_predators", "intensity": 0.7 }`
- `spawner-design` skill — 입력: terrain_spec + bake 후보 슬롯 + encounter_intent + `SpawnerParams::` 컨벤션 헤더. 출력: 슬롯별 `(world position, schema 2 story JSON, Param0~3)`. LLM 은 archetype 선택지가 아닌 **schema 2 JSON 본문을 직접 작성** ([부록 B ADR](#부록-b-archetype-라이브러리를-도입하지-않는다-adr)).
- `terrain-bake` 가 spawner slot 후보 추출: 청크 표면 셀 / 동굴 입구 / biome 경계 / 수면 인접 / 산악 정상.
- Bake 시점 검증: StoryTag 가 schema 2 컴파일 산출물에 존재 / `Param0~3` 값이 본문이 읽는 슬롯과 일관 (정적 분석) / BiomeId 일치 / PosRaw 가 청크 경계 내.

### Schema 2 본문 컨벤션

Spawner story 는 일반 Story 와 **구조적으로 동일**. 별도 `spawner_bound` / `args_int` / `args_tag` 메타 필드 없이, story 본문이 자체적으로 정의하는 인자는 `LoadStore(PropertyId::Param0..3)` 로 직접 읽는다.

```json
{
  "schema": 2,
  "tag": "Story.Flow.Spawner.Natural.Oak",
  "vregs": [...],
  "instructions": [
    {"op": "LoadStore", "dst": {"var":"posX"},     "prop": "Param0"},
    {"op": "LoadStore", "dst": {"var":"posY"},     "prop": "Param1"},
    {"op": "LoadStore", "dst": {"var":"slotHash"}, "prop": "Param2"},
    {"op": "LoadStore", "dst": {"var":"posZ"},     "prop": "Param3"}
  ]
}
```

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
| 데이터 모델 (자연 발생) | `HktTerrain/Public/HktTerrainBakedAsset.h` (`FHktVoxelSpawnRule`, `FHktTerrainBakedConfig::VoxelSpawnRules`, `FHktTerrainBakedChunk::SpawnTemplateAttribution`, `UHktTerrainBakedAsset::SpawnTemplateCatalog`) |
| 데이터 모델 (명시 배치) | `HktTerrain/Public/HktTerrainBakedAsset.h` (`FHktTerrainSpawnerSpec`, `UHktTerrainBakedAsset::Spawners`, `GetSpawnersForChunk`) |
| Voxel Type Enum | `HktTerrain/Public/HktTerrainVoxelTypes.h` (`EHktTerrainType`) |
| Bake 산출 | `HktTerrain/Private/HktTerrainBakeLibrary.cpp::BakeRegion` (rule → bucket → weighted-pick) |
| Provider 어댑터 | `HktTerrain/Private/HktTerrainProvider.cpp` (`GetChunkVoxelAttribution`, `GetChunkSpawners`) |
| 런타임 dispatch | `HktCore/Private/HktSimulationSystems.cpp::FHktTerrainSystem::Process` |
| Event Param 컨벤션 | `HktCore/Public/HktStoryEventParams.h` (`SpawnerParams::`, `VoxelTemplateParams::`, `HktEventBuilder::SpawnerFromView` / `VoxelTemplateActivated[At]`, `ComputeVoxelSlotHash31`) |
| Python 디자이너 입력 | `HktGameplay/Content/Python/bake_terrain.py` (`default_voxel_spawn_rules`, `apply_voxel_spawn_rules`) |
| Story 콘텐츠 | `HktGameplay/Content/Stories/Natural/Tree_Spawn.json`, `Slime/Slime_Spawn.json` |
| 명시 배치 어댑터 (레거시 마이그레이션) | `HktMapGenerator/Private/HktMapSpawnerAdapter.cpp` (`MapSpawnerToTerrainSpec`) |
| 자동화 테스트 | `HktGameplayDeveloper/Source/HktAutomationTests/Private/Tests/HktI0014VoxelAttributionTests.cpp` |

## 인접 문서

- [Design-VoxelTerrain-Simulation.md](Design-VoxelTerrain-Simulation.md) — Voxel 지형 시뮬레이션 (청크 로드/언로드, OpCode, 지면 스냅)
- [Design-Entity-Item-System.md](Design-Entity-Item-System.md) — Spawn 된 entity 의 라이프사이클
- [Flow-Voxel-To-Presentation.md](Flow-Voxel-To-Presentation.md) — voxel → entity → viewmodel end-to-end

---

## 부록 A: Story V2 가드레일

> 본 통합으로 신설되는 모든 코드는 Story V2 (JSON schema 2) 정합이어야 한다. 위반 시 PR 거부. 본 섹션은 V2 방향을 거스르는 설계가 다시 등장하지 않도록 박아두는 가드레일.

### 금지 (Hard Don't)

| # | 금지 사항 | 근거 |
|---|---|---|
| **D1** | `namespace Reg` (`Reg::R0~R9`, `Reg::Self/Target/Spawned/Hit/Iter/Flag/Count`) **참조 금지** | `HktStoryTypes.h:21-23` — deprecated. |
| **D2** | `RegisterIndex` 타입을 인자/반환으로 받는 **신규 메서드 정의 금지** | 신 API 는 `FHktVar`/`FHktVarBlock`. 기존 deprecated 시그니처와 공존만 허용. |
| **D3** | 특수 레지스터 슬롯 (R10~R15) 에 **신규 의미 부여 금지** (`SpawnerOrigin`, `SpawnerBiome` 등 새 슬롯 잡지 않음) | D1 영역 확장. strangler-fig 방향 역행. |
| **D4** | 신규 Story 를 cpp 스니펫 (`HktStory/Public/Snippets/*`) 으로 추가 금지 | Schema 2 JSON 으로만 작성. cpp 스니펫은 레거시 호환 전용. |
| **D5** | JSON Schema 1 (구 schema, `{"schema": 1, ...}` 또는 schema 필드 누락) **참조 금지** | Schema 2 만 사용. |
| **D6** | `FHktScopedReg` / `FHktScopedRegBlock` 을 **신규 코드에서 사용 금지** | `HktStoryBuilder.h:120-123` — deprecated. 신규는 `NewVar()` / `NewVarBlock()`. |
| **D7** | `FHktRegAllocator` 를 빌더 외부에서 직접 호출 금지 | 빌드 타임 Linear-Scan 할당기가 vreg → 물리 레지스터 매핑 수행. 외부는 vreg 만 본다. |

### 허용 (Use Instead)

| # | 항목 | 사용처 |
|---|---|---|
| **U1** | `FHktVar` (가상 변수) — `FHktStoryBuilder::NewVar()` | 모든 단일 변수 슬롯 |
| **U2** | `FHktVarBlock` (연속 N개) — `FHktStoryBuilder::NewVarBlock(N)` | Position(3), Bounds(6) 등 |
| **U3** | `FHktStoryBuilder::Self()` / `Target()` | Entity 컨텍스트 |
| **U4** | OpCode 반환 — `SpawnEntity(...)`, `WaitCollision(...)`, `GetPosition(...)` 등이 `FHktVar`/`FHktVarBlock` 을 **반환** | 호출자가 결과를 명시적으로 수령 |
| **U5** | Schema 2 JSON | `HktStoryGenerator` / `McpBuildStory` 입력 |
| **U6** | **Builder 메서드 추가** 로 신규 의미 노출 — 새 vreg 발급 + 기존 opcode 조합 emit | Spawner context 주입 등 |

### 신규 OpCode 정책

- **기본은 추가 금지**. 기존 60+ opcode 와 Builder 조합으로 표현.
- 추가가 본질적으로 필요한 경우 (예: polling 을 단일 opcode 로만 표현 가능한 경우) 에만 **별도 ADR 통과 후** 추가.
- CI 에서 신규 파일이 deprecated API 를 호출하면 경고를 에러로 승격하는 룰을 운용.

## 부록 B: Archetype 라이브러리를 도입하지 않는다 (ADR)

> **결정**: 8 종 archetype 템플릿 + `Spawner.Archetype.*` 분류 + LLM 의 (archetype, params) 선택지를 도입하려던 설계는 **폐기**. spawner story 는 LLM 이 schema 2 JSON 으로 **자유롭게 직접 작성** 한다.

### 폐기 사유

| # | 사유 |
|---|---|
| **R1** | **사용자 의도와 충돌** — spawner 는 "복합적이고 다양한 생성" 이 목표. 8종 정형 분류는 우리가 폐기한 `EHktSpawnRule` enum 이 이름만 바꿔 부활하는 것. |
| **R2** | **Story 본질 훼손** — Story 는 (사실상) 튜링 완전 bytecode. 8개 템플릿으로 가두면 새 패턴마다 archetype 추가 의존이 생기고, 보스 처치 → 호위 도주 → 다른 region 에서 복수 등장 같은 복합 패턴은 어차피 표현 불가. |
| **R3** | **Leaky abstraction** — story 자체가 이미 DSL 인데 archetype 은 그 위에 약한 DSL 을 한 층 더 쌓는 것. story-gen 이 이미 schema 2 JSON 을 생성 가능. |
| **R4** | **Param0~3 평탄화로 의미 약화** — 진입 인자가 4-슬롯 정수로 단순화되면서 archetype "라이브러리" 의 무게가 사라짐. 남은 의미는 `SpawnerParams::` 별칭 컨벤션 뿐인데 이는 헤더 1개로 충분. |

### 대체 방향

- **`SpawnerParams::` / `VoxelTemplateParams::` 네임스페이스** (`HktStoryEventParams.h`) 만 유지 — `SpawnPosX = Param0` 같은 공통 별칭 + spawner story 본문이 자체적으로 정의하는 `Param2/3` 의미. **강제 분류 아님**.
- **`spawner-design` skill** ([Generator 파이프라인](#generator-파이프라인-명시-배치--llm)) 이 LLM 으로 하여금 `(위치, schema 2 story JSON, Param0~3 값)` 을 직접 출력. 템플릿 선택지가 아닌 자유 작성.
- **예제는 라이브러리가 아닌 참고용** — 필요 시 1~2 개 schema 2 JSON 예제 (`Content/Stories/Spawner/Example_*.json`) 를 두되, Generator 가 의존하지 않는다.

### 재 ADR 트리거

- LLM 이 spawner story 본문에서 반복적으로 동일한 명령 시퀀스를 만들어 토큰 비용이 비대해질 때
- 그리고 그 시퀀스가 3~4 개 정도로 자연 수렴할 때 (8 개 강제 분류는 그 시점에도 거부)

위 조건이 관측될 때 별도 ADR 로 재논의. 본 시점에는 도입하지 않는다.

## 레거시 / 폐기 메모

- **placement story (chunk-level)** — v4 에서 `Event.Terrain.ChunkLoaded` 이벤트 + biome switch JSON 으로 시도되었으나 v5 에서 폐기. voxel attribution 이 단일 진입점.
- **`VoxelTypeSpawnTemplate` (1-tag-per-type)** — v5 의 단조성. v6 에서 `VoxelSpawnRules` (다양성 + weight) 로 교체.
- **`VoxelTypeID: int32`** — v6 의 정수 키. v7 에서 `EHktTerrainType` UENUM 으로 교체 (디자이너 UI 의미화).
- **`PendingWorldInit`** — `AHktGameMode::InitGame` 의 1회성 `WorldInitStoryTag` 발동 경로. 부트스트랩 호환성 유지를 위해 보존 — voxel attribution 모델과 공존. 명시 배치 (`FHktTerrainSpawnerSpec`) 의 BakeRegion 자동 산출이 완성되면 자연 흡수 예정.
- **`FHktMapSpawner` / `EHktSpawnRule` / `AHktSpawnerActor::InitFromSpawnerData`** — deprecated 마킹. `HktMapSpawnerAdapter::MapSpawnerToTerrainSpec` 로 `FHktTerrainSpawnerSpec` 변환 후 본 시스템에 합류. 1 릴리즈 후 제거 예정.
- **`FHktStoryEntryArgs` / VM `StartInstance` API / entry-arg vreg prefill** — 별도 진입 메커니즘 시도 폐기. `FHktEvent::Param0~3` + `PendingGroupIntents` 큐 단일 경로 유지.
- **Phase 1~4 설계 이력 / V2 마이그레이션 (M0~M7) / 잠정 신규 opcode (`WaitPlayerInRadius`)** — audit 보관: [archive/Design-I0013-Implementation.md](archive/Design-I0013-Implementation.md), [archive/TerrainSpawner.design.md](archive/TerrainSpawner.design.md).
