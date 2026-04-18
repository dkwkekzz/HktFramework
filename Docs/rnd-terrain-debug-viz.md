# RND: Terrain Debug Visualization

> **상태:** 설계 (Claude Code 구현 대기)
> **모듈:** `HktVoxelTerrainDebug` (신규 플러그인, Editor-only 가능)
> **의존:** `HktVoxelTerrain` (terrain generator)
> **최종 수정:** 2026-04-17

---

## 1. 목적

Terrain generator의 각 레이어 출력을 **인게임에서 즉시 시각적으로 확인**할 수 있는 디버그 도구. 노이즈 파라미터를 바꾸고 결과를 바로 보는 루프가 없으면 튜닝이 불가능하다.

**해결하려는 문제:**

- Climate 노이즈 주파수를 바꾼 후 실제 지형에 어떻게 반영됐는지 확인하려면 지형을 생성해보고 날아다녀야 함 — 비효율
- 바이옴 분포가 의도대로 나오는지 검증하려면 수십 청크를 돌아다녀야 함
- Tectonic 대륙 타입 경계가 어디인지 지표면만 봐서는 알 수 없음
- 이상 바이옴이 서버 1~3% 비율에 맞게 분포하는지 전역 통계가 필요
- 랜드마크가 실제로 배치됐는지, 청크 경계를 어떻게 침범했는지 눈으로 확인

**근본 원칙: 같은 파이프라인, 다른 렌더링.**

디버그 도구는 terrain generator를 **새로 구현하지 않는다**. `FHktTerrainGenerator`의 실제 출력을 받아서 **다르게 시각화**할 뿐이다. 따라서 디버그 뷰가 보여주는 것과 실제 게임이 생성하는 것이 절대 갈라지지 않는다.

---

## 2. 범위

### 2.1 지원 뷰

Terrain 파이프라인의 각 레이어에 대응하는 7개 뷰. 각 뷰는 독립적으로 토글 가능.

| 뷰 ID | 레이어 | 시각 형태 | 주 사용처 |
|-------|-------|---------|---------|
| `Climate.Elevation` | Layer 1 | 그레이스케일 높이맵 | 지형 주파수 튜닝 |
| `Climate.Moisture` | Layer 1 | 파랑~노랑 그라디언트 | 강수 패턴 확인 |
| `Climate.Temperature` | Layer 1 | 빨강~파랑 그라디언트 | 위도+고도 검증 |
| `Climate.Exoticness` | Layer 1 | 블랙~핫핑크 (드물게 빛남) | 이상 바이옴 분포 예측 |
| `Tectonic` | Layer 1.5 | 7색 대륙 타입 컬러 | 대륙 경계/블렌드 검증 |
| `Biome` | Layer 2 | 11색 바이옴 컬러 (Whittaker 표준) | 바이옴 분류 검증 |
| `ExoticBiome` | Layer 2.5 | 현실 바이옴 회색 + 이상 바이옴 강조색 | 이상 바이옴 클러스터 확인 |
| `Landmark` | Layer 4 | 랜드마크 종류별 아이콘 + 영향 반경 원 | 배치 빈도/충돌 확인 |
| `Decoration` | Layer 5b | 데코 종류별 도트 (Poisson 분포) | 배치 간격/클러스터 |

### 2.2 비목표

- **WFC 중간 상태 시각화** — 셀별 가능 패턴 비트셋 표시는 복잡도 대비 가치 낮음. Step 10 WFC 실패 시 fallback 발생 위치만 마커로 표시.
- **Layer 5a (광석) 시각화** — 지하 매장이라 z-cross-section 뷰가 필요. 별도 복잡도. 우선 통계 창(C.1)으로 대체.
- **실시간 재생성** — 노이즈 파라미터를 에디터에서 바꾸면 즉시 업데이트되는 라이브 편집은 본 RND 범위 외. 파라미터 변경 후 `/regenerate` 콘솔 명령으로 트리거.
- **월드 내 편집 도구** — 디버그용으로 복셀을 직접 수정하는 기능 없음.

