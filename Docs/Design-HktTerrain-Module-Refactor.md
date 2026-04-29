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
2. **HktCore 순수성**: `HktCore` 모듈은 UObject/UWorld/UE 런타임 의존 0.
3. **HktCore 는 지형 데이터 생성에 관여하지 않는다**. HktCore 는 `HktTerrain` 이 제공하는 데이터를 *읽기 전용* 으로 소비한다. 따라서 기존 `HktCore/Terrain/*` 의 **생성기**(`FHktTerrainGenerator`, `FHktTerrainNoise`, `FHktTerrainBiome`, `FHktAdvTerrain*`)는 `HktTerrain` 으로 이관한다. 데이터/상태 타입(`FHktTerrainState`, `FHktTerrainVoxel`, `FHktTerrainVoxelDef`, `FHktTerrainDestructibility`, `FHktFixed32`)만 HktCore 에 남긴다.
4. 서버 권위. 클라이언트는 읽기 전용 `FHktWorldView`만 수신.
5. **VM 쓰기는 `FHktVMWorldStateProxy::SetPropertyDirty` 경유**. `FHktTerrainProvider`도 예외 없음.
6. `FHktEntityState`는 직렬화 전용 DTO. HktCore 내부 로직에서 사용 금지.
7. 컬럼 포인터 호이스팅: 시스템 벌크 루프에서 `GetColumn()`은 루프 밖 캐시.

추가 제약:
- `HktVoxelCore` LoadingPhase = `PostConfigInit` 고정.
- 결정론(FHktFixed32 기반)은 모듈을 옮겨도 깨지지 않는다 — 이관된 생성기는 순수 C++ 그대로 유지.
- HktCore → HktTerrain 의존 금지(역방향). HktTerrain 에서 HktCore 로의 단방향만 허용.

## 목표 의존 그래프

```
HktCore (UObject 0, 순수 C++)                  ← 읽기 전용 데이터 소비자
  └─ Terrain/*  ← FHktTerrainState (VM 캐시), FHktTerrainVoxel (DTO),
                  FHktTerrainVoxelDef, FHktTerrainDestructibility,
                  FHktFixed32, IHktTerrainDataSource (신규 인터페이스)
                  ※ 생성기는 HktTerrain 으로 이관. HktCore 는 생성에 관여하지 않음.

HktTerrain (신규, 생성기 + UObject 레이어 소유)  ← 지형 데이터 생성/관리/스트리밍
  ├─ Depends: Core, CoreUObject, Engine, HktCore
  ├─ FHktTerrainGenerator       — HktCore 에서 이관 (순수 C++ 유지)
  ├─ FHktTerrainNoise           — HktCore 에서 이관
  ├─ FHktTerrainBiome           — HktCore 에서 이관
  ├─ FHktAdvTerrain* (Types/Fill/Layers) — HktCore 에서 이관
  ├─ UHktTerrainBakedAsset      — 청크별 미리 구운 FHktTerrainVoxel 블롭(.uasset)
  ├─ UHktTerrainSubsystem       — WorldSubsystem. baked 우선 + 미존재 시 런타임 생성 폴백
  ├─ FHktTerrainStreamRequest   — 카메라 좌표 기반 큐
  ├─ IHktTerrainChunkLoader     — HktVoxelChunkLoader 인터페이스 일반화하여 이관
  ├─ FHktTerrainProvider        — HktCore 의 FHktTerrainState 에 데이터 주입(Proxy 경유; IHktTerrainDataSource 구현)
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

핵심 결정:
- **HktCore 는 생성에 관여하지 않는다**. 생성기 일체를 `HktTerrain` 으로 이관. 이관 후에도 순수 C++ 결정론은 유지(`FHktFixed32` 기반 알고리즘 변경 금지).
- **HktCore 에는 `IHktTerrainDataSource` 인터페이스만 남긴다**. VM 쪽(`FHktTerrainState::LoadChunk`)은 이 인터페이스를 통해서만 청크 데이터를 받는다. 구현체는 `HktTerrain` 의 `FHktTerrainProvider`.
- "베이킹된 데이터를 로드해서 빠르게 처리" 요구는 `UHktTerrainBakedAsset` + `UHktTerrainSubsystem` 이 담당. 베이크 미존재 시에도 동일 로직(`FHktTerrainGenerator`) 으로 런타임에 생성해 결과만 다르지 않도록 보장.

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

### Runtime fallback (베이크 미존재 시)

베이크 산출물이 없거나 요청한 청크가 베이크 영역 밖일 때 런타임에 동일 로직으로 생성한다. 베이크 시점 결과와 비트 단위로 일치해야 하며 — 결정론(FHktFixed32) — 한 번이라도 호출되면 경고 로그를 남겨 누락 영역을 추적한다.

```
UHktTerrainSubsystem::AcquireChunk(Coord)
  → BakedAsset 미스
  → UE_LOG(LogHktTerrain, Warning,
           TEXT("Chunk %s not baked; runtime generation fallback"), *Coord.ToString());
  → FHktTerrainGenerator::GenerateChunk(BakedAsset->GeneratorConfig, Coord, OutVoxels)
       (BakedAsset 부재 시 UHktRuntimeGlobalSetting::ToTerrainConfig() 의 기본 시드/파라미터 사용)
  → 결과 in-memory 캐시 + 반환
