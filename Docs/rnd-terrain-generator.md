# RND: Voxel Terrain Generator

> **상태:** 설계 (Claude Code 구현 대기)
> **모듈:** `HktVoxelTerrain` (신규 플러그인)
> **의존:** `HktVoxelCore` (FHktVoxelChunk, FHktVoxelType)
> **최종 수정:** 2026-04-09

---

## 1. 목표

청크 단위 결정론적 복셀 지형 생성기. 시드와 청크 좌표만으로 전 세계 어디든 동일한 지형이 재현되며, 청크 간 이음매가 깨지지 않고, 잔디·물·산악·벽 등 타일이 자연스러운 인접 관계로 분포한다.

**성공 기준**
- 동일 `(world_seed, chunk_coord, epoch)` → 비트 단위 동일한 출력
- 인접 청크 경계에서 1-voxel 단차/불연속 없음
- 16×16×256 청크 1개 생성에 단일 코어 기준 50ms 이하
- 바이옴 전이가 시각적으로 자연스러움 (사막↔빙하 직접 인접 금지)

**비목표**
- 동굴 같은 큰 3D 구조 (별도 RND, Layer 5a는 광석만)
- 구조물 (마을, 던전 — Decoration이 아닌 별도 Structure 패스)
- 런타임 편집 (이건 Layer Generator의 역할이 아님)

---

## 2. 전체 파이프라인

```
ChunkCoord(x, z) + WorldSeed + Epoch
        │
        ▼
┌─────────────────────────────────────┐
│ Layer 0: Deterministic Seeding      │  → FHktChunkSeed
├─────────────────────────────────────┤
│ Layer 1: Climate Noise              │  → FHktClimateField (16×16)
├─────────────────────────────────────┤
│ Layer 2: Biome Classification       │  → FHktBiomeMap (16×16)
├─────────────────────────────────────┤
│ Layer 3: Local Tile Placement (WFC) │  → FHktVoxelChunk (16×16×256)
├─────────────────────────────────────┤
│ Layer 4: Feature Pass               │  → FHktVoxelChunk (mutated)
├─────────────────────────────────────┤
│ Layer 5: Decoration Pass            │  → FHktVoxelChunk (mutated)
│   5a. Subsurface (광석, 동굴)        │
│   5b. Surface Scatter (나무, 돌, 풀) │
└─────────────────────────────────────┘
        │
        ▼
   FHktVoxelChunk → Greedy Mesher
```

각 Layer는 **순수 함수**다. 입력만으로 출력이 결정되며 외부 상태에 의존하지 않는다. 이는 결정론 VM 정책과 동일하며, 멀티스레드 청크 생성 시 락을 제거한다.

---

## 3. 공통 데이터 타입

**파일:** `HktVoxelTerrain/Public/HktTerrainTypes.h`

```cpp
// 청크 좌표 (수평면)
struct FHktChunkCoord
{
    int32 X;
    int32 Z;

    FORCEINLINE bool operator==(const FHktChunkCoord& Other) const;
    FORCEINLINE friend uint32 GetTypeHash(const FHktChunkCoord& C);
};

// 청크 시드 (Layer 0 출력)
struct FHktChunkSeed
{
    uint64 ClimateSeed;   // Layer 1용
    uint64 BiomeSeed;     // Layer 2용 (jitter)
    uint64 WFCSeed;       // Layer 3용
    uint64 FeatureSeed;   // Layer 4용
};

// 기후 필드 (Layer 1 출력)
struct FHktClimateField
{
    static constexpr int32 Size = 16;

    float Elevation[Size * Size];   // [0, 1]
    float Moisture[Size * Size];    // [0, 1]
    float Temperature[Size * Size]; // [0, 1]

    FORCEINLINE float GetElevation(int32 X, int32 Z) const;
    FORCEINLINE float GetMoisture(int32 X, int32 Z) const;
    FORCEINLINE float GetTemperature(int32 X, int32 Z) const;
};

// 바이옴 ID
enum class EHktBiome : uint8
{
    Ocean = 0,
    Beach,
    Grassland,
    Forest,
    Desert,
    Savanna,
    Tundra,
    Taiga,
    RockyMountain,
    SnowPeak,
    Swamp,
    MAX
};

// 바이옴 맵 (Layer 2 출력)
struct FHktBiomeMap
{
    static constexpr int32 Size = 16;
    EHktBiome Cells[Size * Size];

    FORCEINLINE EHktBiome Get(int32 X, int32 Z) const;
};

// 복셀 타입은 HktVoxelCore에 이미 정의되어 있음 (FHktVoxelType)
```

**중요:** 청크 크기는 수평 16×16, 수직 256으로 고정한다. Greedy Meshing 효율과 캐시 정렬을 고려한 값이며 변경 시 메셔까지 영향받는다.

---

## 4. Layer 0 — Deterministic Seeding