---

## 3. 전체 구조

```
┌──────────────────────────────────────┐
│ FHktTerrainDebugSubsystem            │  ← 엔진 서브시스템
│  - 활성 뷰 관리                       │
│  - 콘솔 명령 처리                     │
│  - 통계 수집                          │
└──────────────────────────────────────┘
           │
           ├─→ Overlay Renderers
           │   - FHktClimateOverlay       (decal projector)
           │   - FHktTectonicOverlay      (decal projector)
           │   - FHktBiomeOverlay         (decal projector)
           │   - FHktLandmarkOverlay      (line batcher + icons)
           │   - FHktDecorationOverlay    (point cloud)
           │
           ├─→ UMG Widgets
           │   - WBP_TerrainDebugPanel   (메인 컨트롤 패널)
           │   - WBP_TerrainStats        (분포 통계 창)
           │
           └─→ Console Commands
               - hkt.terrain.view <name>
               - hkt.terrain.viewoff
               - hkt.terrain.stats
               - hkt.terrain.regenerate
               - hkt.terrain.jump <biome|landmark> <id>
```

핵심은 **Decal Projector**. 지형 위에 투영되는 데칼로 오버레이를 그리면:
- 지형의 실제 형태를 건드리지 않음
- 지형이 움직여도(Phase 1 공중섬 등) 표면에 자동 감김
- Editor/Runtime 모두 동작

### 3.1 플러그인 구성

```
HktVoxelTerrainDebug/
├── HktVoxelTerrainDebug.uplugin
├── Source/
│   └── HktVoxelTerrainDebug/
│       ├── Public/
│       │   ├── HktTerrainDebugSubsystem.h
│       │   ├── HktTerrainDebugOverlay.h
│       │   └── HktTerrainDebugTypes.h
│       └── Private/
│           ├── Overlays/
│           │   ├── HktClimateOverlay.cpp
│           │   ├── HktTectonicOverlay.cpp
│           │   ├── HktBiomeOverlay.cpp
│           │   ├── HktExoticBiomeOverlay.cpp
│           │   ├── HktLandmarkOverlay.cpp
│           │   └── HktDecorationOverlay.cpp
│           └── HktTerrainDebugSubsystem.cpp
├── Content/
│   ├── Materials/
│   │   ├── M_DebugDecalScalar.uasset       (1채널 그라디언트)
│   │   ├── M_DebugDecalColorIndex.uasset   (인덱스 → 컬러 LUT)
│   │   └── M_DebugDecalMasked.uasset       (마스크드 — 이상 바이옴 강조)
│   ├── Textures/
│   │   ├── T_BiomeColorLUT.uasset          (11 biome 색상 1D LUT)
│   │   ├── T_TectonicColorLUT.uasset
│   │   └── T_ExoticBiomeMask.uasset
│   └── UI/
│       ├── WBP_TerrainDebugPanel.uasset
│       └── WBP_TerrainStats.uasset
```

**중요:** 이 플러그인은 **`WITH_EDITOR` 또는 개발 빌드에서만** 활성화. Shipping 빌드에는 포함되지 않음. `.uplugin`의 `"Type": "DeveloperTool"`.

---

## 4. 구현 상세

### 4.1 공통 — Decal Projector 방식

각 오버레이는 정사각형 Decal Component를 청크 단위로 스폰한다. 청크 크기가 16 voxel이므로 데칼 크기도 1600cm × 1600cm (voxel=100cm 가정).

