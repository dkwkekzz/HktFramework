# Staged Terrain Baker — 사용법

> 의도: [I-0049](intents/I-0049.md) "테마 기반 cell×step 절차적 지형 베이크 파이프라인"
> 설계: [Design-Terrain-Staged-Cell-Pipeline.md](Design-Terrain-Staged-Cell-Pipeline.md)
> 상태: Stage 1~5 첫 컷 구현 — 시각 그럴듯함에 필요한 step 만.

기존 voxel bottom-up `SamplePreview` 경로를 **유지한 채**, `AHktLandscapeTerrainActor` 의
토글 하나로 *저작(Baker)* 경로를 갈아끼울 수 있다. 결정론 무관(D1) — float·반복 자유.

---

## 1. 활성화 — 액터 노브

`AHktLandscapeTerrainActor` 의 `HktLandscape|StagedBaker` 카테고리:

| 노브 | 의미 |
|---|---|
| `bUseStagedBaker` | `false` (기본) → 기존 `SamplePreview` 경로. `true` → 베이커 경로. |
| `Theme` | Stage 0 테마 스펙(아래). |
| `StagedBaseVoxels` | 정규화 고도 0 → 표면 복셀 높이. 해저 최저점에 해당. |
| `StagedReliefVoxels` | 정규화 고도 [0,1] 을 펼칠 수직 복셀 폭. 클수록 기복 과장. |

> `bUseStagedBaker=false` 면 기존 동작 그대로 — 기본값이 false 이므로 기존 BP/맵 영향 0.

설정 후 **`RegenerateLandscape`** (CallInEditor 버튼) 를 누르면 즉시 재생성된다.

---

## 2. Theme 노브 — `FHktTerrainThemeSpec`

선언적 *주제* 노브. 각 step 이 본 값을 읽어 세계를 펼친다.

| 필드 | 범위 | 효과 |
|---|---|---|
| `Seed` | int64 | 모든 step 의 서브시드가 여기서 파생. |
| `Continentality` | [0,1] | 0 = 거의 바다, 1 = 거의 육지. 해안선/육지 비율. |
| `SeaLevel` | [0.05,0.9] | 정규화 해수면. 이하 elev = 바다. |
| `Mountainousness` | [0,1] | 산맥 능선장 강도. |
| `ErosionStrength` | [0,1] | 물방울 침식 강도. 0 = Stage 4 스킵. |
| `Precipitation` | [0,1] | 습윤 바이옴(숲/늪) 비중. |
| `Coldness` | [0,1] | 툰드라/타이가/설원 비중. |
| `ContinentWavelength` | ≥64 vert | 대륙 피처 파장(버텍스 단위). 클수록 대륙이 큼. |
| `MountainWavelength` | ≥32 vert | 산맥 피처 파장. |

> 파장은 **버텍스 단위** — 액터의 `ComponentCountX/Y × QuadsPerSection × SectionsPerComponent`
> 와의 비율이 화면에서의 피처 빈도를 결정. 작은 맵에서 큰 대륙을 원하면 `ContinentWavelength`
> 를 줄이거나 `ComponentCount` 를 늘린다.

---

## 3. Step 파이프라인 (구현된 것)

```
Theme  →  Stage 1 Climate        (월드좌표 함수: 온도/습도)
       →  Stage 2 Skeleton       (대륙 마스크 + 산맥 능선장, 도메인 워프)
       →  Stage 3 Base Heightfield (해안선 연속 정규화 고도)
       →  Stage 4 Erosion        (Lague 류 물방울 침식, 계곡 카빙)
       →  Stage 5 Biome          (기후+고도+경사 → EHktAdvBiome)
       →  FHktTerrainBakeField   (인메모리, row-major)
            ├─ Elevation[W*H] (float [0,1])
            └─ BiomeId[W*H]   (uint8 = EHktAdvBiome)
```

베이커 산출물은 액터가 기존 인코딩 경로로 흘려보낸다:

```
Field.Elevation[i] × StagedReliefVoxels + StagedBaseVoxels
  → Region.Samples[i].SurfaceHeightVoxels
  → uint16 하이트맵 (32768 + voxel*128)  → ALandscape::Import
Field.BiomeId[i] → Region.Samples[i].BiomeId
  → BiomeLayerMapping 가중치 맵         → Paint Layer
```

