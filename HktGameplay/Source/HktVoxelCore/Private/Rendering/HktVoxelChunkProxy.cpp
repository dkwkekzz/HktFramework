// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelChunkProxy.h"
#include "Rendering/HktVoxelVertexFactory.h"
#include "Rendering/HktVoxelBevelVertexFactory.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Meshing/HktVoxelVertex.h"
#include "HktVoxelCoreLog.h"
#include "Materials/Material.h"
#include "SceneManagement.h"
#include "RHIStaticStates.h"
#include "TextureResource.h"

FHktVoxelChunkProxy::FHktVoxelChunkProxy(const UHktVoxelChunkComponent* InComponent)
	: FPrimitiveSceneProxy(InComponent)
	, VoxelSizeUU(InComponent->GetVoxelSize())
	, ShadowDistanceSq(InComponent->GetShadowDistance() > 0.f
		? FMath::Square(InComponent->GetShadowDistance()) : 0.f)
{
	// 머티리얼은 Component에서 0번(Opaque) + 1번(Water) 슬롯을 가져옴
	VoxelMaterial = InComponent->GetMaterial(0);
	if (!VoxelMaterial)
	{
		VoxelMaterial = UMaterial::GetDefaultMaterial(MD_Surface);
	}
	// Water 슬롯은 미설정 시 GetMaterial(1)이 VoxelMaterial로 폴백하므로 null이 아닐 것.
	WaterMaterial = InComponent->GetMaterial(1);
	if (!WaterMaterial)
	{
		WaterMaterial = VoxelMaterial;
	}

	// 머티리얼 관련성 계산 — 두 슬롯 OR 결합.
	// GetRelevance_Concurrent는 렌더 스레드 안전. Scene이 null인 엣지 케이스 방어.
	if (FSceneInterface* SceneRef = InComponent->GetScene())
	{
		const ERHIFeatureLevel::Type FeatureLevel = SceneRef->GetFeatureLevel();
		CombinedMaterialRelevance = VoxelMaterial->GetRelevance_Concurrent(FeatureLevel);
		if (WaterMaterial && WaterMaterial != VoxelMaterial)
		{
			CombinedMaterialRelevance |= WaterMaterial->GetRelevance_Concurrent(FeatureLevel);
		}
	}

	// Component에 캐시된 스타일 텍스처를 Pending*에 복사.
	// MarkRenderStateDirty()로 Proxy가 재생성될 때 기존 Proxy의 텍스처가 소실되므로,
	// 새 Proxy가 생성 시점부터 텍스처 정보를 보유해야
	// UpdateMeshData_RenderThread에서 VertexFactory에 올바르게 바인딩된다.
	const FHktVoxelTileTextureSet& TileTex = InComponent->GetCachedTileTextures();
	if (TileTex.IsValid())
	{
		PendingTileArrayRHI = TileTex.TileArray.Texture;
		PendingTileArraySamplerRHI = TileTex.TileArray.Sampler;
		PendingTileIndexLUTRHI = TileTex.TileIndexLUT.Texture;
		PendingTileIndexLUTSamplerRHI = TileTex.TileIndexLUT.Sampler;
		PendingDefaultPaletteRHI = TileTex.DefaultPalette.Texture;
		PendingDefaultPaletteSamplerRHI = TileTex.DefaultPalette.Sampler;
	}
	if (TileTex.HasNormalArray())
	{
		PendingNormalArrayRHI = TileTex.NormalArray.Texture;
		PendingNormalArraySamplerRHI = TileTex.NormalArray.Sampler;
	}

	const FHktVoxelTexturePair& MatLUT = InComponent->GetCachedMaterialLUT();
	if (MatLUT.IsValid())
	{
		PendingMaterialLUTRHI = MatLUT.Texture;
		PendingMaterialLUTSamplerRHI = MatLUT.Sampler;
	}

	bStylizedRendering = InComponent->IsStylizedRendering();
	NormalMapStrength = InComponent->GetNormalMapStrength();
}