```cpp
// Pseudocode
void FHktTerrainOverlayBase::UpdateForChunk(FHktChunkCoord Coord)
{
    UDecalComponent* Decal = GetOrCreateDecal(Coord);
    Decal->SetWorldLocation(ChunkWorldCenter(Coord));
    Decal->DecalSize = FVector(200, 800, 800);  // X=깊이, Y/Z=평면
    
    UMaterialInstanceDynamic* MID = Decal->CreateDynamicMaterialInstance();
    FillMaterialParameters(MID, Coord);  // 하위 클래스에서 구현
}
```

**데칼 투영 방향:** 수직 (Z축 아래 방향). 지형 표면에 자동 투영됨.

**뎁스 필터:** Decal의 `DecalSortOrder`를 0으로 설정, 지형과 Z-fight 방지를 위해 약간 Z+offset. 또는 Translucent blend mode.

### 4.2 Climate Overlay

**M_DebugDecalScalar 머티리얼**은 하나의 float 파라미터 `Value`와 `ViewMode`를 받는다. 16×16 텍스처로 청크의 값을 전달.

```cpp
void FHktClimateOverlay::FillMaterialParameters(UMaterialInstanceDynamic* MID, FHktChunkCoord Coord)
{
    // Generator의 실제 출력을 그대로 사용
    FHktClimateField Climate = TerrainGen->DebugGetClimate(Coord);
    
    UTexture2D* Tex = GetOrCreateChunkTexture(Coord);  // 16x16 R8 또는 R16F
    switch (ActiveChannel)
    {
        case EClimateChannel::Elevation:
            WriteTextureFromArray(Tex, Climate.Elevation);
            break;
        case EClimateChannel::Moisture:
            WriteTextureFromArray(Tex, Climate.Moisture);
            break;
        // ...
    }
    MID->SetTextureParameterValue("ChannelData", Tex);
    MID->SetScalarParameterValue("ViewMode", (float)ActiveChannel);
}
```

**머티리얼 측 ViewMode별 처리:**

| ViewMode | 매핑 |
|---------|------|
| Elevation | `lerp(Black, White, Value)` — 그레이스케일 |
| Moisture | `lerp(SandYellow, DeepBlue, Value)` — 건조→습윤 |
| Temperature | `lerp(IceBlue, LavaRed, Value)` — 한랭→고온 |
| Exoticness | `lerp(Black, HotPink, pow(Value, 4))` — 대부분 검정, 드물게 형광 |

Exoticness는 `pow(Value, 4)` 추가 가공으로 0.95 이상만 시각적으로 보이게 한다. 임계값 근처 영역을 눈으로 찾기 쉬워짐.

**샘플링:** 16×16 텍스처를 Bilinear로 샘플. 청크 내부가 자연스럽게 보간됨.

### 4.3 Tectonic Overlay

Tectonic은 4096 voxel 단위 대륙 셀이므로 청크보다 훨씬 큰 단위. 청크 단위 데칼이 아닌 **셀 단위 데칼**로 처리하는 게 효율적.

단, **블렌드 영역**을 정확히 보여주려면 청크별 실제 Tectonic mask 출력을 보여야 함. 두 가지 모드 제공:

**Mode A: Cell Color (단순)**
- 대륙 셀 중심에 4096×4096 데칼 1장
- 중심부는 PrimaryType 색, 외곽은 반투명으로 페이드

**Mode B: Actual Mask (상세)**
- 청크별 데칼. 각 셀의 `ElevationMultiplier`를 색상 강도로, `PrimaryType`을 색상 hue로 표현
- 블렌드 구간은 두 색이 섞여 보임

기본값은 Mode A, 튜닝 시 Mode B로 전환.

**컬러 팔레트:**

| 대륙 타입 | 컬러 |
|----------|------|
| Pangea | 연녹색 (기본, 눈에 안 띔) |
| Plateau | 황토색 |
| Archipelago | 청록색 |
| Rift | 진갈색 |
| Spire | 자주색 |
| Crater | 주황색 |
| Abyss | 검남색 |

### 4.4 Biome / ExoticBiome Overlay

바이옴 ID를 1D 컬러 LUT로 인덱싱.

