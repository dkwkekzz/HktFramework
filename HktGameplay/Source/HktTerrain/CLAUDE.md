# CLAUDE.md — HktTerrain

지형 데이터의 **단일 출처**. Voxel/Sprite/Landscape 3개 렌더 경로와 HktCore 시뮬레이션이 본 모듈을 경유한다. 상세: [README.md](README.md).

## 절대 제약

1. **HktCore → HktTerrain 의존 금지**. HktCore 는 `IHktTerrainDataSource` 인터페이스(잔류) 만 본다.
2. **HktRuntime 의존 금지**. ProjectSettings Config 는 호출자가 `SetFallbackConfig` 로 주입.
3. **외부에서 `FHktTerrainGenerator` 직접 인스턴스화 금지**. 항상 `UHktTerrainSubsystem` 경유.
4. **결정론**: 모든 노이즈/혼합은 `FHktFixed32` (Q16.16). 베이크 ≡ 폴백 Generator 결과 (비트 단위).

## 핵심 진입점

- `UHktTerrainSubsystem::AcquireChunk(Coord, OutBuf)` — baked-first → Generator 폴백 → LRU 캐시.
- `UHktTerrainSubsystem::SamplePreview(Min, W, H, Region)` — 2D 하이트/바이옴 (Landscape).
- `UHktTerrainSubsystem::SetFallbackConfig(Cfg)` — GameMode/Actor 가 BeginPlay/InitGame 에서 주입.
- `FHktTerrainProvider` — `IHktTerrainDataSource` 구현체. GameMode 가 `SetTerrainSource` 로 시뮬레이터에 주입.
- `UHktTerrainBakeLibrary::BakeRegion` (Editor) — `.uasset` 산출.

## 폴백 Config 우선순위

`BakedAsset->GeneratorConfig` → `InjectedFallbackConfig` → `FHktTerrainGeneratorConfig{}` (컴파일 기본값). 첫 폴백 호출 시 출처 1회 INFO 로그.

## Insights

`ENABLE_HKT_INSIGHTS=1` 에서 `Terrain.Subsystem` 카테고리 노출 — 키 정의는 [README.md](README.md#insights).

## 변경 시

- 알고리즘 수정 → `UHktTerrainBakedAsset::CurrentBakeVersion` +1 + 자산 재베이크.
- `IHktTerrainDataSource` 확장 → HktCore 호출부(`FHktTerrainState::LoadChunk`) + 모든 구현체 동기 갱신.
