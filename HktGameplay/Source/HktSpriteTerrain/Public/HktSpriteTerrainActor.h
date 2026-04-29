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
 * FHktSpriteTerrainSurfaceCell — 가시 영역 top-most 셀 1개.
 *
 * UHktTerrainSubsystem::AcquireChunk 가 채운 청크 voxel 버퍼에서 추출한 표면 셀.
 * ChunkCoord 가 InstanceMap 의 키 역할을 하며, 청크당 1 HISM 인스턴스로 매핑된다.
 */
struct FHktSpriteTerrainSurfaceCell
{
	FIntVector ChunkCoord = FIntVector::ZeroValue;
	FVector WorldPos = FVector::ZeroVector;
	uint16  TypeID = 0;
	uint8   PaletteIndex = 0;
	uint8   Flags = 0;
};

/**
 * AHktSpriteTerrainActor
 *
 * UHktTerrainSubsystem 단일 출처에서 청크 데이터를 받아 표면 셀을 추출,
 * 단일 HISM 컴포넌트에 청크당 1 인스턴스로 매핑하는 스프라이트 기반 지형 렌더러.
 *
 * Voxel 메싱 파이프라인(HktVoxelCore RenderCache) 의존이 없으며, AcquireChunk 결과
 * (FHktTerrainVoxel[32768]) 를 직접 스캔한다. 따라서 Sprite-only 배포에서 Voxel
 * Actor 가 월드에 없어도 단독 동작한다.
 *
 * ============================================================================
 * [HISM 렌더링 스펙]
 * ============================================================================
 *  - 컴포넌트  : UHierarchicalInstancedStaticMeshComponent (단일)
 *  - Mesh      : 1×1 unit quad (Z-up). 인스턴스 = 청크 top tile 1개
 *  - Material  : M_HktSpriteTerrainBillboard (Z-up quad, ground 평면)
 *                ※ HktSpriteCore 의 M_HktSpriteYBillboard (Y-axis billboard,
 *                   캐릭터 직립) 와는 별개. 본 액터의 quad 는 지면에 누운다.
 *
 *  PerInstanceCustomData 매핑 (NumCustomDataFloats = 16):
 *    | slot | 용도          | 본 액터에서                                   |
 *    |------|---------------|-----------------------------------------------|
 *    | 0    | AtlasIdx      | cell.TypeID                                   |
 *    | 1    | CellW         | CellSizePx.X                                  |
 *    | 2    | CellH         | CellSizePx.Y                                  |
 *    | 3    | (reserved)    | 0                                             |
 *    | 4    | OffX          | 0                                             |
 *    | 5    | OffY          | 0                                             |
 *    | 6    | RotR          | 0 (iso 고정)                                  |
 *    | 7    | ScaleX        | ChunkWorldSize / 2                            |
 *    | 8    | ScaleY        | ChunkWorldSize / 2                            |
 *    | 9~12 | Tint RGBA     | Flags 기반 보조 (TRANSLUCENT=alpha 0.6 등)    |
 *    | 13   | PaletteIndex  | cell.PaletteIndex                             |
 *    | 14   | FlipV         | 0                                             |
 *    | 15   | ZBias         | ComponentZBias (cm; CrowdRenderer 와 동일 슬롯)|
 *
 * ============================================================================
 * [데이터 흐름]
 * ============================================================================
 *   IHktTerrainChunkLoader::Update(CameraPos)        (Game Thread, Tick)
 *     → 가시 영역 청크 좌표 enumerate
 *     → UHktTerrainSubsystem::AcquireChunk(coord, buffer-out)
 *     → ScanTopSurface(buffer)  → FHktSpriteTerrainSurfaceCell
 *     → diff (InstanceMap)
 *         · 신규 키        → AddInstance + SetCustomData
 *         · 변경 키        → UpdateInstanceTransform / SetCustomDataValue
 *         · 사라진 키      → RemoveInstance (스왑 보정)
 *
 * ============================================================================
 * [Crowd 와의 depth 정렬]
 * ============================================================================
 * Sprite Crowd (캐릭터, Y-axis 직립) 와의 z-fighting 은 ComponentZBias 로 해소.
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

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> AtlasTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UTexture2D> PaletteLUT;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D AtlasSizePx = FVector2D(4224.f, 128.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Atlas")
	FVector2D CellSizePx = FVector2D(128.f, 128.f);

	// === 데이터 소스 ===

	/**
	 * 베이크된 청크 자산. UHktTerrainSubsystem 이 비동기 로드.
	 * 미할당/로드 영역 밖 청크는 런타임 폴백 (FHktTerrainGenerator) 으로 동일하게 생성된다.
	 *
	 * 한 World 에 단일 BakedAsset 정책 — VoxelTerrainActor 와 함께 배치되어 있다면
	 * 어느 한 쪽이 LoadBakedAsset 을 호출하면 충분하다 (가장 최근 호출이 우선).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Source")
	TSoftObjectPtr<UHktTerrainBakedAsset> BakedAsset;

	// === 스트리밍 ===

	/**
	 * 청크 로딩 전략. Voxel 액터와 동일 인터페이스.
	 *  - Legacy   : 단일 반경 내 모든 청크.
	 *  - Proximity: 근거리/원거리 2링. iso 카메라에서 보통 Legacy 로 충분.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming")
	EHktTerrainLoaderType LoaderType = EHktTerrainLoaderType::Legacy;

	/** 스트리밍 반경 (UE 유닛). iso ortho 카메라 기준 화면 대각 + 여유. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "480", ClampMax = "1024000"))
	float StreamRadius = 4000.f;

	/** Proximity 모드에서만 사용 — 원거리 링 반경. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "480", ClampMax = "1024000",
				EditCondition = "LoaderType == EHktTerrainLoaderType::Proximity"))
	float ProximityFarRadius = 8000.f;

	/** 프레임당 최대 청크 처리 수. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = 1, ClampMax = 64))
	int32 MaxLoadsPerFrame = 16;

	/** 동시에 활성 가능한 최대 청크 수 (= 인스턴스 수 상한). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = 0))
	int32 MaxLoadedChunks = 1024;

	/** 초당 surface 스캔 횟수 상한 — 카메라/월드 변화 없으면 스킵. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming",
		meta = (ClampMin = "1.0", ClampMax = "120.0"))
	float MaxScansPerSecond = 30.0f;

	// === Depth 정렬 ===

	/**
	 * 본 컴포넌트(액터의 HISM) 의 모든 인스턴스에 일괄 적용되는 Z-bias (cm).
	 *
	 * 머티리얼 WPO 가 카메라 쪽으로 cm 만큼 밀어내며 depth-buffer 에 반영된다.
	 * Sprite Crowd (캐릭터) 와의 정렬:
	 *   - Terrain  : ComponentZBias = 0   (베이스라인)
	 *   - Crowd    : ComponentZBias = +1  (지형 위)
	 * 본 값은 양수일수록 카메라 쪽 (= 다른 액터 앞).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Depth")
	float ComponentZBias = 0.f;

private:
	/** UHktTerrainSubsystem 에서 청크 voxel 을 받아 top-most 셀 1개 추출. */
	bool ExtractTopSurfaceCell(UHktTerrainSubsystem* Sub, const FIntVector& Coord,
		FHktSpriteTerrainSurfaceCell& OutCell) const;

	/** Surface cell → HISM PerInstanceCustomData 16 floats 변환 */
	void FillCustomData(const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const;

	/** Surface cell → HISM 인스턴스 Transform */
	FTransform MakeInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const;

	/** 카메라 / 가시성 기준점 */
	FVector GetViewCenterWorldPos() const;

	/** 청크 추가 / 갱신 */
	void AddOrUpdateInstance(const FHktSpriteTerrainSurfaceCell& Cell);

	/** 청크 인스턴스 제거 + InstanceMap 스왑 보정 */
	void RemoveInstanceForCoord(const FIntVector& Coord);

	/** UPROPERTY 변경이 즉시 반영되도록 매 Tick 로더에 Config 주입 */
	void SyncLoaderConfig(UHktTerrainSubsystem* Sub);

	/** 청크 한 변의 월드 크기 (cm) — Subsystem 의 effective config 에서 산출. */
	float ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> TerrainMID;

	/** 스트리밍 전략 (BeginPlay 1회 생성). */
	TUniquePtr<IHktTerrainChunkLoader> Loader;

	/** ChunkCoord → HISM InstanceIndex */
	TMap<FIntVector, int32> InstanceMap;

	/** InstanceIndex → ChunkCoord 역매핑 (RemoveInstance 의 스왑 보정용) */
	TMap<int32, FIntVector> InstanceCoordByIndex;

	/** ChunkCoord → 마지막 push 된 셀 (재push 여부 판정용) */
	TMap<FIntVector, FHktSpriteTerrainSurfaceCell> LastCellByCoord;

	/** 마지막 스캔 시각 (GetWorld()->GetTimeSeconds 기준) */
	float LastScanTime = -FLT_MAX;

	/** Subsystem 으로부터 캐시된 청크 월드 크기 — Config 변경 시 재계산. */
	float CachedChunkWorldSize = 0.f;
};
