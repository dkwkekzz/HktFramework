# HktTerrain 모듈 분리 설계

> Voxel/Sprite/Landscape 3개 렌더 경로가 단일 지형 데이터 소스를 공유하도록 모듈을 재구성하는 계획. 베이크 타임에 미리 생성한 지형 데이터를 런타임에는 읽기 전용으로 스트리밍한다.

## 배경

현재 `HktVoxelTerrain` 모듈이 런타임에 `FHktTerrainGenerator`를 직접 호출하여 청크를 동적 생성하고 있다. 다음 문제가 누적되어 있다.

- 지형 생성 비용이 메인 렌더 경로에 직접 연결되어 있음.
- `AHktVoxelTerrainActor` / `AHktVoxelSpriteTerrainActor` / `AHktLandscapeTerrainActor` 가 동일 generator를 각자 호출 — 시드/파라미터 동기화 부담.
- 스타일/팔레트/아틀라스 자산이 `HktVoxelTerrain`에 종속되어 있어 Sprite 경로가 자연스럽게 재사용하지 못함.
- 베이크 산출물(`UHktVoxelTerrainStyleSet`)과 런타임 청크 데이터의 책임 경계가 모호.

## 절대 원칙 (선결 제약)

루트 `CLAUDE.md`에서 가져온 invariant — 위반 시 설계 다시 시작.

1. ISP 3-Layer: Intent(`HktRule`) → Simulation(`HktCore`) → Presentation(`HktPresentation`).
2. **HktCore 순수성**: `HktCore` 모듈은 UObject/UWorld/UE 런타임 의존 0. 따라서 `HktCore/Terrain/*` 는 **이동하지 않는다**.
3. 서버 권위. 클라이언트는 읽기 전용 `FHktWorldView`만 수신.
4. **VM 쓰기는 `FHktVMWorldStateProxy::SetPropertyDirty` 경유**. `FHktTerrainProvider`도 예외 없음.
5. `FHktEntityState`는 직렬화 전용 DTO. HktCore 내부 로직에서 사용 금지.
6. 컬럼 포인터 호이스팅: 시스템 벌크 루프에서 `GetColumn()`은 루프 밖 캐시.

추가 제약:
- `HktVoxelCore` LoadingPhase = `PostConfigInit` 고정.
- HktCore/Terrain 의 결정론(FHktFixed32 기반)은 깨지 않는다.

## 목표 의존 그래프

```
HktCore (UObject 0, 순수 C++)
  └─ Terrain/*  ← 결정론 생성 알고리즘 (FHktTerrainGenerator, Noise, Biome, AdvTerrain*)
                  + FHktTerrainState (VM 캐시), FHktTerrainVoxel (DTO)
                  ※ 그대로 유지. 옮기지 않음.

HktTerrain (신규, UObject 레이어)              ← 데이터 관리 / 스트리밍 책임
  ├─ Depends: Core, CoreUObject, Engine, HktCore
  ├─ UHktTerrainBakedAsset      — 청크별 미리 구운 FHktTerrainVoxel 블롭(.uasset)
  ├─ UHktTerrainStyleSet        — 기존 HktVoxelTerrainStyleSet 이관(텍스처/팔레트)
  ├─ UHktTerrainSubsystem       — WorldSubsystem. baked asset 로드 + 청크 좌표→데이터 조회
  ├─ FHktTerrainStreamRequest   — 카메라 좌표 기반 큐
  ├─ IHktTerrainChunkLoader     — HktVoxelChunkLoader 인터페이스 일반화하여 이관
  ├─ FHktTerrainProvider        — HktCore의 FHktTerrainState에 데이터 주입(Proxy 경유)
  └─ HktTerrainBakeLibrary      — 에디터 전용 (FHktTerrainGenerator 호출 → UAsset 직렬화)

HktVoxelCore (그대로, PostConfigInit)
  └─ FHktVoxel / FHktVoxelChunk / RenderCache / Mesher  (메싱·렌더링만 담당)

HktVoxelTerrain (축소 리팩터)                  ← Voxel 메싱·스트리밍만
  ├─ Depends: HktCore, HktVoxelCore, HktTerrain
  ├─ AHktVoxelTerrainActor      — UHktTerrainSubsystem에서 청크 받아 RenderCache 주입
  └─ (FHktTerrainGenerator 직접 호출 제거)

HktSpriteTerrain (신규, HktVoxelSpriteTerrainActor 이관)
  ├─ Depends: HktCore, HktSpriteCore, HktTerrain
  └─ AHktSpriteTerrainActor     — UHktTerrainSubsystem에서 top-surface 셀 받아 HISM 렌더

HktLandscapeTerrain (소폭 리팩터)
  └─ FHktTerrainGenerator 직접 호출 → UHktTerrainSubsystem::SamplePreview() 사용
```