**T_BiomeColorLUT** (32×1 픽셀, 11 현실 + 6 이상 바이옴):

| 인덱스 | 바이옴 | 색상 |
|-------|--------|------|
| 0 | Ocean | 짙은 파랑 |
| 1 | Beach | 밝은 모래색 |
| 2 | Grassland | 밝은 초록 |
| 3 | Forest | 진한 초록 |
| 4 | Desert | 황토 |
| 5 | Savanna | 황갈색 |
| 6 | Tundra | 회청색 |
| 7 | Taiga | 청록색 |
| 8 | RockyMountain | 회색 |
| 9 | SnowPeak | 흰색 |
| 10 | Swamp | 올리브 |
| 100 | CrystalForest | 형광 민트 |
| 101 | FloatingMeadow | 파스텔 핑크 |
| 102 | GlowMushroom | 형광 라임 |
| 103 | BoneDesert | 크림 |
| 104 | VoidRift | 형광 보라 |
| 105 | LivingForest | 파스텔 라벤더 |

**ExoticBiome 뷰:** 현실 바이옴은 전부 회색(30% 알파)으로 죽이고, 이상 바이옴만 원색으로 강조. 서버 전체에서 이상 바이옴이 **어디에 클러스터링**되는지 한눈에 확인.

### 4.5 Landmark Overlay

데칼이 아닌 **Line Batcher + 아이콘 메쉬** 조합.

```cpp
void FHktLandmarkOverlay::RenderChunk(FHktChunkCoord Coord)
{
    auto Landmarks = TerrainGen->DebugGetLandmarks(Coord);
    for (const FDebugLandmark& L : Landmarks)
    {
        // 1. 중심에 아이콘 (빌보드 스프라이트)
        SpawnIcon(L.WorldPos, L.IconTexture, L.IconColor);
        
        // 2. 영향 반경 원
        DrawDebugCircle(L.WorldPos, L.InfluenceRadius * 100, 32, L.IconColor);
        
        // 3. 랜드마크 ID 텍스트
        DrawDebugString(L.WorldPos + FVector(0,0,200), L.Id.ToString());
    }
}
```

아이콘 종류 (9종):

| 랜드마크 ID | 아이콘 | 색상 |
|-----------|--------|------|
| sinkhole | 아래 화살표 | 갈색 |
| mesa | 위 사다리꼴 | 황토 |
| monolith | 기둥 | 흰색 |
| small_crater | 원 | 주황 |
| stone_arch | 아치 | 회색 |
| giant_tree | 큰 나무 | 진녹 |
| bone_spire | 뼈 | 크림 |
| crystal_column | 수정 | 민트 |
| void_fissure | 균열 | 보라 |

**청크 경계 침범 시각화:** 랜드마크의 `InfluenceRadius`가 청크 경계를 넘으면 반경 원이 여러 청크에 걸쳐 그려짐. 이때 각 청크에서 이 랜드마크가 보이는지(N-청크 확장이 제대로 동작하는지) 즉시 확인 가능.

### 4.6 Decoration Overlay

Poisson Disk 점 분포를 **작은 도트**(PointCloudComponent 또는 InstancedStaticMesh with tiny sphere)로 표시.

```cpp
void FHktDecorationOverlay::RenderChunk(FHktChunkCoord Coord)
{
    auto Points = TerrainGen->DebugGetDecorationPoints(Coord);
    for (const FHktDecoPoint& P : Points)
    {
        FColor Color = GetColorForStamp(P.StampId);
        SpawnDot(P.WorldPos, Color, 20.0f);  // 반경 20cm
    }
}
```

**시각 확인 포인트:**
- Poisson 간격이 모든 점 쌍 간에 지켜지는가
- 청크 경계 걸친 9-청크 통합이 제대로 동작해 점이 끊기지 않는가
- 바이옴별 밀도가 카탈로그와 일치하는가

