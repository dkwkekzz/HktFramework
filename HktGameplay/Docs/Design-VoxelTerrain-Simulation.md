# VoxelTerrain 시뮬레이션 — 지형 생성과 동기화

결정론적 시뮬레이션(HktCore)에서 복셀 지형을 런타임에 생성, 쿼리, 변형하는 시스템.
서버-권위적으로 동작하며, 시드 기반 재생성과 Modifications 오버레이로 상태를 관리한다.

---

## 전체 데이터 흐름

```
┌─ 서버/MCP ──────────────────────────────────────────────────────────────┐
│                                                                         │
│  SetTerrainConfig(Config)                                               │
│       │  Seed, HeightScale, Octaves, CaveFreq ...                       │
│       ▼                                                                 │
│  FHktTerrainGenerator 생성 (5개 노이즈 인스턴스 초기화)                     │
│       │                                                                 │
└───────┼─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 시뮬레이션 파이프라인 (매 프레임 1/30초) ──────────────────────────────┐
│                                                                         │
│  1. EntityArrangeSystem  — 제거된 엔티티 정리                              │
│  2. TerrainSystem        — ★ 엔티티 위치 기반 청크 로드/언로드              │
│  3. VMBuildSystem        — 이벤트 → VM 프로그램 빌드                       │
│  4. VMProcessSystem      — VM 명령어 실행 (지형 OpCode 포함)               │
│  5. MovementSystem       — 물리 이동 + ★ 지면 스냅                        │
│  6. PhysicsSystem        — 충돌/히트 판정                                  │
│  7. VMCleanupSystem      — 완료된 VM 해제                                 │
│       │                                                                 │
│       ▼                                                                 │
│  FHktSimulationDiff 발행                                                │
│       ├─ PropertyDeltas[]                                               │
│       ├─ SpawnedEntities[]                                              │
│       └─ VoxelDeltas[]   ← ★ 복셀 변형 이벤트                            │
│                                                                         │
└───────┼─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 클라이언트 (HktVoxelCore) ─────────────────────────────────────────────┐
│                                                                         │
│  FHktVoxelRenderCache.ApplyVoxelDelta()                                 │
│       │                                                                 │
│       ▼                                                                 │
│  FHktVoxelMeshScheduler → MeshChunk() → GPU 업로드 → 화면 렌더링           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 핵심 구조체

### FHktTerrainVoxel (4바이트)

```cpp
struct FHktTerrainVoxel
{
    uint16 TypeID;        // 0 = 빈 공간 (AIR)
    uint8  PaletteIndex;  // 색상 팔레트 인덱스
    uint8  Flags;         // TRANSLUCENT | EMISSIVE | DESTRUCTIBLE
};
```

HktVoxelCore의 `FHktVoxel`과 바이트 레이아웃이 동일하여 `reinterpret_cast` 가능.

### FHktTerrainState (런타임 지형 상태)

| 멤버 | 타입 | 역할 |
|------|------|------|
| `LoadedChunks` | `TMap<FIntVector, TArray<FHktTerrainVoxel>>` | 청크 좌표 → 32768개 복셀 배열 |
| `Modifications` | `TMap<FIntVector, TMap<uint16, FHktTerrainVoxel>>` | 변형 오버레이 (생성기 결과 위에 덮어쓰기) |
| `HeightmapCache` | `TMap<FIntVector, TArray<int32>>` | (ChunkX, ChunkY) → 32×32 표면 높이 캐시 |

### FHktVoxelDelta (18바이트, 네트워크 전송)

```cpp
struct FHktVoxelDelta
{
    FIntVector ChunkCoord;   // 12B
    uint16 LocalIndex;       // 2B (0~32767)
    uint16 NewTypeID;        // 2B
    uint8  NewPaletteIndex;  // 1B
    uint8  NewFlags;         // 1B
};
```

### 좌표 체계

```
월드 cm 좌표  ──(÷15.0)──▶  월드 복셀 좌표  ──(÷32)──▶  청크 좌표
                                    │
                                    └──(mod 32)──▶  로컬 XYZ
                                                      │
                                    로컬 인덱스 = X + Y*32 + Z*1024  (Z-major)
