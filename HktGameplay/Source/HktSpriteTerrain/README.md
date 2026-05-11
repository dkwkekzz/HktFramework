# HktSpriteTerrain — README

`UHktTerrainSubsystem` 단일 출처에서 청크 데이터를 받아 표면 voxel 들을 추출하고, 단일 HISM 컴포넌트에 voxel 1개 = upright Y-billboard quad 1장으로 매핑한다. StarCraft1 / SC 맵 에디터의 iso 타일 방식을 따른다. Voxel 메싱 파이프라인 의존이 없어 Sprite-only 배포에서 단독 동작한다.

상위 가이드: [../../CLAUDE.md](../../CLAUDE.md). 지형 데이터 흐름: [../HktTerrain/README.md](../HktTerrain/README.md).

## 모듈 경계

- **의존**: `Core, CoreUObject, Engine, HktCore, HktTerrain` (Public).
- **HktVoxelCore 의존 없음** — `FHktVoxelRenderCache` / Greedy meshing 우회. 청크 voxel 버퍼를 직접 스캔.
- **HktSpriteCore 비의존** — 머티리얼 / CPD 슬롯 규약 (M_HktSpriteYBillboard) 만 공유 (param 이름 하드코딩).
- **단방향**: HktSpriteTerrain → HktTerrain → HktCore.

## 렌더 방식 (v1 — SC-tile + 3-Face fallback)

두 가지 모드:

| 모드 | 조건 | 렌더 |
|---|---|---|
| **Sprite** | `AtlasTexture` 할당됨 | voxel 당 upright Y-billboard quad 1장. 화가가 그린 iso voxel sprite (마름모 top + 측면 통합 PNG) art 가 carry. |
| **Fallback** | `AtlasTexture=null` + `bUseFallbackColors=true` | voxel 당 axis-aligned face quad 3장 (top +Z, left -X, right -Y). TypeID 별 base color × 면별 음영 (Top 1.00 / Right 0.78 / Left 0.58). 런타임 생성 unlit emissive 머티리얼. |
| (no render) | `AtlasTexture=null` + `bUseFallbackColors=false` | 인스턴스 emit 안 함. |

Mode 는 BeginPlay 1회 결정 — 런타임 스왑 안 됨.

카메라는 `HktCameraMode_IsometricOrtho` (pitch −30, yaw 45) 고정 — Fallback mode 의 axis-aligned face quad 들이 이 각도에서 자연스럽게 마름모 + 평행사변형으로 투영된다.

청크당 voxel 수: 최대 ChunkSize² = 1024. Fallback mode 는 인스턴스 3배 (3072 / 청크) — 청크 1개당 HISMFallbackTop/Left/Right 에 각 1024.

## 핵심 타입

| 심볼 | 위치 | 역할 |
|---|---|---|
| `AHktSpriteTerrainActor` | `Public/HktSpriteTerrainActor.h` | 메인 액터. HISM + 청크 스트리밍 + 표면 voxel 추출. |
| `FHktSpriteTerrainSurfaceCell` | (동) | 표면 voxel 1개 (`ChunkCoord, LocalCoord, WorldPos, TypeID, PaletteIndex, Flags`). |

## 데이터 흐름

```
Tick(DeltaSeconds)
  → IHktTerrainChunkLoader::Update(CameraPos)
       — Legacy: 단일 반경 / Proximity: 근/원 2링
  → For each ChunksToUnload:
       RemoveInstancesForChunk(Coord)   # HISM RemoveInstance × N + swap remap
  → For each ChunksToLoad:
       UHktTerrainSubsystem::AcquireChunk(Coord, ChunkVoxelScratch)
         — baked-first / Generator 폴백 (Subsystem 정책)
       → ExtractSurfaceCells(buffer, OutCells[])
            · (LX, LY) 별 topmost solid voxel
            · +Z 노출 판정: 같은 청크 안 or 위 청크 (LX, LY, 0) 비어 있어야 함
       → AddInstancesForChunk(cells)    # HISM AddInstance × N + CPD 채움
```

`ChunkVoxelScratch` (128KB) / `AboveChunkVoxelScratch` (128KB, lazy) / `SurfaceCellsScratch` 는 멤버 풀로 재사용 — 매 청크 재할당하지 않는다.

v1 은 청크 in-place 갱신 없음 — 지형 정적 가정. 청크는 streaming in/out 시에만 add/remove.

## Sprite / Atlas 텍스처 규약

**Voxel 1개를 한 sprite cell 에 통째로 그린다** — 마름모 top + 좌·우 측면 + 임의 장식 (풀잎, 이끼, 결정 광택, 잎사귀 등).