---

## 5. 디버그 훅 추가 (Terrain Generator 측)

디버그 뷰가 동작하려면 `FHktTerrainGenerator`에 **중간 산출물을 노출하는 훅**을 추가해야 한다. 릴리스 빌드에서는 컴파일 아웃.

```cpp
// HktVoxelTerrain/Public/HktTerrainGenerator.h
class HKTVOXELTERRAIN_API FHktTerrainGenerator
{
public:
    void GenerateChunk(FHktChunkCoord Coord, FHktVoxelChunk& OutChunk) const;

#if WITH_EDITOR || HKT_TERRAIN_DEBUG
    // 디버그 훅 — 각 레이어의 중간 산출물 노출
    FHktClimateField    DebugGetClimate(FHktChunkCoord Coord) const;
    FHktTectonicMask    DebugGetTectonic(FHktChunkCoord Coord) const;
    FHktBiomeMap        DebugGetBiome(FHktChunkCoord Coord, bool bIncludeExotic) const;
    TArray<FDebugLandmark>    DebugGetLandmarks(FHktChunkCoord Coord) const;
    TArray<FHktDecoPoint>     DebugGetDecorationPoints(FHktChunkCoord Coord) const;
#endif
};
```

**성능 고려:** 각 `DebugGet*`은 해당 레이어까지만 실행하는 부분 파이프라인. 전체 GenerateChunk 비용의 일부만 듦.

**캐싱:** 디버그 서브시스템 측에서 청크 단위 LRU 캐시 운영. 같은 청크를 여러 번 그리지 않도록.

---

## 6. UI — Debug Panel

**WBP_TerrainDebugPanel** (우측 슬라이드 아웃 패널):

```
┌─────────────────────────────┐
│  Terrain Debug              │
├─────────────────────────────┤
│ Active View:                │
│  ( ) None                   │
│  ( ) Climate > Elevation    │
│  ( ) Climate > Moisture     │
│  ( ) Climate > Temperature  │
│  ( ) Climate > Exoticness   │
│  ( ) Tectonic               │
│  ( ) Biome                  │
│  (•) ExoticBiome            │
│  ( ) Landmark               │
│  ( ) Decoration             │
├─────────────────────────────┤
│ Radius: [8] chunks          │ ← 플레이어 주변 N청크만 렌더
│ ☑ Show grid lines           │
│ ☑ Show chunk coords         │
├─────────────────────────────┤
│ [ Stats Window ]            │
│ [ Regenerate ]              │
│ [ Jump to... ]              │
└─────────────────────────────┘
```

**토글 단축키:** `F8` — 패널 열기/닫기.

### 6.1 Stats Window (WBP_TerrainStats)

전역 통계 창. 1000청크 샘플 기준 분포 계산.

```
┌─────────────────────────────────────┐
│ Terrain Stats (sampled 1000 chunks) │
├─────────────────────────────────────┤
│ Biome Distribution:                 │
│   Ocean         ████████ 32.4%      │
│   Grassland     ████ 18.2%          │
│   Forest        ███ 14.1%           │
│   Desert        ██ 8.9%             │
│   ...                               │
├─────────────────────────────────────┤
│ Exotic Biomes:                      │
│   Total: 2.3% ✓ (target 1-3%)      │
│   CrystalForest: 0.8%               │
│   GlowMushroom: 0.5%                │
│   ...                               │
├─────────────────────────────────────┤
│ Tectonic Types:                     │
│   Pangea: 48.9% (target 50%) ✓     │
│   Plateau: 16.1% (target 15%) ✓    │
│   ...                               │
├─────────────────────────────────────┤
│ Landmarks:                          │
│   Density: 1 per 5.2 chunks ✓      │
│   (target 4-8)                      │
│   Breakdown: sinkhole 0.019,        │
│     mesa 0.014, ... ✓               │
├─────────────────────────────────────┤
│ Performance:                        │
│   Avg chunk gen: 62ms ✓ (<80)      │
│   WFC fallback rate: 0.3% ✓ (<1%)  │
└─────────────────────────────────────┘
```