```

---

## 단계별 상세 동작

### 1단계: 지형 설정

```cpp
Simulator->SetTerrainConfig(Config);
```

- `FHktTerrainGenerator`를 생성하고 5개 노이즈 인스턴스를 시드 기반 초기화
- `FHktVMInterpreter`에 `TerrainState`와 `PendingVoxelDeltas` 포인터 전달
- 이 시점에서 로드된 청크는 0개 (엔티티가 없으므로)

### 2단계: TerrainSystem — 청크 자동 관리

매 프레임 `FHktTerrainSystem::Process()` 실행.

```
[모든 엔티��� 순회] + [이번 프레임 이벤트의 Location]
       │
       ▼
위치 → CmToVoxel → WorldToChunk → EntityChunks TSet (중복 제거)
       │
       ▼
고유 청크 좌표에서만 반경 확장 (5×5×3 = 75개/청크)
       │
       ├── 미로드 청크 → LoadChunk() (프레임당 최대 4개)
       └── Required에 없는 로드된 청크 → UnloadChunk()
```

이벤트 Location 사전 로드: 스폰 이벤트의 위치에 해당하는 청크를 TerrainSystem 단계에서 미리 로드하여, VMProcess에서 GetTerrainHeight 호출 시 청크가 준비되도록 보장.

**LoadChunk 내부:**

```
FHktTerrainGenerator::GenerateChunk(ChunkX, ChunkY, ChunkZ, OutVoxels)
       │
       ▼
  32×32 XY 열마다:
    1. GetSurfaceHeight → FBM(6옥타브) + RidgedMulti 블렌딩
    2. BiomeMap에서 바이옴 결정
    3. Z=0~31 순회: DetermineVoxel()
       - 표면(1블록): 잔디/모래/눈 (바이옴 의존)
       - 차표면(3블록): 흙
       - 심부: 돌
       - 최하층: 베드록
    4. IsCave() → 3D 절대값 Perlin 노이즈 → 동굴 카빙
    5. 수면 이하 빈 공간 → 물 채우기
       │
       ▼
  Modifications 오버레이 적용 (이전 변형 복원)
       │
       ▼
  RebuildHeightmapForChunk() → HeightmapCache 갱신
```

**시드가 같으면 항상 동일한 청크 생성** → 결정론적.

### 3단계: VM에서 지형 읽기/쓰기

Story 스크립트가 실행 중 4개의 지형 OpCode를 사용:

| OpCode | 시그니처 | 동작 |
|--------|----------|------|
| `GetTerrainHeight` | `Dst, X, Y` | HeightmapCache에서 XY 열 표면 Z 조회 (O(1)) |
| `GetVoxelType` | `Dst, PosBase, Z` | 특정 복셀의 TypeID 반환 |
| `IsTerrainSolid` | `Dst, PosBase, Z` | 고체 여부 1/0 |
| `SetVoxel` | `PosBase, TypeReg` | 복셀 변형 + VoxelDelta 발행 |

**SetVoxel 실행 흐름:**

```
Op_SetVoxel
   │
   ▼
TerrainState->SetVoxel(X, Y, Z, Voxel, PendingVoxelDeltas)
   │
   ├── Modifications[ChunkCoord][LocalIndex] = Voxel     (영구 오버레이)
   ├── LoadedChunks[ChunkCoord][LocalIndex] = Voxel       (즉시 캐시 반영)
   ├── PendingVoxelDeltas.Add(Delta)                      (렌더링 전파용)
   └── RebuildHeightmapColumn(X, Y)                       (표면 높이 재계산)
```

**StoryBuilder 조합 API:**

```cpp
// 엔티티 발밑 복셀 파괴
Story(TEXT("Ability.Terrain.Destroy"))
    .EntityPosToVoxel(pos, Self)     // cm → 복셀 좌표 변환 (÷15)
    .DestroyVoxelAt(pos)             // TypeID=0 설정
    .End();

// 지형 높이 쿼리
Story(TEXT("AI.TerrainCheck"))
    .GetTerrainHeight(heightReg, voxelX, voxelY)
    .End();
