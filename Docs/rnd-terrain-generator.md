# RND: Voxel Terrain Generator

> **상태:** 설계 (Claude Code 구현 대기)
> **모듈:** `HktVoxelTerrain` (신규 플러그인)
> **의존:** `HktVoxelCore` (FHktVoxelChunk, FHktVoxelType)
> **최종 수정:** 2026-04-17

---

## 1. 목표

청크 단위 결정론적 복셀 지형 생성기. 시드와 청크 좌표만으로 전 세계 어디든 동일한 지형이 재현되며, 청크 간 이음매가 깨지지 않고, 지역별 정체성(대륙 구조)과 발견의 쾌감(랜드마크, 이상 바이옴)을 함께 제공한다.

**성공 기준**

* 동일 `(world_seed, chunk_coord, epoch)` → 비트 단위 동일한 출력
* 인접 청크 경계에서 1-voxel 단차/불연속 없음
* 16×16×256 청크 1개 생성에 단일 코어 기준 80ms 이하 (랜드마크 처리 포함)
* 바이옴 전이가 시각적으로 자연스러움 (사막↔빙하 직접 인접 금지)
* **대륙 타입이 월드 위치에 따라 인식 가능해야 함** — 플레이어가 "여긴 군도다"라고 느낄 수 있어야 함
* **랜드마크 발견 빈도** — 육지 청크 기준 평균 4~8 청크당 1개 (시각적으로 드물지만 너무 희귀하지 않음)

**비목표**

* 동굴 같은 큰 3D 구조 → 별도 RND (`rnd-3d-density-migration.md`)
* 정교한 hydraulic erosion
* 구조물 세부 (마을, 던전 내부) — Landmark Injector는 "외형 스탬프"만 담당
* 런타임 편집 (별도 diff layer 필요)

---

## 2. 전체 파이프라인

```
ChunkCoord(x, z) + WorldSeed + Epoch
        │
        ▼
┌──────────────────────────────────────────┐
│ Layer 0: Deterministic Seeding           │  → FHktChunkSeed
├──────────────────────────────────────────┤
│ Layer 1: Climate Noise                   │  → FHktClimateField (16×16)
│   - elevation, moisture, temperature     │
│   - exoticness (4번째 채널)               │
├──────────────────────────────────────────┤
│ Layer 1.5: Tectonic Template             │  → FHktTectonicMask
│   - 4096-voxel 단위 대륙 타입 결정        │
│   - elevation 마스크로 Layer 1에 피드백   │
├──────────────────────────────────────────┤
│ Layer 2: Biome Classification            │  → FHktBiomeMap (16×16)
├──────────────────────────────────────────┤
│ Layer 2.5: Exotic Biome Overlay          │  → FHktBiomeMap (mutated)
│   - exoticness > 0.95 영역에 이상 바이옴  │
├──────────────────────────────────────────┤
│ Layer 3: Local Tile Placement (WFC)      │  → FHktVoxelChunk (16×16×256)
│   - Phase 0: heightmap 기반               │
│   - Phase 1: 3D density 전환 (별도 RND)   │
├──────────────────────────────────────────┤
│ Layer 4: Landmark Injector               │  → FHktVoxelChunk (mutated)
│   - 확률 기반 대형 피처 주입              │
│   - 싱크홀, 모노리스, 크레이터, 공중섬    │
│   - 강(river)은 하위 피처로 포함          │
├──────────────────────────────────────────┤
│ Layer 5: Decoration Pass                 │  → FHktVoxelChunk (mutated)
│   5a. Subsurface (광석)                   │
│   5b. Surface Scatter (나무, 돌, 풀)     │
└──────────────────────────────────────────┘
        │
        ▼
   FHktVoxelChunk → Greedy Mesher
```

각 Layer는 **순수 함수**다. Layer 1.5는 Layer 1의 출력을 변형해서 피드백하는 구조지만, 이 역시 결정론적 함수 조합이다.

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
    uint64 ClimateSeed;    // Layer 1용
    uint64 TectonicSeed;   // Layer 1.5용
    uint64 BiomeSeed;      // Layer 2/2.5용
    uint64 ExoticSeed;     // Layer 2.5용
    uint64 WFCSeed;        // Layer 3용
    uint64 LandmarkSeed;   // Layer 4용
    uint64 FeatureSeed;    // Layer 4 하위 — 강 등
    uint64 DecoSeed;       // Layer 5용
};

// 기후 필드 (Layer 1 출력)
struct FHktClimateField
{
    static constexpr int32 Size = 16;
    float Elevation[Size * Size];    // [0, 1]
    float Moisture[Size * Size];     // [0, 1]
    float Temperature[Size * Size];  // [0, 1]
    float Exoticness[Size * Size];   // [0, 1]
    // 접근자 생략
};

// 대륙 타입 (Layer 1.5 출력)
enum class EHktContinentType : uint8
{
    Pangea = 0,      // 기본 — 연속 대륙
    Archipelago,     // 섬 군도
    Rift,            // 협곡 대륙
    Spire,           // 첨봉 군집
    Crater,          // 대형 분화구
    Plateau,         // 고원
    Abyss,           // 심연 — Phase 1부터 공중섬
    MAX
};

struct FHktTectonicMask
{
    EHktContinentType PrimaryType;
    EHktContinentType SecondaryType;   // 경계 영역 블렌딩용
    float BlendFactor;                 // [0, 1]
    float ElevationMultiplier[16 * 16];  // 청크 내 16×16에 적용할 승수
    float ElevationOffset[16 * 16];
};

// 바이옴 ID
enum class EHktBiome : uint8
{
    // 현실 바이옴 (Layer 2)
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

    // 이상 바이옴 (Layer 2.5) — 서버 1~3%만
    CrystalForest = 100,   // 투명 크리스탈 나무, 시야 +, 발광
    FloatingMeadow,        // 중력 약화, 공중섬 (Phase 1)
    GlowMushroom,          // 어둠, 발광 버섯, 시야 -
    BoneDesert,            // 거대 뼈 구조물, 특수 몬스터
    VoidRift,              // 무중력, 보스 드롭, 귀환 페널티
    LivingForest,          // 나무가 움직임 (런타임 상호작용)
    MAX
};

