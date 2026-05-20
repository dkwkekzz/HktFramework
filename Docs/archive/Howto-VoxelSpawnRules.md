# [ARCHIVED] VoxelSpawnRules 사용법 (v6 시점)

> **현 단일 진실원**: [Design-VoxelSpawner.md](../Design-VoxelSpawner.md). 본 문서는 v6 (`VoxelTypeID: int32` 키) 시점 디자이너 How-to 의 보관본. 현 v7 은 `EHktTerrainType` UENUM 키로 교체됨.

I-0014 v6 의 voxel 기반 entity spawn 매트릭스 설정·튜닝·디버깅 절차. 같은 voxel type 위에서도 다양한 entity 가 결정론적으로 출현하도록 베이크 시점에 weighted-pick 을 수행한다.

## 한 줄 요약

> `bake_terrain.py` 의 `default_voxel_spawn_rules()` 가 단일 진실원 → Python 콘솔에서 `py bake_terrain.py` 한 번이면 reading 끝.

UI 직접 편집은 일회성 실험에만. 영구 매핑은 Python 스크립트에서 관리.

## 데이터 모델

```cpp
USTRUCT(BlueprintType)
struct FHktVoxelSpawnRule
{
    int32 VoxelTypeID;   // 1=Grass / 2=Dirt / 3=Stone / 4=Sand / 6=Snow / 8=Gravel / 9=Clay …
    FGameplayTag StoryTag; // None = skip 슬롯 (해당 weight 만큼 spawn 없음 확률)
    int32 Weight;        // weighted-pick 가중치. 0 = 항목 무시
};
```

`FHktTerrainBakedConfig::VoxelSpawnRules` 는 본 구조체의 `TArray` — 같은 `VoxelTypeID` 를 가진 rule 을 *여러 개* 넣으면 그 voxel type 의 후보 목록이 된다. BakeRegion 이 voxel 좌표 시드 (`ComputeVoxelSlotHash31`) 로 cumulative-weight pick → 결과가 attribution 으로 굳어진다 (런타임 read-only).

## 경로 1: Python 스크립트 실행 (기본 매트릭스 그대로)

UE Editor 의 Python 콘솔:

```
py bake_terrain.py
```

기본 동작:
- 영역 `(-2,-2,0) ~ (2,2,3)` (총 100 청크), seed=42
- `default_voxel_spawn_rules()` 매트릭스 자동 적용
- `/Game/Terrain/Baked/RegionDefault.uasset` 산출

옵션:

```
py bake_terrain.py --min=-1,-1,0 --max=1,1,2          # 작은 영역 (빠른 검증)
py bake_terrain.py --seed 100 --save /Game/Terrain/Baked/RegionAlt
py bake_terrain.py --no-spawn-templates                # 매핑 적용 안 함 (빈 BakedAsset)
```

산출 후 액터 wiring:
1. Outliner 의 `AHktVoxelTerrainActor` 선택
2. `Baked Asset` 슬롯에 `/Game/Terrain/Baked/RegionDefault` 지정
3. PIE 진입 → 표면 voxel 마다 entity 출현 확인

## 경로 2: BakedAsset Editor UI 직접 편집

특정 voxel 만 매핑하거나 weight 비율을 즉시 바꾸고 싶을 때.

⚠️ **재베이크 필요** — `VoxelSpawnRules` 는 *베이크 시점에 attribution 으로 굳어진다*. UI 에서 rules 수정 후 반드시 `BakeRegion` 재실행.

⚠️ **단일 진실원 충돌** — `py bake_terrain.py` 재실행 시 UI 편집이 덮어쓰기됨. UI 편집은 *일회성 실험* 용도로만, 영구 매핑은 경로 3 으로.

절차:
1. Content Browser → `RegionDefault.uasset` 더블클릭
2. **Generator Config → Placement → Voxel Spawn Rules** 펼치기
3. `+` 로 rule 추가:
   - `Voxel Type ID`: 정수
   - `Story Tag`: 드롭다운 — `Story.Flow.Spawner.Natural.*` 선택, **비우면 skip 슬롯**
   - `Weight`: 정수 (비율만 맞으면 됨, 합 100 일 필요 없음)
4. 저장
5. Outliner 에서 BakeRegion 호출 (Editor Utility 또는 Python: `unreal.HktTerrainBakeLibrary.bake_region(...)`)

## 경로 3: `default_voxel_spawn_rules()` 직접 수정 (권장)

영구 매핑은 본 함수에서 관리한다.

**파일**: `HktGameplay/Content/Python/bake_terrain.py`

```python
def default_voxel_spawn_rules() -> dict[int, list[SpawnCandidate]]:
    TREE  = "Story.Flow.Spawner.Natural.Tree"
    SLIME = "Story.Flow.Spawner.Natural.Slime"
    # 새 spawner 를 만들었다면 여기서 import
    # GOBLIN = "Story.Flow.Spawner.Natural.GoblinCamp"
    return {
        # VoxelTypeID : [(StoryTag or None=skip, weight), ...]
        VOXEL_TYPE_GRASS:  [(TREE, 30), (SLIME, 5),  (None, 65)],
        VOXEL_TYPE_SNOW:   [(TREE, 40), (SLIME, 10), (None, 50)],
        VOXEL_TYPE_GRAVEL: [(TREE, 50),               (None, 50)],
        VOXEL_TYPE_CLAY:   [(SLIME, 50), (TREE, 10), (None, 40)],
        VOXEL_TYPE_SAND:   [(SLIME, 30),              (None, 70)],
    }
```

