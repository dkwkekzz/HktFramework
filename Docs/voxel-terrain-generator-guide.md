## 복셀 지형 생성 → 런타임 적용 전체 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Settings                         │
│  UHktRuntimeGlobalSetting (Game → Hkt Gameplay Settings)    │
│  Seed=42, VoxelSizeCm=15, bAdvancedTerrain=true, ...       │
└──────────────────────────┬──────────────────────────────────┘
                           │ ToTerrainConfig()
                           ▼
                 FHktTerrainGeneratorConfig
                    (순수 C++ 구조체)
                    ┌──────┴──────┐
                    ▼             ▼
          ┌─── 시뮬레이션 ───┐  ┌─── 렌더링 ───┐
          │  (HktCore/서버)  │  │(HktVoxelTerrain│
          │                  │  │  /클라이언트)  │
          └────────┬─────────┘  └──────┬────────┘
                   │                   │
         동일 시드, 동일 알고리즘, 독립 생성
```

---

### 1단계: 설정 로드

`UHktRuntimeGlobalSetting`이 에디터 Project Settings에서 UPROPERTY 값을 읽고, `ToTerrainConfig()`로 순수 C++ 구조체 `FHktTerrainGeneratorConfig`를 생성합니다.

```
UHktRuntimeGlobalSetting::ToTerrainConfig()
  ├─ double HeightScale → FHktFixed32::FromDouble(64.0)
  ├─ int64 TerrainSeed → Config.Seed = 42
  ├─ bool bAdvancedTerrain → Config.bAdvancedTerrain = true
  └─ ... (20여개 파라미터 변환)
```

---

### 2단계: 제너레이터 생성 (서버 + 클라이언트 각각)

**서버 (시뮬레이션)**
```
FHktWorldDeterminismSimulator
  └─ TUniquePtr<FHktTerrainGenerator> TerrainGenerator
     └─ SetTerrainConfig(Config) → new FHktTerrainGenerator(Config)
```

**클라이언트 (렌더링)**
```
AHktVoxelTerrainActor::BeginPlay()
  ├─ UHktRuntimeGlobalSetting* Settings = GetDefault<...>()
  ├─ FHktTerrainGeneratorConfig Config = Settings->ToTerrainConfig()
  └─ Generator = MakeUnique<FHktTerrainGenerator>(Config)
```

양쪽 모두 **동일 시드 + 동일 Config** → 동일 제너레이터 상태.

---

### 3단계: 청크 생성 (GenerateChunk)

서버와 클라이언트 모두 동일한 `GenerateChunk(ChunkX, ChunkY, ChunkZ, OutVoxels)` 호출:

```
if (bAdvancedTerrain)
│
├─ Layer 0: FHktAdvTerrainSeed::Derive(Seed, ChunkX, ChunkY, Epoch)
│    └─ SplitMix64 → 8개 서브시드 (Climate, Tectonic, Biome, ...)
│
├─ Layer 1: FHktAdvTerrainClimate::Generate()
│    └─ DomainWarp + FBm → 32×32 기후 필드 (Elevation/Moisture/Temp/Exotic)
│
├─ Layer 1.5: FHktAdvTerrainTectonic::Generate()
│    └─ 7종 대륙 타입 → ElevationMultiplier/Offset 마스크
│
├─ Layer 1 후처리: Climate.Elevation × Tectonic 마스크 적용
│
├─ Layer 2: FHktAdvTerrainBiome::Classify()
│    └─ Whittaker 분류 → 11종 바이옴 (Ocean, Forest, Desert, ...)
│
├─ Layer 2.5: FHktAdvTerrainExoticBiome::Apply()
│    └─ Exoticness > 0.95 → 6종 판타지 바이옴 오버레이
│
├─ Layer 3: FHktAdvTerrainFill::Fill()
│    └─ 높이맵 + 깊이 기반 재질 (Surface/Subsurface/Deep/Bedrock)
│    └─ 인덱스 = LX + LY*32 + LZ*32*32 (Z=높이)
│
├─ Layer 4: FHktAdvTerrainLandmark::Apply()
│    └─ 랜드마크 9종 (Mesa, Monolith, GiantTree, ...) + 강
│
└─ Layer 5: FHktAdvTerrainDecoration::Apply()
     ├─ 지하: 광석 5종 (Coal, Iron, Gold, Crystal, Voidstone)
     └─ 지표: 나무, 선인장, 버섯, 크리스탈 산포
│
▼
OutVoxels[32768] — FHktTerrainVoxel (4B × 32³)
  ├─ uint16 TypeID      (0=Air, 1=Grass, ..., 32=OreVoidstone)
  ├─ uint8  PaletteIndex
  └─ uint8  Flags       (TRANSLUCENT, EMISSIVE, ...)
