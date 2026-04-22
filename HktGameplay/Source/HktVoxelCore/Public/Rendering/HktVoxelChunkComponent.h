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

/**
 * FHktVoxelLODComponentSettings — LOD 레벨별 컴포넌트 품질 프리셋.
 *
 * AHktVoxelTerrainActor가 4개 LOD에 대해 정책 테이블로 보유하고
 * UHktVoxelChunkComponent::SetChunkLOD()가 호출될 때 적용된다.
 *
 * 기본 정책 (LOD 0~3):
 *  LOD 0: 풀 노멀맵 + 풀 라운딩 + 그림자 + collision
 *  LOD 1: 절반 노멀맵 + 절반 라운딩 + 그림자 + no collision
 *  LOD 2: 노멀맵·라운딩 off + 그림자(거리 제한) + no collision
 *  LOD 3: 노멀맵·라운딩 off + 그림자 off + no collision
 */
struct FHktVoxelLODComponentSettings
{
	float NormalMapScale = 1.0f;   // 액터 NormalMapStrength에 곱해질 스케일
	float EdgeRoundScale = 1.0f;   // 액터 EdgeRoundStrength에 곱해질 스케일
	float ShadowDistance = 0.0f;   // 0이면 그림자 항상 ON
	bool  bCastShadow = true;
	bool  bCollision = true;
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
	 * 워터 머티리얼 설정 — Translucent 섹션(Water TypeID)만 이 머티리얼로 별도 렌더.
	 * null 전달 시 기본 VoxelMaterial로 폴백.
	 * SceneProxy는 Opaque/Translucent 두 MeshBatch를 발행, 각각 slot 0/1 머티리얼 사용.
	 */
	void SetWaterMaterial(UMaterialInterface* InMaterial);

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

	/**
	 * 엣지 알파 강도 (0=off, 0.3~0.7 권장).
	 * Dithered clip으로 쿼드 경계 픽셀을 discard → 실루엣이 둥글고 반투명해 보임.
	 * EdgeRound(노멀 벤딩)와 독립 토글. 둘 다 켜면 실루엣+라이팅 모두 둥글어짐.
	 */
	void SetEdgeAlphaStrength(float InStrength);
	float GetEdgeAlphaStrength() const { return EdgeAlphaStrength; }

	/**
	 * 엣지 알파 페이드 시작 거리 (쿼드 중심=0, 경계=1). 0.6~0.9 권장.
	 * 값이 작을수록 더 넓은 영역이 페이드된다.
	 */
	void SetEdgeAlphaStart(float InStart);
	float GetEdgeAlphaStart() const { return EdgeAlphaStart; }

	/** 노멀맵 강도 (0=off, 1=원본). NormalArray가 설정된 경우에만 효과 있음 */
	void SetNormalMapStrength(float InStrength);
	float GetNormalMapStrength() const { return NormalMapStrength; }

	/** 그림자 최대 거리 설정 (UE 유닛). 0이면 항상 그림자 ON */
	void SetShadowDistance(float InDistance) { ShadowDistance = InDistance; }
	float GetShadowDistance() const { return ShadowDistance; }

	/**
	 * 청크 LOD 설정 — 보관 중인 LOD 프리셋 + 액터 글로벌 강도를 컴포넌트 설정에 반영.
	 * NormalMapStrength = ActorNormalMapStrength * Settings.NormalMapScale.
	 * EdgeRoundStrength = ActorEdgeRoundStrength * Settings.EdgeRoundScale.
	 * Collision/CastShadow/ShadowDistance도 함께 갱신.
	 */
	void SetChunkLOD(int32 InLOD, const FHktVoxelLODComponentSettings& Settings,
	                 float ActorNormalMapStrength, float ActorEdgeRoundStrength);
	int32 GetChunkLOD() const { return CurrentLOD; }

	// UPrimitiveComponent
	virtual FPrimitiveSceneProxy* CreateSceneProxy() override;
	virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override;
	virtual UBodySetup* GetBodySetup() override;
	virtual int32 GetNumMaterials() const override { return 2; }
	virtual UMaterialInterface* GetMaterial(int32 ElementIndex) const override
	{
		if (ElementIndex == 0)
		{
			return CachedVoxelMaterial.Get();
		}
		if (ElementIndex == 1)
		{
			// Water 슬롯 미설정 시 Opaque와 동일 머티리얼 사용 — 최소한 렌더는 된다.
			UMaterialInterface* Water = CachedWaterMaterial.Get();
			return Water ? Water : CachedVoxelMaterial.Get();
		}
		return nullptr;
	}
	virtual void GetUsedMaterials(TArray<UMaterialInterface*>& OutMaterials, bool bGetDebugMaterials = false) const override
	{
		if (UMaterialInterface* Mat = CachedVoxelMaterial.Get())
		{
			OutMaterials.Add(Mat);
		}
		if (UMaterialInterface* WaterMat = CachedWaterMaterial.Get())
		{
			OutMaterials.Add(WaterMat);
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

	/** Water 섹션 전용 머티리얼. nullptr이면 CachedVoxelMaterial로 폴백 */
	UPROPERTY()
	TWeakObjectPtr<UMaterialInterface> CachedWaterMaterial;

	FHktVoxelTileTextureSet CachedTileTextures;
	FHktVoxelTexturePair CachedMaterialLUT;
	bool bStyleTexturesApplied = false;
	bool bStylizedRendering = false;
	float EdgeRoundStrength = 0.0f;
	float EdgeAlphaStrength = 0.0f;
	float EdgeAlphaStart = 0.75f;
	float NormalMapStrength = 1.0f;
	float ShadowDistance = 0.f;
	int32 CurrentLOD = 0;
};
