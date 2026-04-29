# HktSpriteTerrain — 스프라이트 기반 지형 렌더러

`UHktTerrainSubsystem` 단일 출처에서 청크 데이터를 받아 top-surface 셀을 추출하고, 단일 HISM 컴포넌트에 청크당 1 인스턴스로 매핑한다. Voxel 메싱 파이프라인 의존이 없어 Sprite-only 배포에서 단독 동작한다.

상위 가이드: [../../CLAUDE.md](../../CLAUDE.md). 지형 데이터 흐름: [../HktTerrain/CLAUDE.md](../HktTerrain/CLAUDE.md).

## 모듈 경계

- **의존**: `Core, CoreUObject, Engine, HktCore, HktSpriteCore, HktTerrain` (Public).
- **HktVoxelCore 의존 없음** — `FHktVoxelRenderCache` / Greedy meshing 우회. 청크 voxel 버퍼를 직접 스캔.
- **단방향**: HktSpriteTerrain → HktTerrain → HktCore.

## 핵심 타입

| 심볼 | 위치 | 역할 |
|---|---|---|
| `AHktSpriteTerrainActor` | `Public/HktSpriteTerrainActor.h` | 메인 액터. HISM 컴포넌트 + 청크 스트리밍 + 표면 셀 추출. |
| `FHktSpriteTerrainSurfaceCell` | (동) | 청크당 1 셀 (`ChunkCoord, WorldPos, TypeID, PaletteIndex, Flags`). |

## 데이터 흐름

```
Tick(DeltaSeconds)
  → IHktTerrainChunkLoader::Update(CameraPos)
       — Legacy: 단일 반경 / Proximity: 근/원 2링
  → For each visible chunk Coord:
       UHktTerrainSubsystem::AcquireChunk(Coord, ChunkVoxelScratch)
         — baked-first / Generator 폴백 (Subsystem 정책)
       → ExtractTopSurfaceCell(buffer)  # top-most non-empty voxel
       → Diff vs InstanceMap:
            · 신규  → AddInstance + SetCustomData
            · 변경  → UpdateInstanceTransform / SetCustomDataValue
            · 사라짐 → RemoveInstance (스왑 보정 + InstanceCoordByIndex 갱신)
```

`ChunkVoxelScratch` 는 멤버 풀 (32768 voxel × 4B = 128KB) — 매 청크마다 재할당하지 않는다.

## HISM 머티리얼 스펙

- **Mesh**: 1×1 unit quad, Z-up (지면에 누운 평면).
- **Material**: `M_HktSpriteTerrainBillboard` (Z-up quad, ground 평면). HktSpriteCore 의 `M_HktSpriteYBillboard` (Y-axis billboard, 캐릭터 직립) 와 별개.
- **PerInstanceCustomData (NumCustomDataFloats=16)**:

| slot | 용도 | 본 액터에서 |
|---|---|---|
| 0 | AtlasIdx | `cell.TypeID` |
| 1 | CellW | `CellSizePx.X` |
| 2 | CellH | `CellSizePx.Y` |
| 3 | reserved | 0 |
| 4 | OffX | 0 |
| 5 | OffY | 0 |
| 6 | RotR | 0 (iso 고정) |
| 7 | ScaleX | `ChunkWorldSize / 2` |
| 8 | ScaleY | `ChunkWorldSize / 2` |
| 9~12 | Tint RGBA | Flags 기반 보조 (TRANSLUCENT alpha 0.6 등) |
| 13 | PaletteIndex | `cell.PaletteIndex` |
| 14 | FlipV | 0 |
| 15 | ZBias | `ComponentZBias` (cm; CrowdRenderer 와 동일 슬롯) |

## Crowd 와의 Depth 정렬

Sprite Crowd (캐릭터, Y-axis 직립) 와의 z-fighting 은 ComponentZBias 로 해소:

| 컴포넌트 | ComponentZBias |
|---|---|
| Terrain (본 액터) | 0 (베이스라인) |
| Crowd (캐릭터) | +1cm 권장 |

값이 양수일수록 카메라 쪽 (= 다른 액터 앞). 머티리얼 WPO 가 cm 만큼 밀어내며 depth-buffer 에 반영된다.

## 단일 BakedAsset 정책

한 World 에 단일 `UHktTerrainBakedAsset` 인스턴스. VoxelTerrainActor 와 함께 배치 시 어느 한 쪽이 `Sub->LoadBakedAsset` 호출하면 충분 (가장 최근 호출이 우선).

`BakedAsset` 미할당 / 로드 영역 밖 청크는 런타임 폴백 (`FHktTerrainGenerator`) 으로 동일하게 생성된다 — 결정론 보장.

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `[SpriteTerrain] UHktTerrainSubsystem 없음 — Tick 무동작` | World 타입이 Subsystem 생성 정책 (`Game/PIE/Editor`) 외. 액터 배치 위치 확인. |
| Crowd 가 Terrain 뒤로 가려짐 | `ComponentZBias` 비교 — Crowd 가 더 작거나 같으면 z-fight. Crowd 를 +1cm 이상 띄울 것. |
| `LastCellByCoord` 만 갱신되고 인스턴스 안 보임 | `TerrainMaterial` 미할당 또는 `QuadMesh` 미할당. UPROPERTY 점검. |
| 인스턴스가 청크 경계에서 깜빡임 | `MaxScansPerSecond` 가 너무 낮거나, `StreamRadius` 가 카메라 이동 속도 대비 부족. |
| 청크가 화면에 들어왔는데 늦게 추가됨 | `MaxLoadsPerFrame` 증가. 단, 메인스레드 비용 ↑ — 프로파일링 필수. |

## Deprecated 마이그레이션

`AHktVoxelSpriteTerrainActor` (HktVoxelTerrain) 는 deprecated. 외부 콘텐츠 referencer 를 위한 1릴리스 유예 후 제거 예정. 신규 콘텐츠는 본 액터를 사용할 것.

## 변경 시 체크리스트

- [ ] 표면 추출 알고리즘 변경 → ChunkVoxelScratch 가 32768 element 로 유지되는지 확인 + 결정론 영향 검토
- [ ] HISM CustomData 슬롯 수정 → 본 문서 표 + 머티리얼 (M_HktSpriteTerrainBillboard) 동기 갱신
- [ ] ChunkWorldSize 산출 변경 → `ComputeChunkWorldSize` 가 effective config 와 일치하는지 검증
- [ ] ComponentZBias 정책 변경 → CrowdRenderer 와의 정렬 매트릭스 재테스트
