# CLAUDE.md — HktSpriteTerrain

`UHktTerrainSubsystem` 청크 데이터에서 top-surface 셀을 추출해 단일 HISM 으로 렌더. Voxel 메싱 의존 없음. 상세 (HISM 슬롯 매핑, 트러블슈팅): [README.md](README.md).

## 절대 제약

1. **Subsystem 경유 강제** — 직접 `FHktTerrainGenerator` 인스턴스화 금지.
2. **HktVoxelCore 의존 없음** — `FHktVoxelRenderCache` 우회. AcquireChunk 결과를 직접 스캔.
3. **단방향**: HktSpriteTerrain → HktTerrain → HktCore.
4. **단일 BakedAsset** — Voxel/Sprite Actor 가 동일 자산 공유 (한 World 단일 인스턴스).

## 핵심 진입점

- `AHktSpriteTerrainActor::Tick` — 카메라 좌표 → ChunkLoader → AcquireChunk → ExtractTopSurfaceCell → HISM diff.
- `FHktSpriteTerrainSurfaceCell` — 청크당 1 셀 (`ChunkCoord, WorldPos, TypeID, PaletteIndex, Flags`).
- `ChunkVoxelScratch` — 멤버 풀 (32768 voxel × 4B = 128KB), 매 호출 재할당 금지.

## Depth 정렬

Crowd (캐릭터) 와 z-fight 방지 — Terrain `ComponentZBias=0` (베이스라인), Crowd 는 +1cm 이상. 머티리얼 WPO 가 cm 단위로 카메라 쪽으로 밀어 depth-buffer 에 반영.

## 변경 시

- HISM CustomData 슬롯 수정 → README 표 + 머티리얼 (`M_HktSpriteTerrainBillboard`) 동기 갱신.
- 표면 추출 알고리즘 변경 → 결정론 영향 검토.

`AHktVoxelSpriteTerrainActor` (HktVoxelTerrain) 는 deprecated — 1 릴리스 유예 후 제거.
