// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/HktVoxelRenderCache.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "HktVoxelTerrainStreamer.h"
#include "Terrain/HktTerrainGenerator.h"
#include "HktVoxelTerrainActor.generated.h"

struct FHktTerrainGeneratorConfig;
class UHktVoxelChunkComponent;
class UHktVoxelTileAtlas;
class UHktVoxelMaterialLUT;

/**
 * FHktVoxelBlockStyle — TypeID별 시각 정의
 *
 * 에디터에서 블록 타입별 텍스처(Top/Side/Bottom)와 PBR 속성을 지정한다.
 * TerrainActor가 BeginPlay에서 이 배열을 Texture2DArray + MaterialLUT로 빌드.
 */
USTRUCT(BlueprintType)
struct FHktVoxelBlockStyle
{
	GENERATED_BODY()

	/** 대응하는 복셀 TypeID (HktTerrainType 참조) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	int32 TypeID = 0;

	/** 블록 이름 (에디터 표시용) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	FString DisplayName;

	// --- 텍스처 (면 방향별) ---

	/** +Z(위) 면 텍스처. nullptr이면 SideTexture 사용 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> TopTexture;

	/** ±X/±Y(옆) 면 텍스처. 필수 — nullptr이면 팔레트 폴백 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> SideTexture;

	/** -Z(아래) 면 텍스처. nullptr이면 SideTexture 사용 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> BottomTexture;

	// --- PBR 속성 ---

	/** 표면 거칠기 (0=매끈/반사, 1=거침/매트) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Roughness = 0.8f;

	/** 금속성 (0=비금속, 1=금속) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Metallic = 0.0f;

	/** 스페큘러 반사 강도 (0=없음, 1=최대) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Specular = 0.5f;
};

/**
 * AHktVoxelTerrainActor
 *
 * 월드에 1개 배치하여 복셀 테레인 전체를 관리한다.
 * 테레인 전용 RenderCache + MeshScheduler를 소유하고,
 * 카메라 기반 스트리밍으로 ChunkComponent를 동적 생성/풀링한다.
 *
 * 데이터 흐름:
 *   Streamer → Generator.GenerateChunk() → RenderCache → MeshScheduler → ChunkComponent → GPU
 */
UCLASS(ClassGroup = (HktVoxel))
class HKTVOXELTERRAIN_API AHktVoxelTerrainActor : public AActor
{
	GENERATED_BODY()

public:
	AHktVoxelTerrainActor();
	~AHktVoxelTerrainActor();

	// === 외부 API (VM 연동) ===

	/** VM에서 청크 데이터를 수신하여 로드 */
	void LoadTerrainChunk(const FIntVector& ChunkCoord, const struct FHktVoxel* VoxelData, int32 VoxelCount);

	/** VM에서 청크 언로드 요청 (스트리밍 아웃) */
	void UnloadTerrainChunk(const FIntVector& ChunkCoord);

	/** RenderCache 직접 접근 (테스트/디버그용) */
	FHktVoxelRenderCache* GetTerrainCache() const { return TerrainCache.Get(); }

	// === 설정 ===

	/** 카메라로부터 청크 로드/유지 거리 (UE 유닛). 3200 = 청크 1개분 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 3200, ClampMax = 204800))
	float ViewDistance = 32000.f;  // 10청크 반경 ≈ 320m

	/** 프레임당 최대 청크 생성+로드 수 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 1, ClampMax = 32))
	int32 MaxLoadsPerFrame = 4;

	/** 프레임당 최대 메싱 수 (MeshScheduler에 전달) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Meshing", meta = (ClampMin = 1, ClampMax = 16))
	int32 MaxMeshPerFrame = 4;

	/** 동시에 로드 가능한 최대 청크 수 (메모리 예산). 0이면 제한 없음 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 0))
	int32 MaxLoadedChunks = 2048;

	/**
	 * 테레인 높이 범위 — Z축 청크 좌표 [MinZ, MaxZ].
	 * BeginPlay에서 UHktRuntimeGlobalSetting에서 읽어 초기화된다 (시뮬레이션과 공유).
	 * 직접 편집 불가 — 전역 설정이 단일 출처.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Streaming", Transient)
	int32 HeightMinZ = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Streaming", Transient)
	int32 HeightMaxZ = 3;

	/** 테레인 렌더링용 머티리얼 (팔레트 기반) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/** 그림자 렌더링 최대 거리 (UE 유닛). 이 거리 밖 청크는 그림자를 드리우지 않음. 0이면 항상 ON */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering", meta = (ClampMin = 0))
	float ShadowDistance = 16000.f;

