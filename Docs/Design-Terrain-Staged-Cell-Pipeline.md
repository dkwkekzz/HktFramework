# 테마 기반 cell×step 절차적 지형 베이크 파이프라인

> 의도: [I-0049](intents/I-0049.md) (부모 [I-0025](intents/I-0025.md) → [I-0011](intents/I-0011.md))
> 상태: 설계 (구현 대기)
> 최종 수정: 2026-05-27

하나의 *주제* 를 입력하면 세계를 **cell** 격자로 나누고, **step 별 패스** 로 각 cell 의
지형 디테일을 누적·파일로 영속화하여, 최종적으로 Landscape 베이크 에셋을 산출하는
절차적 파이프라인. 기존 청크 단위 voxel 생성기(`FHktTerrainGenerator` / Adv 파이프라인)를
대체하는 *저작(Baker)* 경로다.

---

## 1. 배경 / 문제

현재 `HktTerrain` 의 정본 데이터는 **voxel 모양** 이다. Landscape 경로
(`AHktLandscapeTerrainActor`)는 `UHktTerrainSubsystem::SamplePreview` 로 칼럼당
(Elevation, SurfaceHeight, BiomeId)만 뽑은 **2D 다운샘플 투영** 을 받아 하이트맵을
만든다. 그래서:

- Landscape 가 voxel 해상도(15cm, 32³ 청크)와 voxel 한정 피처(carve/stamp/동굴)에 묶인다.
  Landscape 의 잠재 해상도(타일당 2017² R16)를 전혀 쓰지 못한다 — **디테일이 구조적으로 손실** 된다.
- 생성이 청크 단위 bottom-up 노이즈라 **주제** 가 드러나지 않는다. 대륙·산맥·강을 벡터로
  들고 있는 글로벌 저작 레이어가 없다.
- 침식/하천(erosion/hydrology)이 사실상 부재(`abs(fbm)` 강 선분뿐)하고, 품질 자동
  평가(Evaluator)가 없어 디테일 미달을 잡아낼 장치가 없다.

## 2. 핵심 결정

| # | 결정 | 근거 |
|---|------|------|
| D1 | **baked 정본 = 결정론 무관** | 에셋은 고정 바이트 블롭 → 서버·클라가 동일 파일 로드 → 지형은 "계산" 아닌 "동일 바이트" 라 자동 동일. GGPO 롤백 동일성 충족. 생성 과정은 float·반복·GPU 자유. |
| D2 | **Baker ↔ 런타임 Generator 분리** | 본 문서는 *저작(Baker)* 만 다룬다. 런타임 `FHktTerrainGenerator`(무한 외곽 폴백)는 파이프라인 완성 후 별도 결정(I-0049 TODO). |
| D3 | **heightfield-canonical** | cell 의 정본은 R16 하이트맵 + 마스크 셋 + 벡터 스켈레톤. Landscape 가 직접 소비, Voxel/Sprite 는 백엔드로 복셀화/투영. |
| D4 | **cell = Landscape Proxy 타일** | 시각 타깃이 Landscape → World Partition 스트리밍 단위에 직접 정합. 기본 ~1km / 2017² 버텍스(설정 가능). |
| D5 | **step-major 순회 + 파일 아티팩트** | Step N 을 모든 cell 에 굳히고 → Step N+1 이 자기+이웃의 Step N 파일을 읽는다. 디테일이 레이어로 누적, 중간 검사/재실행 가능. |
| D6 | **Step 1~2 는 전역, 3~8 은 cell-local** | 기후·골격은 대륙 규모 → 월드 레벨 1패스로 산출, Step 3~8 이 cell 슬라이스로 소비. |

## 3. 데이터 모델

### 3.1 cell 격자 + halo

- **cell 크기**: Landscape Proxy 타일. 기본 `2017×2017` 버텍스 = 한 변 `(QuadsPerComponent × ComponentCount) + 1`. 월드 cm 환산은 `LandscapeScale` 기준.
- **halo**: erosion/하천이 경계에서 끊기지 않도록 cell 마다 이웃 방향으로 겹치는 여유 띠(예 `64` 버텍스)를 포함해 계산하고, **코어 영역만 채택**. halo 는 디스크에 영속화하지 않는다(연산 임시).
- cell 좌표 = `(CellX, CellY)` 정수 격자. 월드 원점 기준.

### 3.2 아티팩트 디렉토리

`Saved/Terrain/<Theme>/` 아래에 step 산출물을 영속화한다. **파일이 중간 진실, 에셋은 파생물.**