FHktVoxelChunkProxy::~FHktVoxelChunkProxy()
{
	if (VertexBufferWrapper.IsInitialized())
	{
		VertexBufferWrapper.ReleaseResource();
	}
	if (IndexBufferWrapper.IsInitialized())
	{
		IndexBufferWrapper.ReleaseResource();
	}
	if (VertexFactory)
	{
		VertexFactory->ReleaseResource();
		delete VertexFactory;
		VertexFactory = nullptr;
	}

	// 베벨 섹션 리소스 해제
	if (BevelVertexBufferWrapper.IsInitialized())
	{
		BevelVertexBufferWrapper.ReleaseResource();
	}
	if (BevelIndexBufferWrapper.IsInitialized())
	{
		BevelIndexBufferWrapper.ReleaseResource();
	}
	if (BevelVertexFactory)
	{
		BevelVertexFactory->ReleaseResource();
		delete BevelVertexFactory;
		BevelVertexFactory = nullptr;
	}
}

void FHktVoxelChunkProxy::GetDynamicMeshElements(
	const TArray<const FSceneView*>& Views,
	const FSceneViewFamily& ViewFamily,
	uint32 VisibilityMap,
	FMeshElementCollector& Collector) const
{
	if (NumIndices == 0 || !VertexBufferWrapper.VertexBufferRHI.IsValid() || !IndexBufferWrapper.IndexBufferRHI.IsValid())
	{
		return;
	}

	const int32 TranslucentIndexCount = NumIndices - OpaqueIndexCount;

	for (int32 ViewIndex = 0; ViewIndex < Views.Num(); ViewIndex++)
	{
		if (!(VisibilityMap & (1 << ViewIndex)))
		{
			continue;
		}

		// 거리 기반 그림자 컬링
		const bool bCastShadow = (ShadowDistanceSq <= 0.f)
			|| (FVector::DistSquared(GetBounds().Origin, Views[ViewIndex]->ViewMatrices.GetViewOrigin()) < ShadowDistanceSq);

		// Batch 0 — Opaque 섹션 (TerrainMaterial)
		if (OpaqueIndexCount > 0)
		{
			FMeshBatch& Mesh = Collector.AllocateMesh();
			Mesh.VertexFactory = VertexFactory;
			Mesh.Type = PT_TriangleList;
			Mesh.bWireframe = false;
			Mesh.bUseWireframeSelectionColoring = false;
			Mesh.MaterialRenderProxy = VoxelMaterial->GetRenderProxy();
			Mesh.ReverseCulling = IsLocalToWorldDeterminantNegative();
			Mesh.CastShadow = bCastShadow;

			FMeshBatchElement& BatchElement = Mesh.Elements[0];
			BatchElement.IndexBuffer = &IndexBufferWrapper;
			BatchElement.NumPrimitives = OpaqueIndexCount / 3;
			BatchElement.FirstIndex = 0;
			BatchElement.MinVertexIndex = 0;
			BatchElement.MaxVertexIndex = NumVertices > 0 ? NumVertices - 1 : 0;
			BatchElement.PrimitiveUniformBuffer = GetUniformBuffer();

			Collector.AddMesh(ViewIndex, Mesh);
		}

		// Batch 1 — Translucent(Water) 섹션 (WaterMaterial)
		if (TranslucentIndexCount > 0 && WaterMaterial)
		{
			FMeshBatch& Mesh = Collector.AllocateMesh();
			Mesh.VertexFactory = VertexFactory;
			Mesh.Type = PT_TriangleList;
			Mesh.bWireframe = false;
			Mesh.bUseWireframeSelectionColoring = false;
			Mesh.MaterialRenderProxy = WaterMaterial->GetRenderProxy();
			Mesh.ReverseCulling = IsLocalToWorldDeterminantNegative();
			// Translucent는 일반적으로 그림자를 드리우지 않음 (성능/룩 양쪽 이점).
			Mesh.CastShadow = false;

			FMeshBatchElement& BatchElement = Mesh.Elements[0];
			BatchElement.IndexBuffer = &IndexBufferWrapper;
			BatchElement.NumPrimitives = TranslucentIndexCount / 3;
			BatchElement.FirstIndex = OpaqueIndexCount;
			BatchElement.MinVertexIndex = 0;
			BatchElement.MaxVertexIndex = NumVertices > 0 ? NumVertices - 1 : 0;
			BatchElement.PrimitiveUniformBuffer = GetUniformBuffer();

			Collector.AddMesh(ViewIndex, Mesh);
		}

		// Batch 2 — LOD0 베벨 섹션 (Opaque TerrainMaterial)
		if (BevelNumIndices > 0
			&& BevelVertexFactory
			&& BevelVertexBufferWrapper.VertexBufferRHI.IsValid()
			&& BevelIndexBufferWrapper.IndexBufferRHI.IsValid())
		{
			FMeshBatch& Mesh = Collector.AllocateMesh();
			Mesh.VertexFactory = BevelVertexFactory;
			Mesh.Type = PT_TriangleList;
			Mesh.bWireframe = false;
			Mesh.bUseWireframeSelectionColoring = false;
			Mesh.MaterialRenderProxy = VoxelMaterial->GetRenderProxy();
			Mesh.ReverseCulling = IsLocalToWorldDeterminantNegative();
			Mesh.CastShadow = bCastShadow;

			FMeshBatchElement& BatchElement = Mesh.Elements[0];
			BatchElement.IndexBuffer = &BevelIndexBufferWrapper;
			BatchElement.NumPrimitives = BevelNumIndices / 3;
			BatchElement.FirstIndex = 0;
			BatchElement.MinVertexIndex = 0;
			BatchElement.MaxVertexIndex = BevelNumVertices > 0 ? BevelNumVertices - 1 : 0;
			BatchElement.PrimitiveUniformBuffer = GetUniformBuffer();

			Collector.AddMesh(ViewIndex, Mesh);
		}
	}
}

