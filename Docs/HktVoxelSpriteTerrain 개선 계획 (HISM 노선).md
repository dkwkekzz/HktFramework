● HktVoxelSpriteTerrain 개선 계획 (HISM 노선)

  다른 에이전트 핸드오프용. 컨텍스트가 없는 에이전트도 이 문서만으로 진행 가능하도록 작성.

  ---
  0. 배경

  AHktVoxelSpriteTerrainActor (HktGameplay/HktVoxelTerrain/Public/HktVoxelSpriteTerrainActor.h)는
   원래 헤더 주석 L67~L162에 Niagara System(NDI Array DI 4개 + Sprite Renderer 2 emitter)
  기반으로 명세돼 있었다. 검토 결과 Niagara가 depth/layer 정렬 면에서 HISM보다 우위 없음, HISM
  패턴이 이 코드베이스의 M_HktSpriteYBillboard와 정합, PerInstanceCustomData가 Array DI보다
  운영·디버깅 단순하여 HISM 노선으로 변경한다.

  1. 현재 자산 처리 정책

  자산/코드: EditorBuildTerrainAtlasFromBundle 함수
  위치: HktGameplayGenerator/HktSpriteGenerator/Private+Public/HktSpriteGeneratorFunctionLibrary.
  {h,cpp}
  처리: 유지 — 아틀라스 빌더, HISM에서도 그대로 사용
  ────────────────────────────────────────
  자산/코드: M_HktSpriteTerrain 머티리얼
  위치: /HktGameplay/Materials/M_HktSpriteTerrain
  처리: 삭제 — Niagara ParticleColor 기반이라 HISM과 호환 안 됨
  ────────────────────────────────────────
  자산/코드: NS_HktSpriteTerrain Niagara System
  위치: /HktGameplay/VFX/NS_HktSpriteTerrain
  처리: 삭제
  ────────────────────────────────────────
  자산/코드: AHktVoxelSpriteTerrainActor
  위치: HktGameplay/HktVoxelTerrain/Public+Private/HktVoxelSpriteTerrainActor.{h,cpp}
  처리: 리팩토링 (아래 §3)
  ────────────────────────────────────────
  자산/코드: UHktVoxelTerrainNDI
  위치: HktGameplay/HktVoxelTerrain/Public/HktVoxelTerrainNDI.h 등
  처리: 제거 — 사용처가 SpriteTerrainActor만이면 클래스 자체 삭제, 다른 사용처 있으면 유지 (먼저
    grep 확인 필수)
  ────────────────────────────────────────
  자산/코드: 헤더 주석 L67~L162 (Niagara 스펙)
  위치: 위 actor 헤더
  처리: HISM 스펙으로 재작성

  2. 신규 머티리얼: M_HktSpriteTerrainBillboard

  M_HktSpriteYBillboard(경로: /HktGameplay/Materials/M_HktSpriteYBillboard)를 base로 duplicate한
  뒤 팔레트 LUT 추가.

  Properties: 동일 (Surface / Unlit / Masked 0.333 / TwoSided /
  bUsedWithInstancedStaticMeshes=true)

  기존 그래프 재사용:
  - Custom_0 "HktSprite UV" — AtlasIdx 셀 UV 계산
  - Custom_1 "HktSprite Tint" — slot 9~12에서 RGBA tint
  - Custom_2 "HktSprite WPO" — Y-iso 빌보드 + ZBias

  추가/변경:
  1. 새 Texture2D Parameter PaletteLUT (default white)
  2. PerInstanceCustomData slot 13 (현재 미사용) → PaletteIndex (0~7) 신규 할당. 기존
  M_HktSpriteYBillboard의 slot 정의 유지하면서 13만 새로 정의:
  float PaletteIdx = GetPerInstanceCustomData(Parameters, 13, 0.0);
  3. Atlas 샘플 결과의 R 채널 = palette U, PaletteIdx / 7.0 = palette V
  4. MakeFloat2(Atlas.R, PaletteIdx/7) → PaletteLUT.Sample → 결과를 기존 Tint와 곱하기 전에 합성:
    - 옵션 A (단순): EmissiveColor = PaletteLUT.RGB * Tint.RGB
    - 옵션 B (호환): static switch parameter bUsePalette로 기존 직결 vs LUT 경로 분기

  자동화 경로: material_query MCP로 가능. 기존 그래프를 export_material_graph로 받고, JSON에 LUT
  노드 4개(Param/AppendVector/Sample/Multiply) + slot 13 Custom_3 추가 후 build_material_graph.

  3. Actor 리팩토링: AHktVoxelSpriteTerrainActor

  3.1 헤더 변경

  // 제거
  class UNiagaraComponent;
  class UNiagaraSystem;
  class UHktVoxelTerrainNDI;
  TObjectPtr<UNiagaraComponent> NiagaraComponent;
  TObjectPtr<UNiagaraSystem> TerrainNiagaraSystem;
  TObjectPtr<UHktVoxelTerrainNDI> TerrainNDI;
  FName ParamName_Positions / TypeIDs / PaletteIndices / Flags;

  // 추가
  class UHierarchicalInstancedStaticMeshComponent;
  class UStaticMesh;
  class UMaterialInterface;

  UPROPERTY(VisibleAnywhere) TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMComponent;
  UPROPERTY(EditAnywhere) TObjectPtr<UStaticMesh> QuadMesh;             // 1×1 unit quad, Z-up
  UPROPERTY(EditAnywhere) TObjectPtr<UMaterialInterface> TerrainMaterial; //
  M_HktSpriteTerrainBillboard
  UPROPERTY(EditAnywhere) TObjectPtr<UTexture2D> AtlasTexture;          //
  T_HktSpriteTerrainAtlas
  UPROPERTY(EditAnywhere) TObjectPtr<UTexture2D> PaletteLUT;
  UPROPERTY(EditAnywhere) FVector2D AtlasSizePx = FVector2D(4224, 128);
  UPROPERTY(EditAnywhere) FVector2D CellSizePx  = FVector2D(128, 128);

  3.2 cpp 변경

  - 생성자: CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>("HISM"),
  NumCustomDataFloats = 16 (slot 0~15)
  - BeginPlay: HISM에 mesh/material 적용, MID 생성하여 Atlas/PaletteLUT/AtlasSize 파라미터 set
  - Tick 알고리즘:
  ScanVisibleTopSurface(OutCells)
  // diff 갱신:
  for each cell in OutCells:
    key = (chunkX, chunkY)  // 셀 고유 키
    if key in InstanceMap:
      // 위치/타입 변경시 BatchUpdateInstancesData
    else:
      AddInstance(transform, customData[16])
  for each key not in OutCells:
    RemoveInstance(InstanceMap[key])
  - PerInstanceCustomData 매핑 (M_HktSpriteYBillboard 표 + 신규 slot 13):
  | slot | 용도         | 본 액터에서                               |
  |------|--------------|-------------------------------------------|
  | 0    | AtlasIdx     | cell.TypeID                               |
  | 1, 2 | CellW/H      | CellSizePx                                |
  | 4, 5 | OffX/Y       | 0                                         |
  | 6    | RotR         | 0                                         |
  | 7, 8 | ScaleX/Y     | Chunk WorldSize / 2 = 240                 |
  | 9~12 | Tint RGBA    | Flags 기반 보조 (예: 발광=1.5x, 일반=1.0) |
  | 13   | PaletteIndex | cell.PaletteIndex (신규)                  |
  | 14   | FlipV        | 0                                         |
  | 15   | ZBiasV       | 0 (또는 셀 세로 인덱스 기반 미세 bias)    |


  3.3 ResolveRenderCache, GetViewCenterWorldPos, ScanVisibleTopSurface

  - 그대로 유지 — 데이터 소스는 변경 없음

  3.4 Translucent 분기

  - Glass/Water/Ice(FLAG_TRANSLUCENT) 셀: 별도 HISM 컴포넌트(Material만 Translucent variant)로
  분리 — 또는 Masked 머티리얼로 통일하고 alpha-test로 처리하여 단일 HISM. 권장: 단일 HISM +
  masked, 모바일 친화 + 정렬 문제 회피.

  4. 헤더 주석 재작성 가이드

  HktVoxelSpriteTerrainActor.h의 L67~L162 Niagara 스펙 블록 전체를 다음 헤딩 구조로 재작성:

  [HISM 렌더링 스펙]
    - 컴포넌트: UHierarchicalInstancedStaticMeshComponent
    - Mesh: 1×1 unit quad (Z-up), 단일 인스턴스 = 청크 top tile 1개
    - Material: M_HktSpriteTerrainBillboard (M_HktSpriteYBillboard 기반 + PaletteLUT)
    - PerInstanceCustomData slot 매핑 (위 표)

  [데이터 흐름]
    FHktVoxelRenderCache → ScanVisibleTopSurface() (Game Thread, Tick)
      → diff 비교 (InstanceMap)
      → AddInstance / RemoveInstance / BatchUpdateInstancesData
    ※ Niagara/NDI 제거 — 단일 컴포넌트 단일 DC

  [아틀라스 / 팔레트 LUT 스펙]
    L116~L154 (현 상태) 그대로 유지

  5. 작업 순서 (권장)

  1. 사용처 검색: grep -r UHktVoxelTerrainNDI — SpriteTerrainActor 외 사용처 확인. 단독 사용이면
  §1 따라 클래스 삭제, 아니면 보존.
  2. 머티리얼 신규 생성 (§2): M_HktSpriteYBillboard duplicate → M_HktSpriteTerrainBillboard → LUT
   노드 추가
  3. Actor 헤더/cpp 리팩토링 (§3): UE5 컴파일 통과 확인 (자동 빌드 금지 — 에디터가 떠 있으면
  hot-reload만)
  4. 헤더 주석 갱신 (§4)
  5. 불필요 자산 삭제: M_HktSpriteTerrain, NS_HktSpriteTerrain (에디터에서 또는
  EditorAssetLibrary.delete_asset MCP)
  6. 레벨에서 검증: AHktVoxelSpriteTerrainActor를 spawn하고 가시 영역 청크 가시화 확인.
  r.VisualizeInstancedMeshes 1로 인스턴스 카운트 확인.

  6. 인수 기준 (Acceptance)

  - HISM 1개 컴포넌트, 단일 DC로 가시 청크 top tile 렌더
  - 카메라 이동 시 가시 영역 청크가 add/remove 차분 갱신 (전체 재구성 X)
  - PaletteIndex 변경 시 즉시 색조 변경 (LUT 샘플 동작)
  - 캐릭터/구조물 등 다른 3D 메시와 depth 정렬 정상
  - Niagara/NDI 의존 코드/자산 0
  - EditorBuildTerrainAtlasFromBundle로 빌드한 T_HktSpriteTerrainAtlas가 그대로 사용됨

  7. 참고 코드/문서

  - 기존 HISM 빌보드 패턴: M_HktSpriteYBillboard 그래프 (material_query.export_material_graph로
  JSON 추출 가능)
  - 아틀라스 빌더 호출법:
  UHktSpriteGeneratorFunctionLibrary::EditorBuildTerrainAtlasFromBundle(InputDir,
  OutputAssetPath, ForcedFrameSize)
  - TerrainType ↔ 인덱스 매핑: HktVoxelTerrain/Public/HktVoxelTerrainTypes.h::HktTerrainType
  namespace
  - 환경: UE 5.6, 사용자가 에디터 상시 오픈 → 자동 빌드 금지, hot-reload 또는 Live Coding 사용