각 수치는 테스트 계획(본 문서 §13)의 성공 기준과 자동 비교해 ✓ / ✗ 표시. **테스트 자동화 없이도 튜닝 중 한눈에 상태 파악**.

---

## 7. 콘솔 명령

```
hkt.terrain.view <name>
    Argument: Climate.Elevation | Climate.Moisture | Climate.Temperature 
            | Climate.Exoticness | Tectonic | Biome | ExoticBiome 
            | Landmark | Decoration | None
    Effect: 활성 뷰 변경

hkt.terrain.viewradius <N>
    Argument: N = 1..32
    Effect: 플레이어 주변 N 청크 반경까지만 오버레이 렌더

hkt.terrain.stats
    Effect: Stats 창 열기 + 즉시 샘플링 시작

hkt.terrain.regenerate
    Effect: 로드된 청크의 캐시 무효화 + 재생성
    (노이즈 파라미터 변경 후 즉시 반영)

hkt.terrain.jump <category> <id>
    Example: hkt.terrain.jump biome CrystalForest
             hkt.terrain.jump landmark monolith
             hkt.terrain.jump tectonic Spire
    Effect: 가장 가까운 해당 요소 위치로 플레이어 이동
    (샘플링 범위: 반경 5000 청크 내, 못 찾으면 에러)

hkt.terrain.seed <value>
    Effect: WorldSeed 변경 + 전체 청크 재생성
    (빠른 시드 비교용)
```

---

## 8. 구현 순서

Step 3~16의 terrain generator 구현에 **병행 진행**. 각 기능은 해당 레이어 구현 직후에 활성화 가능하도록.

| 단계 | Terrain Step 대응 | 작업 |
|-----|------------------|-----|
| D-1 | Step 3 | 플러그인 스캐폴드 + 서브시스템 + 콘솔 명령 뼈대 |
| D-2 | Step 3 | `M_DebugDecalScalar` + Climate.Elevation 뷰 (최우선 — 지형 검증 필수) |
| D-3 | Step 3 | Climate 나머지 3채널 (Moisture/Temperature/Exoticness) |
| D-4 | Step 5 | Tectonic Overlay (Mode A — 대륙 셀 단위) |
| D-5 | Step 6 | `T_BiomeColorLUT` + Biome Overlay |
| D-6 | Step 7 | ExoticBiome Overlay + Stats 창 기본 레이아웃 |
| D-7 | Step 7 | Stats 창에 바이옴 분포 통계 + 자동 ✓/✗ 판정 |
| D-8 | Step 8~11 | `hkt.terrain.regenerate` + WFC fallback 마커 |
| D-9 | Step 12 | Landmark Overlay (아이콘 + 영향 반경 원) |
| D-10 | Step 13 | Landmark Stats + N-청크 확장 검증 뷰 |
| D-11 | Step 15 | Decoration Overlay (Poisson 도트) |
| D-12 | Step 16 | 전체 성능 프로파일 통합 + `hkt.terrain.jump` |

D-2는 최우선: Climate.Elevation 뷰 없이는 Step 3의 노이즈 튜닝이 사실상 불가능.

---

## 9. 테스트 / 검증

| 항목 | 검증 |
|-----|------|
| `OverlayZFighting` | 모든 뷰에서 지형과 Z-fight 없이 렌더 |
| `OverlayUpdateConsistency` | 플레이어 이동 시 주변 청크 뷰가 누락 없이 업데이트 |
| `OverlayPerformance` | 반경 8청크(81청크) 오버레이 렌더 추가 비용 < 2ms/frame |
| `DebugHookParity` | `DebugGetBiome`이 반환하는 값이 실제 `GenerateChunk` 내부에서 쓰는 값과 비트 단위 동일 |
| `StatsAccuracy` | 1000청크 샘플 통계가 전역 이론값과 ±2% 이내 |
| `ShippingBuildExclusion` | Shipping 빌드에서 본 플러그인 심볼이 완전히 제거됨 (바이너리 diff 검증) |