**책임:** 월드 시드 + 청크 좌표 + epoch에서 각 Layer가 사용할 독립 시드를 파생한다.

**파일:** `HktVoxelTerrain/Private/HktTerrainSeed.cpp`

```cpp
class FHktTerrainSeed
{
public:
    static FHktChunkSeed Derive(
        uint64 WorldSeed,
        FHktChunkCoord Coord,
        uint32 Epoch);

private:
    static uint64 SplitMix64(uint64 X);
};
```

**알고리즘:**

1. `base = SplitMix64(WorldSeed ^ hash(Coord.X, Coord.Z) ^ Epoch)`
2. `ClimateSeed = SplitMix64(base + 0x1)`
3. `BiomeSeed   = SplitMix64(base + 0x2)`
4. `WFCSeed     = SplitMix64(base + 0x3)`
5. `FeatureSeed = SplitMix64(base + 0x4)`

`hash(x, z)`는 Cantor pairing 또는 `(x * 73856093) ^ (z * 19349663)` 사용. SplitMix64는 단순하고 빠르며 균일 분포가 좋아 시드 파생 표준으로 적합하다.

**Epoch 의미:** "지도가 없는 세계 + 미탐험 영역 재생성" 정책을 위한 시간축 회전 변수. 평소엔 0, 미탐험 영역 재생성 사이클마다 증가. 탐험된 청크는 epoch을 고정해서 영구화한다.

**테스트 케이스:**
- 동일 입력 → 동일 출력 (10000회 반복)
- 인접 청크 시드 간 상관관계 없음 (chi-square)

---

## 5. Layer 1 — Climate Noise

**책임:** 청크 영역 16×16 격자에 대해 elevation, moisture, temperature 세 채널을 생성한다.

**파일:** `HktVoxelTerrain/Private/HktTerrainClimate.cpp`

```cpp
class FHktTerrainClimate
{
public:
    static FHktClimateField Generate(
        FHktChunkCoord Coord,
        const FHktChunkSeed& Seed);

private:
    static float SampleElevation(float WorldX, float WorldZ, uint64 Seed);
    static float SampleMoisture(float WorldX, float WorldZ, uint64 Seed);
    static float SampleTemperature(float WorldX, float WorldZ, uint64 Seed);

    static float FBm(float X, float Z, int32 Octaves, float Lacunarity, float Persistence, uint64 Seed);
    static float DomainWarp(float& X, float& Z, float Strength, uint64 Seed);
};
```

**핵심 원칙:** 노이즈 함수의 입력은 **월드 좌표**다. 청크 좌표가 아니다. `WorldX = Coord.X * 16 + LocalX`. 이것이 청크 경계 연속성의 핵심.

**Elevation 알고리즘:**

1. 도메인 워핑 적용: `(wx, wz) = warp(WorldX, WorldZ, strength=20, seed=ClimateSeed)`
2. Continental noise (저주파): `c = FBm(wx/512, wz/512, octaves=4, lac=2.0, per=0.5, seed=ClimateSeed)`
3. Mountain noise (고주파): `m = FBm(wx/128, wz/128, octaves=6, lac=2.0, per=0.5, seed=ClimateSeed^0xA1)`
4. `elevation = remap(c, -1, 1, 0, 1) * 0.7 + remap(m, -1, 1, 0, 1) * 0.3`
5. `[0, 1]` 클램프

**Moisture 알고리즘:**

`m = FBm(wx/256, wz/256, octaves=3, lac=2.0, per=0.5, seed=ClimateSeed^0xB2)` → remap → `[0, 1]`

추가로 elevation에 따른 비그늘(rain shadow) 효과: 고도 0.7 이상에서 moisture에 0.7 곱셈.

**Temperature 알고리즘:**

위도 기반 + 노이즈:

```
latitude_factor = 1.0 - abs(WorldZ / 4096.0)  // 적도 1.0, 극지 0.0
noise = FBm(wx/384, wz/384, 3, 2.0, 0.5, ClimateSeed^0xC3)
temperature = clamp(latitude_factor * 0.7 + remap(noise, -1, 1, 0, 1) * 0.3 - elevation * 0.4, 0, 1)
```

고도가 높을수록 추워지는 현실 모델.

**노이즈 함수 선택:** `FastNoiseLite` (단일 헤더, MIT, Simplex/OpenSimplex2 제공). UE5 플러그인 디렉토리에 ThirdParty로 임베드.

---

## 6. Layer 2 — Biome Classification

**책임:** Climate 세 채널 → Biome ID 매핑. 결정 트리 기반 + 경계 jitter.

**파일:** `HktVoxelTerrain/Private/HktTerrainBiome.cpp`

```cpp
class FHktTerrainBiome
{
public:
    static FHktBiomeMap Classify(
        const FHktClimateField& Climate,
        const FHktChunkSeed& Seed);

private:
    static EHktBiome Decide(float Elev, float Moist, float Temp);
};
```