FPrimitiveViewRelevance FHktVoxelChunkProxy::GetViewRelevance(const FSceneView* View) const
{
	FPrimitiveViewRelevance Result;
	Result.bDrawRelevance = IsShown(View);
	Result.bShadowRelevance = IsShadowCast(View);
	Result.bDynamicRelevance = true;
	Result.bStaticRelevance = false;
	Result.bRenderInMainPass = ShouldRenderInMainPass();
	// 머티리얼 관련성 전달 — Translucent/Masked 패스가 호출되도록 한다.
	// 이 호출이 없으면 Translucent 머티리얼을 바인딩해도 렌더 패스가 스킵됨.
	CombinedMaterialRelevance.SetPrimitiveViewRelevance(Result);
	Result.bVelocityRelevance = DrawsVelocity() && Result.bOpaque && Result.bRenderInMainPass;
	return Result;
}

void FHktVoxelChunkProxy::UpdateMeshData_RenderThread(
	const TArray<FHktVoxelVertex>& Vertices,
	const TArray<uint32>& Indices,
	int32 InOpaqueIndexCount)
{
	check(IsInRenderingThread());

	if (Vertices.Num() == 0 || Indices.Num() == 0)
	{
		NumIndices = 0;
		OpaqueIndexCount = 0;
		VertexBufferWrapper.VertexBufferRHI = nullptr;
		IndexBufferWrapper.IndexBufferRHI = nullptr;
		return;
	}

	// Opaque 카운트는 총 Index 수를 넘지 못하도록 클램프 (방어).
	OpaqueIndexCount = FMath::Clamp(InOpaqueIndexCount, 0, Indices.Num());

	// Vertex Buffer 생성
	{
		FRHIResourceCreateInfo CreateInfo(TEXT("HktVoxelChunkVB"));
		const uint32 Size = Vertices.Num() * sizeof(FHktVoxelVertex);
		VertexBufferWrapper.VertexBufferRHI = FRHICommandListImmediate::Get().CreateVertexBuffer(
			Size, BUF_Static, CreateInfo);

		void* Data = FRHICommandListImmediate::Get().LockBuffer(VertexBufferWrapper.VertexBufferRHI, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Data, Vertices.GetData(), Size);
		FRHICommandListImmediate::Get().UnlockBuffer(VertexBufferWrapper.VertexBufferRHI);
	}

	// Index Buffer 생성
	{
		FRHIResourceCreateInfo CreateInfo(TEXT("HktVoxelChunkIB"));
		const uint32 Size = Indices.Num() * sizeof(uint32);
		IndexBufferWrapper.IndexBufferRHI = FRHICommandListImmediate::Get().CreateIndexBuffer(
			sizeof(uint32), Size, BUF_Static, CreateInfo);

		void* Data = FRHICommandListImmediate::Get().LockBuffer(IndexBufferWrapper.IndexBufferRHI, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Data, Indices.GetData(), Size);
		FRHICommandListImmediate::Get().UnlockBuffer(IndexBufferWrapper.IndexBufferRHI);
	}

	NumIndices = Indices.Num();
	NumVertices = Vertices.Num();
	// RenderResource 초기화 마킹 (InitRHI는 비어있고 RHI 핸들은 위에서 직접 설정)
	if (!VertexBufferWrapper.IsInitialized())
	{
		VertexBufferWrapper.InitResource(FRHICommandListImmediate::Get());
	}
	if (!IndexBufferWrapper.IsInitialized())
	{
		IndexBufferWrapper.InitResource(FRHICommandListImmediate::Get());
	}

	// Vertex Factory 셋업
	if (!VertexFactory)
	{
		VertexFactory = new FHktVoxelVertexFactory(GetScene().GetFeatureLevel());
		VertexFactory->InitResource(FRHICommandListImmediate::Get());
	}
	VertexFactory->VoxelSizeUU = VoxelSizeUU;
	VertexFactory->StylizedEnabled = bStylizedRendering ? 1.0f : 0.0f;
	VertexFactory->NormalMapStrength = NormalMapStrength;

	// 팔레트 텍스처 설정 — 타일 활성 시 기본 팔레트(8×256 흰색), 아니면 GWhiteTexture 폴백
	if (!VertexFactory->PaletteTextureRHI)
	{
		if (PendingDefaultPaletteRHI)
		{
			VertexFactory->SetPaletteTexture(PendingDefaultPaletteRHI, PendingDefaultPaletteSamplerRHI);
		}
		else
		{
			VertexFactory->SetPaletteTexture(
				GWhiteTexture->TextureRHI,
				TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI());
		}
	}

	FHktVoxelVertexFactory::FDataType VFData;
	VFData.PositionComponent = FVertexStreamComponent(
		&VertexBufferWrapper, 0, sizeof(FHktVoxelVertex), VET_UInt);
	VFData.MaterialComponent = FVertexStreamComponent(
		&VertexBufferWrapper, 4, sizeof(FHktVoxelVertex), VET_UInt);

	// SetTileTextures/SetMaterialLUT/SetNormalArray가 VertexFactory 생성 전에 호출될 수 있으므로 여기서 적용
	if (PendingTileArrayRHI)
	{
		VertexFactory->SetTileTextures(
			PendingTileArrayRHI, PendingTileArraySamplerRHI,
			PendingTileIndexLUTRHI, PendingTileIndexLUTSamplerRHI);
	}
	if (PendingMaterialLUTRHI)
	{
		VertexFactory->SetMaterialLUT(PendingMaterialLUTRHI, PendingMaterialLUTSamplerRHI);
	}
	if (PendingNormalArrayRHI)
	{
		VertexFactory->SetNormalArray(PendingNormalArrayRHI, PendingNormalArraySamplerRHI);
	}

	VertexFactory->SetData(VFData);

	// 기존 본 트랜스폼 SRV가 있으면 재바인딩
	if (BoneTransformSRV.IsValid())
	{
		VertexFactory->SetBoneTransformSRV(BoneTransformSRV);
	}
}