---

## 10. 유즈케이스 예시

### 케이스 1: "대륙 경계가 너무 갑작스럽다"

1. `F8`로 디버그 패널
2. Tectonic 뷰 선택, Mode B(상세)
3. 블렌드 영역의 색 섞임 폭 관찰 → 너무 좁으면 Tectonic의 `blend_zone` 상수 조정
4. `hkt.terrain.regenerate` → 즉시 확인
5. 만족할 때까지 반복

### 케이스 2: "이상 바이옴이 너무 자주/드물게 나온다"

1. Stats 창 열고 "Exotic Biomes: Total: 5.7% ✗ (target 1-3%)" 확인
2. ExoticBiome 뷰 활성화 → 실제 분포 눈으로 확인
3. Layer 1의 `pow(remap(base,...), 8.0)` 지수를 8→10으로 증가 (더 날카로운 분포)
4. `hkt.terrain.regenerate` + Stats 다시 확인 → 2.4% ✓

### 케이스 3: "랜드마크가 청크 경계에서 잘린다"

1. Landmark 뷰 활성화 → 영향 반경 원이 청크 경계를 넘음
2. 해당 랜드마크 근처 인접 청크로 이동 → 같은 랜드마크가 보이는지 확인
3. 안 보이면 N-청크 확장 로직 버그. R 값 재검토
4. 보이면 정상. 다른 이슈 탐색

### 케이스 4: "시드 A와 시드 B 중 어느 월드가 나은가"

1. `hkt.terrain.seed 12345` → 월드 A 전역 훑어보기
2. Stats 창 캡처
3. `hkt.terrain.seed 67890` → 월드 B
4. Stats 창과 시각 비교 → 분포 차이, 랜드마크 배치 차이 확인

---

## 11. 제약 및 주의

- **메모리** — 청크별 16×16 R8 텍스처 × 활성 청크 수. 반경 16청크면 ~1024청크 × 256byte = 256KB. 무시 가능.
- **Decal 개수 한계** — UE5 Decal은 수천 개 한 번에 렌더 가능하지만, 반경을 너무 키우면 GPU 부하. `viewradius` 기본값 8, 최대 32로 제한.
- **Landmark 아이콘 드로우콜** — 빌보드 스프라이트가 많으면 드로우콜 폭발. Hierarchical Instanced Static Mesh로 처리.
- **결정론 유지** — 디버그 훅이 실제 생성 경로와 다른 코드를 쓰면 디버그 뷰가 거짓말을 함. **반드시 `GenerateChunk`의 내부 함수를 그대로 재호출**할 것. 복사-붙여넣기 금지.
- **네트워크 안전성** — MMO 환경에서 디버그 뷰는 **클라이언트 전용**. 서버에 디버그 훅이 있어도 서브시스템은 서버에 로드하지 않음.

---

## 12. 향후 확장

본 RND 범위 밖이지만 고려 가능:

- **3D Cross-section 뷰** — 지하 광석 매장을 수직 단면으로 표시 (Phase 1 동굴 시각화에도 필요)
- **Heatmap Export** — 현재 오버레이를 PNG로 저장해 외부 비교
- **Diff 뷰** — 두 시드의 월드 차이를 색 차이로 표시
- **Live 파라미터 편집** — 디버그 패널에서 FBm octaves 등을 슬라이더로 조정 (노이즈 프리셋 에셋)
- **자동 리그레션 캡처** — CI에서 기준 시드의 Stats 값을 기록해 빌드 간 회귀 감지

이들은 Phase 0에서는 불필요. 필요해지는 시점에 별도 검토.