**결정 규칙 (Whittaker 변형):**

```
if elevation < 0.30:
    return Ocean
if elevation < 0.34:
    return Beach
if elevation > 0.85:
    return SnowPeak
if elevation > 0.70:
    return RockyMountain

// 평지/구릉
if temperature < 0.25:
    return moisture > 0.5 ? Taiga : Tundra
if temperature < 0.55:
    if moisture < 0.30: return Grassland  // 한대 초원
    if moisture < 0.65: return Forest
    return Swamp
// temperature >= 0.55
if moisture < 0.20: return Desert
if moisture < 0.45: return Savanna
if moisture < 0.70: return Grassland
return Forest
```

**경계 jitter:** 동일 구역 내에서도 셀별로 elevation/moisture에 ±0.02 미세 노이즈를 더해 분류한다. 경계가 직선으로 떨어지지 않게 하는 안티앨리어싱.

```cpp
float jitter_e = (HashFloat(BiomeSeed, x, z, 0) - 0.5) * 0.04;
float jitter_m = (HashFloat(BiomeSeed, x, z, 1) - 0.5) * 0.04;
EHktBiome biome = Decide(elev + jitter_e, moist + jitter_m, temp);
```

**자연스러운 인접성 보장:** Whittaker 다이어그램 자체가 climate 공간에서 연속이므로, climate가 연속이면 biome 전이도 자연스럽다. "사막 옆 빙하" 같은 경우는 Layer 1의 noise가 그런 점프를 만들지 않으므로 발생하지 않는다.

---

## 7. Layer 3 — Local Tile Placement (WFC)

**책임:** 바이옴 맵 + climate를 입력으로, 16×16×256 복셀 청크를 채운다. 표면 형상과 표면 타일 종류를 결정한다.

**파일:** `HktVoxelTerrain/Private/HktTerrainWFC.cpp`

이 Layer는 두 단계로 나뉜다.

### 7.1 단계 A: Heightmap 생성

각 (x, z) 셀에 대해 표면 높이를 결정한다. WFC가 아닌 단순 매핑.

```
height = floor(elevation * 200) + 20
```

세계 해수면을 고정 y=60으로 두고, ocean 바이옴은 `height < 60`, 그 외는 `height >= 60`이 되도록 elevation 매핑을 조정한다.

### 7.2 단계 B: 컬럼 채우기 + 표면 패턴 WFC

각 (x, z) 컬럼을 다음 규칙으로 채운다:

```
y < height - 4    : Stone
y in [height-4, height-1] : (biome 의존 sub-surface, 예: Grassland → Dirt)
y == height       : 표면 타일 (WFC로 결정)
y > height        : Air (단, ocean이면 height <= y <= 60은 Water)
```

표면 타일만 WFC로 결정하는 이유: 전체 3D WFC는 비용이 폭발한다. 2D 16×16 표면 그리드에 한정하면 충분히 빠르고, 시각적으로 가장 중요한 부분이다.

### 7.3 WFC 패턴 정의

**파일:** `HktVoxelTerrain/Config/SurfaceTilePatterns.json` (런타임 로드)

각 패턴은 다음 필드를 갖는다:

```json
{
  "id": "grass_plain",
  "voxel_type": "Grass",
  "biomes": ["Grassland", "Forest", "Savanna"],
  "weight": 10.0,
  "neighbors": {
    "north": ["grass_plain", "grass_flower", "dirt_path", "water_edge"],
    "south": ["grass_plain", "grass_flower", "dirt_path", "water_edge"],
    "east":  ["grass_plain", "grass_flower", "dirt_path", "water_edge"],
    "west":  ["grass_plain", "grass_flower", "dirt_path", "water_edge"]
  }
}
```

**필수 패턴 카탈로그 (MVP):**

| ID | Voxel | 허용 바이옴 |
|----|-------|------------|
| `grass_plain` | Grass | Grassland, Forest, Savanna |
| `grass_flower` | GrassFlower | Grassland, Forest |
| `dirt_path` | Dirt | Grassland, Savanna, Forest |
| `sand_plain` | Sand | Desert, Beach, Savanna |
| `water_edge` | Water | Ocean, Swamp, Beach |
| `water_deep` | Water | Ocean |
| `stone_plain` | Stone | RockyMountain, SnowPeak |
| `stone_mossy` | StoneMossy | RockyMountain, Forest, Swamp |
| `snow_plain` | Snow | SnowPeak, Tundra, Taiga |
| `ice_plain` | Ice | Tundra, Ocean(cold) |

각 패턴의 `neighbors` 규칙은 별도 표(이 문서 부록 A)로 관리한다. 디자이너가 JSON만 수정해서 반복 가능.

### 7.4 WFC 알고리즘

표준 Overlapping이 아닌 **Tiled WFC** 사용. 각 셀이 하나의 패턴 ID를 갖는다.

