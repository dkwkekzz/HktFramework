// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktVoxelSpriteTerrainActor.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UTexture2D;
class AHktVoxelTerrainActor;
class FHktVoxelRenderCache;

/**
 * FHktVoxelSurfaceCell — 가시 영역 top-most voxel 1개.
 *
 * 카메라(IsometricOrtho, Pitch=-60°, Yaw=45°)에서 보이는 청크별 최상단 셀만 추출하여
 * HISM 인스턴스 1개로 매핑한다. ChunkCoord가 InstanceMap의 키 역할을 한다.
 */
struct FHktVoxelSurfaceCell
{
	FIntVector ChunkCoord = FIntVector::ZeroValue; // 셀이 속한 청크 좌표 (InstanceMap key)
	FVector WorldPos = FVector::ZeroVector;        // 셀 중심 월드 좌표 (UU)
	uint16  TypeID = 0;                            // HktTerrainType — Atlas 프레임 인덱스
	uint8   PaletteIndex = 0;                      // 0~7 — PaletteLUT V축
	uint8   Flags = 0;                             // FHktVoxel::FLAG_* (TRANSLUCENT 등)
};

/**
 * AHktVoxelSpriteTerrainActor
 *
 * AHktVoxelTerrainActor와 병렬 배치 가능한 스프라이트 기반 테레인 렌더러.
 * 카메라(IsometricOrtho) 고정 전제로, 가시 영역 top-most voxel 1셀을 1 HISM 인스턴스로
 * 치환하여 단일 컴포넌트, 단일 DC로 그린다.
 *
 * ============================================================================
 * [HISM 렌더링 스펙]
 * ============================================================================
 *  - 컴포넌트  : UHierarchicalInstancedStaticMeshComponent (단일)
 *  - Mesh      : 1×1 unit quad (Z-up). 인스턴스 = 청크 top tile 1개
 *  - Material  : M_HktSpriteTerrainBillboard
 *                 (M_HktSpriteYBillboard 베이스 + Atlas + PaletteLUT)
 *  - Translucent 분기: 단일 HISM + Masked 머티리얼로 통일 (모바일 친화, 정렬 회피).
 *                       FLAG_TRANSLUCENT는 알파 톤다운으로만 처리.
 *
 *  PerInstanceCustomData 매핑 (NumCustomDataFloats = 16):
 *    | slot | 용도         | 본 액터에서                                   |
 *    |------|--------------|-----------------------------------------------|
 *    | 0    | AtlasIdx     | cell.TypeID                                   |
 *    | 1    | CellW        | CellSizePx.X                                  |
 *    | 2    | CellH        | CellSizePx.Y                                  |
 *    | 3    | (reserved)   | 0                                             |
 *    | 4    | OffX         | 0                                             |
 *    | 5    | OffY         | 0                                             |
 *    | 6    | RotR         | 0 (iso 고정)                                  |
 *    | 7    | ScaleX       | ChunkWorldSize / 2                            |
 *    | 8    | ScaleY       | ChunkWorldSize / 2                            |
 *    | 9~12 | Tint RGBA    | Flags 기반 보조 (TRANSLUCENT=alpha 0.6 등)    |
 *    | 13   | PaletteIndex | cell.PaletteIndex (LUT V = idx/7)             |
 *    | 14   | FlipV        | 0                                             |
 *    | 15   | ZBiasV       | 0                                             |
 *
 * ============================================================================
 * [데이터 흐름]
 * ============================================================================
 *   FHktVoxelRenderCache (공용, 기존 Voxel 경로와 공유)
 *     → ScanVisibleTopSurface()  (Game Thread, Tick)
 *     → FHktVoxelSurfaceCell 배열 + ChunkCoord 키
 *     → diff 비교 (InstanceMap)
 *         · 신규 키        → AddInstance + SetCustomData
 *         · 변경 키        → BatchUpdateInstancesData / SetCustomDataValue
 *         · 사라진 키      → RemoveInstance (스왑 보정)
 *   ※ Niagara/NDI 의존 0 — 단일 HISM 컴포넌트, 단일 DC.
 *
 * 기존 AHktVoxelTerrainActor의 메싱/청크 컴포넌트 경로와 독립적이며,
 * 월드에 둘 중 하나만 활성화하거나 양쪽 모두 스폰 후 bHiddenInGame으로 A/B 비교한다.
 *
 * ============================================================================
 * [아틀라스 / 팔레트 LUT 스펙 — T_HktSpriteTerrainAtlas]
 * ============================================================================
 * 33 타입 × 1방향(iso 고정) = 33 프레임. Yaw 회전 비활성이므로 방향 바리에이션 불필요.
 *
 * [아틀라스 레이아웃]
 *   - 크기       : 모바일 기준 프레임당 128×128 px → 아틀라스 4224×128 (1D strip)
 *   - Frame 순서 : HktTerrainType 열거값 순서와 동일 (Air=0은 빈 프레임)
 *                   AtlasIdx = TypeID 직접 매핑
 *   - 포맷       : BC7 / ASTC 6×6 (모바일) — 알파 채널로 투명 배경 보존
 *   - sRGB       : ON (diffuse)
 *   - 빌드 도구  : UHktSpriteGeneratorFunctionLibrary::EditorBuildTerrainAtlasFromBundle
 *
 * [팔레트 바리에이션]
 *   개별 프레임에 팔레트를 굽지 않는다 — 머티리얼에서 런타임 스왑:
 *     1) 베이스 프레임은 grayscale + mask 레이어로 저장
 *     2) PaletteLUT (Texture2D 8×N)에서 (Atlas.R, PaletteIndex/7)로 샘플
 *     3) HktTerrainPalette 바이옴별 변주는 LUT row로 처리
 *   기존 UHktVoxelPalette(HktSpriteCore) 관행과 동일.
 * ============================================================================
 */