- Atlas 그리드 레이아웃: **가로 = TypeID 슬롯, 세로 = 애니메이션 프레임** (v1 은 frame 1개)
- 기본 4224×128 = 33 TypeID × 1 frame, 셀당 128×128 px
- **셀당 art 규약**:
  - Pivot: cell 하단-중앙 (= voxel 의 바닥-중앙과 일치)
  - 폭: iso 마름모 양 끝 (sprite cell 폭에 맞춰)
  - 높이: 마름모 최상단부터 기둥 바닥까지
  - 빈 공간: 마름모 양 옆/위는 투명 OK (sprite 가 cell 의 일부만 차지해도 무방)

`PixelToWorld` (기본 0.166) = (VoxelSize × √2) / CellW. voxel 큐브 한 변의 iso 가로 투영이 cell 폭에 맞아 들어가는 값. art / VoxelSize / CellSizePx 변경 시 재튜닝.

### Fallback 컬러 face quad (`bUseFallbackColors`)

`AtlasTexture` 가 **null** 이고 `bUseFallbackColors=true` (기본) 인 경우, BeginPlay 에서 fallback mode 로 진입. voxel 의 보이는 3면을 axis-aligned 평면 quad 로 직접 색칠한다 — 텍스처 픽셀 페인팅 없음. Sprite 픽셀 art 보다 단순 / 명확.

```
        TOP  (+Z, axis-aligned 수평 quad, identity rotation)
       /    \
      /      \             각 면이 별도 HISM 인스턴스:
     ╲   ◇   ╱             - HISMFallbackTop   (voxel 윗면)
      ╲     ╱              - HISMFallbackLeft  (voxel -X 면)
   ┌───┴───┴───┐           - HISMFallbackRight (voxel -Y 면)
   │ L ╲   ╱ R │
   │   ╲ ╱   │             면별 transform 으로 axis-aligned 배치,
   │   ╳ ╲   │             iso ortho 카메라가 자연스럽게 마름모+
   │  ╱   ╲   │             평행사변형으로 투영.
   └─────────┘
```

**면별 음영** (단일 광원 NE 상부 가정 — 전형적 iso pixel-art 톤):
- Top   = base × 1.00
- Right = base × 0.78
- Left  = base × 0.58

**TypeID 별 base color**: `HktAdvTerrainType` 33 ID 매핑 (Grass=초록, Water=파랑, OreGold=금색 등). 등록 안 된 TypeID 는 마젠타 (FF00FF) — 신규 type 추가 시 즉시 시각 식별. 정의: `Private/HktSpriteTerrainActor.cpp` 의 `GetFallbackTypeColorLinear`.

**머티리얼**: BeginPlay 에서 자동 생성 (`GetFallbackFaceMaterial`) — Unlit / TwoSided / Opaque, PerInstanceCustomData[9..11] (R, G, B) 을 Emissive 로 직접 출력. **Editor 빌드 전용** — Shipping 빌드에선 엔진 기본 머티리얼로 폴백 (색 안 나옴). Fallback 은 dev 용도이므로 Shipping 에선 정식 art 사용 가정.

**면별 인스턴스 transform** (voxel bottom-center = (Wx, Wy, Wz), 크기 S):

| 면 | Rotation | Position | Scale |
|---|---|---|---|
| Top   | `FRotator::ZeroRotator`        | `(Wx, Wy - S/2, Wz + S)`     | `(S, S, S)` |
| Left  | `FRotator(-90, 0, 0)` (pitch)  | `(Wx - S/2, Wy - S/2, Wz + S/2)` | `(S, S, S)` |
| Right | `FRotator(0, 0, 90)` (roll)    | `(Wx, Wy - S/2, Wz)`         | `(S, S, S)` |

QuadMesh (sprite mode 와 공유, 하단-중앙 피벗 XY 평면 1×1 quad) 가 위 transform 으로 voxel 의 axis-aligned face 위치에 정확히 배치된다.

**CPD 슬롯**: slot 9 = R, 10 = G, 11 = B, 12 = A. 나머지 미사용.

## HISM 머티리얼 스펙

- **Mesh**: 1×1 vertical quad, 로컬 XY 평면, 피벗 하단-중앙 (HktSpriteCore Crowd Renderer 와 동일 메시 규약).
- **Material**: `M_HktSpriteYBillboard` (Y-axis billboard) — HktSpriteCore 의 캐릭터 빌보드와 공유. 이전 default `M_HktSpriteTerrainBillboard` (Z-up plane) 는 deprecated.
- **PerInstanceCustomData (NumCustomDataFloats=16, M_HktSpriteYBillboard 규약)**:

| slot | 용도 | 본 액터에서 |
|---|---|---|
| 0 | AtlasIndex (grid cell idx) | `cell.TypeID` |
| 1 | CellW (px) | `CellSizePx.X` |
| 2 | CellH (px) | `CellSizePx.Y` |
| 3 | reserved | 0 |
| 4 | PivotOffsetX (world) | 0 (quad mesh 가 이미 bottom-center) |
| 5 | PivotOffsetY (world) | 0 |
| 6 | RotRad | 0 |
| 7 | HalfWidth (world cm) | `CellSizePx.X × PixelToWorld × 0.5` |
| 8 | HalfHeight (world cm) | `CellSizePx.Y × PixelToWorld × 0.5` |
| 9~12 | Tint RGBA | Flags 기반 보조 (TRANSLUCENT alpha 0.6) |
| 13 | PaletteIndex | `cell.PaletteIndex` |
| 14 | FlipX | 0 |
| 15 | ZBias (cm) | `ComponentZBias` (CrowdRenderer slot 15 와 동일) |

## Crowd 와의 Depth 정렬

Sprite Crowd (캐릭터, Y-axis 직립) 와의 z-fighting 은 ComponentZBias 로 해소:

| 컴포넌트 | ComponentZBias |
|---|---|
| Terrain (본 액터) | 0 (베이스라인) |
| Crowd (캐릭터) | +1cm 권장 |

값이 양수일수록 카메라 쪽. 머티리얼 WPO 가 cm 만큼 밀어내며 depth-buffer 에 반영된다.

## 단일 BakedAsset 정책

한 World 에 단일 `UHktTerrainBakedAsset` 인스턴스. VoxelTerrainActor 와 함께 배치 시 어느 한 쪽이 `Sub->LoadBakedAsset` 호출하면 충분.

`BakedAsset` 미할당 / 로드 영역 밖 청크는 런타임 폴백 (`FHktTerrainGenerator`) 으로 동일하게 생성된다 — 결정론 보장.

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `[SpriteTerrain] UHktTerrainSubsystem 없음 — Tick 무동작` | World 타입이 Subsystem 생성 정책 (`Game/PIE/Editor`) 외. 액터 배치 위치 확인. |
| `[SpriteTerrain] TerrainMaterial 미할당 ...` | UPROPERTY `TerrainMaterial` 에 `M_HktSpriteYBillboard` (또는 동등 슬롯 규약 머티리얼) 할당. |
| Crowd 가 Terrain 뒤로 가려짐 | `ComponentZBias` 비교 — Crowd 가 더 작거나 같으면 z-fight. Crowd 를 +1cm 이상. |
| Sprite 가 너무 작거나 큼 | `PixelToWorld` 또는 `CellSizePx` 재튜닝. 기본 (0.166, 128) 은 VoxelSize=15cm 가정. |
| Sprite 가 안 보임 | `QuadMesh` / `TerrainMaterial` UPROPERTY 점검. AtlasTexture 가 null 이어도 `bUseFallbackColors=true` 면 솔리드 컬러로 가시화됨. |
| 모든 voxel 이 마젠타 (FF00FF) | 폴백 컬러 테이블 미등록 TypeID — `HktAdvTerrainType` 범위 초과. 신규 type 추가 시 `GetFallbackTypeColorLinear` 테이블 확장. |
| Fallback mode 에서 모두 검정/회색 | Shipping 빌드 (런타임 머티리얼 생성 미지원). 정식 `AtlasTexture` + `TerrainMaterial` 할당 필요. |
| 인스턴스가 청크 경계에서 깜빡임 | `MaxScansPerSecond` / `StreamRadius` 점검. v1 은 청크 in-place 갱신 없음. |
| 청크가 화면에 들어왔는데 늦게 추가됨 | `MaxLoadsPerFrame` 증가. 단, 메인스레드 비용 ↑ — 프로파일링 필수. |
| Solid 청크 위 voxel 이 보임 (underground top 누설) | v1 한계 — 위 청크 fetch 실패 시 노출로 간주. v2 (volumetric surface) 에서 해소 예정. |

## v1 한계 / 향후

- **v1** (현재): (X, Y) 별 topmost-exposed solid voxel 1개. 동굴/오버행 미표시. ChunkSize²=1024 sprite/청크 상한.
- **v2** (예정): 측면(-X, -Y) 노출 voxel 도 emit. 절벽/계단 측면 voxel 도 sprite 1장씩 그려짐. 인스턴스 수 ~2–3배.

## Deprecated 마이그레이션

`AHktVoxelSpriteTerrainActor` (HktVoxelTerrain) 는 deprecated. 외부 콘텐츠 referencer 를 위한 1릴리스 유예 후 제거 예정. 신규 콘텐츠는 본 액터를 사용할 것.

## 변경 시 체크리스트

- [ ] 표면 추출 알고리즘 변경 → ChunkVoxelScratch / AboveChunkVoxelScratch 가 32768 element 로 유지되는지 + 결정론 영향 검토
- [ ] HISM CustomData 슬롯 수정 → 본 문서 표 + 머티리얼 (M_HktSpriteYBillboard) 동기 갱신
- [ ] PixelToWorld / CellSizePx 기본값 변경 → README sprite 규약 섹션 동기 갱신
- [ ] ComponentZBias 정책 변경 → CrowdRenderer 와의 정렬 매트릭스 재테스트