설계 §5 의 **Stage 6 Landmark / Stage 7 Scatter / Stage 8 Evaluator 는 미구현** — 시각
그럴듯함 최소 집합 밖이므로 후속.

---

## 4. 바이옴 → Paint Layer 매핑

베이커는 바이옴 ID 로 `EHktAdvBiome` 값(uint8 캐스트)을 쓴다 — 머티리얼 페인트 레이어가
보이려면 액터의 `BiomeLayerMapping` 에 다음 ID 를 매핑해야 한다.

현실 바이옴 (Stage 5 가 산출하는 집합):

| ID | EHktAdvBiome | 비고 |
|---:|---|---|
| 0 | Ocean | elev ≤ SeaLevel |
| 1 | Beach | SeaLevel ~ +Beach band |
| 2 | Grassland | 온대 × 저습 |
| 3 | Forest | 온대 × 중·고습 / 고온 고습 |
| 4 | Desert | 고온 × 저습 |
| 5 | Savanna | 고온 × 중습 |
| 6 | Tundra | 저온 × 저습 |
| 7 | Taiga | 저온 × 중·고습 |
| 8 | RockyMountain | 고지대 또는 가파른 경사 |
| 9 | SnowPeak | 고지대 × 한랭 |
| 10 | Swamp | 온대 × 고습 |

매핑되지 않은 ID 는 액터가 첫 레이어로 폴백한다 (`HktLandscapeTerrainActor.cpp` 의
`BiomeToLayer.Find` → 폴백 인덱스 0).

---

## 5. 좌표 / 정렬

- 베이커는 `(LandscapeOriginWorldVoxels.X, .Y)` 를 좌하단 버텍스의 월드 좌표로 받는다 —
  **버텍스 1개 = 월드 복셀 1개** (Landscape 경로의 기존 가정과 동일).
- 모든 노이즈가 월드좌표의 함수라 액터를 옮겨도 동일 좌표는 동일 결과.
- `LandscapeScale` 은 액터가 effective `VoxelSize` 로 강제 정렬 — voxel/HktCore 좌표계
  불변식 유지.

---

## 6. 한계 / 후속 (I-0049 TODO)

- **cell 타일링 / halo 없음** — 현재는 한 액터 = 한 영역을 통째로 베이크 (연속 영역이라
  seam 없음). 다중 cell + Landscape Proxy 정합은 후속.
- **파일 아티팩트 영속화 없음** — 설계 §3.2 의 `Saved/Terrain/<Theme>/` 영속화는 후속.
  지금은 매 호출마다 재계산.
- **Landmark/Scatter/Evaluator 미구현** — 설계 §5 Stage 6~8.
- **무한 외곽** — 베이크 영역 밖은 런타임 Generator 폴백과 함께 후속 결정 (I-0049 TODO).
- **HktCore 소비 계약 미확장** — 시뮬레이션 측은 여전히 voxel `IHktTerrainDataSource` 경로.
  heightfield 직접 소비는 설계 §7.

---

## 7. 빠른 트러블슈팅

| 증상 | 원인 후보 |
|---|---|
| 전체가 바다/육지 | `Continentality` 가 극단 / `SeaLevel` 과 불일치. 0.4~0.6 사이로. |
| 평평함 | `StagedReliefVoxels` 작음 / `Mountainousness` 낮음. |
| 산이 부자연스럽게 뾰족 | `ErosionStrength` 를 0.4~0.7 로 — Stage 4 가 능선을 정돈. |
| Paint Layer 안 보임 | `BiomeLayerMapping` 미설정 / `LayerInfo` 의 `LayerName` 과 머티리얼 불일치. |
| Subsystem 부재 경고 | 비-게임 World — staged 모드는 부재해도 동작. `bUseStagedBaker=true` 확인. |

---

## 8. 관련 코드

- 베이커: [`HktTerrain/Public/HktTerrainStagedBaker.h`](../HktGameplay/Source/HktTerrain/Public/HktTerrainStagedBaker.h) · [`Private/HktTerrainStagedBaker.cpp`](../HktGameplay/Source/HktTerrain/Private/HktTerrainStagedBaker.cpp)
- 액터 분기: [`HktLandscapeTerrain/Private/HktLandscapeTerrainActor.cpp`](../HktGameplay/Source/HktLandscapeTerrain/Private/HktLandscapeTerrainActor.cpp) 의 `InitializeLandscape`.
