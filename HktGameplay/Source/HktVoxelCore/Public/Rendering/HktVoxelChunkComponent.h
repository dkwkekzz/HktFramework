// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/PrimitiveComponent.h"
#include "Data/HktVoxelTypes.h"
#include "HktVoxelChunkComponent.generated.h"

class FHktVoxelRenderCache;

/** 텍스처+샘플러 RHI 쌍 — 타일/머티리얼 텍스처 전달에 공용 */
struct FHktVoxelTexturePair
{
	FRHITexture* Texture = nullptr;
	FRHISamplerState* Sampler = nullptr;

	bool IsValid() const { return Texture != nullptr; }
};

/** 타일 텍스처 셋 (Texture2DArray + IndexLUT) */
struct FHktVoxelTileTextureSet
{
	FHktVoxelTexturePair TileArray;
	FHktVoxelTexturePair TileIndexLUT;

	bool IsValid() const { return TileArray.IsValid() && TileIndexLUT.IsValid(); }
};

/**
 * UHktVoxelChunkComponent
 *
 * Actor에 부착하여 청크 단위 복셀 메시를 렌더링한다.
 * 메싱 완료 시 OnMeshReady()를 호출하면 SceneProxy에 새 메시 데이터를 전달한다.
 *
 * 주의: 복셀마다 Component를 만들지 말 것 — 청크(32x32x32) 단위 1개.
 */
UCLASS(ClassGroup = (HktVoxel), meta = (BlueprintSpawnableComponent))
class HKTVOXELCORE_API UHktVoxelChunkComponent : public UPrimitiveComponent
{
	GENERATED_BODY()

public:
	UHktVoxelChunkComponent();

	/** 초기화 — 렌더 캐시와 청크 좌표 바인딩. InVoxelSize=0이면 기본값(VOXEL_SIZE) 사용 */
	void Initialize(FHktVoxelRenderCache* Cache, const FIntVector& InChunkCoord, float InVoxelSize = 0.f);

	/** 메싱 완료 시 호출 → SceneProxy에 새 메시 데이터 전달 (ENQUEUE_RENDER_COMMAND) */
	void OnMeshReady();

	/**
	 * GPU 스키닝용 본 트랜스폼 업데이트 — 매 프레임 Tick에서 호출.
	 * 3x4 affine matrix × NumBones. float4 × 3 per bone.
	 * 인덱스 0은 identity(루트/스키닝 없음), 유효 본은 인덱스 1~.
	 */
	void UpdateBoneTransforms(const TArray<FVector4f>& BoneMatrixRows);

	/** 청크 좌표 반환 */
	FIntVector GetChunkCoord() const { return ChunkCoord; }

	/** 복셀 크기 반환 (UE 유닛) */
	float GetVoxelSize() const { return CachedVoxelSize; }

	/** 복셀 렌더링용 머티리얼 설정 (팔레트 기반 단일 머티리얼) */
	void SetVoxelMaterial(UMaterialInterface* InMaterial);

	/** 타일 텍스처 설정 — OnMeshReady에서 Proxy에 전달 */
	void SetTileTextures(const FHktVoxelTileTextureSet& InTileTextures);

	/** 머티리얼 LUT 설정 — OnMeshReady에서 Proxy에 전달 */
	void SetMaterialLUT(const FHktVoxelTexturePair& InMaterialLUT);

	/** 캐시된 타일 텍스처 셋 유효 여부 (TileArray RHI는 비동기 빌드라 재시도 필요) */
	bool HasCachedTileTextures() const { return CachedTileTextures.IsValid(); }

	/** 캐시된 머티리얼 LUT 유효 여부 */
	bool HasCachedMaterialLUT() const { return CachedMaterialLUT.IsValid(); }

	/** 그림자 최대 거리 설정 (UE 유닛). 0이면 항상 그림자 ON */
	void SetShadowDistance(float InDistance) { ShadowDistance = InDistance; }
	float GetShadowDistance() const { return ShadowDistance; }

	// UPrimitiveComponent
	virtual FPrimitiveSceneProxy* CreateSceneProxy() override;
	virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
	virtual int32 GetNumMaterials() const override { return 1; }

private:
	FIntVector ChunkCoord = FIntVector::ZeroValue;
	FHktVoxelRenderCache* RenderCache = nullptr;
	float CachedVoxelSize = FHktVoxelChunk::VOXEL_SIZE;

	FHktVoxelTileTextureSet CachedTileTextures;
	FHktVoxelTexturePair CachedMaterialLUT;
	bool bStyleTexturesApplied = false;
	float ShadowDistance = 0.f;
};
