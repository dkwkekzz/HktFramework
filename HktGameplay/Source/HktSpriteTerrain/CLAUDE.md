# CLAUDE.md — HktSpriteTerrain

`UHktTerrainSubsystem` 청크 데이터에서 표면 voxel 들을 추출해 SC1 / SC 맵 에디터 방식의 iso 스프라이트(voxel 1개 = upright Y-billboard quad 1장)로 단일 HISM 에 렌더. Voxel 메싱 의존 없음. 상세 (HISM 슬롯 매핑, 트러블슈팅): [README.md](README.md).

## 절대 제약

1. **Subsystem 경유 강제** — 직접 `FHktTerrainGenerator` 인스턴스화 금지.
2. **HktVoxelCore 의존 없음** — `FHktVoxelRenderCache` 우회. AcquireChunk 결과를 직접 스캔.
3. **HktSpriteCore 비의존** — 머티리얼 / CPD 슬롯 규약 (M_HktSpriteYBillboard) 만 공유.
4. **단방향**: HktSpriteTerrain → HktTerrain → HktCore.
5. **단일 BakedAsset** — Voxel/Sprite Actor 가 동일 자산 공유 (한 World 단일 인스턴스).

## 핵심 진입점

- `AHktSpriteTerrainActor::Tick` — 매 프레임 fallback wireframe (`DrawFallbackWireframes`) + throttle 된 chunk load/unload.
- `FHktSpriteTerrainSurfaceCell` — 표면 voxel 1개 (`ChunkCoord, LocalCoord, WorldPos, TypeID, PaletteIndex, Flags`). v1 은 (LX, LY) 별 topmost-exposed solid voxel.
- `ChunkVoxelScratch` / `AboveChunkVoxelScratch` — 멤버 풀 (각 128KB).
- `InitSpriteMode` — Sprite mode HISM/머티리얼/Atlas 바인딩. Fallback mode 는 BeginPlay 에서 HISM 비활성화만.
- `LoadedSurfaceCells` — Fallback mode 가 청크 별 cell 캐시 (DrawDebugBox 가 매 Tick 순회).
- `GetFallbackTypeColor` (cpp 무명 ns) — HktAdvTerrainType 33 ID → FColor 매핑 테이블.

## Depth 정렬

Crowd (캐릭터) 와 z-fight 방지 — Terrain `ComponentZBias=0` (베이스라인), Crowd 는 +1cm 이상. 머티리얼 WPO 가 cm 단위로 카메라 쪽으로 밀어 depth-buffer 에 반영.

## 변경 시

- HISM CustomData 슬롯 수정 → README 표 + 머티리얼 (`M_HktSpriteYBillboard`) 동기 갱신.
- 표면 추출 알고리즘 변경 → 결정론 영향 검토.
- 폴백 컬러 테이블 변경 → README 매핑 요약 / Troubleshooting 표 동기.
- 신규 `HktAdvTerrainType` 추가 시 → `GetFallbackTypeColor` 테이블 확장 (안 하면 마젠타 표시).

`AHktVoxelSpriteTerrainActor` (HktVoxelTerrain) 는 deprecated — 1 릴리스 유예 후 제거.