void FHktVoxelChunkProxy::UpdateBevelMeshData_RenderThread(
	const TArray<FHktVoxelBevelVertex>& BevelVertices,
	const TArray<uint32>& BevelIndices)
{
	check(IsInRenderingThread());

	if (BevelVertices.Num() == 0 || BevelIndices.Num() == 0)
	{
		BevelNumIndices = 0;
		BevelNumVertices = 0;
		BevelVertexBufferWrapper.VertexBufferRHI = nullptr;
		BevelIndexBufferWrapper.IndexBufferRHI = nullptr;
		return;
	}

	// Vertex Buffer
	{
		FRHIResourceCreateInfo CreateInfo(TEXT("HktVoxelChunkBevelVB"));
		const uint32 Size = BevelVertices.Num() * sizeof(FHktVoxelBevelVertex);
		BevelVertexBufferWrapper.VertexBufferRHI = FRHICommandListImmediate::Get().CreateVertexBuffer(
			Size, BUF_Static, CreateInfo);

		void* Data = FRHICommandListImmediate::Get().LockBuffer(BevelVertexBufferWrapper.VertexBufferRHI, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Data, BevelVertices.GetData(), Size);
		FRHICommandListImmediate::Get().UnlockBuffer(BevelVertexBufferWrapper.VertexBufferRHI);
	}

	// Index Buffer
	{
		FRHIResourceCreateInfo CreateInfo(TEXT("HktVoxelChunkBevelIB"));
		const uint32 Size = BevelIndices.Num() * sizeof(uint32);
		BevelIndexBufferWrapper.IndexBufferRHI = FRHICommandListImmediate::Get().CreateIndexBuffer(
			sizeof(uint32), Size, BUF_Static, CreateInfo);

		void* Data = FRHICommandListImmediate::Get().LockBuffer(BevelIndexBufferWrapper.IndexBufferRHI, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Data, BevelIndices.GetData(), Size);
		FRHICommandListImmediate::Get().UnlockBuffer(BevelIndexBufferWrapper.IndexBufferRHI);
	}

	BevelNumIndices = BevelIndices.Num();
	BevelNumVertices = BevelVertices.Num();

	if (!BevelVertexBufferWrapper.IsInitialized())
	{
		BevelVertexBufferWrapper.InitResource(FRHICommandListImmediate::Get());
	}
	if (!BevelIndexBufferWrapper.IsInitialized())
	{
		BevelIndexBufferWrapper.InitResource(FRHICommandListImmediate::Get());
	}

	// Vertex Factory — 최초 호출 시 생성.
	if (!BevelVertexFactory)
	{
		BevelVertexFactory = new FHktVoxelBevelVertexFactory(GetScene().GetFeatureLevel());
		BevelVertexFactory->InitResource(FRHICommandListImmediate::Get());
	}
	BevelVertexFactory->VoxelSizeUU = VoxelSizeUU;
	BevelVertexFactory->StylizedEnabled = bStylizedRendering ? 1.0f : 0.0f;

	// 팔레트 텍스처 공유 — 메인 VF와 동일하게 기본 팔레트 또는 GWhiteTexture 폴백
	if (PendingDefaultPaletteRHI)
	{
		BevelVertexFactory->SetPaletteTexture(PendingDefaultPaletteRHI, PendingDefaultPaletteSamplerRHI);
	}
	else if (!BevelVertexFactory->PaletteTextureRHI)
	{
		BevelVertexFactory->SetPaletteTexture(
			GWhiteTexture->TextureRHI,
			TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI());
	}

	FHktVoxelBevelVertexFactory::FDataType VFData;
	VFData.PositionComponent = FVertexStreamComponent(
		&BevelVertexBufferWrapper, 0, sizeof(FHktVoxelBevelVertex), VET_Float3);
	VFData.NormalComponent = FVertexStreamComponent(
		&BevelVertexBufferWrapper, 12, sizeof(FHktVoxelBevelVertex), VET_UInt);
	VFData.MaterialComponent = FVertexStreamComponent(
		&BevelVertexBufferWrapper, 16, sizeof(FHktVoxelBevelVertex), VET_UInt);

	BevelVertexFactory->SetData(VFData);

	// 본 트랜스폼 SRV 공유
	if (BoneTransformSRV.IsValid())
	{
		BevelVertexFactory->SetBoneTransformSRV(BoneTransformSRV);
	}
}