```cpp
class FHktSurfaceWFC
{
public:
    bool Solve(
        const FHktBiomeMap& Biomes,
        const FHktBoundaryConstraint& Boundary,
        uint64 Seed,
        TArray<FName>& OutPatternIds);  // 16*16 size

private:
    void InitializeCells(const FHktBiomeMap& Biomes);
    int32 SelectMinEntropyCell();
    void Collapse(int32 CellIdx, uint64& RngState);
    bool Propagate(int32 CellIdx);
    bool ApplyBoundaryConstraint(const FHktBoundaryConstraint& B);
};
```

**셀 상태:** 각 셀은 현재 가능한 패턴 ID들의 비트셋(uint64면 패턴 64개까지 지원, 충분).

**초기화:**
1. 모든 셀 = 모든 패턴 가능
2. 각 셀에 대해 해당 위치의 biome으로 필터링 → 그 biome을 허용하지 않는 패턴 제거
3. Boundary constraint 적용 (7.5절)

**반복:**
1. 엔트로피 최소 셀 선택 (가능 패턴 수가 가장 적은 셀, 동률이면 시드 기반 결정)
2. weight 기반 가중 랜덤으로 패턴 1개 선택 → 그 셀 collapse
3. 인접 셀에 제약 전파 (BFS 큐): 인접 셀의 패턴 중 현재 셀의 neighbor 규칙에 없는 것 제거
4. 모순(가능 패턴 0) 발생 시 → 백트래킹 또는 재시작

**모순 처리:** 청크당 최대 3회 재시작 허용. 그래도 실패하면 fallback으로 biome별 디폴트 패턴으로 전부 채움 (시각적으로 단조롭지만 절대 실패하지 않음).

### 7.5 청크 경계 처리 — 가장 중요

청크 A, B가 인접할 때 경계 한 줄(A의 동쪽 끝, B의 서쪽 끝)이 일치해야 이음매가 없다.

**해결책: 경계 사전 결정 (Pre-determined Boundary)**

청크의 4개 가장자리(north, south, east, west) 각 16칸을 WFC 본 풀이 *전에* 결정론적으로 미리 결정한다. 이때 경계 한 줄은 **두 청크의 시드를 모두 사용해서 결정**한다.

```cpp
FName ResolveBoundaryCell(
    FHktChunkCoord A, FHktChunkCoord B, int32 IndexAlongEdge)
{
    // A, B를 정규화 (좌표 작은 쪽이 항상 첫 번째)
    if (A > B) Swap(A, B);

    uint64 EdgeSeed = SplitMix64(
        Hash(A.X, A.Z) ^ Hash(B.X, B.Z) ^ IndexAlongEdge);

    // 두 청크의 biome 중 더 "온화한" 쪽 기준으로 패턴 선택
    EHktBiome BiomeA = SampleBiomeAtEdge(A, IndexAlongEdge);
    EHktBiome BiomeB = SampleBiomeAtEdge(B, IndexAlongEdge);
    EHktBiome Chosen = SelectTransitionBiome(BiomeA, BiomeB);

    return PickWeightedPattern(Chosen, EdgeSeed);
}
```

청크 A를 생성할 때:
1. A의 4개 이웃 좌표를 안다
2. 각 이웃과의 경계 16칸을 위 함수로 미리 결정 → `FHktBoundaryConstraint`
3. 이 제약을 가진 채로 A 내부 14×14를 WFC로 푼다

이렇게 하면 청크 B를 생성할 때도 B-A 경계는 동일한 함수로 같은 값이 나오므로 자동으로 일치한다. **두 청크가 서로의 존재를 모르고도 경계가 맞는다.**

**SelectTransitionBiome 규칙:** 부록 B 표 참조. 예: Grassland↔Desert → Savanna 우선, Ocean↔Grassland → Beach.

### 7.6 성능 가드

- 16×16 = 256 셀, 패턴 ~40개. 단일 청크 WFC는 1ms 이하여야 함
- Propagation 큐는 스택 할당 (`TInlineAllocator<256>`)
- 패턴 비트셋은 uint64 1개로 충분
- 재시작 로깅 → 빈도가 5%를 넘으면 패턴 규칙이 너무 빡빡함을 의미, 디자이너에게 경고

---

## 8. Layer 4 — Feature Pass

**책임:** Layer 3가 채운 청크 위에 강, 호수, 절벽 같은 광역 피처를 덮어쓴다. MVP에서는 **강(River)**만 구현.

**파일:** `HktVoxelTerrain/Private/HktTerrainFeature.cpp`

```cpp
class FHktTerrainFeature
{
public:
    static void Apply(
        FHktVoxelChunk& InOutChunk,
        FHktChunkCoord Coord,
        const FHktClimateField& Climate,
        const FHktChunkSeed& Seed);
};
```

**River 알고리즘 (간소화):**

별도 저주파 노이즈 채널을 사용해 강의 흐름을 결정한다.