```

생성 인자 우선순위: `BakedAsset->GeneratorConfig` → `UHktRuntimeGlobalSetting::ToTerrainConfig()` → 컴파일 기본값. 어느 단계에서 인자를 채웠는지 첫 호출 시 1회 로그.

### Runtime VM 주입

```
FHktTerrainProvider (IHktTerrainDataSource 구현, HktCore 어댑터)
  → FHktVMWorldStateProxy::SetPropertyDirty 경유  // 절대원칙 5
  → FHktTerrainState::LoadChunk(...)
```

## 단계별 작업 분할 (PR 단위 권장)

각 단계는 독립 커밋/빌드 가능하도록 설계.

### Phase 0 — 설계 컨펌 (✅ 확정 완료)

| 항목 | 결정 |
|---|---|
| 모듈 이름 | **단일 `HktTerrain`** (HktCore/Terrain 이 이미 "Core" 역할). |
| HktCore/Terrain 생성기 위치 | **`HktTerrain` 으로 이관**. HktCore 는 데이터/상태/인터페이스만 보유, 생성에 관여하지 않음. |
| 베이크 미존재 폴백 | **런타임 동일 로직 생성 + 경고 로그**. 인자 부족 시 임의 기본값(시드/파라미터)으로 진행, 출처를 첫 호출 시 1회 로그. |
| 청크 압축 | oodle (UE 기본). |
| `HktVoxelSpriteTerrainActor` 폐기 | deprecated 1릴리스 후 제거. |
| 콘텐츠 redirector | 자동 fixup + 검증 빌드. |

### Phase 1 — `HktTerrain` 모듈 스켈레톤

1. `HktGameplay/Source/HktTerrain/{Public,Private}` 생성.
2. `HktTerrain.Build.cs` 작성 — Public deps: `Core, CoreUObject, Engine, HktCore`. Editor deps: `UnrealEd`(베이크용).
3. `HktGameplay.uplugin` 에 `HktTerrain` 모듈 항목 추가 (LoadingPhase: `Default`).
4. `IHktTerrainModule.h/.cpp` 빈 `IMPLEMENT_MODULE` + `DECLARE_LOG_CATEGORY_EXTERN(LogHktTerrain, Log, All)` (폴백 경고 로그용).
5. 빌드만 통과시키고 커밋 — "scaffold HktTerrain module".

### Phase 2 — HktCore/Terrain 생성기 이관 (단방향 의존 정립)

> 핵심 단계 — 다른 모든 단계의 전제. 결정론(FHktFixed32) 결과가 비트 단위로 동일해야 한다. 이관 전후 베이크 결과 해시 비교 테스트 필수.

1. **HktCore 에 인터페이스 신설**: `HktCore/Public/Terrain/HktTerrainDataSource.h`
   - `class IHktTerrainDataSource { virtual bool TryGetChunk(const FHktChunkCoord&, TArrayView<FHktTerrainVoxel> Out) const = 0; virtual bool TryGetSurfaceHeight(int32 X, int32 Y, FHktFixed32& OutZ) const = 0; ... }`
   - `FHktTerrainState` 가 보관하던 `FHktTerrainGenerator` 직접 참조를 `IHktTerrainDataSource*` 로 교체.
2. **이관 대상 파일** (HktCore → HktTerrain, namespace/symbol 이름 유지):
   - `HktCore/Public/Terrain/HktTerrainGenerator.h` + `.cpp`
   - `HktCore/Public/Terrain/HktTerrainNoise.h` + `.cpp`
   - `HktCore/Public/Terrain/HktTerrainBiome.h` + `.cpp`
   - `HktCore/Public/Terrain/HktAdvTerrainTypes.h`
   - `HktCore/Private/Terrain/HktAdvTerrainFill.{h,cpp}`
   - `HktCore/Private/Terrain/HktAdvTerrainLayers.{h,cpp}`
   - `HktCore/Private/Terrain/HktTerrainNoiseFloat.{h,cpp}`
3. **HktCore 에 잔류**:
   - `HktTerrainState.{h,cpp}`, `HktTerrainVoxel.h`, `HktTerrainVoxelDef.h`, `HktTerrainDestructibility.h`, `HktFixed32.h`, `HktTerrainDataSource.h`(신규).
4. **include 경로 갱신**: HktVoxelTerrain / HktLandscapeTerrain 의 `#include "Terrain/HktTerrainGenerator.h"` 등을 새 위치로.
5. **빌드 의존 갱신**: HktVoxelTerrain.Build.cs / HktLandscapeTerrain.Build.cs 에 `HktTerrain` 추가.
6. **결정론 검증 자동화 테스트**: 동일 시드 + 동일 ChunkCoord 에 대해 이관 전 brick(bytes) 과 이관 후 brick 의 SHA256 일치 확인. `HktGameplayDeveloper/HktAutomationTests` 카테고리 `HktTerrain.Migration.Determinism`.