```
Saved/Terrain/<Theme>/
  theme.yaml                        # 입력 주제 스펙 (Stage 0 — 사람/도구가 작성)
  _world/
    step1_climate.exr               # 전역 저해상 기후 필드 (다채널)
    step1_climate.yaml              # 기후 요약 + 특수지형 후보 마킹 (화산/분화구/aeolian)
    step2_skeleton.json             # 대륙 SDF/윤곽 + 산맥 스플라인 + 해안선 + 강 경로
  cell_<X>_<Y>/
    step3_height.r16                # 베이스 하이트필드 (cell 해상도)
    step4_height.r16                # 침식 적용 하이트필드 (step3 덮어씀이 아니라 신규)
    step4_flow.exr  step4_slope.exr  step4_sediment.exr
    step5_biome.png                 # biome ID + sub-biome
    step6_landmarks.json            # 랜드마크 배치 (위치/타입/footprint)
    step7_scatter.json              # PCG 시드포인트 / 밀도 마스크 참조
    step8_eval.json                 # 평가 점수 + pass/fail
```

각 `(cell, step)` = 파일 1개(또는 step 성격상 소수). 포맷은 성격대로: 스펙 `yaml/json`,
스칼라 필드 `r16`, 다채널 마스크 `exr`, 단채널 마스크 `png`.

### 3.3 BakedAsset v8 스키마 (heightfield-canonical)

기존 `UHktTerrainBakedAsset`(청크별 압축 voxel + spawn attribution)에 **타일 단위 heightfield**
표현을 추가한다(`CurrentBakeVersion` +1 → v8). 설계 수준 개요:

```
FHktTerrainBakedTile
  FIntPoint  CellCoord
  int32      ResX, ResY                 // 2017 등
  TArray<uint8> CompressedHeight         // R16 (oodle)
  TArray<uint8> CompressedBiome          // biome/sub-biome ID 맵
  TArray<uint8> CompressedFlowSlope      // 하천/슬로프 마스크 (PCG/머티리얼 입력)
  TArray<FHktTerrainLandmarkInst> Landmarks
  TArray<FHktTerrainScatterPoint>  Scatter   // 또는 PCG 그래프 참조
UHktTerrainBakedAsset
  TArray<FHktTerrainBakedTile> Tiles         // 기존 Chunks[] 와 병존(전환기) 또는 대체
  EHktTerrainBakeKind Kind                   // Voxel(legacy) | Heightfield(v8)
```

> 결정 필요(구현 시): 기존 `Chunks[](voxel)` 과 신규 `Tiles[](heightfield)` 를 한 에셋에
> 병존시킬지, `Kind` 로 분기할지. Voxel 백엔드가 heightfield 에서 복셀화하면 `Tiles[]` 단일화 가능.

## 4. 패스 구조

```
Stage 0  theme.yaml (입력)
   │
   ▼  [전역 1패스]
Stage 1  Macro Climate     → _world/step1_*
Stage 2  Tectonic Skeleton → _world/step2_skeleton.json
   │
   ▼  [step-major, cell 단위, halo]
Stage 3  Base Heightfield  → cell/step3_height.r16          (모든 cell)
Stage 4  Erosion/Hydrology → cell/step4_*                   (모든 cell, 이웃 read)
Stage 5  Biome Painter     → cell/step5_biome.png           (모든 cell)
Stage 6  Landmark Injector → cell/step6_landmarks.json      (모든 cell)
Stage 7  Scatter & Foliage → cell/step7_scatter.json        (모든 cell)
Stage 8  Evaluator         → cell/step8_eval.json + 게이트   (모든 cell + 전역 집계)
   │
   ▼  [조립]
UHktTerrainBakedAsset (v8)  →  Landscape Import + RVT 머티리얼 + PCG foliage
```

- **재실행성**: 임의 step 을 임의 cell 에 대해 다시 돌릴 수 있다(이전 step 아티팩트가 입력). 디버그/튜닝 핵심.
- **검사성**: 각 아티팩트는 그 자체로 시각화 가능(rnd-terrain-debug-viz 와 연계).

## 5. Step 정의

각 step = `입력 아티팩트 → 처리 → 출력 아티팩트`. 결정론 불필요(D1).

### Stage 0 — Theme Spec (입력)
- **출력** `theme.yaml`: 위도 범위, 강수 경향, 지배 바이옴, 대륙 타입 선호, 특수지형(화산/협곡/고원) 강도, 톤(MapleStory2 채도) 등 선언적 노브.