```
river_noise = abs(FBm(wx/256, wz/256, 4, 2.0, 0.5, FeatureSeed))
is_river = river_noise < 0.03 && elevation > 0.34 && elevation < 0.7
```

`abs(fbm)` 가까이 0인 영역이 가는 선이 되어 강처럼 보인다 (ridged noise의 역). 조건을 만족하는 (x, z)에서 표면 voxel을 Water로 교체하고 한 칸 파낸다.

추후 RND에서 정교한 hydraulic erosion 추가 예정. 본 문서 범위 외.

---

## 9. Layer 5 — Decoration Pass

**책임:** Layer 4까지 결정된 청크에 환경 오브젝트(나무, 돌, 풀, 광석)를 배치한다. 표면 데코와 지하 매장을 분리해 처리한다.

**파일:** `HktVoxelTerrain/Private/HktTerrainDecoration.cpp`

```cpp
class FHktTerrainDecoration
{
public:
    static void Apply(
        FHktVoxelChunk& InOutChunk,
        FHktChunkCoord Coord,
        const FHktBiomeMap& Biomes,
        const FHktChunkSeed& Seed);

private:
    static void ApplySubsurface(FHktVoxelChunk& Chunk, FHktChunkCoord Coord, uint64 Seed);
    static void ApplySurfaceScatter(FHktVoxelChunk& Chunk, FHktChunkCoord Coord, const FHktBiomeMap& Biomes, uint64 Seed);
};
```

### 9.1 데코 카탈로그

**파일:** `HktVoxelTerrain/Config/DecorationCatalog.json`

데코는 두 종류로 나뉜다.

**Subsurface (광석 등 — 단일 voxel 치환):**

```json
{
  "id": "ore_iron",
  "category": "subsurface",
  "voxel_type": "OreIron",
  "replaces": ["Stone"],
  "min_y": 10,
  "max_y": 80,
  "noise_threshold": 0.92,
  "noise_scale": 32.0,
  "vein_size": [3, 8]
}
```

**Surface (나무, 돌 — 다중 voxel 스탬프):**

```json
{
  "id": "tree_oak",
  "category": "surface",
  "biomes": ["Forest", "Grassland"],
  "biome_density": { "Forest": 0.15, "Grassland": 0.03 },
  "footprint": [3, 3],
  "min_spacing": 4,
  "max_slope": 0.3,
  "stamp": "stamps/tree_oak.json",
  "rotation_variants": 4,
  "size_variants": [
    { "scale": 1.0, "weight": 6 },
    { "scale": 1.2, "weight": 3 },
    { "scale": 1.5, "weight": 1 }
  ]
}
```

**MVP 카탈로그:**

| ID | Category | 바이옴 | 비고 |
|----|----------|--------|------|
| `tree_oak` | surface | Forest, Grassland | 잎+줄기 스탬프 |
| `tree_pine` | surface | Taiga, SnowPeak | 원뿔형 |
| `tree_palm` | surface | Beach, Savanna | 키 큼 |
| `tree_dead` | surface | Desert, Tundra | 잎 없음 |
| `cactus` | surface | Desert | 1×1 footprint |
| `rock_small` | surface | 모든 육지 | 1~2 voxel |
| `rock_large` | surface | RockyMountain, Mountain | 3×3×2 |
| `bush` | surface | Forest, Grassland, Savanna | 1×1 |
| `flower_patch` | surface | Grassland, Forest | 표면 voxel만 변경 |
| `mushroom_cluster` | surface | Forest, Swamp | 1×1 |
| `ore_coal` | subsurface | — | y < 100 |
| `ore_iron` | subsurface | — | y < 80 |
| `ore_gold` | subsurface | — | y < 40 |
| `ore_crystal` | subsurface | — | y < 30, RockyMountain 가중 |

### 9.2 Stamp 포맷

**파일:** `HktVoxelTerrain/Content/Stamps/tree_oak.json`

스탬프는 작은 3D voxel 배열이다. 한 그루의 voxel 모양을 정의한다.

```json
{
  "id": "tree_oak",
  "size": [5, 7, 5],
  "anchor": [2, 0, 2],
  "voxels": [
    { "pos": [2, 0, 2], "type": "WoodLog" },
    { "pos": [2, 1, 2], "type": "WoodLog" },
    { "pos": [2, 2, 2], "type": "WoodLog" },
    { "pos": [2, 3, 2], "type": "WoodLog" },
    { "pos": [1, 4, 2], "type": "Leaves" },
    { "pos": [3, 4, 2], "type": "Leaves" },
    "..."
  ]
}
```

**핵심 필드:**
- `size`: 스탬프의 바운딩 박스 (X, Y, Z)
- `anchor`: 표면에 닿는 기준점. 보통 줄기 밑동
- `voxels`: 채울 voxel 좌표와 타입 목록 (희소 표현)

