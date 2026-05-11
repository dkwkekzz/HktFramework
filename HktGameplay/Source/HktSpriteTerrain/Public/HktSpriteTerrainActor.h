// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainChunkLoader.h"
#include "HktSpriteTerrainActor.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UTexture2D;
class UHktTerrainSubsystem;

/**
 * FHktSpriteTerrainSurfaceCell — 표면 voxel 1개의 데이터.
 *
 * v1 (SC1 동치) — 청크 내 (LocalX, LocalY) 별로 카메라에 노출된 topmost solid voxel 하나씩.
 * Sprite mode: 셀 1개 = HISM 인스턴스 1개 (Y-billboard quad).
 * Fallback mode: 셀 1개 = HISM 인스턴스 3개 (top/left/right axis-aligned face quad).
 */
struct FHktSpriteTerrainSurfaceCell
{
	FIntVector ChunkCoord = FIntVector::ZeroValue;
	FIntVector LocalCoord = FIntVector::ZeroValue;     // 청크 내 (X, Y, Z) 0..ChunkSize-1
	FVector    WorldPos   = FVector::ZeroVector;       // voxel 바닥-중앙 월드 좌표
	uint16     TypeID      = 0;
	uint8      PaletteIndex = 0;
	uint8      Flags        = 0;
};

/**
 * AHktSpriteTerrainActor
 *
 * 두 가지 렌더 경로:
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ [Sprite mode] AtlasTexture 할당 시                                    │
 * │  화가가 그린 iso voxel sprite (마름모 top + 측면 통합 PNG) 을 voxel    │
 * │  당 upright Y-billboard quad 1장에 매핑. SC1 / 맵 에디터 방식.        │
 * │  → HISMComponent (단일)                                              │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ [Fallback mode] AtlasTexture=null + bUseFallbackColors=true 시        │
 * │  Sprite art 가 아직 없는 dev 단계 — voxel 의 보이는 3면 (top, -X, -Y) │
 * │  을 axis-aligned 평면 quad 3장으로 직접 색칠. TypeID 별 base color +  │
 * │  면별 음영 (Top 1.00 / Right 0.78 / Left 0.58).                       │
 * │  → HISMFallbackTop / HISMFallbackLeft / HISMFallbackRight (3개)       │
 * │  Iso ortho 카메라가 자연스럽게 3면을 마름모+기둥으로 투영.            │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 카메라는 `HktCameraMode_IsometricOrtho` (pitch −30, yaw 45) 고정 — fallback mode 의
 * axis-aligned face quad 들이 이 각도에서 iso 마름모/평행사변형으로 투영된다.
 *
 * ============================================================================
 * [Sprite mode CPD 슬롯 매핑] — M_HktSpriteYBillboard 규약
 * ============================================================================
 *    | slot | 용도          | 본 액터에서                                   |
 *    |------|---------------|-----------------------------------------------|
 *    | 0    | AtlasIndex    | cell.TypeID                                   |
 *    | 1    | CellW (px)    | CellSizePx.X                                  |
 *    | 2    | CellH (px)    | CellSizePx.Y                                  |
 *    | 7    | HalfW (world) | CellSizePx.X × PixelToWorld × 0.5             |
 *    | 8    | HalfH (world) | CellSizePx.Y × PixelToWorld × 0.5             |
 *    | 9~12 | Tint RGBA     | (1,1,1, Flags 기반 alpha)                     |
 *    | 13   | PaletteIndex  | cell.PaletteIndex                             |
 *    | 15   | ZBias (cm)    | ComponentZBias                                |
 *
 * ============================================================================
 * [Fallback mode CPD 슬롯 매핑] — runtime 생성 M_HktSpriteTerrainFallbackFace
 * ============================================================================
 *  Unlit material 이 PerInstanceCustomData[9..11] 을 Emissive RGB 로 직접 출력.
 *    | slot  | 용도        | 본 액터에서                                    |
 *    |-------|-------------|------------------------------------------------|
 *    | 9     | R           | base.R × FaceShade                             |
 *    | 10    | G           | base.G × FaceShade                             |
 *    | 11    | B           | base.B × FaceShade                             |
 *    | 12    | A           | (예약, 미사용)                                 |
 *  나머지 슬롯은 머티리얼이 무시.
 */
UCLASS(ClassGroup = (HktSprite))
class HKTSPRITETERRAIN_API AHktSpriteTerrainActor : public AActor
{
	GENERATED_BODY()

public:
	AHktSpriteTerrainActor();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

public:
	// === 렌더 컴포넌트 ===