struct FHktBiomeMap
{
    static constexpr int32 Size = 16;
    EHktBiome Cells[Size * Size];
    FORCEINLINE EHktBiome Get(int32 X, int32 Z) const;
    FORCEINLINE bool IsExotic(int32 X, int32 Z) const;  // >= 100
};
```

**중요:** 청크 크기는 수평 16×16, 수직 256으로 고정 유지.

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
3. `TectonicSeed = SplitMix64(base + 0x2)`
4. `BiomeSeed = SplitMix64(base + 0x3)`
5. `ExoticSeed = SplitMix64(base + 0x4)`
6. `WFCSeed = SplitMix64(base + 0x5)`
7. `LandmarkSeed = SplitMix64(base + 0x6)`
8. `FeatureSeed = SplitMix64(base + 0x7)`
9. `DecoSeed = SplitMix64(base + 0x8)`

`hash(x, z)`는 `(x * 73856093) ^ (z * 19349663)` 사용. SplitMix64는 균일 분포가 좋아 시드 파생 표준으로 적합하다.

**Epoch 의미:** "지도가 없는 세계 + 미탐험 영역 재생성" 정책을 위한 시간축 회전 변수. 평소엔 0, 미탐험 영역 재생성 사이클마다 증가. 탐험된 청크는 epoch을 고정해서 영구화한다. **단, Tectonic 레이어는 epoch 무시(항상 0 사용)** — 대륙 구조는 영구 불변이어야 장소 정체성이 유지된다.

**테스트 케이스:**

* 동일 입력 → 동일 출력 (10000회 반복)
* 인접 청크 시드 간 상관관계 없음 (chi-square)

---

## 5. Layer 1 — Climate Noise

**책임:** 청크 영역 16×16 격자에 대해 elevation, moisture, temperature, exoticness 네 채널을 생성한다.

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
    static float SampleExoticness(float WorldX, float WorldZ, uint64 Seed);
    static float FBm(float X, float Z, int32 Octaves, float Lacunarity, float Persistence, uint64 Seed);
    static float DomainWarp(float& X, float& Z, float Strength, uint64 Seed);
};
```

**핵심 원칙:** 노이즈 함수의 입력은 **월드 좌표**다. 청크 좌표가 아니다. `WorldX = Coord.X * 16 + LocalX`. 이것이 청크 경계 연속성의 핵심.

### 5.1 Elevation

1. 도메인 워핑 적용: `(wx, wz) = warp(WorldX, WorldZ, strength=20, seed=ClimateSeed)`
2. Continental noise (저주파): `c = FBm(wx/512, wz/512, octaves=4, lac=2.0, per=0.5, seed=ClimateSeed)`
3. Mountain noise (고주파): `m = FBm(wx/128, wz/128, octaves=6, lac=2.0, per=0.5, seed=ClimateSeed^0xA1)`
4. `elevation_raw = remap(c, -1, 1, 0, 1) * 0.7 + remap(m, -1, 1, 0, 1) * 0.3`
5. **Layer 1.5 마스크 적용** (5.5절) — `elevation = elevation_raw * tectonic_mul + tectonic_offset`
6. `[0, 1]` 클램프

### 5.2 Moisture

`m = FBm(wx/256, wz/256, octaves=3, lac=2.0, per=0.5, seed=ClimateSeed^0xB2)` → remap → `[0, 1]`

elevation에 따른 비그늘(rain shadow) 효과: 고도 0.7 이상에서 moisture에 0.7 곱셈.

### 5.3 Temperature

위도 기반 + 노이즈:

```
latitude_factor = 1.0 - abs(WorldZ / 4096.0)
noise = FBm(wx/384, wz/384, 3, 2.0, 0.5, ClimateSeed^0xC3)
temperature = clamp(latitude_factor * 0.7 + remap(noise, -1, 1, 0, 1) * 0.3 - elevation * 0.4, 0, 1)
```

고도가 높을수록 추워지는 현실 모델.

### 5.4 Exoticness

이상 바이옴 발생 확률 채널. **매우 저주파 + 날카로운 분포**가 핵심.

```
ex_warp = FBm(wx/1024, wz/1024, 2, 2.0, 0.5, ExoticSeed)
warp_x = wx + ex_warp * 100
warp_z = wz + FBm(wx/1024+999, wz/1024+999, 2, 2.0, 0.5, ExoticSeed) * 100
base = FBm(warp_x/768, warp_z/768, 3, 2.0, 0.5, ExoticSeed)
// 날카로운 분포: 대부분 0, 드물게 1에 가까움
exoticness = pow(remap(base, -1, 1, 0, 1), 8.0)
```

`pow(x, 8.0)` 변환으로 **95% 이상은 0에 가깝고, 드물게만 0.95를 넘는** 분포를 만든다. 이 값이 Layer 2.5에서 이상 바이옴 판정에 사용된다.

**노이즈 함수 선택:** `FastNoiseLite` (단일 헤더, MIT, Simplex/OpenSimplex2 제공). UE5 플러그인 디렉토리에 ThirdParty로 임베드.

### 5.5 Layer 1.5와의 상호작용

Layer 1은 원시 elevation을 계산하고, Layer 1.5가 그 위에 **대륙 타입 기반 마스크**를 곱해서 최종 elevation을 만든다. 파이프라인 순서상 Layer 1.5 출력을 Layer 1 후처리로 끌어오는 구조:

```
climate = GenerateRawClimate(Coord, Seed);        // Layer 1
tectonic = GenerateTectonicMask(Coord, Seed);     // Layer 1.5
for each cell (x, z):
    climate.Elevation[x,z] = clamp(
        climate.Elevation[x,z] * tectonic.ElevationMultiplier[x,z]
        + tectonic.ElevationOffset[x,z], 0, 1);
```

---

## 6. Layer 1.5 — Tectonic Template

**책임:** 월드를 4096×4096 voxel 단위 "대륙 셀"로 분할하고, 각 셀에 대륙 타입을 부여한다. 이 타입이 Layer 1의 elevation에 마스크로 작용해 **지역별 거대 지형 특성**을 만든다.

**파일:** `HktVoxelTerrain/Private/HktTerrainTectonic.cpp`

```cpp
class FHktTerrainTectonic
{
public:
    static FHktTectonicMask Generate(
        FHktChunkCoord Coord,
        const FHktChunkSeed& Seed);

private:
    static EHktContinentType ClassifyCell(int32 CellX, int32 CellZ, uint64 WorldSeed);
    static void FillMaskForPangea(FHktTectonicMask& M, ...);
    static void FillMaskForArchipelago(FHktTectonicMask& M, ...);
    // 대륙 타입별 FillMask 함수 7개
};
```

### 6.1 대륙 셀 격자

월드 좌표 → 셀 좌표:

```
CELL_SIZE = 4096  // voxel (= 256 청크)
CellX = floor(WorldX / CELL_SIZE)
CellZ = floor(WorldZ / CELL_SIZE)
```

한 청크(16 voxel)는 한 대륙 셀 내부에 완전히 속한다 (CELL_SIZE가 16의 배수이므로).

### 6.2 대륙 타입 분류

**Tectonic은 WorldSeed만 사용 (epoch 무시)** — 대륙은 영구 불변. 월드 어디를 가도 같은 위치의 대륙은 같아야 "장소 정체성"이 생긴다.

```
uint64 CellSeed = SplitMix64(WorldSeed ^ hash(CellX, CellZ) ^ 0xC0DEBEEF);
float roll = SplitMix64ToFloat(CellSeed);

if roll < 0.50: Pangea           // 50% — 기본
elif roll < 0.65: Plateau        // 15%
elif roll < 0.77: Archipelago    // 12%
elif roll < 0.87: Rift           //  10%
elif roll < 0.93: Crater         //  6%
elif roll < 0.98: Spire          //  5%
else:            Abyss           //  2% (Phase 0에서는 Pangea로 폴백)
```

