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
 * Fallback mode: 셀 1개 = 매 Tick DrawDebugBox 12 라인.
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
 * │  Sprite art 가 아직 없는 dev 단계 — voxel 마다 매 Tick DrawDebugBox  │
 * │  로 12-line wireframe cube 를 그린다. Iso ortho 카메라가 자연스럽게  │
 * │  마름모 + 평행사변형 outline 으로 투영. HISM/머티리얼 불필요.        │
 * │  TypeID 별 base color 적용. Shipping 빌드에선 자동 no-op (debug 라인  │
 * │  은 non-shipping 한정).                                              │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 카메라는 `HktCameraMode_IsometricOrtho` (pitch −30, yaw 45) 고정.
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
 * Fallback mode 는 CPD / 머티리얼 미사용 — 색은 DrawDebugBox 인자.
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

	/** Sprite mode 메인 HISM (Y-billboard quad, 1 instance per voxel). Fallback mode 에서는 미사용. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMComponent;

	/** Sprite mode 메시 — 로컬 XY 평면 1×1 quad, 하단-중앙 피벗 (M_HktSpriteYBillboard 규약). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	/** Sprite mode 머티리얼 (M_HktSpriteYBillboard). Fallback mode 에선 무시. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/** Iso voxel sprite atlas. 미할당 시 Fallback mode 로 진입 (bUseFallbackColors=true 면). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> AtlasTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> PaletteLUT;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D AtlasSizePx = FVector2D(4224.f, 128.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D CellSizePx = FVector2D(128.f, 128.f);

	/** Pixel → World 환산 (cm/px). Sprite mode 에서만 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas",
		meta = (ClampMin = "0.001"))
	float PixelToWorld = 0.166f;

	/**
	 * AtlasTexture 미할당 시 Fallback wireframe 모드 활성화.
	 * voxel 마다 12-line debug box 를 매 Tick 그린다. false 면 미할당 시 무렌더.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Fallback")
	bool bUseFallbackColors = true;

	/** Fallback wireframe 라인 두께 (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Fallback",
		meta = (ClampMin = "0.1", ClampMax = "10.0"))
	float FallbackWireThickness = 0.5f;

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
	/** 청크 voxel 버퍼에서 카메라 노출 표면 voxel 들을 추출. */
	void ExtractSurfaceCells(UHktTerrainSubsystem* Sub, const FIntVector& Coord,
		TArray<FHktSpriteTerrainSurfaceCell>& OutCells);

	/** Sprite mode — CPD 16 floats 채우기. */
	void FillSpriteCustomData(const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const;

	/** Sprite mode — 셀 1개의 인스턴스 Transform. */
	FTransform MakeSpriteInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const;

	FVector GetViewCenterWorldPos() const;

	/** 청크 단위 일괄 추가 (mode 분기). */
	void AddInstancesForChunk(const FIntVector& Coord,
		const TArray<FHktSpriteTerrainSurfaceCell>& Cells);

	/** 청크 단위 일괄 제거 (mode 분기). */
	void RemoveInstancesForChunk(const FIntVector& Coord);

	void SyncLoaderConfig(UHktTerrainSubsystem* Sub);

	float ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const;

	/** Sprite mode 인스턴스 baseline (slot 7/8/15) 일괄 refresh. */
	void RefreshAllSpriteInstanceBaseline();

	void InitSpriteMode();

	/** Fallback mode — 매 Tick 호출, LoadedSurfaceCells 의 모든 voxel 을 DrawDebugBox. */
	void DrawFallbackWireframes(float VoxelSize) const;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TerrainMID;

	TUniquePtr<IHktTerrainChunkLoader> Loader;

	// === Sprite mode 인스턴스 추적 ===
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices;
	TMap<int32, FIntVector> InstanceChunkByIdx;

	/**
	 * Fallback mode — 청크 별 로드된 surface cell 캐시 (HISM 없이 DrawDebugBox 만 사용).
	 * Tick 마다 전체 순회해 12-line cube 를 그린다.
	 */
	TMap<FIntVector, TArray<FHktSpriteTerrainSurfaceCell>> LoadedSurfaceCells;

	/** BeginPlay 에서 결정 — true 면 fallback mode (DrawDebugBox 경로). */
	bool bUsingFallback = false;

	float LastScanTime = -FLT_MAX;
	float CachedChunkWorldSize = 0.f;
	float CachedVoxelSize = 0.f;

	float PrevComponentZBias = FLT_MAX;
	float PrevHalfWWorld = -1.f;
	float PrevHalfHWorld = -1.f;

	TArray<FHktTerrainVoxel> ChunkVoxelScratch;
	TArray<FHktTerrainVoxel> AboveChunkVoxelScratch;
	FIntVector AboveChunkCachedCoord = FIntVector(INT_MIN, INT_MIN, INT_MIN);
	bool       bAboveChunkValid      = false;

	TArray<FHktSpriteTerrainSurfaceCell> SurfaceCellsScratch;
};