### Phase 3 — 데이터 자산 + 베이크 파이프라인

1. `UHktTerrainBakedAsset (UDataAsset)`: 헤더(시드/버전/영역/`FHktTerrainGeneratorConfig`) + `TArray<FHktTerrainBakedChunk>` + 좌표→인덱스 맵.
2. `FHktTerrainBakedChunk`: `FHktChunkCoord` + 압축된 `TArray<uint8>` (FHktTerrainVoxel 시퀀스, oodle).
3. `UHktTerrainBakeLibrary` (BlueprintFunctionLibrary, Editor 전용): `BakeRegion(GeneratorConfig, ChunkRange, OutAssetPath)` — 내부에서 `FHktTerrainGenerator::GenerateChunk` 직접 호출.
4. 기존 `UHktVoxelTerrainBakeLibrary`(StyleSet 베이킹) 는 Phase 5 에서 이관.

### Phase 4 — 런타임 로더 + 서브시스템 + 폴백

1. `UHktTerrainSubsystem (UWorldSubsystem)`:
   - `LoadBakedAsset(SoftRef)` — 비동기 로드.
   - `AcquireChunk(Coord) → const FHktTerrainVoxel*` — baked 우선; 미스 시 `WARN` 로그 + `FHktTerrainGenerator::GenerateChunk` 폴백 + in-memory LRU 캐시.
   - `ReleaseChunk(Coord)`, `SamplePreview(Region)`.
   - 폴백 인자 결정 순서: `BakedAsset->GeneratorConfig` → `UHktRuntimeGlobalSetting::ToTerrainConfig()` → 컴파일 기본값. 첫 호출 시 출처 1회 로그.
2. `IHktTerrainChunkLoader` 인터페이스를 `HktVoxelTerrain` 에서 `HktTerrain` 으로 이관(이름도 `HktTerrainChunkLoader` 로 정규화). Legacy/Proximity 구현체도 함께 이동.
3. `FHktTerrainProvider`: `IHktTerrainDataSource` 구현체. `FHktVMWorldStateProxy` 를 받아 `SetPropertyDirty` 경유로 `FHktTerrainState::LoadChunk` 트리거. 시뮬레이션 부트업 시 HktCore 에 등록.

### Phase 5 — 스타일/팔레트 자산 정책 (부결, 잔류)

PR-C 진행 중 재검토 결과, 스타일 자산은 **렌더러별 모듈에 잔류**시키는 것이 맞다.

근거:
- `UHktVoxelTerrainStyleSet` 의 모든 멤버(`TileArray`, `NormalArray`, `TileMappings`(Top/Side/Bottom), `Materials`(per-face PBR))가 voxel face-meshing 파이프라인에 묶여있다 — 100% Voxel-specific.
- Sprite 경로는 빌보드/HISM 기반이라 `Side` 면 개념도 PBR per-face도 무의미. 별도 자산 구조(스프라이트 atlas slot, billboard scale variance, HISM mesh ref) 가 필요하다.
- 진짜 공용일 만한 메타(TypeID → 시맨틱 이름/걷기-가능 플래그) 는 이미 `FHktTerrainVoxelDef` (HktCore) 가 담당.