**Phase 0 제약:** Abyss는 공중섬을 요구하므로 3D density가 없으면 시각적 완성도가 떨어진다. Phase 0에서는 Pangea로 폴백, Phase 1에서 활성화.

### 6.3 경계 블렌딩

대륙 셀 경계에서 급격한 변화를 막기 위해 **인접 셀과의 거리 기반 블렌딩**을 적용한다.

```
Vec2 CellCenter = CellCoord * CELL_SIZE + CELL_SIZE/2
float dist_to_center = distance(worldXZ, CellCenter) / (CELL_SIZE/2)
float blend_zone = 0.3  // 중심 70%는 순수, 가장자리 30%는 블렌드

if dist_to_center > (1.0 - blend_zone):
    // 인접 셀 중 가장 가까운 쪽과 블렌드
    NeighborType = ClassifyNeighbor(CellX, CellZ, worldXZ);
    blend_t = (dist_to_center - (1.0 - blend_zone)) / blend_zone
    ElevationMultiplier = lerp(mask_for(PrimaryType), mask_for(NeighborType), blend_t)
```

이 블렌딩 때문에 두 대륙 사이에 자연스러운 "해안선"이나 "산맥 경계"가 생긴다.

### 6.4 대륙 타입별 마스크 정의

각 타입은 `(ElevationMultiplier, ElevationOffset)`을 셀별로 제공한다.

**Pangea (기본):**
```
ElevationMultiplier = 1.0
ElevationOffset     = 0.0
```
→ 현재 설계 그대로. 연속적인 구릉/평원.

**Archipelago (섬 군도):**
```
// 날카로운 threshold로 바다 비중 증가
island_noise = FBm(wx/300, wz/300, 4, 2.0, 0.5, TectonicSeed^Hash(CellX,CellZ))
if island_noise < 0.0:
    ElevationMultiplier = 0.5
    ElevationOffset     = -0.2  // 대부분 해수면 아래
else:
    ElevationMultiplier = 1.3
    ElevationOffset     = 0.1   // 섬은 확실히 솟음
```
→ 작은 섬들이 바다에 점점이 흩어진 형태.

**Rift (협곡 대륙):**
```
// 한 축으로 긴 골짜기
RiftAxisAngle = Hash(CellX, CellZ) → [0, 2π]
local = rotate(worldXZ - CellCenter, -RiftAxisAngle)
rift_intensity = exp(-pow(local.z / 200, 2))  // 축 근처에서 강함
ElevationOffset = -0.5 * rift_intensity
```
→ 대륙을 가로지르는 거대 협곡. 플레이어가 협곡을 건너는 경험.

**Spire (첨봉 군집):**
```
// Voronoi 셀 중심에 높은 elevation 집중
voronoi_dist = VoronoiDistance(worldXZ, cellSize=60, seed=TectonicSeed)
ElevationMultiplier = 1.0 + 2.0 * exp(-voronoi_dist / 30)
```
→ 날카로운 첨봉이 숲처럼 빽빽이 선 대륙. Guilin(계림) 스타일.

**Crater (대형 분화구):**
```
CraterCenter = CellCenter
dist = distance(worldXZ, CraterCenter)
CRATER_RADIUS = 1500
if dist < CRATER_RADIUS:
    t = dist / CRATER_RADIUS
    ElevationOffset = -0.6 * (1 - t*t) + 0.2 * smoothstep(0.85, 1.0, t)  // 림(rim) 형성
```
→ 셀 중심에 거대 운석 구덩이. 림이 산맥처럼 둘러쌈.

**Plateau (고원):**
```
plateau_noise = FBm(wx/400, wz/400, 3, 2.0, 0.5, TectonicSeed)
if plateau_noise > 0.2:
    // 평탄한 고원
    ElevationMultiplier = 0.3   // 고원 내부는 변동 작음
    ElevationOffset     = 0.5   // 베이스 높이 상승
else:
    ElevationMultiplier = 0.8   // 고원 바깥은 낮음
    ElevationOffset     = 0.0
```
→ Tibet/Altiplano 스타일. 넓고 평탄한 고지대와 급격한 낭떠러지.

**Abyss (Phase 1):**
```
// 기본 지형은 매우 낮음 (해수면 아래)
ElevationMultiplier = 0.2
ElevationOffset     = -0.3
// 공중섬은 3D density layer가 별도 처리
```
→ Phase 1 (3D density 도입 후) 활성화. 검은 심해 위에 공중섬이 떠다니는 영역.

### 6.5 결정론 보장

모든 승수/오프셋은 `(WorldSeed, WorldX, WorldZ)`만의 함수. 청크 좌표가 같으면 항상 같은 값. 청크 간 경계에서도 동일한 함수가 양쪽에서 호출되므로 자동 일치.

### 6.6 성능

단일 청크(16×16 = 256 셀) 처리 시간 목표: **2ms 이하**. 주요 비용은 각 셀의 FBm 호출 2회 정도. Voronoi(Spire) 타입이 가장 무거움 — SIMD 최적화 여지 있음.

---

## 7. Layer 2 — Biome Classification

**책임:** Climate 세 채널(elevation, moisture, temperature) → Biome ID 매핑. 결정 트리 기반 + 경계 jitter. 이상 바이옴은 Layer 2.5에서 오버라이드한다.

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
if elevation < 0.30: return Ocean
if elevation < 0.34: return Beach
if elevation > 0.85: return SnowPeak
if elevation > 0.70: return RockyMountain

// 평지/구릉
if temperature < 0.25:
    return moisture > 0.5 ? Taiga : Tundra
if temperature < 0.55:
    if moisture < 0.30: return Grassland
    if moisture < 0.65: return Forest
    return Swamp
// temperature >= 0.55
if moisture < 0.20: return Desert
if moisture < 0.45: return Savanna
if moisture < 0.70: return Grassland
return Forest
```

**경계 jitter:** 셀별 ±0.02 미세 노이즈 추가 (안티앨리어싱).

---

## 8. Layer 2.5 — Exotic Biome Overlay

**책임:** Layer 2가 만든 현실 바이옴 위에, `exoticness > threshold`인 영역을 이상 바이옴으로 덮어쓴다.

**파일:** `HktVoxelTerrain/Private/HktTerrainExoticBiome.cpp`

```cpp
class FHktTerrainExoticBiome
{
public:
    static void Apply(
        FHktBiomeMap& InOutBiomes,
        const FHktClimateField& Climate,
        const FHktChunkSeed& Seed);

private:
    static EHktBiome SelectExoticBiome(
        float Exoticness, float Elev, float Moist, float Temp, uint64 LocalSeed);
};
```

### 8.1 임계값 및 타입 선택

```
for each cell (x, z) in chunk:
    if climate.Exoticness[x,z] > 0.95:  // 서버 전체의 ~1-3% 커버
        EHktBiome Original = Biomes.Get(x, z);
        if Original == Ocean: continue;  // 바다는 이상 바이옴 제외
        
        uint64 localSeed = ExoticSeed ^ hash(worldX, worldZ);
        EHktBiome Exotic = SelectExoticBiome(
            exoticness, elev, moist, temp, localSeed);
        Biomes.Set(x, z, Exotic);