**왜 희소 표현인가:** 나무는 대부분 빈 공간이라 dense array는 낭비. 또 회전 시 빈 공간이 자동으로 무시됨.

**런타임 캐시:** JSON은 시작 시 한 번만 파싱하고 4종 회전을 미리 계산해 메모리에 보관 (`FHktDecorationStampCache`).

### 9.3 Surface Scatter 알고리즘 — Poisson Disk

나무는 무작위 균등 분포가 아니라 **최소 간격이 보장된** 분포여야 자연스럽다. 이를 위해 Poisson Disk Sampling을 결정론적으로 구현한다.

**왜 Poisson Disk인가:** 균등 랜덤은 클러스터링이 생긴다(어떤 곳은 빽빽, 어떤 곳은 휑함). Poisson Disk는 최소 간격 r을 보장하면서도 자연스러운 분포를 만든다.

**Bridson 알고리즘 (간소화):**

```
input: chunk_area (16×16), min_radius r, seed
output: list of (x, z) points

grid = 2D array, cell size r/sqrt(2)
active = []

// 1. 초기점
seed_pt = (rand(0,16), rand(0,16))
add seed_pt to grid and active

// 2. 반복
while active not empty:
    pick random p from active
    for k in 0..30:  // k = 시도 횟수
        new_pt = annulus_sample(p, r, 2r)
        if in bounds AND no neighbor in r:
            add new_pt to grid and active
            break
    else:
        remove p from active

return grid points
```

**결정론 구현:** 모든 `rand` 호출을 `WfcXorshift(state)` 같은 PRNG로 대체. seed는 `Seed.FeatureSeed ^ DecorationSalt`. `pick random p from active`도 인덱스를 PRNG로 결정.

### 9.4 청크 경계 처리 — 스탬프 오버행

나무 한 그루가 5×7×5라면 청크 가장자리 2칸 안에 심어진 나무는 인접 청크로 침범한다. 이 처리는 두 가지 전략이 가능하다.

**전략 A: 청크 경계 침범 허용 + 인접 청크 시 양보**

청크 A를 생성할 때, 자기 영역(0~15) 안의 모든 데코를 결정한다. 청크 가장자리에 심어진 나무는 인접 청크 B의 영역(예: x = -1)으로 일부가 넘어간다. 이때 청크 B는 자기 영역만 채우면 된다 — A가 생성한 voxel을 무시하지 않고 받아들인다.

문제: 청크 B가 A보다 먼저 메시화되면 나무 일부가 사라진다. 또 A와 B가 동시 생성되면 race.

**전략 B: 데코 결정은 9-청크 통합 (권장)**

청크 A의 데코를 결정할 때, A 자신 + 8방향 이웃 청크의 데코까지 함께 시뮬레이션한다. 그 중 자기 영역에 들어오는 voxel만 기록한다.

```cpp
void ApplySurfaceScatter(...)
{
    // 자기 + 이웃 9개 청크 각각에 대해 데코 점 생성
    for (int dx = -1; dx <= 1; ++dx)
    for (int dz = -1; dz <= 1; ++dz)
    {
        FHktChunkCoord Neighbor = { Coord.X + dx, Coord.Z + dz };
        TArray<FHktDecoPoint> Points;
        GeneratePoissonPointsForChunk(Neighbor, Points);

        // 각 점의 스탬프가 InOutChunk 영역과 겹치는지 검사
        for (const FHktDecoPoint& P : Points)
            StampIntoChunk(InOutChunk, Coord, Neighbor, P);
    }
}
```

**비용:** 9배 같지만, Poisson 생성 자체는 가벼우며 (16×16에 ~30점), 스탬프 적용은 영역 겹침 검사로 빠르게 컬링된다. 핵심은 **각 이웃의 데코 점이 결정론적으로 동일하게 생성**된다는 것 — 그래서 어느 청크에서 봐도 같은 나무가 같은 자리에 있다.

이 방식은 청크 경계를 양방향에서 자동으로 일치시킨다. 7.5절의 WFC 경계 사전 결정과 동일한 철학.

### 9.5 배치 가능 조건 검사

각 Poisson 점에 대해 다음을 검사한다:

1. **표면 높이 조회** — `surface_y = GetSurfaceHeight(Chunk, x, z)`
2. **바이옴 매칭** — 해당 (x, z)의 biome이 데코 카탈로그의 `biomes`에 포함되는가
3. **밀도 가중치** — `rand() < biome_density[biome]` 통과해야 배치
4. **경사 검사** — 인접 4셀의 surface_y 차이 평균 < `max_slope * stamp_size`
5. **표면 voxel 검사** — Water/Lava/Ice 위에는 안 됨 (cactus는 Sand 필요 등 데코별 화이트리스트)
6. **충돌 검사** — 이미 배치된 데코의 footprint와 겹치지 않음

위 6개를 모두 통과한 점에만 스탬프를 적용한다. 통과 못한 점은 조용히 폐기 (에러 아님).