규칙:
- **튜플 형식**: `(StoryTag, Weight)`. StoryTag 가 `None` 이면 skip 슬롯.
- **weight 합 자유**: 비율만 맞으면 됨 — cumulative-weight 로 픽 (예: 합 65 vs 100 동일 동작).
- **weight ≤ 0**: 항목 무시. orphan 카운트에 기록.
- **같은 voxel type 에 후보 N 개** → N 가지 결과가 voxel 좌표별로 분산.
- **흔한 surface (Grass/Dirt)** → skip 비중을 높여 spawn 폭주 차단.

수정 후 `py bake_terrain.py` 재실행으로 적용.

## 새 spawner Story 추가 절차

새 entity 종류를 매트릭스에 편입하려면:

1. **Story JSON 작성** — `Content/Stories/Natural/<Name>/<Name>_Spawn.json` (schema 2)
   - `Param0/1/3` 으로 voxel cm 좌표 읽기
   - `Param2` 는 SlotHash31 — 필요 시 `RandomInt` 등으로 Story 내부 추가 다양성에 사용
   - 패턴 참조: `Tree_Spawn.json`, `Slime_Spawn.json`
2. **태그 선언** — `HktCore/Public/HktCoreTags.h` + `.cpp` 의 `HktNaturalStoryTags` 에 `UE_DECLARE_GAMEPLAY_TAG_EXTERN` + `UE_DEFINE_GAMEPLAY_TAG_COMMENT`. (BirchSpawn/OakSpawn/TreeSpawn/SlimeSpawn 패턴 그대로.)
3. **재로드** — UE Editor *Tools → HktStory → Regenerate Story Tags and Reload* 실행 (JSON 만 추가했고 네이티브 태그 변경 없으면 PIE 진입 시 자동 등록).
4. **bake_terrain.py 후보 추가** → `default_voxel_spawn_rules()` 의 dict 에 새 spawner StoryTag 를 weight 와 함께 등록.
5. **재베이크** — `py bake_terrain.py`.

## 디자인 가이드 — 좋은 매트릭스 짜기

| 변수 | 권장 |
|---|---|
| **흔한 voxel** (Grass/Dirt, 표면의 ~60%) | skip 비중 70-80%. 그러지 않으면 attribution 이 폭증 + spawner story 의 `CountByTag` cap 즉시 도달로 잔여 fire 가 모두 no-op → 디버그 가독성 저하 |
| **희소 voxel** (Snow/Gravel/Clay/Sand) | skip 비중 40-50%. 환경의 정체성을 entity 로 표현 |
| **후보 종 수** | voxel type 당 2-4개 권장. 너무 많으면 (5+) 같은 voxel 에 너무 다양해 보여 환경 일관성 저하 |
| **weight 분포** | "주력 1개 (50-60) + 보조 1-2개 (10-20) + skip 슬롯" 패턴이 안정적 |
| **결정론** | weight 비율은 좌표 분포에 의해 *근사적으로* 실현된다. 표본 100 voxel 미만이면 비율 편차 큼 — 영역 크기로 보정 |

## 디버깅

베이크 후 콘솔 로그를 본다:

```
BakeRegion: VoxelSpawnRules 처리 — Rules=12 (orphan=0), Buckets=4,
SurfaceChunks=25, AttributionsWritten=487, SkipPicks=623
```

| 증상 | 확인 |
|---|---|
| `Rules=0` | Python 스크립트가 `cfg.voxel_spawn_rules` 를 못 채움. `--no-spawn-templates` 줬는지, Editor 빌드 + HktTerrain 모듈 로드됐는지 확인 |
| `Rules>0, orphan>0` | `Weight<=0` 또는 `VoxelTypeID` 범위 밖 entry — 매트릭스 점검 |
| `Buckets=N, AttributionsWritten=0` | 해당 voxel type 이 region 표면에 등장 안 함. 시드/영역 변경 또는 흔한 type (Grass=1) 으로 테스트 |
| `AttributionsWritten=N, SkipPicks=0` | skip 슬롯 없음 — `(None, weight)` 추가하여 "빈 영역" 표현 |
| `BakeRegion: catalog templateId=… 가 어떤 voxel 도 참조하지 않음` WARN | StoryTag 후보로 들어갔으나 한 번도 안 뽑힘 — weight 너무 낮거나 다른 후보에 밀림 |
| 베이크는 되는데 PIE 에서 spawn 없음 | ① Tag 미등록 → `RegenerateStoryTagsAndReload` 호출 / ② Story JSON 의 `storyTag` 가 catalog tag 와 일치하는지 / ③ BakedAsset 슬롯이 액터에 할당됐는지 |

추가 진단:
- 콘솔: `hkt.EventLog.Start` → 시뮬 시작 → `hkt.EventLog.Dump` 로 `Story.Flow.Spawner.Natural.*` 이벤트 dispatch 확인
- Insights 패널: `Window → HKT Gameplay Log` 에서 `Spawner` 카테고리 필터링

## 빠른 검증 시나리오

```
py bake_terrain.py --min=-1,-1,0 --max=1,1,2
```

→ 3×3 청크 (XY) × 3 (Z) 작은 영역. 로그에 `Rules=12 Buckets=4 AttributionsWritten>0 SkipPicks>0` 가 찍히면 OK. PIE 진입 → 표면에 Oak/Slime 결정론 분포 확인. 같은 seed/영역으로 재베이크 시 동일 결과가 나와야 한다 (I-0017 검증).