void FHktVoxelChunkProxy::UpdateBoneTransforms_RenderThread(const TArray<FVector4f>& BoneMatrixRows)
{
	check(IsInRenderingThread());

	if (BoneMatrixRows.Num() == 0)
	{
		return;
	}

	const uint32 BufferSize = BoneMatrixRows.Num() * sizeof(FVector4f);

	// 버퍼 재사용 — 크기가 같으면 Lock/Unlock만, 다르면 재생성
	if (!BoneTransformBuffer.IsValid() || BoneTransformBufferSize != BufferSize)
	{
		FRHIResourceCreateInfo CreateInfo(TEXT("HktVoxelBoneTransforms"));
		BoneTransformBuffer = FRHICommandListImmediate::Get().CreateVertexBuffer(
			BufferSize, BUF_ShaderResource | BUF_Dynamic, CreateInfo);

		BoneTransformSRV = FRHICommandListImmediate::Get().CreateShaderResourceView(
			BoneTransformBuffer, sizeof(FVector4f), PF_A32B32G32R32F);

		BoneTransformBufferSize = BufferSize;

		if (VertexFactory)
		{
			VertexFactory->SetBoneTransformSRV(BoneTransformSRV);
		}
		if (BevelVertexFactory)
		{
			BevelVertexFactory->SetBoneTransformSRV(BoneTransformSRV);
		}
	}

	void* Data = FRHICommandListImmediate::Get().LockBuffer(BoneTransformBuffer, 0, BufferSize, RLM_WriteOnly);
	FMemory::Memcpy(Data, BoneMatrixRows.GetData(), BufferSize);
	FRHICommandListImmediate::Get().UnlockBuffer(BoneTransformBuffer);
}