### 9.6 Subsurface 알고리즘 — 3D Noise Threshold

광석은 Poisson 대신 3D 노이즈 임계값 방식이 효율적이다.

```cpp
for each stone voxel (x, y, z) in chunk:
    for each ore in catalog:
        if y not in [ore.min_y, ore.max_y]: continue
        n = noise3D(wx/scale, wy/scale, wz/scale, ore.seed)
        if n > ore.noise_threshold:
            voxel = ore.voxel_type
            break  // 우선순위: 더 희귀한 광석이 카탈로그 앞쪽
```

**Vein 형성:** 단일 임계값은 점 형태가 된다. 매장량(vein)을 만들려면 임계값을 약간 낮추고 (`0.92` → `0.88`) 노이즈 스케일을 키우면 자연스럽게 덩어리진 영역이 생긴다.

**우선순위:** 카탈로그 순서가 곧 우선순위. 희귀 광석을 위에, 흔한 광석을 아래에. break로 중복 배치 방지.

**카탈로그 순서:** `ore_crystal` → `ore_gold` → `ore_iron` → `ore_coal`

**비용:** stone voxel 전체를 순회하면 16×16×200 = 50000회. ore 4종이면 200000 회 노이즈 호출. 단일 청크 5~10ms 정도. 광석 종류가 늘면 비용이 선형 증가하므로, 광석이 6종을 넘으면 "후보 영역만 순회" 최적화 필요.

### 9.7 데코 데이터 구조

```cpp
struct FHktDecoPoint
{
    int32 LocalX;     // 청크 로컬 좌표
    int32 LocalZ;
    FName StampId;
    uint8 Rotation;   // 0~3
    uint8 SizeVariant;
};

struct FHktDecorationStamp
{
    FName Id;
    FIntVector Size;
    FIntVector Anchor;
    TArray<TPair<FIntVector, FHktVoxelType>> Voxels;
};

class FHktDecorationStampCache
{
public:
    static FHktDecorationStampCache& Get();
    const FHktDecorationStamp& GetRotated(FName Id, uint8 Rotation) const;
private:
    void LoadAll();  // JSON → 메모리, 4종 회전 미리 계산
    TMap<TPair<FName, uint8>, FHktDecorationStamp> Stamps;
};
```

### 9.8 성능 가드

- 단일 청크 데코 패스 (Surface + Subsurface) 합계 15ms 이하
- 9-청크 Poisson 통합은 ~270점 처리, 이 중 ~30개만 스탬프 적용
- 스탬프 캐시는 thread-safe (읽기 전용)
- 광석 노이즈는 SIMD 가능 (FastNoiseLite의 batch API 활용 검토)

---

## 10. 진입점

**파일:** `HktVoxelTerrain/Public/HktTerrainGenerator.h`

```cpp
class HKTVOXELTERRAIN_API FHktTerrainGenerator
{
public:
    FHktTerrainGenerator(uint64 InWorldSeed, uint32 InEpoch = 0);

    // 메인 진입점. 스레드 안전 (순수 함수).
    // 내부 호출 순서:
    //   Layer 0  → FHktChunkSeed
    //   Layer 1  → FHktClimateField
    //   Layer 2  → FHktBiomeMap
    //   Layer 3  → FHktVoxelChunk (heightmap + WFC surface)
    //   Layer 4  → FHktVoxelChunk (river)
    //   Layer 5a → FHktVoxelChunk (subsurface ore)
    //   Layer 5b → FHktVoxelChunk (surface scatter, 9-chunk Poisson)
    void GenerateChunk(
        FHktChunkCoord Coord,
        FHktVoxelChunk& OutChunk) const;

private:
    uint64 WorldSeed;
    uint32 Epoch;
};
```

**호출 예:**

```cpp
FHktTerrainGenerator Gen(0xDEADBEEF, 0);
FHktVoxelChunk Chunk;
Gen.GenerateChunk({3, -7}, Chunk);
// → Chunk를 Greedy Mesher에 넘김
```

---

## 11. 테스트 계획

**파일:** `HktVoxelTerrain/Tests/HktTerrainGeneratorTests.cpp`

| 테스트 | 검증 |
|--------|------|
| `Determinism_SameInput` | 동일 시드/좌표 100회 → 동일 출력 |
| `Determinism_CrossThread` | 8스레드 동시 생성 → 모순 없음 |
| `BoundarySeam_Horizontal` | 인접 청크 (0,0)-(1,0) 경계 비교 |
| `BoundarySeam_Vertical` | 인접 청크 (0,0)-(0,1) 경계 비교 |
| `BoundarySeam_4Way` | 4개 청크 모서리 한 점 일치 |
| `BiomeContinuity` | 인접 셀 biome 거리 ≤ 2 (Whittaker 거리) |
| `WFCSuccessRate` | 1000개 청크 생성 시 fallback 발생률 < 1% |
| `DecoTreeContinuity` | 청크 경계 걸친 나무가 양쪽 청크에서 동일 voxel |
| `DecoPoissonSpacing` | 모든 데코 점 쌍 거리 ≥ min_spacing |
| `DecoOreDistribution` | 광석 빈도가 카탈로그 비율과 일치 (±5%) |
| `DecoNoFloating` | 모든 표면 데코의 anchor 아래 voxel이 solid |
| `Performance_SingleChunk` | 단일 청크 70ms 이하 (데코 포함) |
| `Performance_Batch` | 64청크 배치 300ms 이하 (멀티스레드) |

