● AHktVoxelSpriteTerrainActor 동작 흐름

  1. 라이프사이클

  생성자

  - HISMComponent 생성 → RootComponent 지정
  - NumCustomDataFloats = 16 (slot 0~15)
  - 충돌/네비게이션/그림자/라이팅 영향 OFF (월드와 분리된 스프라이트 레이어)
  - TickGroup = TG_DuringPhysics

  BeginPlay

  1. HISM.SetStaticMesh(QuadMesh)
  2. TerrainMaterial → UMaterialInstanceDynamic::Create → TerrainMID
  3. MID 파라미터 설정:
    - Atlas = AtlasTexture
    - PaletteLUT = PaletteLUT
    - AtlasSize = (AtlasW, AtlasH, CellW, CellH) — Vector4
  4. HISM.SetMaterial(0, TerrainMID)
  5. 데이터 소스(VoxelActor)는 아직 바인딩 안 함 — 첫 Tick에서 lazy resolve

  EndPlay

  - HISM ClearInstances + 3개 매핑 테이블 reset

  ---
  2. Tick 파이프라인

  Tick(dt)
   │
   ├─ Throttle: (Now - LastScanTime) < 1/MaxScansPerSecond → return
   │
   ├─ ScanVisibleTopSurface(Cells)
   │    │
   │    ├─ ResolveRenderCache()  ← lazy (FindActorOfClass 1회 + AddTickPrerequisiteActor)
   │    │     · 캐시되면 즉시 반환
   │    │     · 첫 호출 시 VoxelActor 탐색 → CachedSourceActor에 저장
   │    │     · VoxelActor 가시면 Z-fighting 경고 1회
   │    │
   │    ├─ ViewCenter = Pawn.Location (없으면 PC ViewPoint)
   │    │
   │    └─ for chunk in Cache->GetAllChunkCoords():
   │          · XY 거리 < IncludeRadiusUU 필터
   │          · 청크 내부 32×32 컬럼 스캔 → 컬럼당 z-내림 first-non-empty
   │          · BestZ 갱신 방식이라 컬럼 간 최상단 voxel 1개만 선출
   │          · OutCells.Add({ChunkCoord, WorldPos, TypeID, Palette, Flags})
   │
   ├─ ChunkWorldSize = VoxelActor.GetChunkWorldSize()
   │
   ├─ === Diff: 신규/변경 ===
   │    SeenCoords = {}
   │    for cell in Cells:
   │       SeenCoords += cell.ChunkCoord
   │       Xform   = Translate(WorldPos), Scale=1
   │       CData16 = FillCustomData(cell, ChunkWorldSize)
   │       │
   │       ├─ InstanceMap.Find(ChunkCoord)?
   │       │     ├─ YES: prev = LastCellByCoord[ChunkCoord]
   │       │     │       · WorldPos 변동 → UpdateInstanceTransform (no dirty)
   │       │     │       · TypeID/Palette/Flags 변동 → SetCustomDataValue × 16 (no dirty)
   │       │     │
   │       │     └─ NO : AddInstance → newIdx
   │       │             InstanceMap[ChunkCoord]   = newIdx
   │       │             InstanceCoordByIndex[newIdx] = ChunkCoord
   │       │             SetCustomDataValue × 16 (no dirty)
   │       │
   │       └─ LastCellByCoord[ChunkCoord] = cell
   │
   ├─ === Diff: 사라진 인스턴스 ===
   │    ToRemove = InstanceMap.Keys − SeenCoords
   │    for coord in ToRemove:
   │       removeIdx = InstanceMap.FindAndRemoveChecked(coord)
   │       lastIdx   = HISM.GetInstanceCount() - 1   ← 제거 전 시점
   │       HISM.RemoveInstance(removeIdx)            ← 내부적으로 마지막 인스턴스를 removeIdx로 swap
   │       │
   │       └─ if (removeIdx != lastIdx):
   │            · InstanceCoordByIndex[lastIdx] (있다면) → key를 removeIdx로 재매핑
   │            · InstanceMap[swappedKey] = removeIdx
   │
   └─ HISM.MarkRenderStateDirty()  ← 프레임당 1회

  ---
  3. PerInstanceCustomData 16 floats (FillCustomData)

  ┌────────┬────────────────────┬──────────────────────────────────────────────────┐
  │  slot  │         값         │                       비고                       │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 0      │ TypeID             │ Atlas 프레임 인덱스                              │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 1, 2   │ CellSizePx.X / Y   │ 머티리얼 UV 스케일                               │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 3      │ 0                  │ reserved                                         │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 4, 5   │ 0                  │ OffX/Y                                           │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 6      │ 0                  │ RotR (iso 고정)                                  │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 7, 8   │ ChunkWorldSize/2   │ 빌보드 ScaleX/Y (M_HktSpriteYBillboard WPO 입력) │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 9~11   │ 1,1,1              │ Tint RGB                                         │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 12     │ 1.0 또는 0.6       │ TRANSLUCENT 플래그시 0.6                         │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 13     │ PaletteIndex (0~7) │ LUT V축                                          │
  ├────────┼────────────────────┼──────────────────────────────────────────────────┤
  │ 14, 15 │ 0                  │ FlipV / ZBiasV                                   │
  └────────┴────────────────────┴──────────────────────────────────────────────────┘