/**
 * @deprecated PR-D 에서 `AHktSpriteTerrainActor` (HktSpriteTerrain 모듈) 로 대체.
 *             신규 버전은 RenderCache 의존을 제거하고 `UHktTerrainSubsystem` 단일
 *             출처에서 청크 데이터를 받는다. 본 클래스는 1 릴리스 유지 후 제거 예정.
 *
 * 마이그레이션:
 *   1. 월드 배치된 본 액터를 `AHktSpriteTerrainActor` 로 교체.
 *   2. QuadMesh / TerrainMaterial / AtlasTexture / PaletteLUT 등 UPROPERTY 그대로 복사.
 *   3. 기존 본 액터의 데이터 의존(`AHktVoxelTerrainActor` RenderCache) 은 제거 — 신 액터는
 *      Subsystem 단일 출처라 Voxel actor 가 같은 월드에 없어도 동작.
 *
 * 본 클래스는 BeginPlay 시 EventLog Warning 을 1회 emit 하여 콘텐츠 referencer 를 추적한다.
 */
UCLASS(ClassGroup = (HktVoxel))
class HKTVOXELTERRAIN_API AHktVoxelSpriteTerrainActor : public AActor
{
	GENERATED_BODY()

public:
	AHktVoxelSpriteTerrainActor();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

public:
	/** HISM — 청크 top tile 인스턴스 컬렉션 (월드에 단 하나) */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMComponent;

	/** 1×1 unit quad (Z-up). 인스턴스 = 청크 top tile 1개 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	/** M_HktSpriteTerrainBillboard — Atlas + PaletteLUT 기반 빌보드 머티리얼 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/** T_HktSpriteTerrainAtlas — EditorBuildTerrainAtlasFromBundle 산출물 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> AtlasTexture;

	/** PaletteLUT — 8×N 컬러 룩업 (R: Atlas, V: PaletteIndex/7) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> PaletteLUT;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D AtlasSizePx = FVector2D(4224.f, 128.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D CellSizePx = FVector2D(128.f, 128.f);

	/**
	 * 가시 영역 반경 (UU) — 월드 XY-평면 상 ViewCenter 기준 원 내부의 청크만 스캔.
	 *
	 * 기본값 2000은 OrthoWidth ≈ 2500(화면 반폭 1250) + 16:9 세로 반폭 ≈ 704 의 대각
	 * (≈ 1435)에 여유를 더한 값. OrthoWidth를 바꿨다면 이에 맞춰 조정한다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "0.0"))
	float IncludeRadiusUU = 2000.0f;

	/** 초당 surface 스캔 횟수 상한 — 카메라/월드 변화 없으면 스킵 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming")
	float MaxScansPerSecond = 30.0f;

private:
	/**
	 * 가시 영역 내 로드된 chunk iterate → 청크당 top-most voxel 1개 수집.
	 *
	 * 모바일 orthographic 카메라 기준 가시 청크 ≈ 20개 전제. 청크당 1 인스턴스이므로
	 * GPU 부하는 무시 가능. XY-평면 반경 체크로 frustum 근사하며 Z는 무시
	 * (iso 고정 각도라 세부 frustum이 불필요).
	 */
	void ScanVisibleTopSurface(TArray<FHktVoxelSurfaceCell>& OutCells) const;

	/** Surface cell 1개 → HISM PerInstanceCustomData 16 floats 변환 */
	void FillCustomData(const FHktVoxelSurfaceCell& Cell, float ChunkWorldSize, TArray<float>& OutData) const;

	/** Surface cell 1개 → HISM 인스턴스 Transform 계산 */
	FTransform MakeInstanceTransform(const FHktVoxelSurfaceCell& Cell) const;

	/** 스트리밍/가시성 기준점 — Pawn이 있으면 Pawn, 없으면 PC ViewPoint */
	FVector GetViewCenterWorldPos() const;

	/**
	 * RenderCache resolver — 월드에 배치된 AHktVoxelTerrainActor의 공용 캐시를 참조한다.
	 *
	 * 설계 결정: Voxel Actor의 데이터 파이프라인(Loader/Generator/Cache)을 재사용하여
	 * 메모리 복제와 중복 스트리밍을 피한다. Sprite-only 배포 시엔 Voxel Actor의
	 * 렌더링(ChunkComponent)만 별도 토글로 끄고 데이터 피드는 유지한다.
	 *
	 * Voxel Actor가 월드에 없으면 nullptr을 반환하고 Tick은 no-op으로 동작.
	 */
	FHktVoxelRenderCache* ResolveRenderCache() const;

	/** 머티리얼 파라미터(Atlas/PaletteLUT/AtlasSize)를 적용한 Dynamic Material Instance */
	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TerrainMID;

	/** ChunkCoord → HISM InstanceIndex */
	TMap<FIntVector, int32> InstanceMap;

	/** InstanceIndex → ChunkCoord 역매핑 (RemoveInstance의 스왑 보정용) */
	TMap<int32, FIntVector> InstanceCoordByIndex;

	/** ChunkCoord → 마지막 push된 셀 (재push 여부 판정용) */
	TMap<FIntVector, FHktVoxelSurfaceCell> LastCellByCoord;

	/** 마지막 스캔 시각 (GetWorld()->GetTimeSeconds 기준) */
	float LastScanTime = -FLT_MAX;

	/** 월드 스캔 결과 캐시 — 매 Tick FindActorOfClass 재호출 방지 */
	mutable TWeakObjectPtr<AHktVoxelTerrainActor> CachedSourceActor;
};
