// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "PrimitiveSceneProxy.h"
#include "RenderResource.h"
#include "Meshing/HktVoxelVertex.h"

class UHktVoxelChunkComponent;
class FHktVoxelVertexFactory;

/**
 * FHktVoxelChunkProxy — 복셀 청크 SceneProxy
 *
 * 하나의 청크(32x32x32)를 GPU 버퍼로 관리하고 렌더링한다.
 * 메싱 완료 시 Game Thread에서 ENQUEUE_RENDER_COMMAND로
 * UpdateMeshData_RenderThread를 호출하여 버퍼를 갱신한다.
 *
 * Phase 3 (프로덕션) 에서 사용. Phase 1은 PMC 기반.
 */
class HKTVOXELCORE_API FHktVoxelChunkProxy : public FPrimitiveSceneProxy
{
public:
	explicit FHktVoxelChunkProxy(const UHktVoxelChunkComponent* InComponent);
	virtual ~FHktVoxelChunkProxy();

	// FPrimitiveSceneProxy
	virtual void GetDynamicMeshElements(
		const TArray<const FSceneView*>& Views,
		const FSceneViewFamily& ViewFamily,
		uint32 VisibilityMap,
		FMeshElementCollector& Collector) const override;

	virtual FPrimitiveViewRelevance GetViewRelevance(const FSceneView* View) const override;

	virtual uint32 GetMemoryFootprint() const override
	{
		return sizeof(*this) + GetAllocatedSize();
	}

	SIZE_T GetAllocatedSize() const { return 0; }

	virtual SIZE_T GetTypeHash() const override
	{
		static SIZE_T UniquePointer;
		return reinterpret_cast<SIZE_T>(&UniquePointer);
	}

	/**
	 * Render Thread에서 호출 — 메싱 완료 데이터로 GPU 버퍼 갱신.
	 *
	 * InOpaqueIndexCount = Opaque 섹션이 사용하는 index 수 (Indices 배열 앞쪽).
	 * 나머지 (Indices.Num() - InOpaqueIndexCount)는 Translucent(Water) 섹션.
	 * GetDynamicMeshElements가 이 경계로 2개의 FMeshBatch를 발행한다.
	 */
	void UpdateMeshData_RenderThread(
		const TArray<FHktVoxelVertex>& Vertices,
		const TArray<uint32>& Indices,
		int32 InOpaqueIndexCount);

	void SetTileTextures_RenderThread(
		FRHITexture* InTileArray, FRHISamplerState* InTileSampler,
		FRHITexture* InTileIndexLUT, FRHISamplerState* InLUTSampler,
		FRHITexture* InDefaultPalette = nullptr, FRHISamplerState* InPaletteSampler = nullptr);

	void SetMaterialLUT_RenderThread(FRHITexture* InLUT, FRHISamplerState* InSampler);

	/** 노멀맵 배열 전달 — nullptr이면 플랫 노멀 폴백 */
	void SetNormalArray_RenderThread(FRHITexture* InNormalArray, FRHISamplerState* InSampler);

	/** 노멀맵 강도 설정 — Render Thread에서 호출 (0=off, 1=원본) */
	void SetNormalMapStrength_RenderThread(float InStrength);

	/** Render Thread에서 호출 — 본 트랜스폼 GPU 버퍼 갱신 (GPU 스키닝) */
	void UpdateBoneTransforms_RenderThread(const TArray<FVector4f>& BoneMatrixRows);

	/** 스타일라이즈 렌더링 토글 — Render Thread에서 호출 */
	void SetStylizedRendering_RenderThread(bool bEnabled);

	/** 엣지 라운딩 강도 설정 — Render Thread에서 호출 (0=off, 0.3~0.6 권장) */
	void SetEdgeRoundStrength_RenderThread(float InStrength);

	/** 엣지 알파 강도 설정 — Render Thread에서 호출 (0=off, 0.3~0.7 권장) */
	void SetEdgeAlphaStrength_RenderThread(float InStrength);

	/** 엣지 알파 페이드 시작 거리 — Render Thread에서 호출 (쿼드 중심=0, 경계=1) */
	void SetEdgeAlphaStart_RenderThread(float InStart);

private:
	/** RHI 버퍼를 감싸는 FVertexBuffer/FIndexBuffer 래퍼 (FVertexStreamComponent, FMeshBatchElement 호환용) */
	struct FVoxelVertexBuffer : public FVertexBuffer
	{
		virtual void InitRHI(FRHICommandListBase&) override {}
	};

	struct FVoxelIndexBuffer : public FIndexBuffer
	{
		virtual void InitRHI(FRHICommandListBase&) override {}
	};

	FVoxelVertexBuffer VertexBufferWrapper;
	FVoxelIndexBuffer IndexBufferWrapper;
	FHktVoxelVertexFactory* VertexFactory = nullptr;
	UMaterialInterface* VoxelMaterial = nullptr;
	UMaterialInterface* WaterMaterial = nullptr;

	/**
	 * 결합된 머티리얼 관련성 (VoxelMaterial | WaterMaterial).
	 * GetViewRelevance에서 Translucent/Opaque/Masked 플래그를 엔진에 전달해
	 * 올바른 렌더 패스(메인, 트랜슬루슨트, 마스크드)가 스케줄링되도록 한다.
	 * 이게 없으면 Translucent 머티리얼이 있어도 translucent 패스가 호출되지 않아 invisible.
	 */
	FMaterialRelevance CombinedMaterialRelevance;
	float VoxelSizeUU = 15.0f;
	float ShadowDistanceSq = 0.f;  // 그림자 거리 제곱. 0이면 항상 그림자 ON
	int32 NumIndices = 0;
	int32 NumVertices = 0;
	/** Opaque 섹션이 차지하는 index 수. NumIndices - OpaqueIndexCount = Translucent 섹션 크기 */
	int32 OpaqueIndexCount = 0;

	mutable bool bDrawDiagLogged = false;

	FRHITexture* PendingTileArrayRHI = nullptr;
	FRHISamplerState* PendingTileArraySamplerRHI = nullptr;
	FRHITexture* PendingTileIndexLUTRHI = nullptr;
	FRHISamplerState* PendingTileIndexLUTSamplerRHI = nullptr;
	FRHITexture* PendingMaterialLUTRHI = nullptr;
	FRHISamplerState* PendingMaterialLUTSamplerRHI = nullptr;
	FRHITexture* PendingDefaultPaletteRHI = nullptr;
	FRHISamplerState* PendingDefaultPaletteSamplerRHI = nullptr;
	FRHITexture* PendingNormalArrayRHI = nullptr;
	FRHISamplerState* PendingNormalArraySamplerRHI = nullptr;

	bool bStylizedRendering = false;
	float EdgeRoundStrength = 0.0f;
	float EdgeAlphaStrength = 0.0f;
	float EdgeAlphaStart = 0.75f;
	float NormalMapStrength = 1.0f;

	/** GPU 스키닝용 본 트랜스폼 버퍼 (float4 × 3 per bone) */
	FBufferRHIRef BoneTransformBuffer;
	FShaderResourceViewRHIRef BoneTransformSRV;
	uint32 BoneTransformBufferSize = 0;
};