확정된 위치:
1. `UHktVoxelTerrainStyleSet` — `HktVoxelTerrain` 모듈 잔류. ApplyTo()는 멤버 메서드.
2. `UHktSpriteTerrainStyleSet` (PR-D) — `HktSpriteTerrain` 모듈에 신설. 데이터 구조는 sprite 렌더링 전용으로 별도 정의.
3. 콘텐츠 redirector 불요 (이름/경로 변경 없음).

### Phase 6 — `HktVoxelTerrain` 축소 리팩터

1. `AHktVoxelTerrainActor` 에서 `FHktTerrainGenerator GeneratorMember` 제거.
2. `BeginPlay` → `UHktTerrainSubsystem::Get(World)->LoadBakedAsset(BakedRef)`.
3. `GenerateAndLoadChunk()` 가 `Subsystem->AcquireChunk(buffer-out)` 호출 → `FHktVoxelRenderCache::LoadChunk` 로 전달.
4. 청크 로더 사용처를 `HktTerrain` 의 인터페이스로 갱신 (PR-D 의 Sprite 모듈 신설 시 일반화와 함께 처리).
5. 베이크 라이브러리(`UHktVoxelTerrainBakeLibrary`) 는 입력이 voxel-specific(`FHktVoxelBlockStyle`) 이므로 모듈 잔류, StyleSet 도 함께 잔류.

### Phase 7 — `HktSpriteTerrain` 신규 모듈

1. `HktGameplay/Source/HktSpriteTerrain/{Public,Private}` 생성.
2. `Build.cs` Public: `Core, CoreUObject, Engine, HktCore, HktSpriteCore, HktTerrain`.
3. `AHktVoxelSpriteTerrainActor` → `AHktSpriteTerrainActor` 로 이관.
4. RenderCache 의존 제거 → `UHktTerrainSubsystem` 에서 표면 셀 직접 추출(`ScanTopSurfaceFromBaked`).
5. HISM 컴포넌트 코드는 `HktSpriteCore` 헬퍼(`UHktSpriteCrowdRenderer`) 로 가능한 최대 위임.
6. `.uplugin` 모듈 항목 추가.
7. 기존 `AHktVoxelSpriteTerrainActor` 는 deprecated 표시 + 1 릴리스 유지 후 제거.

### Phase 8 — `HktLandscapeTerrain` 정리

1. `FHktTerrainGenerator::SamplePreviewRegion` 직접 호출 → `UHktTerrainSubsystem::SamplePreview` 경유로 변경.
2. baked asset 이 있으면 baked 에서 우선 추출하도록 폴백 분기(같은 정책).

### Phase 9 — VM 통합 점검 (절대원칙 검증)

1. `FHktTerrainProvider` 의 모든 쓰기가 `FHktVMWorldStateProxy::SetPropertyDirty` 경유인지 검증(grep).
2. HktCore 에 신규 UObject 의존이 누설되지 않았는지 확인 (`HktCore/**` 안에서 `UObject`/`UWorld` 패턴 0건 유지).
3. HktCore 가 `HktTerrain` 헤더를 include 하지 않는지 확인(역방향 의존 차단).
4. `WITH_HKT_INSIGHTS` 트레이스 포인트 추가: 베이크 로드 시간, 청크 acquire latency, 폴백 호출 횟수.

### Phase 10 — 문서/CLAUDE.md

1. 루트 `CLAUDE.md` 의 모듈 표에 `HktTerrain`, `HktSpriteTerrain` 추가.
2. `HktGameplay/CLAUDE.md` 의존 그래프 갱신 (HktCore → 생성기 항목 제거, HktTerrain 신설).
3. 신규 모듈 각각 `CLAUDE.md` 1쪽씩(데이터 흐름, 베이크 명령, 폴백 정책, 트러블슈팅).

## 위험/결정 사항 (Phase 0 확정 결과)

| 항목 | 결정 | 근거 |
|---|---|---|
| HktCore/Terrain 이관 범위 | **생성기는 이관, 데이터/상태/인터페이스는 유지** | 사용자 결정 — HktCore 는 생성에 관여하지 않음. |
| 모듈 분리 단위 | **단일 `HktTerrain`** | 중복 회피, HktCore/Terrain 잔류부가 사실상 "Core" 역할. |
| 베이크 미존재 폴백 | **런타임 동일 로직 생성 + 경고 로그** | 사용자 결정 — 결과 동일성(결정론) 유지, 누락 영역 추적. |
| 폴백 인자 부족 시 | `BakedAsset->GeneratorConfig` → `UHktRuntimeGlobalSetting::ToTerrainConfig()` → 컴파일 기본값. 출처 1회 로그. | 사용자 결정 — "임의로 줄 것". |
| 청크 압축 | oodle (UE 기본) | 표준 경로. |
| `HktVoxelSpriteTerrainActor` 폐기 | deprecated 1릴리스 후 제거 | 외부 콘텐츠 referencer 안전 마이그레이션. |
| 콘텐츠 redirector | 자동 fixup + 검증 빌드 | 휴먼 에러 차단. |
| 결정론 회귀 위험 | Phase 2 자동화 테스트 (SHA256 비교) | 이관이 알고리즘 결과를 바꾸지 않음을 보장. |