	// === 블록 스타일 (Phase 1+2: 타일 텍스처 + PBR) ===

	/**
	 * 블록 타입별 시각 정의.
	 * TypeID별 텍스처(Top/Side/Bottom)와 PBR(Roughness/Metallic/Specular)을 지정.
	 * BeginPlay에서 자동으로 Texture2DArray + MaterialLUT로 빌드된다.
	 * 비어있으면 기존 팔레트 렌더링 그대로 동작.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Style",
		meta = (TitleProperty = "{DisplayName} (ID:{TypeID})"))
	TArray<FHktVoxelBlockStyle> BlockStyles;

	/**
	 * 복셀 1개의 월드 크기 (UE 유닛).
	 * BeginPlay에서 UHktRuntimeGlobalSetting::VoxelSizeCm에서 읽어 초기화된다.
	 * 직접 편집 불가 — 전역 설정이 단일 출처.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Rendering", Transient)
	float VoxelSize = 15.0f;

	/** 컴포넌트 풀 초기 크기 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 16, ClampMax = 2048))
	int32 InitialPoolSize = 64;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaTime) override;

private:
	/** 카메라 위치 가져오기 */
	FVector GetCameraWorldPos() const;

	/** 절차적 생성 + RenderCache 로드 + 컴포넌트 할당 */
	void GenerateAndLoadChunk(const FIntVector& ChunkCoord);

	/** 스트리밍 결과 반영 — 청크 로드/언로드 + 컴포넌트 할당 */
	void ProcessStreamingResults();

	/** 메싱 완료된 청크의 컴포넌트 갱신 */
	void ProcessMeshReadyChunks();

	/**
	 * ActiveChunks 전체에 대해 스타일 텍스처 캐시 재시도 + Proxy 전달.
	 *
	 * BuildTerrainStyle의 UpdateResource()가 비동기이므로, 최초 ApplyStyleToComponent
	 * 호출 시점에는 TileArray RHI가 아직 nullptr일 수 있다. 이전 구현은 ProcessMeshReadyChunks
	 * 안에서 bMeshReady=true인 틱에만 재시도를 수행했는데, 정적 청크는 메싱이 한 번만
	 * 발생하므로 RHI가 그 틱 안에 준비되지 않으면 다시는 재시도할 기회가 없었다.
	 *
	 * 매 Tick 호출되어 캐시가 완성되는 즉시 PushStyleTexturesToProxy로 Proxy에 전달한다.
	 */
	void PumpStyleTextures();

	/** 컴포넌트 풀 관리 */
	UHktVoxelChunkComponent* AcquireComponent();
	void ReleaseComponent(UHktVoxelChunkComponent* Comp);
	void PrewarmPool(int32 Count);

	/** BlockStyles 배열로부터 Texture2DArray + LUT + MaterialLUT를 빌드 */
	void BuildTerrainStyle();

	/** 청크 컴포넌트에 타일/머티리얼 텍스처를 적용 */
	void ApplyStyleToComponent(UHktVoxelChunkComponent* Comp);

	// === 내부 상태 ===

	TUniquePtr<FHktVoxelRenderCache> TerrainCache;
	TUniquePtr<FHktVoxelMeshScheduler> TerrainMeshScheduler;
	TUniquePtr<FHktVoxelTerrainStreamer> Streamer;
	TUniquePtr<FHktTerrainGenerator> Generator;

	/** 활성 청크 → 컴포넌트 매핑 */
	TMap<FIntVector, UHktVoxelChunkComponent*> ActiveChunks;

	/** 비활성 컴포넌트 풀 (재사용) */
	TArray<UHktVoxelChunkComponent*> ComponentPool;

	/** 청크 월드 크기 = SIZE * VoxelSize */
	float GetChunkWorldSize() const { return FHktVoxelChunk::SIZE * VoxelSize; }

	// === 스타일 빌드 결과 (BeginPlay에서 생성) ===

	UPROPERTY(Transient)
	TObjectPtr<UHktVoxelTileAtlas> BuiltTileAtlas;

	UPROPERTY(Transient)
	TObjectPtr<UHktVoxelMaterialLUT> BuiltMaterialLUT;

	/** 스타일이 빌드되었는지 (BlockStyles가 비어있으면 false → 기존 팔레트 폴백) */
	bool bStyleBuilt = false;
};
