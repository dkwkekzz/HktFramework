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
 * 각 셀이 HISM 인스턴스 1개 = upright Y-billboard quad 1장.
 * 화가가 그린 iso voxel sprite (마름모 top + 기둥 측면 통합 art) 한 장이 quad 에 매핑된다.
 */
struct FHktSpriteTerrainSurfaceCell
{
	FIntVector ChunkCoord = FIntVector::ZeroValue;
	FIntVector LocalCoord = FIntVector::ZeroValue;     // 청크 내 (X, Y, Z) 0..ChunkSize-1
	FVector    WorldPos   = FVector::ZeroVector;       // voxel 바닥-중앙 월드 좌표 (quad pivot 일치점)
	uint16     TypeID      = 0;
	uint8      PaletteIndex = 0;
	uint8      Flags        = 0;
};

/**
 * AHktSpriteTerrainActor
 *
 * SC1/StarCraft 맵 에디터 방식의 iso 스프라이트 지형 렌더러.
 *
 * 각 voxel 데이터 위치마다 upright Y-axis billboard quad 1장을 세우고, 화가가 그린
 * iso voxel sprite (마름모 top + 좌·우 측면이 하나의 PNG 에 통합된 art) 를 매핑한다.
 * 카메라는 `HktCameraMode_IsometricOrtho` (pitch −30, yaw 45) 고정이라 sprite 한 장이
 * 3D voxel 의 시각적 환영을 그대로 carry 한다.
 *
 * ============================================================================
 * [데이터 / 머티리얼 사양]
 * ============================================================================
 *  - 컴포넌트  : UHierarchicalInstancedStaticMeshComponent (단일)
 *  - Mesh      : 1×1 vertical quad, 로컬 XY 평면, 피벗 하단-중앙
 *                (HktSpriteCore Crowd Renderer 와 동일 메시 규약)
 *  - Material  : M_HktSpriteYBillboard (Y-axis billboard).
 *                현재 액터 default(`M_HktSpriteTerrainBillboard`, Z-up plane)는 SC-tile
 *                방식과 부적합 → BeginPlay 에서 TerrainMaterial 미할당 시 자동 폴백.
 *
 *  PerInstanceCustomData 매핑 (NumCustomDataFloats = 16, M_HktSpriteYBillboard 규약):
 *    | slot | 용도          | 본 액터에서                                   |
 *    |------|---------------|-----------------------------------------------|
 *    | 0    | AtlasIndex    | cell.TypeID  (atlas grid cell index)          |
 *    | 1    | CellW (px)    | CellSizePx.X                                  |
 *    | 2    | CellH (px)    | CellSizePx.Y                                  |
 *    | 3    | (reserved)    | 0                                             |
 *    | 4    | PivotOffX (w) | 0  (quad mesh 가 이미 bottom-center pivot)    |
 *    | 5    | PivotOffY (w) | 0                                             |
 *    | 6    | RotRad        | 0                                             |
 *    | 7    | HalfW (world) | CellSizePx.X × PixelToWorld × 0.5             |
 *    | 8    | HalfH (world) | CellSizePx.Y × PixelToWorld × 0.5             |
 *    | 9~12 | Tint RGBA     | Flags 기반 보조 (TRANSLUCENT → alpha 0.6)     |
 *    | 13   | PaletteIndex  | cell.PaletteIndex                             |
 *    | 14   | FlipX         | 0                                             |
 *    | 15   | ZBias (cm)    | ComponentZBias (CrowdRenderer slot 15 와 동일)|
 *
 * ============================================================================
 * [Atlas 텍스처 규약]
 * ============================================================================
 *   - AtlasTexture 한 장에 TypeID 별 iso voxel sprite 가 grid 로 배치된다.
 *   - 기본 4224×128 = 33 cells × 128px (현재 자산 그대로). 애니메이션은 cell 행 추가.
 *   - 각 cell 안에는 한 voxel 의 iso ortho 룩 (마름모 top + 좌/우 측면 + 임의 장식)
 *     이 통째로 그려져 있어야 한다. 피벗은 cell 하단-중앙 (= voxel 바닥 중앙에 정렬).
 *
 * ============================================================================
 * [데이터 흐름]
 * ============================================================================
 *   IHktTerrainChunkLoader::Update(CameraPos)        (Game Thread, Tick)
 *     → 가시 영역 청크 좌표 enumerate
 *     → ChunksToLoad / ChunksToUnload 두 set 출력
 *
 *   For each ChunksToLoad:
 *     UHktTerrainSubsystem::AcquireChunk(coord, buffer-out)
 *     → ExtractSurfaceCells(buffer)  → TArray<FHktSpriteTerrainSurfaceCell>
 *         (청크 내 (LX, LY) 별 topmost-exposed solid voxel)
 *     → AddInstancesForChunk(cells)  → HISM AddInstance × N
 *
 *   For each ChunksToUnload:
 *     RemoveInstancesForChunk(coord)  → HISM RemoveInstance × N + swap remap
 *
 *   v1: 청크 in-place 갱신 없음 (지형 정적 가정). v2 에서 cave / overhang 추가 예정.
 *
 * ============================================================================
 * [Crowd 와의 depth 정렬]
 * ============================================================================
 * Sprite Crowd (캐릭터) 와의 z-fighting 은 ComponentZBias 로 해소.
 * 본 액터는 0 (베이스라인), Crowd 는 작은 양수 (예: +1cm) 로 두면 캐릭터가 항상
 * 지형 위에 안정적으로 그려진다. 모든 ZBias 는 머티리얼 WPO 가 카메라 쪽으로
 * 밀어내는 cm 단위 오프셋이며, depth-buffer 에 그대로 반영된다.
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

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite")
	TObjectPtr<UHierarchicalInstancedStaticMeshComponent> HISMComponent;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	/**
	 * 머티리얼. v1 부터 M_HktSpriteYBillboard (Y-axis billboard) 사용.
	 * 미할당이면 BeginPlay 에서 HktSpriteBillboardMaterial::GetDefault() 로 폴백.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/** Iso voxel sprite atlas. 각 cell 에 한 voxel 의 iso ortho 룩이 통째로 그려져 있어야 함. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> AtlasTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> PaletteLUT;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D AtlasSizePx = FVector2D(4224.f, 128.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D CellSizePx = FVector2D(128.f, 128.f);

	/**
	 * Pixel → World 환산 (cm/px). voxel 1개를 sprite 1 cell 에 정확히 매핑하려면
	 * 화가가 그린 sprite 의 iso 마름모 가로폭과 voxel 의 iso 가로폭이 일치해야 한다.
	 *
	 *   기본 0.166 ≈ (VoxelSize × √2) / CellSizePx.X    (=15 × 1.414 / 128)
	 *
	 * voxel 큐브 한 변(15cm)의 iso 가로 투영(√2 배) 이 128px cell 폭에 들어맞는 값.
	 * Sprite art / voxel size / cell size 변경 시 재튜닝.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas",
		meta = (ClampMin = "0.001"))
	float PixelToWorld = 0.166f;

	// === 데이터 소스 ===

	/**
	 * 베이크된 청크 자산. UHktTerrainSubsystem 이 비동기 로드.
	 * 미할당/로드 영역 밖 청크는 런타임 폴백 (FHktTerrainGenerator) 으로 동일하게 생성된다.
	 */
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
	 * 노출 판정: 해당 voxel 의 +Z 이웃이 비어 있어야 함 (같은 청크 안 or 위 청크 (0,0)).
	 */
	void ExtractSurfaceCells(UHktTerrainSubsystem* Sub, const FIntVector& Coord,
		TArray<FHktSpriteTerrainSurfaceCell>& OutCells);

	/** 셀 1개의 HISM CPD 16 floats 채우기 (M_HktSpriteYBillboard 슬롯 규약). */
	void FillCustomData(const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const;

	/** 셀 1개의 인스턴스 Transform — 회전 identity, 위치 = voxel 바닥-중앙. */
	FTransform MakeInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const;

	/** 카메라 / 가시성 기준점 */
	FVector GetViewCenterWorldPos() const;

	/** 청크 단위 일괄 인스턴스 추가 (Loader ChunksToLoad emit 시점). */
	void AddInstancesForChunk(const FIntVector& Coord,
		const TArray<FHktSpriteTerrainSurfaceCell>& Cells);

	/** 청크 단위 일괄 인스턴스 제거 (Loader ChunksToUnload emit 시점). */
	void RemoveInstancesForChunk(const FIntVector& Coord);

	/** UPROPERTY 변경이 즉시 반영되도록 매 Tick 로더에 Config 주입 */
	void SyncLoaderConfig(UHktTerrainSubsystem* Sub);

	/** 청크 한 변의 월드 크기 (cm) — Subsystem 의 effective config 에서 산출. */
	float ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const;

	/** ComponentZBias / Sprite size 변경 시 모든 인스턴스 일괄 refresh. */
	void RefreshAllInstanceBaseline();

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TerrainMID;

	/** 스트리밍 전략 (BeginPlay 1회 생성). */
	TUniquePtr<IHktTerrainChunkLoader> Loader;

	/** 청크별 보유 HISM 인스턴스 인덱스 목록 (RemoveInstancesForChunk 에서 사용). */
	TMap<FIntVector, TArray<int32>> ChunkInstanceIndices;

	/** InstanceIndex → ChunkCoord 역매핑 (RemoveInstance 스왑 보정). */
	TMap<int32, FIntVector> InstanceChunkByIdx;

	/** 마지막 스캔 시각 (GetWorld()->GetTimeSeconds 기준) */
	float LastScanTime = -FLT_MAX;

	/** Subsystem 으로부터 캐시된 청크 월드 크기 — Config 변경 시 재계산. */
	float CachedChunkWorldSize = 0.f;

	/** 변경 감지용 — 변경 시 RefreshAllInstanceBaseline 트리거. */
	float PrevComponentZBias = FLT_MAX;
	float PrevHalfWWorld = -1.f;
	float PrevHalfHWorld = -1.f;

	/**
	 * AcquireChunk 임시 버퍼 — Tick 당 여러 청크 처리 시 재사용 (32768 voxel × 4B = 128 KB).
	 * 매 호출마다 SetNumUninitialized 로 재할당하지 않도록 멤버 풀로 보관.
	 */
	TArray<FHktTerrainVoxel> ChunkVoxelScratch;

	/**
	 * 경계 voxel (LocalZ==ChunkSize-1) 의 +Z 노출 판정을 위한 위 청크 voxel 캐시.
	 * 한 Tick 내 다수 (LX, LY) 가 같은 위 청크를 참조하므로 코드 1회 fetch 후 재사용.
	 */
	TArray<FHktTerrainVoxel> AboveChunkVoxelScratch;
	FIntVector AboveChunkCachedCoord = FIntVector(INT_MIN, INT_MIN, INT_MIN);
	bool       bAboveChunkValid      = false;

	/** Surface 셀 추출 임시 버퍼 — 청크 처리 직후 reuse. */
	TArray<FHktSpriteTerrainSurfaceCell> SurfaceCellsScratch;
};