### Stage 1 — Macro Climate (전역)
- **입력** theme.yaml
- **처리** 위도(north-south) · 강수량 · 수역 근접도로 저해상 전역 필드 산출. 강수 많은 곳을 화산/분화구/aeolian basin 등 **특수지형 후보지로 마킹**.
- **출력** `step1_climate.exr`(elev bias / precip / temp / water-proximity 채널) + `step1_climate.yaml`(후보 마킹 요약).

### Stage 2 — Tectonic Skeleton (전역)
- **입력** step1
- **처리** 대륙 형상(SDF/윤곽), 산맥 라인, 해안선, 주요 강의 **발원→하류 경로** 를 굵은 스플라인으로 결정. 기존 voxel tectonic template 컨셉 재활용.
- **출력** `step2_skeleton.json`(벡터 데이터).

### Stage 3 — Base Heightfield (cell)
- **입력** step1+step2 의 cell 슬라이스
- **처리** 스켈레톤 골격 위에 노이즈 조합으로 cell 해상도 R16 하이트맵 생성. Compute Shader 가능(D1).
- **출력** `step3_height.r16`.

### Stage 4 — Erosion & Hydrology (cell, halo)
- **입력** step3 (자기+이웃, halo)
- **처리** fluvial erosion. step2 강 경로를 따라 하천 carve. flow/sediment/slope 마스크 추출.
- **출력** `step4_height.r16` + `step4_flow/slope/sediment.exr`.

### Stage 5 — Biome Painter (cell)
- **입력** step1 기후 + step4 마스크
- **처리** 기후 + slope/flow/sediment → biome ID + sub-biome 텍스처. MapleStory2 톤(채도 과장)으로 **경계 명료화**. RVT 머티리얼 입력 전제.
- **출력** `step5_biome.png`.

### Stage 6 — Landmark Injector (cell)
- **입력** step3~5
- **처리** "와" 하고 멈출 랜드마크(거대 나무/폭포/협곡/유적)를 가시 거리·실루엣 평가로 배치. 하이트/바이옴에 스탬프. 기존 voxel landmark injector 차용.
- **출력** `step6_landmarks.json`(+ 하이트/바이옴 갱신).

### Stage 7 — Scatter & Foliage (cell)
- **입력** 이전 전부
- **처리** slope/height/feature 마스크 기반 PCG 시드포인트/밀도 산출. UE5 PCG 그래프 네이티브.
- **출력** `step7_scatter.json`.

### Stage 8 — Evaluator (cell + 전역) — **가장 중요**
- **입력** 전부
- **처리/지표**: 플레이가능성(슬로프>45° 비율, 막힌 협곡), 시각 다양성(biome 히스토그램 엔트로피), 랜드마크 가시성(거리별 흥미점 카운트), 네비메시 연결성.
- **출력** `step8_eval.json` + **게이트**: 미달 cell 은 해당 step 재실행 권고/차단.
- [TODO] 지표별 임계값 — I-0049.

## 6. 최종 조립 + Landscape 소비

1. 모든 step 통과한 cell 의 아티팩트 → `FHktTerrainBakedTile` 로 압축 직렬화 → `UHktTerrainBakedAsset(v8)`.
2. `AHktLandscapeTerrainActor`: 기존 `SamplePreview→칼럼 투영` 대신 **타일의 R16 을 직접 Import**.
   - 바이옴 맵 → Landscape Paint Layer 가중치(현 `FHktBiomeLandscapeLayer` 경로 재사용) 또는 RVT 머티리얼.
   - scatter → PCG foliage.
3. Voxel/Sprite 백엔드: 동일 타일의 heightfield+마스크에서 복셀화/표면 추출(후속).

## 7. 미해결 / TODO

- **무한 외곽**: 저작되지 않은 영역. 런타임 `FHktTerrainGenerator` 와 함께 후속 결정(D2, I-0049 TODO).
- **에이전트화**: 각 Stage 를 LLM/도구 에이전트가 아티팩트를 읽고 산출하도록 확장 — `HktGameplayGenerator`(MCP) 영역. 본 문서는 파이프라인 골격까지만.
- **BakedAsset 병존 vs 대체**: §3.3 Voxel `Chunks[]` ↔ heightfield `Tiles[]` 전환 정책.
- **HktCore 소비 계약**: 시뮬레이션이 타일의 표면고/마스크를 *읽기* 로 소비 — `IHktTerrainDataSource` 확장 필요(변경 시 HktCore 호출부·구현체 동기 갱신, 루트 CLAUDE.md 규칙).
- **debug 시각화**: 각 step 아티팩트 오버레이 — [rnd-terrain-debug-viz.md](rnd-terrain-debug-viz.md) 연계.