```

### 8.2 이상 바이옴 선택 규칙

원래 바이옴의 기후 특성에 따라 **어울리는 이상 바이옴**을 확률적으로 선택:

| 원래 바이옴 | 이상 바이옴 후보 (가중치) |
|-----------|-------------------------|
| Forest, Grassland | CrystalForest(3), LivingForest(2), GlowMushroom(1) |
| Desert, Savanna | BoneDesert(4), CrystalForest(1) |
| RockyMountain, SnowPeak | CrystalForest(2), VoidRift(3) |
| Tundra, Taiga | GlowMushroom(2), VoidRift(1) |
| Swamp | GlowMushroom(4), LivingForest(2) |

`FloatingMeadow`, `VoidRift`는 Phase 1 (3D density) 필수. Phase 0에서는 해당 바이옴이 선택되면 **시각적 유사 폴백** (FloatingMeadow → CrystalForest, VoidRift → GlowMushroom).

### 8.3 이상 바이옴 정의

각 이상 바이옴은 다음 속성을 가진다:

| 바이옴 | 표면 타일 | 데코 | 환경 규칙 변화 | 시각 키워드 |
|-------|---------|------|--------------|------------|
| CrystalForest | CrystalGrass | CrystalTree, CrystalShard | 시야 +20%, 야간 밝음 | 파스텔 민트/청록, 반투명 |
| FloatingMeadow | GrassEthereal | FloatingRock, ChimeFlower | 중력 0.3×, 낙하 피해 -70% | 파스텔 핑크/보라, 공기 |
| GlowMushroom | SoilDark, MossGlow | GiantMushroom, SporePuff | 시야 -40%, 발광 체력 +10% | 파스텔 라임/자주, 흑+형광 |
| BoneDesert | SandBleached | BoneArch, SkullRock | 수분 -50%, 일몰시 몬스터 강화 | 파스텔 크림/연노랑, 거대 뼈 구조 |
| VoidRift | StoneFractured | VoidShard, GravityWell | 중력 불규칙, 귀환 페널티, 보스 드롭 | 파스텔 인디고/핑크, 균열 이펙트 |
| LivingForest | GrassShifting | WalkingTree, RootSerpent | 지형이 주기적으로 이동 (매 시간) | 파스텔 라벤더/황록, 동적 |

**중요 — MapleStory 2 톤 일관성:** 모든 이상 바이옴의 컬러 팔레트는 **파스텔 고채도**로 통일한다. 어두운 호러톤 금지. 귀여운 복셀 세계관 안에서 "신비롭고 이질적이지만 위협적이진 않은" 느낌을 유지.

**환경 규칙 변화 구현:** 이상 바이옴의 시야/중력/체력 효과는 본 문서 범위 외 (`HktGameplayBiomeEffect` 시스템에서 담당). 여기서는 **바이옴 ID만 올바르게 할당**하는 것이 목표.

### 8.4 클러스터링

`exoticness` 노이즈가 저주파(`/768`)이므로 `> 0.95` 영역은 **자연스럽게 덩어리로 뭉친다**. 단일 셀이 고립된 이상 바이옴이 되진 않음. 보통 반경 수 청크 규모의 클러스터가 된다. 이게 "이 지역은 수정의 숲이다"라는 장소감을 만든다.

### 8.5 성능

Layer 2가 끝난 후 16×16 셀 추가 순회. 대부분 셀은 `exoticness` 검사 후 즉시 continue. **1ms 이하** 목표.

---

## 9. Layer 3 — Local Tile Placement (WFC)

**책임:** 바이옴 맵 + climate를 입력으로, 16×16×256 복셀 청크를 채운다. 표면 형상과 표면 타일 종류를 결정한다.

**파일:** `HktVoxelTerrain/Private/HktTerrainWFC.cpp`

### 9.0 Phase 0 / Phase 1 분기

- **Phase 0 (본 문서):** heightmap 기반. 아래 9.1~9.6 설계.
- **Phase 1:** 3D density function 기반. 별도 RND 문서 `rnd-3d-density-migration.md` 참조.

Phase 0 설계는 Phase 1에서도 **floor layer**로 부분 활용될 수 있도록 훅을 유지한다 (`GenerateBaseHeightmap` 함수를 public으로 노출).

### 9.1 단계 A: Heightmap 생성

```
height = floor(elevation * 200) + 20
```

세계 해수면 고정 y=60. ocean 바이옴은 `height < 60`, 그 외는 `height >= 60`.

**이상 바이옴 높이 조정:**
- `CrystalForest`, `LivingForest`: 원래 높이 유지
- `BoneDesert`: 약간 낮게 (`* 0.85`)
- `VoidRift`: 약간 높게 (`* 1.1`) — 주변과 대비
- `FloatingMeadow` (Phase 1): heightmap은 낮게, 공중섬은 3D density가 처리

### 9.2 단계 B: 컬럼 채우기 + 표면 패턴 WFC

```
y < height - 4    : Stone
y in [height-4, height-1] : (biome 의존 sub-surface)
y == height       : 표면 타일 (WFC로 결정)
y > height        : Air (ocean이면 height <= y <= 60은 Water)
```

표면 타일만 WFC로 결정. 2D 16×16 표면 그리드에 한정.

### 9.3 WFC 패턴 정의

**파일:** `HktVoxelTerrain/Config/SurfaceTilePatterns.json`

각 패턴은 다음 필드:

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

*현실 바이옴용:*

| ID | Voxel | 허용 바이옴 |
| --- | --- | --- |
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

*이상 바이옴용:*

| ID | Voxel | 허용 바이옴 |
| --- | --- | --- |
| `crystal_grass` | CrystalGrass | CrystalForest |
| `crystal_shard_surface` | CrystalShardSmall | CrystalForest |
| `glow_moss` | MossGlow | GlowMushroom |
| `soil_dark` | SoilDark | GlowMushroom |
| `sand_bleached` | SandBleached | BoneDesert |
| `bone_fragment` | BoneFragment | BoneDesert |
| `stone_fractured` | StoneFractured | VoidRift |
| `grass_ethereal` | GrassEthereal | FloatingMeadow, LivingForest |

각 패턴의 `neighbors` 규칙은 부록 A 참조.

### 9.4 WFC 알고리즘

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

**셀 상태:** 각 셀은 현재 가능한 패턴 ID들의 비트셋. 현재 ~20 현실 + 8 이상 ≈ 28 패턴이므로 uint64 여유 있지만, 확장성 고려 시 **`TBitArray<FDefaultBitArrayAllocator>` 권장**.

**초기화:**

1. 모든 셀 = 모든 패턴 가능
2. 각 셀에 대해 biome으로 필터링
3. Boundary constraint 적용 (9.5절)

**반복:**

1. 엔트로피 최소 셀 선택
2. weight 기반 가중 랜덤으로 패턴 선택 → collapse
3. 인접 셀에 제약 전파 (BFS 큐)
4. 모순 발생 시 → 백트래킹 또는 재시작

**모순 처리:** 청크당 최대 3회 재시작. 실패 시 biome별 디폴트 패턴으로 전부 채움 (fallback).

### 9.5 청크 경계 처리 — Pre-determined Boundary

청크의 4개 가장자리 각 16칸을 WFC 본 풀이 *전에* 결정론적으로 미리 결정한다. 두 청크의 시드를 모두 사용해서 결정하므로, 어느 청크에서 생성하든 경계가 자동 일치한다.

```cpp
FName ResolveBoundaryCell(
    FHktChunkCoord A, FHktChunkCoord B, int32 IndexAlongEdge)
{
    if (A > B) Swap(A, B);
    uint64 EdgeSeed = SplitMix64(
        Hash(A.X, A.Z) ^ Hash(B.X, B.Z) ^ IndexAlongEdge);
    EHktBiome BiomeA = SampleBiomeAtEdge(A, IndexAlongEdge);
    EHktBiome BiomeB = SampleBiomeAtEdge(B, IndexAlongEdge);
    EHktBiome Chosen = SelectTransitionBiome(BiomeA, BiomeB);
    return PickWeightedPattern(Chosen, EdgeSeed);
}
```

**이상 바이옴과 현실 바이옴 전이:** `SelectTransitionBiome`에 규칙 추가 — 이상 바이옴 ↔ 현실 바이옴 경계는 원래 바이옴(이상화되기 전)으로 전이. 예: CrystalForest(원래 Forest) ↔ Grassland → Forest.

### 9.6 성능 가드

* 16×16 = 256 셀, 패턴 ~30개. 단일 청크 WFC 1ms 이하
* Propagation 큐는 스택 할당 (`TInlineAllocator<256>`)
* 재시작 빈도 >5% → 디자이너 경고

---

## 10. Layer 4 — Landmark Injector

**책임:** Layer 3가 채운 청크 위에 **대형 랜드마크**와 하위 피처(강 등)를 덮어쓴다. 플레이어가 지평선 너머로 발견하는 "기억에 남는 지점"을 만드는 것이 목적.

**파일:** `HktVoxelTerrain/Private/HktTerrainLandmark.cpp`

```cpp
class FHktTerrainLandmark
{
public:
    static void Apply(
        FHktVoxelChunk& InOutChunk,
        FHktChunkCoord Coord,
        const FHktClimateField& Climate,
        const FHktBiomeMap& Biomes,
        const FHktTectonicMask& Tectonic,
        const FHktChunkSeed& Seed);

private:
    // 두 단계: 랜드마크 먼저 (큰 것), 강 나중 (작은 것)
    static void ApplyLandmarks(FHktVoxelChunk& Chunk, ...);
    static void ApplyRivers(FHktVoxelChunk& Chunk, ...);
};
```

### 10.1 랜드마크 카탈로그

**파일:** `HktVoxelTerrain/Config/LandmarkCatalog.json`

각 랜드마크는 확률/조건/형태를 JSON으로 정의.

```json
{
  "id": "sinkhole",
  "probability": 0.02,
  "allowed_biomes": ["Desert", "Grassland", "Savanna", "RockyMountain"],
  "allowed_continents": ["Pangea", "Plateau"],
  "min_elevation": 0.40,
  "max_elevation": 0.75,
  "influence_radius": 35,
  "carve": {
    "type": "sphere",
    "radius": 30,
    "y_offset": -40,
    "noise_perturbation": 5
  }
}
```

**MVP 카탈로그:**

| ID | 확률(청크당) | 바이옴 | 대륙 | 형태 | 크기 | 메모 |
|----|------------|--------|------|------|-----|------|
| `sinkhole` | 0.02 | Desert, Grassland, Savanna | Pangea, Plateau | sphere carve | r=30, depth=40 | 지하 노출 |
| `mesa` | 0.015 | Desert | Pangea | flat cylinder stamp | r=40, h=50 | 평정 봉우리 |
| `monolith` | 0.005 | 전부 | 전부 | voxel tower stamp | w=5, h=80 | 신비 유물 |
| `small_crater` | 0.01 | 전부 | Pangea (Crater 대륙은 제외 — 중복) | paraboloid carve | r=25, depth=15 | 소형 운석 |
| `stone_arch` | 0.008 | RockyMountain, Desert | 전부 | arch stamp | w=20, h=25 | 자연 아치 |
| `giant_tree` | 0.003 | Forest, CrystalForest | 전부 | oversized tree stamp | r=15, h=60 | 세계수 |
| `bone_spire` | 0.02 | BoneDesert | 전부 | rib stamp | h=40~70 | 이상 바이옴 전용 |
| `crystal_column` | 0.025 | CrystalForest | 전부 | crystal stamp | r=8, h=40 | 이상 바이옴 전용 |
| `void_fissure` | 0.015 | VoidRift | 전부 | linear crack carve | l=60, depth=80 | 이상 바이옴 전용 |

**확률 해석:** "해당 바이옴/대륙 조건을 만족하는 청크에서 시도할 때의 성공 확률". 바이옴이 맞지 않으면 시도조차 하지 않음.

평균 밀도 목표: **육지 청크 기준 4~8 청크당 1개**. 카탈로그 전체의 확률 합이 그 범위에 들어가도록 튜닝.

### 10.2 랜드마크 배치 알고리즘

```
for each landmark in catalog:
    if chunk's biome/continent not in allowed: continue
    
    // 결정론적 roll
    roll_seed = LandmarkSeed ^ hash(landmark.id) ^ hash(Coord.X, Coord.Z)
    if SplitMix64ToFloat(roll_seed) >= landmark.probability: continue
    
    // 배치 위치 (청크 내 중심 근처)
    local_x = (SplitMix64(roll_seed+1) % 8) + 4  // [4, 11]
    local_z = (SplitMix64(roll_seed+2) % 8) + 4
    
    // 조건 검사 (elevation, 충돌 등)
    if not CheckPlacementValid(chunk, local_x, local_z, landmark): continue
    
    // 적용
    ApplyCarveOrStamp(chunk, local_x, local_z, landmark, roll_seed)
    break  // 청크당 1개만 (중복 방지)
