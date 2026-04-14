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

	/** Render Thread에서 호출 — 메싱 완료 데이터로 GPU 버퍼 갱신 */
	void UpdateMeshData_RenderThread(
		const TArray<FHktVoxelVertex>& Vertices,
		const TArray<uint32>& Indices);

	void SetTileTextures_RenderThread(
		FRHITexture* InTileArray, FRHISamplerState* InTileSampler,
		FRHITexture* InTileIndexLUT, FRHISamplerState* InLUTSampler,
		FRHITexture* InDefaultPalette = nullptr, FRHISamplerState* InPaletteSampler = nullptr);

	void SetMaterialLUT_RenderThread(FRHITexture* InLUT, FRHISamplerState* InSampler);

	/** Render Thread에서 호출 — 본 트랜스폼 GPU 버퍼 갱신 (GPU 스키닝) */
	void UpdateBoneTransforms_RenderThread(const TArray<FVector4f>& BoneMatrixRows);

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
	float VoxelSizeUU = 15.0f;
	float ShadowDistanceSq = 0.f;  // 그림자 거리 제곱. 0이면 항상 그림자 ON
	int32 NumIndices = 0;
	int32 NumVertices = 0;

	mutable bool bDrawDiagLogged = false;

	FRHITexture* PendingTileArrayRHI = nullptr;
	FRHISamplerState* PendingTileArraySamplerRHI = nullptr;
	FRHITexture* PendingTileIndexLUTRHI = nullptr;
	FRHISamplerState* PendingTileIndexLUTSamplerRHI = nullptr;
	FRHITexture* PendingMaterialLUTRHI = nullptr;
	FRHISamplerState* PendingMaterialLUTSamplerRHI = nullptr;
	FRHITexture* PendingDefaultPaletteRHI = nullptr;
	FRHISamplerState* PendingDefaultPaletteSamplerRHI = nullptr;

	/** GPU 스키닝용 본 트랜스폼 버퍼 (float4 × 3 per bone) */
	FBufferRHIRef BoneTransformBuffer;
	FShaderResourceViewRHIRef BoneTransformSRV;
	uint32 BoneTransformBufferSize = 0;
};
