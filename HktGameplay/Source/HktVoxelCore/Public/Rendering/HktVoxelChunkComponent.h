// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/PrimitiveComponent.h"
#include "Data/HktVoxelTypes.h"
#include "HktVoxelChunkComponent.generated.h"

class FHktVoxelRenderCache;
class UBodySetup;

/** 텍스처+샘플러 RHI 쌍 — 타일/머티리얼 텍스처 전달에 공용 */
struct FHktVoxelTexturePair
{
	FRHITexture* Texture = nullptr;
	FRHISamplerState* Sampler = nullptr;

	bool IsValid() const { return Texture != nullptr; }
};

/** 타일 텍스처 셋 (Texture2DArray + IndexLUT + 기본 팔레트 + 옵션 NormalArray) */
struct FHktVoxelTileTextureSet
{
	FHktVoxelTexturePair TileArray;
	FHktVoxelTexturePair TileIndexLUT;

	/**
	 * 타일 활성 시 기본 팔레트 텍스처 (8×256 흰색).
	 * GWhiteTexture(1x1)를 팔레트로 사용하면 Load(int3(PaletteIdx, VoxelType, 0))이
	 * VoxelType>0에서 out-of-bounds → (0,0,0,0)을 반환하여 TileColor * 0 = 검정이 됨.
	 * 유효한 크기의 흰색 팔레트를 제공하여 PaletteTint = (1,1,1,1)을 보장.
	 */
	FHktVoxelTexturePair DefaultPalette;

	/**
	 * 노멀맵 배열 (선택). TileArray와 동일한 슬라이스 인덱싱.
	 * 미설정이면 셰이더가 플랫 노멀로 폴백. IsValid()에는 포함되지 않음 (옵션).
	 */
	FHktVoxelTexturePair NormalArray;

	bool IsValid() const { return TileArray.IsValid() && TileIndexLUT.IsValid(); }
	bool HasNormalArray() const { return NormalArray.IsValid(); }
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

	/**
	 * 디버그 시각화용 자동 생성 머티리얼 — Wireframe + Unlit + VertexColor→Emissive.
	 * AHktVoxelTerrainActor::bDebugRenderMode 활성 시 폴백으로 사용된다.
	 * 에디터/개발 빌드에서만 유효 (WITH_EDITORONLY_DATA). Shipping은 엔진 기본 머티리얼.
	 */
	static UMaterialInterface* GetDebugWireframeMaterial();

	/** 타일 텍스처 설정 — OnMeshReady에서 Proxy에 전달 */
	void SetTileTextures(const FHktVoxelTileTextureSet& InTileTextures);

	/** 머티리얼 LUT 설정 — OnMeshReady에서 Proxy에 전달 */
	void SetMaterialLUT(const FHktVoxelTexturePair& InMaterialLUT);

	/** 캐시된 타일 텍스처 셋 유효 여부 (TileArray RHI는 비동기 빌드라 재시도 필요) */
	bool HasCachedTileTextures() const { return CachedTileTextures.IsValid(); }

	/** 캐시된 머티리얼 LUT 유효 여부 */
	bool HasCachedMaterialLUT() const { return CachedMaterialLUT.IsValid(); }

	/** Proxy 생성 시 캐시된 텍스처를 Pending*에 복사하기 위한 접근자 */
	const FHktVoxelTileTextureSet& GetCachedTileTextures() const { return CachedTileTextures; }
	const FHktVoxelTexturePair& GetCachedMaterialLUT() const { return CachedMaterialLUT; }

	/** 스타일 텍스처가 현재 SceneProxy로 이미 전달되었는지 여부 */
	bool IsStyleTexturesApplied() const { return bStyleTexturesApplied; }

	/**
	 * 캐시된 스타일 텍스처(TileArray/IndexLUT/MaterialLUT)를
	 * 메시 재업로드 없이 현재 SceneProxy로 전달한다.
	 *
	 * 사용 목적: BuildTerrainStyle의 UpdateResource()가 비동기이므로
	 * 메시가 먼저 업로드된 후에야 TileArray RHI가 준비되는 경우,
	 * OnMeshReady 이벤트 없이도 텍스처만 따로 밀어넣기 위함.
	 */
	void PushStyleTexturesToProxy();

	/** 스타일라이즈 렌더링 토글 (메이플2풍 카툰 셰이딩) */
	void SetStylizedRendering(bool bEnabled);
	bool IsStylizedRendering() const { return bStylizedRendering; }

	/** 엣지 라운딩 강도 (0=off, 0.3~0.6 권장). PS 노멀 벤딩으로 복셀 경계를 둥글게 보이게 함 */
	void SetEdgeRoundStrength(float InStrength);
	float GetEdgeRoundStrength() const { return EdgeRoundStrength; }

	/** 노멀맵 강도 (0=off, 1=원본). NormalArray가 설정된 경우에만 효과 있음 */
	void SetNormalMapStrength(float InStrength);
	float GetNormalMapStrength() const { return NormalMapStrength; }

	/** 그림자 최대 거리 설정 (UE 유닛). 0이면 항상 그림자 ON */
	void SetShadowDistance(float InDistance) { ShadowDistance = InDistance; }
	float GetShadowDistance() const { return ShadowDistance; }

	// UPrimitiveComponent
	virtual FPrimitiveSceneProxy* CreateSceneProxy() override;
	virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
	virtual UBodySetup* GetBodySetup() override;
	virtual int32 GetNumMaterials() const override { return 1; }
	virtual UMaterialInterface* GetMaterial(int32 ElementIndex) const override
	{
		return (ElementIndex == 0) ? CachedVoxelMaterial.Get() : nullptr;
	}
	virtual void GetUsedMaterials(TArray<UMaterialInterface*>& OutMaterials, bool bGetDebugMaterials = false) const override
	{
		if (UMaterialInterface* Mat = CachedVoxelMaterial.Get())
		{
			OutMaterials.Add(Mat);
		}
	}

private:
	/** solid 복셀 AABB로 Box collision 재구축 — OnMeshReady에서 호출 */
	void RebuildCollision();

	UPROPERTY()
	TObjectPtr<UBodySetup> ChunkBodySetup;

	/** 이전 AABB 캐시 — 변경 시에만 RecreatePhysicsState 호출 (비용 절감) */
	FIntVector CachedAABBMin = FIntVector(-1, -1, -1);
	FIntVector CachedAABBMax = FIntVector(-1, -1, -1);

	FIntVector ChunkCoord = FIntVector::ZeroValue;
	FHktVoxelRenderCache* RenderCache = nullptr;
	float CachedVoxelSize = FHktVoxelChunk::VOXEL_SIZE;

	/** UPrimitiveComponent는 OverrideMaterials를 제공하지 않으므로 직접 관리 */
	UPROPERTY()
	TWeakObjectPtr<UMaterialInterface> CachedVoxelMaterial;

	FHktVoxelTileTextureSet CachedTileTextures;
	FHktVoxelTexturePair CachedMaterialLUT;
	bool bStyleTexturesApplied = false;
	bool bStylizedRendering = false;
	float EdgeRoundStrength = 0.0f;
	float NormalMapStrength = 1.0f;
	float ShadowDistance = 0.f;
};
