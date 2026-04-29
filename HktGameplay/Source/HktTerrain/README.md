# HktTerrain — README

지형 데이터의 생성 / 베이크 / 스트리밍을 담당하는 모듈. Voxel·Sprite·Landscape 3개 렌더 경로가 본 모듈을 경유해 동일한 청크 데이터를 공유한다. HktCore 는 본 모듈을 통해서만 청크를 소비한다 (`IHktTerrainDataSource` 인터페이스).

상위 가이드: [../../CLAUDE.md](../../CLAUDE.md). 절대 원칙: [../../../CLAUDE.md](../../../CLAUDE.md).

## 모듈 경계

- **의존**: `Core, CoreUObject, Engine, HktCore` (Public). Editor: `UnrealEd` (베이크 라이브러리).
- **의존하지 않음**: `HktRuntime` (역의존 차단). `UHktRuntimeGlobalSetting` 기반 Config 는 호출자(GameMode, Voxel/Landscape Actor)가 `SetFallbackConfig` 로 주입.
- **HktCore → HktTerrain 의존 금지**. `HktCore` 는 `IHktTerrainDataSource` 만 보며, 본 모듈의 헤더를 include 해서는 안 된다.

## 핵심 타입

| 심볼 | 위치 | 역할 |
|---|---|---|
| `UHktTerrainSubsystem` | `Public/HktTerrainSubsystem.h` | UWorldSubsystem. 청크 데이터 단일 출처. baked-first + 폴백 정책, LRU 캐시. |
| `UHktTerrainBakedAsset` | `Public/HktTerrainBakedAsset.h` | 청크별 oodle 압축 voxel 블롭 + `FHktTerrainBakedConfig` (시드/파라미터 캡처) + `RegionMin/Max`. |
| `FHktTerrainBakedChunk` | (동) | `FIntVector` 좌표 + 압축 바이트 + uncompressed size. |
| `UHktTerrainBakeLibrary` | `Public/HktTerrainBakeLibrary.h` | Editor 전용. `BakeRegion(Config, ChunkRange)` 호출로 .uasset 산출. |
| `FHktTerrainProvider` | `Public/HktTerrainProvider.h` | `IHktTerrainDataSource` 구현. Subsystem `WeakObjectPtr` 보유. GameMode 가 시뮬레이터에 주입. |
| `FHktTerrainGenerator` | `Public/HktTerrainGenerator.h` | 결정론적 청크 생성기 (FBM + RidgedMulti + 바이옴). 외부 직접 사용 금지 — 항상 Subsystem 경유. |
| `IHktTerrainChunkLoader` | `Public/HktTerrainChunkLoader.h` | 카메라 좌표 기반 청크 요청 큐 인터페이스 (Voxel/Sprite Actor 가 사용). |

## 데이터 흐름

### 베이크 (Editor)

```
UHktTerrainBakeLibrary::BakeRegion(Config, ChunkRange)
  → FHktTerrainGenerator::GenerateChunk(ChunkX, ChunkY, ChunkZ, OutVoxels)
  → oodle 압축 → FHktTerrainBakedChunk
  → UHktTerrainBakedAsset.Chunks 누적 + GeneratorConfig 캡처
  → 패키지 저장 (.uasset)
```

### 런타임 청크 요청

```
AHktVoxelTerrainActor / AHktSpriteTerrainActor
  → IHktTerrainChunkLoader::Update(CameraPos)
  → UHktTerrainSubsystem::AcquireChunk(Coord, OutVoxels)
       ├─ 캐시 적중 → memcpy
       ├─ BakedAsset 적중 → TryDecompressChunk → memcpy + LRU 등록
       └─ 폴백 → EnsureFallbackGenerator → GenerateChunk + 경고 로그 + LRU 등록
  → 호출자(렌더러) 가 자기 표현으로 변환
```

### VM 주입 (시뮬레이션)

```
AHktGameMode::InitGame
  → UHktTerrainSubsystem::SetFallbackConfig(SettingsCfg)   # ProjectSettings 주입
  → RebindTerrainProvider()
       → SetTerrainSource(MakeUnique<FHktTerrainProvider>(Sub, EffectiveCfg))
  → OnEffectiveConfigChanged 델리게이트 등록 (BakedAsset 로드 후 자동 재바인딩)

시뮬레이션 프레임:
  FHktTerrainSystem::Process
    → TerrainState.LoadChunk(Coord, Provider)
       → FHktTerrainProvider::GenerateChunk → Sub->AcquireChunk → 호출자 버퍼 채움
```

`FHktTerrainProvider::GenerateChunk` 는 **const** — VM property 에 쓰지 않는다. 시뮬레이션 측 청크 캐시(`FHktTerrainState::LoadedChunks`)는 VM property 와 독립된 저장소이며, 절대원칙 4 의 `SetPropertyDirty` 대상이 아니다.