핵심 결정: **HktCore/Terrain 은 그대로 둔다.** 이미 순수 C++이고 VM이 직접 의존한다. 새 `HktTerrain` 은 그 위에 얹는 **에셋·스트리밍·UObject 레이어**다. "베이킹된 데이터를 로드해서 빠르게 처리" 요구는 `UHktTerrainBakedAsset` + `UHktTerrainSubsystem` 이 담당.

## 데이터 흐름 (확정해야 할 계약)

### Editor 베이크 타임

```
HktTerrainBakeLibrary
  → FHktTerrainGenerator::GenerateChunk(...)        // HktCore 호출
  → 청크별 FHktTerrainVoxel[32768] 압축 직렬화
  → UHktTerrainBakedAsset (.uasset)
```

### Runtime 시작

```
UHktTerrainSubsystem::Initialize()
  → BakedAsset 비동기 로드
  → 청크 좌표 → 메모리 매핑 인덱스 구축
```

### Runtime 청크 요청

```
AHktVoxelTerrainActor / AHktSpriteTerrainActor
  → IHktTerrainChunkLoader::Update(CameraPos)
  → UHktTerrainSubsystem::AcquireChunk(Coord) → const FHktTerrainVoxel*
  → 각 렌더러가 자기 표현으로 변환 (Voxel: RenderCache, Sprite: HISM)
```

### Runtime VM 주입

```
FHktTerrainProvider (HktCore 어댑터)
  → FHktVMWorldStateProxy::SetPropertyDirty 경유  // 절대원칙 4
  → FHktTerrainState::LoadChunk(...)
```

## 단계별 작업 분할 (PR 단위 권장)

각 단계는 독립 커밋/빌드 가능하도록 설계. **Phase 0 결정 사항은 작업 시작 전에 확정.**

### Phase 0 — 설계 컨펌 (코드 변경 0)

- 모듈 이름: `HktTerrain` 단일 모듈 vs. `HktTerrainCore` + `HktTerrain` 분리.
  - **권장: 단일 `HktTerrain`**. HktCore/Terrain 이 이미 "Core" 역할이므로 중복 회피.
- HktCore/Terrain 이동 여부.
  - **권장: 이동 금지.** HktCore 는 UObject 0 원칙 + VM 이 직접 사용 중.
- 베이크 포맷: 청크당 압축(zstd/oodle), 메타(시드, 버전, 청크 영역).
- 베이크 미존재 시 폴백: `FHktTerrainGenerator` 즉석 호출 vs. 강제 실패.

### Phase 1 — `HktTerrain` 모듈 스켈레톤

1. `HktGameplay/Source/HktTerrain/{Public,Private}` 생성.
2. `HktTerrain.Build.cs` 작성 — Public deps: `Core, CoreUObject, Engine, HktCore`. Editor deps: `UnrealEd`(베이크용).
3. `HktGameplay.uplugin` 에 `HktTerrain` 모듈 항목 추가 (LoadingPhase: `Default`).
4. `IHktTerrainModule.h/.cpp` 빈 `IMPLEMENT_MODULE`.
5. 빌드만 통과시키고 커밋 — "scaffold HktTerrain module".

### Phase 2 — 데이터 자산 + 베이크 파이프라인