	/** Sprite mode 메인 HISM (Y-billboard quad, 1 instance per voxel). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMComponent;

	/** Fallback mode: voxel 의 top face (Z+) axis-aligned 평면 quad. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite|Fallback")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMFallbackTop;

	/** Fallback mode: voxel 의 left face (-X) axis-aligned 평면 quad. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite|Fallback")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMFallbackLeft;

	/** Fallback mode: voxel 의 right face (-Y) axis-aligned 평면 quad. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite|Fallback")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMFallbackRight;

	/**
	 * 양 모드 공통으로 사용하는 1×1 quad 메시 (로컬 XY 평면, 하단-중앙 피벗).
	 * Sprite mode 의 M_HktSpriteYBillboard 가 가정하는 메시 규약과 일치.
	 * Fallback mode 는 동일 메시를 axis-aligned 변환만 다르게 적용해 재사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	/**
	 * Sprite mode 머티리얼 (M_HktSpriteYBillboard).
	 * Fallback mode 에선 무시 — 자동 생성된 unlit emissive 머티리얼 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/**
	 * Iso voxel sprite atlas. 미할당 시 Fallback mode 로 진입 (bUseFallbackColors=true 면).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> AtlasTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> PaletteLUT;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D AtlasSizePx = FVector2D(4224.f, 128.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D CellSizePx = FVector2D(128.f, 128.f);

	/**
	 * Pixel → World 환산 (cm/px). Sprite mode 에서 sprite cell → world 크기 계산.
	 * Fallback mode 에선 voxel 크기(VoxelSizeCm) 가 직접 사용되므로 무관.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas",
		meta = (ClampMin = "0.001"))
	float PixelToWorld = 0.166f;

	/**
	 * AtlasTexture 미할당 시 Fallback mode 활성화 (voxel 의 3면을 axis-aligned quad 로 색칠).
	 * false 면 AtlasTexture 미할당 시 아무것도 렌더 안 함.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Fallback")
	bool bUseFallbackColors = true;

	// === 데이터 소스 ===

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Source")
	TSoftObjectPtr<UHktTerrainBakedAsset> BakedAsset;

	// === 스트리밍 ===

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming")
	EHktTerrainLoaderType LoaderType = EHktTerrainLoaderType::Legacy;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "480", ClampMax = "1024000"))
	float StreamRadius = 4000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "480", ClampMax = "1024000",
				EditCondition = "LoaderType == EHktTerrainLoaderType::Proximity"))
	float ProximityFarRadius = 8000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = 1, ClampMax = 64))
	int32 MaxLoadsPerFrame = 16;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = 0))
	int32 MaxLoadedChunks = 1024;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "1.0", ClampMax = "120.0"))
	float MaxScansPerSecond = 30.0f;

	// === Depth 정렬 ===

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Depth")
	float ComponentZBias = 0.f;

private:
	/**
	 * 청크 voxel 버퍼에서 카메라 노출 표면 voxel 들을 추출.
	 * v1 — 청크 내 (LX, LY) 별로 topmost-exposed solid voxel 한 개씩 emit.
	 */
	void ExtractSurfaceCells(UHktTerrainSubsystem* Sub, const FIntVector& Coord,
		TArray<FHktSpriteTerrainSurfaceCell>& OutCells);

	/** Sprite mode — CPD 16 floats 채우기 (M_HktSpriteYBillboard 규약). */
	void FillSpriteCustomData(const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const;

	/** Sprite mode — 셀 1개의 인스턴스 Transform. */
	FTransform MakeSpriteInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const;

	/** 카메라 / 가시성 기준점 */
	FVector GetViewCenterWorldPos() const;

	/** 청크 단위 일괄 인스턴스 추가 (mode 분기). */
	void AddInstancesForChunk(const FIntVector& Coord,
		const TArray<FHktSpriteTerrainSurfaceCell>& Cells,
		float VoxelSize);

	/** 청크 단위 일괄 인스턴스 제거 (mode 분기). */
	void RemoveInstancesForChunk(const FIntVector& Coord);

	/** UPROPERTY 변경이 즉시 반영되도록 매 Tick 로더에 Config 주입 */
	void SyncLoaderConfig(UHktTerrainSubsystem* Sub);

	/** 청크 한 변의 월드 크기 (cm) — Subsystem 의 effective config 에서 산출. */
	float ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const;

	/** ComponentZBias / Sprite size 변경 시 Sprite mode 인스턴스 일괄 refresh. */
	void RefreshAllSpriteInstanceBaseline();

	/** Sprite mode 초기화 — material/atlas/MID 바인딩. */
	void InitSpriteMode();

	/** Fallback mode 초기화 — 3 HISM 메시/머티리얼 바인딩. */
	void InitFallbackMode();

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TerrainMID;

	/** 스트리밍 전략 (BeginPlay 1회 생성). */
	TUniquePtr<IHktTerrainChunkLoader> Loader;

	// === Sprite mode 인스턴스 추적 ===
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices;
	TMap<int32, FIntVector> InstanceChunkByIdx;

	// === Fallback mode 인스턴스 추적 (면별로 독립) ===
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices_FallbackTop;
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices_FallbackLeft;
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices_FallbackRight;
	TMap<int32, FIntVector> InstanceChunkByIdx_FallbackTop;
	TMap<int32, FIntVector> InstanceChunkByIdx_FallbackLeft;
	TMap<int32, FIntVector> InstanceChunkByIdx_FallbackRight;

	/** BeginPlay 에서 결정 — true 면 fallback mode. 런타임 스왑 안 함. */
	bool bUsingFallback = false;

	float LastScanTime = -FLT_MAX;
	float CachedChunkWorldSize = 0.f;

	float PrevComponentZBias = FLT_MAX;
	float PrevHalfWWorld = -1.f;
	float PrevHalfHWorld = -1.f;

	TArray<FHktTerrainVoxel> ChunkVoxelScratch;
	TArray<FHktTerrainVoxel> AboveChunkVoxelScratch;
	FIntVector AboveChunkCachedCoord = FIntVector(INT_MIN, INT_MIN, INT_MIN);
	bool       bAboveChunkValid      = false;

	TArray<FHktSpriteTerrainSurfaceCell> SurfaceCellsScratch;
};