```

---

### 4단계: 시뮬레이션 적용 (서버)

```
FHktTerrainSystem::Process() — 매 시뮬레이션 프레임
  │
  ├─ WorldState에서 모든 엔티티 위치 조회
  ├─ 엔티티 주변 청크 계산 (SimLoadRadiusXY=2, SimLoadRadiusZ=1)
  │
  ├─ 필요한 청크:
  │    TerrainState.LoadChunk(Coord, Generator)
  │      └─ Generator.GenerateChunk() → LoadedChunks[Coord]에 저장
  │
  ├─ 범위 밖 청크:
  │    TerrainState.UnloadChunk(Coord) — SimMaxChunksLoaded 제한
  │
  └─ 결과: FHktTerrainState
       ├─ LoadedChunks: TMap<FIntVector, TArray<FHktTerrainVoxel>>
       ├─ Modifications: 블록 파괴/편집 오버레이
       └─ HeightmapCache: O(1) 표면 높이 쿼리 (물리 충돌용)
```

---

### 5단계: 렌더링 스트리밍 (클라이언트)

```
AHktVoxelTerrainActor::Tick()
  │
  ├─ Streamer->UpdateStreaming(CameraPos)
  │    └─ 카메라 XY 거리 기준 + Z축 전체 높이 로드 판정
  │
  ├─ ProcessStreamingResults()
  │    └─ 새로 필요한 청크마다:
  │
  │         GenerateAndLoadChunk(ChunkCoord)
  │           ├─ Generator->GenerateChunk(X, Y, Z, TempBuffer)
  │           │
  │           ├─ reinterpret_cast<const FHktVoxel*>(TempBuffer)
  │           │   └─ FHktTerrainVoxel ↔ FHktVoxel 메모리 레이아웃 동일 (4B)
  │           │
  │           └─ RenderCache->LoadChunk(Coord, VoxelData)
  │
  └─ 범위 밖 청크: RenderCache->UnloadChunk()
```

---

### 6단계: 메싱 → GPU 업로드

```
FHktVoxelRenderCache — 청크 더티 시 메싱 트리거
  │
  ├─ Worker Thread:
  │    FHktVoxelMesher::MeshChunk(Chunk)
  │      ├─ 슬라이스별 비트마스크로 노출 면 검출
  │      ├─ Greedy Merge: 인접 동일 타입 쿼드 병합 → 삼각형 최소화
  │      ├─ Baked AO 계산
  │      └─ 출력: OpaqueVertices/Indices + TranslucentVertices/Indices
  │
  └─ Game Thread → Render Thread:
       UHktVoxelChunkComponent::OnMeshReady()
         └─ ENQUEUE_RENDER_COMMAND → SceneProxy → GPU 버퍼 업로드
```

---

### 7단계: 런타임 블록 변경 (Delta 전파)

```
VM 바이트코드가 블록 파괴 실행
  │
  ├─ TerrainState->SetVoxel(Coord, LocalIdx, NewVoxel)
  │    └─ Modifications 오버레이에 기록
  │    └─ PendingVoxelDeltas에 추가
  │
  ├─ AdvanceFrame() 완료 시:
  │    FHktSimulationDiff.VoxelDeltas = MoveTemp(PendingVoxelDeltas)
  │
  ├─ 네트워크 전송 (서버 → 클라이언트):
  │    FHktVoxelDelta { ChunkCoord, LocalIndex, NewTypeID, Palette, Flags }
  │
  └─ 클라이언트 수신:
       RenderCache->ApplyVoxelDelta(Delta)
         ├─ 해당 청크의 복셀 1개 갱신
         ├─ 청크 더티 마킹
         └─ 메싱 재실행 → GPU 재업로드
```

---

### 핵심 정리

| 구간 | 주체 | 데이터 |
|---|---|---|
| Config → Generator | 서버/클라이언트 각각 | 동일 `FHktTerrainGeneratorConfig` |
| 청크 생성 | 서버/클라이언트 **독립 실행** | 동일 시드 → 동일 `FHktTerrainVoxel[32768]` |
| 시뮬레이션 저장 | 서버 전용 | `FHktTerrainState.LoadedChunks` |
| 렌더 캐시 | 클라이언트 전용 | `FHktVoxelRenderCache` (reinterpret_cast 브릿지) |
| 런타임 변경 | 서버 생성 → 네트워크 전송 | `FHktVoxelDelta` (단일 복셀 변경분만) |
| 메싱 | 클라이언트 워커 스레드 | Greedy Mesh → GPU 업로드 |

**대역폭 절약**: 기본 지형은 전송하지 않음 (양쪽 독립 생성). 블록 파괴 같은 변경분(`FHktVoxelDelta`)만 네트워크 전송 → `HktDetMath`로 결정론이 보장되어야 하는 이유.