1. `UHktTerrainBakedAsset (UDataAsset)`: 헤더(시드/버전/영역) + `TArray<FHktTerrainBakedChunk>` + 좌표→인덱스 맵.
2. `FHktTerrainBakedChunk`: `ChunkCoord` + 압축된 `TArray<uint8>` (FHktTerrainVoxel 시퀀스).
3. `UHktTerrainBakeLibrary` (BlueprintFunctionLibrary, Editor 전용): `BakeRegion(GeneratorConfig, ChunkRange, OutAssetPath)`.
4. 기존 `UHktVoxelTerrainBakeLibrary`(StyleSet 베이킹) 는 Phase 4 에서 이관.

### Phase 3 — 런타임 로더 + 서브시스템

1. `UHktTerrainSubsystem (UWorldSubsystem)`: `LoadBakedAsset(SoftRef)`, `AcquireChunk(Coord) → const FHktTerrainVoxel*`, `ReleaseChunk(Coord)`, `SamplePreview(Region)`.
2. `IHktTerrainChunkLoader` 인터페이스를 `HktVoxelTerrain` 에서 `HktTerrain` 으로 이관(이름도 `HktTerrainChunkLoader` 로 정규화).
3. 기존 Legacy/Proximity 구현체도 함께 이동.
4. `FHktTerrainProvider`: VM 어댑터. `FHktVMWorldStateProxy` 를 받아 `SetPropertyDirty` 경유로 `FHktTerrainState::LoadChunk` 트리거.

### Phase 4 — 스타일/팔레트 자산 이관

1. `UHktVoxelTerrainStyleSet` → `UHktTerrainStyleSet` 으로 리네임 + 이동(HktTerrain).
2. Atlas 텍스처(`T_HktSpriteTerrainAtlas`), `PaletteLUT` 도 동일 이관.
3. 콘텐츠 referencer redirector 처리(`-FixupRedirectors`).
4. 기존 `HktVoxelTerrain.Build.cs` 에 `HktTerrain` 의존 추가.

### Phase 5 — `HktVoxelTerrain` 축소 리팩터

1. `AHktVoxelTerrainActor` 에서 `FHktTerrainGenerator GeneratorMember` 제거.
2. `BeginPlay` → `UHktTerrainSubsystem::Get(World)->LoadBakedAsset(BakedRef)`.
3. `GenerateAndLoadChunk()` → `LoadChunkFromSubsystem()` 로 변경: Subsystem 에서 받아 `FHktVoxelRenderCache::LoadChunk` 그대로 캐스팅.
4. 청크 로더 사용처를 `HktTerrain` 의 인터페이스로 갱신.
5. 베이크 라이브러리(`UHktVoxelTerrainBakeLibrary`) 는 StyleSet 부분만 남기고 `HktTerrain` 에서 import.
6. 빌드 의존: `HktVoxelTerrain.Build.cs` 에 `HktTerrain` 추가.

### Phase 6 — `HktSpriteTerrain` 신규 모듈

1. `HktGameplay/Source/HktSpriteTerrain/{Public,Private}` 생성.
2. `Build.cs` Public: `Core, CoreUObject, Engine, HktCore, HktSpriteCore, HktTerrain`.
3. `AHktVoxelSpriteTerrainActor` → `AHktSpriteTerrainActor` 로 이관.
4. RenderCache 의존 제거 → `UHktTerrainSubsystem` 에서 표면 셀 직접 추출(`ScanTopSurfaceFromBaked`).
5. HISM 컴포넌트 코드는 `HktSpriteCore` 헬퍼(`UHktSpriteCrowdRenderer`) 로 가능한 최대 위임.
6. `.uplugin` 모듈 항목 추가.

### Phase 7 — `HktLandscapeTerrain` 정리

1. `FHktTerrainGenerator::SamplePreviewRegion` 직접 호출 → `UHktTerrainSubsystem::SamplePreview` 경유로 변경.
2. baked asset 이 있으면 baked 에서 우선 추출하도록 fallback 분기.

### Phase 8 — VM 통합 점검 (절대원칙 검증)