## 폴백 Config 우선순위

`UHktTerrainSubsystem::GetEffectiveConfig()` 의 결정 순서:

1. `BakedAsset->GeneratorConfig.ToConfig()` — 베이크된 자산의 캡처 Config
2. `InjectedFallbackConfig` — 호출자(GameMode, Landscape Actor)가 `SetFallbackConfig` 로 주입한 Config
3. `FHktTerrainGeneratorConfig{}` — 컴파일 기본값

폴백 발동 시 첫 호출에서 `LogFallbackOriginOnce` 가 출처를 1회 INFO 로그. 이후 폴백 호출마다 `LogHktTerrain Warning` 으로 누락 청크 좌표를 추적.

## 결정론 보장

- 모든 노이즈/혼합 연산은 `FHktFixed32` (Q16.16 고정소수점). 부동소수점 비결정성 차단.
- 동일 시드 + 동일 Config + 동일 ChunkCoord ⇒ 비트 단위 동일 결과.
- 베이크 결과와 폴백 Generator 결과는 비트 단위 일치한다 (Phase 2 SHA256 회귀 테스트).
- `UHktTerrainBakedAsset::CurrentBakeVersion` — 알고리즘 변경 시 +1 후 자산 재베이크 강제.

## Insights

`ENABLE_HKT_INSIGHTS=1` 빌드 (HktCore Build.cs 가 비-Shipping 에서 자동 정의) 에서 `Terrain.Subsystem` 카테고리에 다음 키를 노출한다 (HktGameplayDeveloper 인사이트 패널이 표시):

| 키 | 의미 |
|---|---|
| `BakedAsset` | 현재 로드된 자산 이름 또는 `None` |
| `BakedHits` | BakedAsset 디컴프레스로 채워진 청크 누계 |
| `FallbackHits` | Generator 폴백으로 채워진 청크 누계 |
| `CacheHits` | LRU 캐시 적중 누계 |
| `CacheSize` | 현재 LRU 보유 청크 수 (`MaxCachedChunks` 기본 256) |
| `LastBakeLoad` | 마지막 `LoadBakedAsset(Sync)` 소요 시간 (ms) |
| `LastAcquire` | 마지막 `AcquireChunk` latency (us) |
| `FallbackOrigin` | `BakedAsset` / `Injected` / `CompileDefault` |

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `Chunk (X,Y,Z) 베이크 미존재 — 런타임 생성 폴백` | 정상 — 폴백은 결정론적으로 동일 결과를 낸다. 누락 영역이 의도된 게임 영역인지 확인. 의도되었다면 `UHktTerrainBakeLibrary::BakeRegion` 으로 영역 확장. |
| `Terrain fallback Config 출처: CompileDefault (...)` | `SetFallbackConfig` 가 호출되지 않았다. GameMode `InitGame` 또는 Landscape Actor `BeginPlay` 에서 주입 누락. |
| `LoadBakedAsset: 비동기 로드 실패` | SoftRef 가 가리키는 `.uasset` 가 패키지 누락. ContentBrowser 에서 자산 존재 + 의존성 확인. 또는 PIE 시작 직전 `LoadBakedAssetSync` 로 회피. |
| `AcquireChunk: 출력 버퍼 크기 N != 기대값 32768` | 호출자 버그. `OutVoxels.Num() == GetVoxelsPerChunk()` 보장 후 호출. |
| `UHktTerrainSubsystem 부재 — Landscape 생성을 건너뜁니다` | World 타입이 `Game/PIE/Editor` 가 아님 (Preview/Inactive). `ShouldCreateSubsystem` 정책. |

## 단일 BakedAsset 정책

한 World 에 단일 인스턴스. 여러 Actor 가 `LoadBakedAsset` 을 호출하면 가장 최근 호출이 우선. **단일 VoxelTerrainActor 배치 권장**. Sprite/Landscape Actor 는 동일 BakedAsset 을 공유하도록 설정 (단일 출처 보장).

## 변경 시 체크리스트

- [ ] `FHktTerrainGenerator` 알고리즘 변경 → `CurrentBakeVersion` +1, 회귀 테스트 갱신
- [ ] 신규 폴백 Config 출처 추가 → `GetEffectiveConfig` 우선순위 + `LogFallbackOriginOnce` 라벨 갱신
- [ ] Insights 키 추가 → 본 문서 표 갱신, HktGameplayDeveloper 패널과 키 이름 동기화
- [ ] `IHktTerrainDataSource` 인터페이스 확장 → HktCore 측 호출부(`FHktTerrainState::LoadChunk`) 와 모든 구현체 동기 갱신