```

**핵심:** `break` — 청크당 최대 1개 랜드마크만 허용. 이게 "밀도는 드물게, 존재감은 강렬하게"를 보장한다.

### 10.3 영향 반경이 청크를 넘는 경우

큰 랜드마크(`influence_radius > 16`)는 인접 청크로 침범한다. 처리 방식은 **N-청크 통합 방식**으로 일반화한다 (Layer 5b의 Poisson 통합과 동일한 철학):

```
// 청크 A를 생성할 때
for dx in [-R, R], dz in [-R, R]:  // R = ceil(max_landmark_radius / 16)
    Neighbor = Coord + (dx, dz)
    // Neighbor가 랜드마크를 배치하는지 결정론적으로 체크
    // 배치한다면, 그 랜드마크의 영향이 A에 미치는지 확인
    if landmark_from_neighbor_overlaps_A:
        ApplyCarveOrStamp(InOutChunk, ..., offset_adjusted)
```

현재 카탈로그에서 가장 큰 랜드마크는 `giant_tree` (반경 15) = 1 청크. **R=1이면 9-청크 확장으로 충분**. 미래 더 큰 랜드마크(반경 30+) 추가 시 R=2 (25-청크) 필요. JSON의 `influence_radius`를 기반으로 R을 자동 결정한다.

Layer 5b의 Poisson 데코와 Layer 4 랜드마크 모두 이 "메타데이터가 영향 반경을 선언하고, N-청크 확장을 자동 결정"하는 구조를 공유한다.

### 10.4 Carve / Stamp 프리미티브

**Carve (감산):**
- `sphere(center, r)` — 구체 내부 Air
- `paraboloid(center, r, depth)` — 그릇 모양 (분화구)
- `extruded_path(start, end, width, depth)` — 경로 따라 홈 (협곡)
- `linear_crack(center, axis, length, depth)` — 날카로운 균열 (VoidRift)

**Stamp (가산):**
- `cylinder(center, r, h, voxel_type)` — 원기둥
- `voxel_tower(footprint, h, voxel_type)` — 직육면체 타워
- `arch(start, end, h, voxel_type)` — 아치 (파라볼라)
- `rib(center, h, rib_count, voxel_type)` — 갈비뼈 구조 (BoneSpire)
- `custom_stamp(stamp_id)` — 외부 JSON 스탬프 (거대 나무, 수정 기둥)

모든 프리미티브는 **noise_perturbation** 파라미터를 받아 경계를 약간 흔들어 자연스러운 외형을 만든다.

### 10.5 Rivers (하위 피처)

강은 랜드마크 하위의 세부 피처로 처리한다:

```
river_noise = abs(FBm(wx/256, wz/256, 4, 2.0, 0.5, FeatureSeed))
is_river = river_noise < 0.03 && elevation > 0.34 && elevation < 0.7
// 단, 이상 바이옴 중 VoidRift에는 강이 생기지 않음
```

`abs(fbm)` 가까이 0인 영역이 가는 선이 되어 강처럼 보인다. 조건을 만족하는 (x, z)에서 표면 voxel을 Water로 교체하고 한 칸 파낸다.

강은 랜드마크 적용 *후*에 덮어써서 "모노리스 옆을 흐르는 강" 같은 조합이 자연 발생하도록 한다.

### 10.6 성능

- 단일 청크 랜드마크 패스: **5ms 이하** 목표
- 9-청크 확장 시 최악 45ms — 대부분의 청크는 랜드마크 roll에서 바로 탈락하므로 평균 10ms 내외 예상
- 큰 Stamp의 voxel 적용은 bounding-box 컬링으로 최적화

---

## 11. Layer 5 — Decoration Pass

**책임:** 이전 레이어까지 결정된 청크에 환경 오브젝트(나무, 돌, 풀, 광석)를 배치한다.

이 Layer는 두 단계로 나뉜다:
- **5a. Subsurface** — 3D noise threshold 기반 광석 매장
- **5b. Surface Scatter** — 9-청크 Poisson Disk 통합으로 나무/돌/풀 배치

본 섹션은 요약만 제공하며, 상세 알고리즘은 구현 단계에서 본 문서에 보강한다.

### 11.1 데코 카탈로그

**파일:** `HktVoxelTerrain/Config/DecorationCatalog.json`

*현실 바이옴용 (MVP):*

| ID | Category | 바이옴 | 비고 |
| --- | --- | --- | --- |
| `tree_oak` | surface | Forest, Grassland | 잎+줄기 스탬프 |
| `tree_pine` | surface | Taiga, SnowPeak | 원뿔형 |
| `tree_palm` | surface | Beach, Savanna | 키 큼 |
| `tree_dead` | surface | Desert, Tundra | 잎 없음 |
| `cactus` | surface | Desert | 1×1 footprint |
| `rock_small` | surface | 모든 육지 | 1~2 voxel |
| `rock_large` | surface | RockyMountain | 3×3×2 |
| `bush` | surface | Forest, Grassland, Savanna | 1×1 |
| `flower_patch` | surface | Grassland, Forest | 표면 voxel만 변경 |
| `mushroom_cluster` | surface | Forest, Swamp | 1×1 |
| `ore_coal` | subsurface | — | y < 100 |
| `ore_iron` | subsurface | — | y < 80 |
| `ore_gold` | subsurface | — | y < 40 |
| `ore_crystal` | subsurface | — | y < 30, RockyMountain 가중 |

*이상 바이옴용:*

| ID | Category | 바이옴 | 비고 |
| --- | --- | --- | --- |
| `tree_crystal` | surface | CrystalForest | 반투명 크리스탈 나무 |
| `crystal_shard` | surface | CrystalForest | 뾰족 결정체 |
| `mushroom_giant` | surface | GlowMushroom | 거대 발광 버섯 |
| `spore_puff` | surface | GlowMushroom | 포자 구름 이펙트 (mesh) |
| `bone_arch_small` | surface | BoneDesert | 소형 뼈 아치 |
| `skull_rock` | surface | BoneDesert | 두개골 형태 |
| `void_shard` | surface | VoidRift | 공허 파편 |
| `tree_walking` | surface | LivingForest | 다리 달린 나무 (런타임 상호작용) |
| `ore_voidstone` | subsurface | VoidRift 내부만 | 특수 광물 |

### 11.2 Surface Scatter — 9-청크 Poisson 통합

Poisson Disk Sampling (Bridson 알고리즘)으로 최소 간격이 보장된 자연 분포를 생성한다. 청크 경계 걸친 데코가 양쪽 청크에서 동일하게 보이도록, 각 청크는 **자신 + 8방향 이웃 9개 청크**의 데코를 함께 시뮬레이션하고 자기 영역에 들어오는 voxel만 기록한다.

### 11.3 Subsurface — 3D Noise Threshold

광석은 3D 노이즈 임계값 방식이 효율적:

```
for each stone voxel (x, y, z) in chunk:
    for each ore in catalog:
        if y not in [ore.min_y, ore.max_y]: continue
        n = noise3D(wx/scale, wy/scale, wz/scale, ore.seed)
        if n > ore.noise_threshold:
            voxel = ore.voxel_type
            break  // 우선순위: 희귀 광석이 카탈로그 앞쪽