## 우선순위 / 시퀀싱 (PR 단위)

| PR | 포함 Phase | 영향 |
|---|---|---|
| PR-A | Phase 1, 2 | 모듈 스켈레톤 + **생성기 이관** (가장 위험, 단독 PR). 기존 동작은 라우팅만 변경. |
| PR-B | Phase 3, 4 | 베이크 자산 + 서브시스템 + 폴백. 기존 코드 영향 없음(추가만). |
| PR-C | Phase 5(부결), 6 | VoxelTerrain 새 경로 전환 + Subsystem-aware Provider wiring. 스타일 자산은 렌더러별 모듈 잔류로 부결. |
| PR-D | Phase 7 | SpriteTerrain 신규 모듈. |
| PR-E | Phase 8, 9, 10 | Landscape 정리 + VM 점검 + 문서. |

## 참고 — 현재 코드 위치

| 심볼 | 현재 경로 | 이관 후 경로 |
|---|---|---|
| `FHktTerrainGenerator` | `HktCore/Public/Terrain/HktTerrainGenerator.h` | **`HktTerrain/Public/HktTerrainGenerator.h`** |
| `FHktTerrainNoise` | `HktCore/Public/Terrain/HktTerrainNoise.h` | **`HktTerrain/Public/HktTerrainNoise.h`** |
| `FHktTerrainBiome` | `HktCore/Public/Terrain/HktTerrainBiome.h` | **`HktTerrain/Public/HktTerrainBiome.h`** |
| `FHktAdvTerrain*` | `HktCore/Public/Terrain/HktAdvTerrainTypes.h` 외 | **`HktTerrain/Public/`** |
| `FHktTerrainState` | `HktCore/Public/Terrain/HktTerrainState.h` | (유지) |
| `FHktTerrainVoxel` | `HktCore/Public/Terrain/HktTerrainVoxel.h` | (유지) |
| `FHktTerrainVoxelDef` | `HktCore/Public/Terrain/HktTerrainVoxelDef.h` | (유지) |
| `FHktTerrainDestructibility` | `HktCore/Public/Terrain/HktTerrainDestructibility.h` | (유지) |
| `FHktFixed32` | `HktCore/Public/Terrain/HktFixed32.h` | (유지) |
| `IHktTerrainDataSource` | — | **`HktCore/Public/Terrain/HktTerrainDataSource.h`** (신규) |
| `AHktVoxelTerrainActor` | `HktVoxelTerrain/Public/HktVoxelTerrainActor.h` | (유지, 내용 축소) |
| `AHktVoxelSpriteTerrainActor` | `HktVoxelTerrain/Public/HktVoxelSpriteTerrainActor.h` | **`HktSpriteTerrain/Public/HktSpriteTerrainActor.h`** (이관 + 리네임) |
| `UHktVoxelChunkLoader` | `HktVoxelTerrain/Public/HktVoxelChunkLoader.h` | **`HktTerrain/Public/HktTerrainChunkLoader.h`** |
| `UHktVoxelTerrainStyleSet` | `HktVoxelTerrain/Public/HktVoxelTerrainStyleSet.h` | (유지 — Voxel-specific 데이터, 부결) |
| `UHktVoxelTerrainBakeLibrary` | `HktVoxelTerrain/Public/HktVoxelTerrainBakeLibrary.h` | (유지 — 입력이 voxel-specific). 청크 베이크는 **`HktTerrain/Public/HktTerrainBakeLibrary.h`** |
| `FHktVoxel` / `FHktVoxelChunk` | `HktVoxelCore/Public/HktVoxelTypes.h` | (유지) |
| `FHktVoxelRenderCache` | `HktVoxelCore/Public/HktVoxelRenderCache.h` | (유지) |
| `AHktLandscapeTerrainActor` | `HktLandscapeTerrain/Public/HktLandscapeTerrainActor.h` | (유지, Subsystem 사용) |