```

### 4단계: MovementSystem — 지면 스냅 (IsGrounded 시스템)

`IsGrounded=1`인 모든 엔티티를 매 프레임 지형 표면에 스냅한다.
이동 중이든 정지 상태이든 관계없이 적용되므로, 스폰 직후나 지형 변형 후에도 즉시 보정.

```
[패스 1: 이동 엔티티]
NewPos = CurPos + Velocity * dt
   │
   ▼
if (IsGrounded == 1 && TerrainState)
   │
   ▼
HeightmapCache 조회 → 표면 Z (O(1))
   │
   ▼
if (NewZ < SurfaceCmZ) NewZ = SurfaceCmZ

[패스 2: 정지 접지 엔티티]  ← 스폰 직후, 지형 변형 후 등
   │
   ▼
if (IsMoving == 0 && IsGrounded == 1 && TerrainState)
   │
   ▼
HeightmapCache 조회 → 표면 Z (O(1))
   │
   ▼
if (CurZ < SurfaceCmZ) CurZ = SurfaceCmZ
```

**IsGrounded 프로퍼티:**
- `Op_SpawnEntity`에서 기본값 `IsGrounded=1` 설정 (모든 엔티티는 기본 접지)
- 투사체 등 공중 엔티티는 Story에서 `IsGrounded=0`으로 명시 해제
- Hot 프로퍼티 목록에 포함되어 매 프레임 빠르게 접근 가능

### 5단계: Diff 전파

프레임 종료 시 `AdvanceFrame()` → `FHktSimulationDiff` 반환:

```cpp
Diff.VoxelDeltas = MoveTemp(PendingVoxelDeltas);
```

클라이언트는 `VoxelDeltas`를 받아 `FHktVoxelRenderCache`에 적용 → 해당 청크 메시 재구축 → GPU 업로드.

### 6단계: 롤백/예측 복원

```
1. TerrainState.CopyFrom(Snapshot)  — LoadedChunks + Modifications + HeightmapCache 복사
2. 생성기 시드 동일 → 청크 재생성 시 같은 결과
3. Modifications만 있으면 변형 상태 완벽 복원
4. SerializeModifications() → 네트워크 전송 시 오버레이만 직렬화
```

---

## 성능 특성

### 설정 상수

| 상수 | 값 | 위치 |
|------|-----|------|
| `ChunkSize` | 32 | FHktTerrainState |
| `VoxelsPerChunk` | 32768 (32³) | FHktTerrainState |
| `VoxelSizeCm` | 15.0 | FHktTerrainSystem |
| `LoadRadiusXY` | 2 (5×5 청크) | FHktTerrainSystem |
| `LoadRadiusZ` | 1 (3층) | FHktTerrainSystem |
| `MaxChunksLoaded` | 256 | FHktTerrainSystem |
| `MaxChunkLoadsPerFrame` | 4 | FHktTerrainSystem |
| `TerrainOctaves` | 6 | FHktTerrainGeneratorConfig |

### 프레임 비용 (엔티티 200개, 이동 중 50개 기준)

| 단계 | 정상 상태 | 이동 중 (청크 1개 로드) | 텔레포트 (4개 로드) |
|------|-----------|------------------------|-------------------|
| TerrainSystem 수집 | 0.07ms | 0.07ms | 0.07ms |
| GenerateChunk | 0ms | ~8.7ms | ~35ms |
| HeightmapCache 빌드 | 0ms | 0.1ms | 0.4ms |
| MovementSystem 스냅 | 0.008ms | 0.008ms | 0.008ms |
| VM OpCode | 0.02ms | 0.02ms | 0.02ms |
| **지형 합계** | **~0.1ms** | **~9ms** | **~35ms** |
| 프레임 버짓(33ms) 대비 | 0.3% | 27% | 105% |

### GenerateChunk 비용 내역 (청크 1개)

| 연산 | 호출 수 | 소계 |
|------|---------|------|
| Perlin2D (높이, 6+6옥타브) | 1024열 × 12회 | ~0.6ms |
| Perlin3D (동굴, 6옥타브) | ~16K복셀 × 6회 | ~7.7ms |
| DetermineVoxel (분기) | 32K | ~0.3ms |
| HeightmapCache 빌드 | 1024열 | ~0.1ms |
| **합계** | | **~8.7ms** |

주 병목은 **3D 동굴 노이즈** (청크당 ~89%).

### 메모리

| 항목 | 크기 |
|------|------|
| LoadedChunks (75개 평균) | ~9.6MB |
| HeightmapCache (~25개 XY) | ~100KB |
| Modifications | 수 KB |
| **합계** | **~10MB** |

### 네트워크

| 항목 | 크기 |
|------|------|
| FHktVoxelDelta | 18바이트/개 |
| 프레임당 평균 변형 | ~2개 = 36바이트 |
| SerializeModifications (롤백 시) | 오버레이 건수 × ~10바이트 |

네트워크 부하는 **무시 가능**.

---

## 최적화 이력

| 문제 | 해결 | 효과 |
|------|------|------|
| `GetSurfaceHeightAt` O(256청크 + 96복셀) | HeightmapCache 도입 → O(1) TMap 조회 | 이동 엔티티 100개 기준 ~50ms → ~0.008ms |
| 엔티티당 75개 TSet 삽입 | EntityChunks로 중복 제거 후 확장 | 15,000회 → ~750회 (엔티티 200개) |
| 프레임 스파이크 (무제한 청크 로드) | MaxChunkLoadsPerFrame=4 예산 | 최악 무제한 → 4 × 8.7ms = ~35ms |
| GenerateChunk ↔ GetVoxel 인덱싱 불일치 | X-major → Z-major 통일 | X↔Z 축 뒤바뀜 버그 수정 |

---

## 향후 개선 가능 사항

| 우선순위 | 방안 | 기대 효과 |
|----------|------|-----------|
| 1 | 비동기 GenerateChunk (워커 스레드) | 메인 스레드 부하 0ms, 결정론은 동기점에서 보장 |
| 2 | 동굴 노이즈 최적화 (표면 인접 블록 스킵 확대) | 청크당 ~40% 절감 |
| 3 | MaxChunkLoadsPerFrame CVar화 | 런타임 튜닝 가능 |
| 4 | ColumnLoadedZ 인덱스 | RebuildHeightmapColumn에서 LoadedChunks 풀스캔 제거 |

---

## 파일 구조

```
Source/HktCore/
├── Public/
│   ├── Terrain/
│   │   ├── HktTerrainVoxel.h          FHktTerrainVoxel (4바이트 복셀)
│   │   ├── HktTerrainGenerator.h      FHktTerrainGeneratorConfig + FHktTerrainGenerator
│   │   ├── HktTerrainNoise.h          FHktTerrainNoise (Perlin FBM/Ridged)
│   │   ├── HktTerrainBiome.h          FHktTerrainBiome (바이옴/재질 규칙)
│   │   └── HktTerrainState.h          FHktTerrainState (런타임 청크 캐시)
│   ├── HktCoreSimulator.h             IHktDeterminismSimulator::SetTerrainConfig()
│   ├── HktCoreEvents.h                FHktVoxelDelta, FHktSimulationDiff
│   ├── HktStoryTypes.h                EOpCode::GetTerrainHeight / SetVoxel / ...
│   └── HktStoryBuilder.h              지형 API (GetTerrainHeight, SetVoxel, ...)
├── Private/
│   ├── Terrain/
│   │   ├── HktTerrainState.cpp        청크 생명주기 + 쿼리 + HeightmapCache
│   │   ├── HktTerrainGenerator.cpp    프로시저럴 지형 생성 (FBM + 동굴 + 바이옴)
│   │   ├── HktTerrainNoise.cpp        Perlin 노이즈 구현
│   │   └── HktTerrainBiome.cpp        바이옴 매핑
│   ├── HktSimulationSystems.h/cpp     FHktTerrainSystem + FHktMovementSystem
│   ├── HktWorldDeterminismSimulator.h/cpp   파이프라인 통합
│   └── VM/
│       ├── HktVMInterpreter.h/cpp     Op_GetTerrainHeight 등 디스패치
│       └── HktVMInterpreterActions.cpp 지형 OpCode 구현
```