```

### 11.4 Stamp 포맷

Stamp는 3D voxel 희소 배열 JSON으로 정의한다. 나무, 거대 버섯, 아치 등 복잡한 형태는 스탬프로 처리한다.

스탬프 포맷 상세와 Poisson 알고리즘의 결정론 구현은 Step 14~15 구현 시점에 본 섹션에 보강한다.

---

## 12. 진입점

**파일:** `HktVoxelTerrain/Public/HktTerrainGenerator.h`

```cpp
class HKTVOXELTERRAIN_API FHktTerrainGenerator
{
public:
    FHktTerrainGenerator(uint64 InWorldSeed, uint32 InEpoch = 0);

    // 메인 진입점. 스레드 안전 (순수 함수).
    // 내부 호출 순서:
    //   Layer 0   → FHktChunkSeed
    //   Layer 1   → FHktClimateField (raw)
    //   Layer 1.5 → FHktTectonicMask → Climate.Elevation 재조정
    //   Layer 2   → FHktBiomeMap
    //   Layer 2.5 → FHktBiomeMap (exotic overlay)
    //   Layer 3   → FHktVoxelChunk (heightmap + WFC surface)
    //   Layer 4   → FHktVoxelChunk (landmarks + rivers)
    //   Layer 5a  → FHktVoxelChunk (subsurface ore)
    //   Layer 5b  → FHktVoxelChunk (surface scatter)
    void GenerateChunk(
        FHktChunkCoord Coord,
        FHktVoxelChunk& OutChunk) const;

private:
    uint64 WorldSeed;
    uint32 Epoch;
};
```

---

## 13. 테스트 계획

| 테스트 | 검증 |
| --- | --- |
| `Determinism_SameInput` | 동일 시드/좌표 100회 → 동일 출력 |
| `Determinism_CrossThread` | 8스레드 동시 생성 → 모순 없음 |
| `BoundarySeam_Horizontal` | 인접 청크 경계 비교 |
| `BoundarySeam_Vertical` | 인접 청크 경계 비교 |
| `BoundarySeam_4Way` | 4개 청크 모서리 한 점 일치 |
| `BiomeContinuity` | 인접 셀 biome 거리 ≤ 2 (현실 바이옴 내) |
| `WFCSuccessRate` | 1000청크 fallback 발생률 < 1% |
| `TectonicCellStability` | 동일 대륙 셀 내 타입이 epoch에 무관하게 동일 |
| `TectonicBlendContinuity` | 대륙 경계 블렌드 구간에서 elevation 연속 |
| `ExoticBiomeDensity` | 대규모 월드에서 이상 바이옴 비율 1~3% |
| `ExoticBiomeClustering` | 이상 바이옴이 고립 셀로 나타나지 않음 (평균 클러스터 크기 ≥ 5셀) |
| `LandmarkDensity` | 육지 청크당 평균 4~8 청크당 1개 |
| `LandmarkBoundary` | 청크 경계 걸친 랜드마크가 양쪽에서 동일 voxel |
| `DecoTreeContinuity` | 데코 경계 검증 |
| `DecoPoissonSpacing` | 데코 점 쌍 간격 ≥ min_spacing |
| `DecoOreDistribution` | 광석 빈도 ±5% 이내 |
| `DecoNoFloating` | 표면 데코 아래가 solid |
| `Performance_SingleChunk` | 단일 청크 80ms 이하 (랜드마크 포함) |
| `Performance_Batch` | 64청크 300ms 이하 (멀티스레드) |

---

## 14. 구현 순서 (Claude Code용)

16단계. 각 단계는 독립적으로 컴파일/테스트 가능하게 설계했다.

1. **Step 1:** `HktVoxelTerrain` 플러그인 스캐폴드 + `HktTerrainTypes.h`
2. **Step 2:** Layer 0 (`FHktTerrainSeed`) + 결정론 테스트
3. **Step 3:** FastNoiseLite 임베드 + Layer 1 (exoticness 포함 4채널) + 시각화 BP
4. **Step 4:** Layer 1.5 (Tectonic Template) — Pangea/Plateau/Archipelago 3종 먼저
5. **Step 5:** Layer 1.5 나머지 대륙 타입 (Rift, Spire, Crater) + 경계 블렌딩
6. **Step 6:** Layer 2 (`FHktTerrainBiome`) + 분포 통계 테스트
7. **Step 7:** Layer 2.5 (Exotic Biome Overlay) — 4종 이상 바이옴 우선 (CrystalForest, GlowMushroom, BoneDesert, LivingForest)
8. **Step 8:** Layer 3 단계 A (heightmap) + 단순 컬럼 채우기. 첫 메시 가시화
9. **Step 9:** WFC 패턴 카탈로그 JSON + 로더 (현실 + 이상 바이옴 통합)
10. **Step 10:** Layer 3 단계 B (WFC) — 단일 청크, 경계 무시
11. **Step 11:** 경계 사전 결정 + `FHktBoundaryConstraint`. 이음매 검증
12. **Step 12:** Layer 4 (Landmark Injector) — 카탈로그 로더 + 3종 랜드마크 (sinkhole, monolith, mesa)
13. **Step 13:** Layer 4 나머지 랜드마크 + 영향 반경 기반 N-청크 확장 + 강(river)
14. **Step 14:** Stamp 포맷 + `FHktDecorationStampCache`
15. **Step 15:** Layer 5b (Surface Scatter) + 9-청크 Poisson 통합
16. **Step 16:** Layer 5a (Subsurface) + 성능 프로파일링

각 단계 완료 시 해당 섹션에 ✅ 표시 + 구현 차이점 갱신.

---

## 15. Phase 1 예고: 3D Density Function

Phase 0 완료 후 별도 RND 문서 `rnd-3d-density-migration.md`에서 다룸. 주요 변경:

- Layer 3 단계 A의 heightmap → `density(x, y, z) > 0 ? Solid : Air` 로 전환
- 동굴, 오버행, 아치, 공중섬 지원
- `Abyss` 대륙 타입 활성화
- `FloatingMeadow`, `VoidRift` 이상 바이옴 완전 구현

Phase 0 코드는 Phase 1에서 **floor layer**로 부분 재사용된다 (`GenerateBaseHeightmap` 훅 유지).

---

## 부록 A: WFC 패턴 인접 규칙 표

*(Step 9 구현 시 상세 규칙 채움. 현실 바이옴 + 이상 바이옴 패턴 모두 포함.)*

비대칭 규칙 금지: A가 B를 허용하면 B도 A를 허용해야 함 (검증 함수 필수).

---

## 부록 B: 바이옴 전이 표

`SelectTransitionBiome(A, B)` 룩업.

| A | B | 전이 |
| --- | --- | --- |
| Ocean | Grassland | Beach |
| Ocean | Desert | Beach |
| Ocean | Forest | Beach |
| Desert | Grassland | Savanna |
| Desert | Forest | Savanna |
| Tundra | Grassland | Taiga |
| Tundra | Forest | Taiga |
| RockyMountain | * | RockyMountain |
| SnowPeak | * | RockyMountain |
| **(Exotic, Real)** | | **Real의 원래 바이옴 (Exotic 해제)** |
| (정의되지 않음) | | A 또는 B 중 가나다순 앞 |

---

## 부록 C: 향후 작업 항목 (Future Work)

본 문서는 Phase 0 terrain generator의 **자기 완결적 설계**다. 아래는 이 설계를 구현하는 과정에서 발생하지 않지만, **전체 시스템을 성숙시키려면 별도로 진행해야 할 작업들**이다. 각 항목은 독립된 RND 또는 튜닝 작업이며, 본 문서의 구현(Step 1~16)에는 포함되지 않는다.

### C.1 별도 RND 문서가 필요한 작업

#### **`rnd-3d-density-migration.md` — 3D Density 전환 (작성 완료)**

Phase 0은 heightmap 기반 2.5D. 동굴, 오버행, 아치, 공중섬을 얻으려면 Layer 3를 3D density function으로 전환해야 한다. 4단계 점진적 마이그레이션(Density Floor → Cave Carver → Overhang → Floating Islands)으로 Phase 1에서 진행. 본 RND에 이미 정리되어 있음.

**착수 시점:** Phase 0 완료 후, 로그라이트 프로토타입 검증 이후.

---

#### **`rnd-chunk-streamer.md` — Epoch 캐시 무효화 정책 (미작성)**

탐험된 청크는 epoch을 고정해 영구화하고, 미탐험 영역은 주기적으로 epoch를 증가시켜 재생성한다 (방향성 5.1 "지도가 없는 세계"). 이때 이미 메시화되어 클라이언트 메모리에 있는 청크의 캐시를 어떻게 무효화할지, 탐험/미탐험 경계를 어떻게 판정할지가 미정.

**의존:** 플레이어 탐험 기록 시스템, 청크 스트리밍 시스템과 연계 설계 필요.

---

#### **`rnd-y-axis-chunking.md` — Y축 청크 분할 여부 (미작성)**

현재 청크는 수평 16×16, 수직 256의 단일 컬럼. Y축을 32 높이 × 8층으로 분할하면 동굴 많은 지형에서 메시 효율이 오르고 수직 방향 LOD도 가능하다. 반면 분할하면 경계 처리 복잡도가 6면으로 증가.

**착수 시점:** Phase 1 (3D density) 시작 **전에** 결정해야 함. 동굴/공중섬이 많아지면 수직 분할 가치가 급증하므로 이 RND 없이 Phase 1 진입 금지.

---

#### **`rnd-terrain-debug-viz.md` — 시각 검증 도구 (미작성)**

개발 중 터레인 파이프라인의 각 레이어를 시각화하는 디버그 도구. 바이옴 히트맵, 대륙 타입 컬러 오버레이, 랜드마크 배치 마커, 이상 바이옴 분포 맵 등.

**우선순위:** 높음. Step 3~7 구현 시 즉시 필요. 본 문서와 병행 착수 권장.

---

#### **`rnd-runtime-voxel-diff.md` — 런타임 복셀 편집 영속화 (미작성)**

Layer Generator는 순수 함수이므로 나무 베기, 광산 채굴 등 런타임 변경을 반영할 수 없다. 별도의 diff 레이어가 필요: "생성기 출력에 플레이어 변경을 덮어쓰는 레이어".

**의존:** MMO 서버 저장 시스템. VM/서버 쪽 설계와 묶여야 함.

---

#### **`rnd-structure-placement.md` — 구조물(마을, 던전 입구) 상세 (미작성)**

Layer 4의 Landmark Injector는 "외형 스탬프"만 담당한다. 마을 내부의 NPC 배치, 던전 입구에서 내부로 연결, 거점의 기능적 상호작용은 본 문서 범위 밖. 구조물 배치 알고리즘 자체는 Layer 4 메커니즘을 재사용하되, 내부 설계는 별도.

**착수 시점:** Phase 0 프로토타입에서 거점/시설 시스템 요구사항이 확정된 후.

---

### C.2 구현 단계에서 결정/튜닝이 필요한 작업

아래 항목들은 별도 RND가 필요하진 않지만, 본 문서 Step을 진행하면서 튜닝/결정해야 할 작업이다.

| 항목 | 결정 시점 | 메모 |
|-----|---------|------|
| Tectonic 대륙 타입별 확률 튜닝 | Step 4~5 | 기본값(Pangea 50%)을 시각 검증 후 조정. 대륙 타입 추가/제거 시 확률 합 재조정 |
| 이상 바이옴과 랜드마크 충돌 방지 | Step 12 | `void_fissure`가 VoidRift 내부에 과하게 생기지 않도록 확률 감쇠 |
| Phase 0 `FloatingMeadow`/`VoidRift` 처리 | Step 7 | 시각적 유사 폴백(CrystalForest/GlowMushroom) vs 카탈로그에서 아예 제외 — 플레이테스트로 판단 |
| WFC 패턴 수 64 초과 시 비트셋 전환 | Step 9 | 현재 28패턴. 패턴 추가 시 `TBitArray`로 전환 |
| 광석 종류 6+ 시 후보 영역 컬링 | Step 16 | 현재 4종. 6종 넘으면 stone voxel 순회 대신 후보 영역 기반 방식으로 최적화 |
| 대륙 경계 블렌드 폭 | Step 5 | 현재 30%. 너무 넓으면 대륙 정체성 희석, 너무 좁으면 경계 급격 |
| Exoticness 임계값 | Step 7 | 현재 0.95. 이상 바이옴 밀도 1~3% 목표로 튜닝 |
| 랜드마크 확률 총합 | Step 13 | 육지 청크당 4~8 청크당 1개 밀도 목표로 카탈로그 전체 확률 조정 |

---

### C.3 이 문서가 다루지 않는 범위

명시적으로 본 RND의 **범위 밖**인 것들. 다른 시스템에서 다룬다.

- **이상 바이옴의 게임플레이 효과** (중력 0.3×, 시야 +20%, 귀환 페널티 등) → `HktGameplayBiomeEffect` 시스템
- **NPC/몬스터 스폰 테이블** → 몬스터 생성 시스템
- **아이템 드롭, 자원 밀도** → 루트 테이블 시스템
- **하이드롤릭 이로전(물 침식)** 정교 시뮬레이션 → 별도 RND (필요 시)
- **지역별 음악/사운드스케이프** → 오디오 시스템
- **맵/미니맵 UI** → UI 시스템

---

### C.4 우선순위 요약

작업 착수 순서 권장:

1. **본 문서 Step 1~16** (Phase 0 terrain 구현) — 진행 중
2. **`rnd-terrain-debug-viz.md`** — Step 3부터 병행 필요, 없으면 시각 검증 불가
3. **`rnd-structure-placement.md`** — 프로토타입 거점 시스템 요구사항 확정 후
4. **`rnd-y-axis-chunking.md`** — Phase 1 진입 전 필수
5. **`rnd-3d-density-migration.md`** — Phase 0 프로토타입 검증 후
6. **`rnd-runtime-voxel-diff.md`** — MMO 서버 설계와 함께
7. **`rnd-chunk-streamer.md`** — 실제 탐험 시스템 구현 시