void FHktVoxelChunkProxy::SetTileTextures_RenderThread(
	FRHITexture* InTileArray, FRHISamplerState* InTileSampler,
	FRHITexture* InTileIndexLUT, FRHISamplerState* InLUTSampler,
	FRHITexture* InDefaultPalette, FRHISamplerState* InPaletteSampler)
{
	check(IsInRenderingThread());

	PendingTileArrayRHI = InTileArray;
	PendingTileArraySamplerRHI = InTileSampler;
	PendingTileIndexLUTRHI = InTileIndexLUT;
	PendingTileIndexLUTSamplerRHI = InLUTSampler;
	PendingDefaultPaletteRHI = InDefaultPalette;
	PendingDefaultPaletteSamplerRHI = InPaletteSampler;

	if (VertexFactory)
	{
		VertexFactory->SetTileTextures(InTileArray, InTileSampler, InTileIndexLUT, InLUTSampler);
		if (InDefaultPalette)
		{
			VertexFactory->SetPaletteTexture(InDefaultPalette, InPaletteSampler);
		}
	}
}

void FHktVoxelChunkProxy::SetMaterialLUT_RenderThread(
	FRHITexture* InLUT, FRHISamplerState* InSampler)
{
	check(IsInRenderingThread());

	PendingMaterialLUTRHI = InLUT;
	PendingMaterialLUTSamplerRHI = InSampler;

	if (VertexFactory)
	{
		VertexFactory->SetMaterialLUT(InLUT, InSampler);
	}
}

void FHktVoxelChunkProxy::SetStylizedRendering_RenderThread(bool bEnabled)
{
	check(IsInRenderingThread());

	bStylizedRendering = bEnabled;

	if (VertexFactory)
	{
		VertexFactory->StylizedEnabled = bEnabled ? 1.0f : 0.0f;
	}
	if (BevelVertexFactory)
	{
		BevelVertexFactory->StylizedEnabled = bEnabled ? 1.0f : 0.0f;
	}
}

void FHktVoxelChunkProxy::SetNormalArray_RenderThread(
	FRHITexture* InNormalArray, FRHISamplerState* InSampler)
{
	check(IsInRenderingThread());

	PendingNormalArrayRHI = InNormalArray;
	PendingNormalArraySamplerRHI = InSampler;

	if (VertexFactory)
	{
		VertexFactory->SetNormalArray(InNormalArray, InSampler);
	}
}

void FHktVoxelChunkProxy::SetNormalMapStrength_RenderThread(float InStrength)
{
	check(IsInRenderingThread());

	NormalMapStrength = InStrength;

	if (VertexFactory)
	{
		VertexFactory->NormalMapStrength = InStrength;
	}
}