1. `FHktTerrainProvider` 의 모든 쓰기가 `FHktVMWorldStateProxy::SetPropertyDirty` 경유인지 검증(grep).
2. HktCore 에 신규 UObject 의존이 누설되지 않았는지 확인 (`HktCore/**` 안에서 `UObject`/`UWorld` 패턴 0건 유지).
3. `WITH_HKT_INSIGHTS` 트레이스 포인트 추가: 베이크 로드 시간, 청크 acquire latency.

### Phase 9 — 문서/CLAUDE.md

1. 루트 `CLAUDE.md` 의 모듈 표에 `HktTerrain`, `HktSpriteTerrain` 추가.
2. `HktGameplay/CLAUDE.md` 의존 그래프 갱신.
3. 신규 모듈 각각 `CLAUDE.md` 1쪽씩(데이터 흐름, 베이크 명령, 트러블슈팅).

## 위험/결정 필요 사항

| 항목 | 옵션 | 권장 |
|---|---|---|
| HktCore/Terrain 이동 여부 | (a) 이동 금지 (b) HktTerrain 으로 이동 | **(a)**. VM 직접 의존 + UObject 0 원칙. |
| 모듈 분리 단위 | 단일 `HktTerrain` vs. `HktTerrainCore`+`HktTerrain` | **단일**. 중복 회피. |
| 베이크 미존재 fallback | (a) 즉석 생성 (b) 강제 실패 | **(a) 개발용 / (b) shipping**. CVar 로 토글. |
| 청크 압축 | none / oodle / zstd | **oodle (UE 기본)**. |
| `HktVoxelSpriteTerrainActor` 폐기 | 즉시 제거 vs. deprecated 표시 | **deprecated 1릴리스 후 제거**. |
| 콘텐츠 redirector | 자동 fixup vs. 수동 | **자동 fixup + 검증 빌드**. |

## 우선순위 / 시퀀싱

- **사용자 컨펌 필요**: Phase 0 결정 사항 (특히 §위험/결정 표의 1·5번째 행).
- 컨펌 후 **Phase 1~3 을 한 PR** (스켈레톤 + 베이크 + 로더, 기존 동작 영향 없음).
- **Phase 4~5 를 한 PR** (VoxelTerrain 이 새 경로로 전환).
- **Phase 6** 을 별도 PR (SpriteTerrain 신규).
- **Phase 7~9** 를 한 PR (Landscape 정리 + 문서).

## 참고 — 현재 코드 위치

| 심볼 | 경로 |
|---|---|
| `FHktTerrainGenerator` | `HktGameplay/Source/HktCore/Public/Terrain/HktTerrainGenerator.h` |
| `FHktTerrainState` | `HktGameplay/Source/HktCore/Public/Terrain/HktTerrainState.h` |
| `FHktTerrainVoxel` | `HktGameplay/Source/HktCore/Public/Terrain/HktTerrainVoxel.h` |
| `AHktVoxelTerrainActor` | `HktGameplay/Source/HktVoxelTerrain/Public/HktVoxelTerrainActor.h` |
| `AHktVoxelSpriteTerrainActor` | `HktGameplay/Source/HktVoxelTerrain/Public/HktVoxelSpriteTerrainActor.h` |
| `UHktVoxelChunkLoader` | `HktGameplay/Source/HktVoxelTerrain/Public/HktVoxelChunkLoader.h` |
| `UHktVoxelTerrainBakeLibrary` | `HktGameplay/Source/HktVoxelTerrain/Public/HktVoxelTerrainBakeLibrary.h` |
| `FHktVoxel` / `FHktVoxelChunk` | `HktGameplay/Source/HktVoxelCore/Public/HktVoxelTypes.h` |
| `FHktVoxelRenderCache` | `HktGameplay/Source/HktVoxelCore/Public/HktVoxelRenderCache.h` |
| `AHktLandscapeTerrainActor` | `HktGameplay/Source/HktLandscapeTerrain/Public/HktLandscapeTerrainActor.h` |