---

## 12. 구현 순서 (Claude Code용)

다음 순서를 따른다. 각 단계는 그 자체로 컴파일/테스트 가능해야 한다.

1. **Step 1:** `HktVoxelTerrain` 플러그인 스캐폴드 + `HktTerrainTypes.h` 모든 구조체
2. **Step 2:** Layer 0 (`FHktTerrainSeed`) + 결정론 단위 테스트
3. **Step 3:** FastNoiseLite 임베드 + Layer 1 (`FHktTerrainClimate`) + 시각화 디버그 BP
4. **Step 4:** Layer 2 (`FHktTerrainBiome`) + biome 분포 통계 테스트
5. **Step 5:** Layer 3 단계 A (heightmap만) + 단순 컬럼 채우기. 이 시점에 처음으로 메시가 보임
6. **Step 6:** WFC 패턴 카탈로그 JSON + 로더
7. **Step 7:** Layer 3 단계 B (WFC) — 단일 청크, 경계 무시
8. **Step 8:** 경계 사전 결정 + `FHktBoundaryConstraint` 적용. 인접 청크 이음매 검증
9. **Step 9:** Layer 4 (River) MVP
10. **Step 10:** Stamp 포맷 + `FHktDecorationStampCache` + JSON 로더
11. **Step 11:** Layer 5b (Surface Scatter) — 단일 청크, 9-청크 통합 없이
12. **Step 12:** 9-청크 Poisson 통합 + 청크 경계 데코 검증
13. **Step 13:** Layer 5a (Subsurface 광석) — 3D 노이즈 기반
14. **Step 14:** 성능 프로파일링 + 최적화

각 단계 완료 시 `docs/rnd-terrain-generator.md`의 해당 섹션에 ✅ 표시 + 실제 구현과 다른 점이 있으면 문서 갱신.

---

## 부록 A: WFC 패턴 인접 규칙 표

> **TODO:** Step 6에서 채울 것. 형식만 정의.

| Pattern A | 허용 이웃 패턴 |
|-----------|---------------|
| grass_plain | grass_plain, grass_flower, dirt_path, water_edge, sand_plain, stone_mossy |
| sand_plain | sand_plain, grass_plain(savanna 한정), water_edge, stone_plain |
| water_edge | water_edge, water_deep, grass_plain, sand_plain, ice_plain |
| water_deep | water_deep, water_edge, ice_plain |
| stone_plain | stone_plain, stone_mossy, snow_plain, grass_plain |
| snow_plain | snow_plain, ice_plain, stone_plain |
| ... | ... |

비대칭 규칙 금지: A가 B를 허용하면 B도 A를 허용해야 한다 (검증 함수 필수).

---

## 부록 B: 바이옴 전이 표

`SelectTransitionBiome(A, B)` 룩업.

| A | B | 전이 |
|---|---|------|
| Ocean | Grassland | Beach |
| Ocean | Desert | Beach |
| Ocean | Forest | Beach |
| Desert | Grassland | Savanna |
| Desert | Forest | Savanna |
| Tundra | Grassland | Taiga |
| Tundra | Forest | Taiga |
| RockyMountain | * | RockyMountain |
| SnowPeak | * | RockyMountain |
| (정의되지 않음) | | A 또는 B 중 가나다순 앞 |

---

## 부록 C: 미해결 질문

- [ ] Y축 청크 분할 여부 (현재 256 단일 컬럼 vs 32×8 분할)
- [ ] Epoch 증가 시 이미 메시화된 청크의 캐시 무효화 정책
- [ ] WFC 패턴 수가 64를 넘으면 비트셋 → uint128 또는 TBitArray 전환
- [ ] 시각적 검증 도구 (디버그 마테리얼, 바이옴 히트맵 오버레이) 별도 RND
- [ ] 데코 스탬프가 청크 경계를 *2칸 이상* 침범하는 경우 (큰 나무 → 9-청크 → 25-청크 확장 필요?)
- [ ] 광석 종류가 6+ 으로 늘어났을 때 후보 영역 컬링 전략
- [ ] 나무 베기 같은 런타임 데코 변경의 영속화 방식 (생성기는 순수 함수이므로 별도 diff layer 필요)
- [ ] 구조물 (마을, 던전 입구) 배치는 Layer 5와 통합? 아니면 Layer 6 신설?
