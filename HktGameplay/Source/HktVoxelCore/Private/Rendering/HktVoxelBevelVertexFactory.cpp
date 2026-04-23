// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelBevelVertexFactory.h"
#include "MeshMaterialShader.h"
#include "ShaderParameterUtils.h"
#include "MeshDrawShaderBindings.h"
#include "HktVoxelCoreLog.h"

// ============================================================================
// Shader 파라미터 — 메인 VF의 subset (팔레트, 본, 복셀 크기, 스타일라이즈)
// ============================================================================

class FHktVoxelBevelVertexFactoryShaderParameters : public FVertexFactoryShaderParameters
{
	DECLARE_TYPE_LAYOUT(FHktVoxelBevelVertexFactoryShaderParameters, NonVirtual);

public:
	void Bind(const FShaderParameterMap& ParameterMap)
	{
		VoxelSizeParam.Bind(ParameterMap, TEXT("HktVoxelSize"));
		PaletteTextureParam.Bind(ParameterMap, TEXT("HktPaletteTexture"));
		PaletteSamplerParam.Bind(ParameterMap, TEXT("HktPaletteSampler"));
		BoneMatricesParam.Bind(ParameterMap, TEXT("HktBoneMatrices"));
		StylizedEnabledParam.Bind(ParameterMap, TEXT("HktStylizedEnabled"));
	}

	void GetElementShaderBindings(
		const class FSceneInterface* Scene,
		const class FSceneView* View,
		const class FMeshMaterialShader* Shader,
		const EVertexInputStreamType InputStreamType,
		ERHIFeatureLevel::Type FeatureLevel,
		const class FVertexFactory* VertexFactory,
		const struct FMeshBatchElement& BatchElement,
		class FMeshDrawSingleShaderBindings& ShaderBindings,
		FVertexInputStreamArray& VertexStreams) const
	{
		const FHktVoxelBevelVertexFactory* VF = static_cast<const FHktVoxelBevelVertexFactory*>(VertexFactory);

		if (VoxelSizeParam.IsBound())
		{
			ShaderBindings.Add(VoxelSizeParam, VF->VoxelSizeUU);
		}
		if (PaletteTextureParam.IsBound() && VF->PaletteTextureRHI)
		{
			ShaderBindings.Add(PaletteTextureParam, VF->PaletteTextureRHI);
		}
		if (PaletteSamplerParam.IsBound() && VF->PaletteSamplerRHI)
		{
			ShaderBindings.Add(PaletteSamplerParam, VF->PaletteSamplerRHI);
		}
		if (BoneMatricesParam.IsBound() && VF->BoneTransformSRV)
		{
			ShaderBindings.Add(BoneMatricesParam, VF->BoneTransformSRV);
		}
		if (StylizedEnabledParam.IsBound())
		{
			ShaderBindings.Add(StylizedEnabledParam, VF->StylizedEnabled);
		}
	}

private:
	LAYOUT_FIELD(FShaderParameter, VoxelSizeParam);
	LAYOUT_FIELD(FShaderResourceParameter, PaletteTextureParam);
	LAYOUT_FIELD(FShaderResourceParameter, PaletteSamplerParam);
	LAYOUT_FIELD(FShaderResourceParameter, BoneMatricesParam);
	LAYOUT_FIELD(FShaderParameter, StylizedEnabledParam);
};

IMPLEMENT_TYPE_LAYOUT(FHktVoxelBevelVertexFactoryShaderParameters);

IMPLEMENT_VERTEX_FACTORY_PARAMETER_TYPE(FHktVoxelBevelVertexFactory, SF_Vertex, FHktVoxelBevelVertexFactoryShaderParameters);
IMPLEMENT_VERTEX_FACTORY_PARAMETER_TYPE(FHktVoxelBevelVertexFactory, SF_Pixel, FHktVoxelBevelVertexFactoryShaderParameters);

IMPLEMENT_VERTEX_FACTORY_TYPE(FHktVoxelBevelVertexFactory, "/Plugin/HktVoxelCore/HktVoxelBevelVertexFactory.ush",
	EVertexFactoryFlags::UsedWithMaterials
	| EVertexFactoryFlags::SupportsDynamicLighting
);

FHktVoxelBevelVertexFactory::FHktVoxelBevelVertexFactory(ERHIFeatureLevel::Type InFeatureLevel)
	: FVertexFactory(InFeatureLevel)
{
}

void FHktVoxelBevelVertexFactory::SetData(const FDataType& InData)
{
	Data = InData;
	UpdateRHI(FRHICommandListImmediate::Get());
}

void FHktVoxelBevelVertexFactory::SetPaletteTexture(FRHITexture* InTexture, FRHISamplerState* InSampler)
{
	PaletteTextureRHI = InTexture;
	PaletteSamplerRHI = InSampler;
}

void FHktVoxelBevelVertexFactory::SetBoneTransformSRV(FRHIShaderResourceView* InSRV)
{
	BoneTransformSRV = InSRV;
}

bool FHktVoxelBevelVertexFactory::ShouldCompilePermutation(const FVertexFactoryShaderPermutationParameters& Parameters)
{
	return Parameters.MaterialParameters.MaterialDomain == MD_Surface;
}

void FHktVoxelBevelVertexFactory::ModifyCompilationEnvironment(
	const FVertexFactoryShaderPermutationParameters& Parameters,
	FShaderCompilerEnvironment& OutEnvironment)
{
	FVertexFactory::ModifyCompilationEnvironment(Parameters, OutEnvironment);
	OutEnvironment.SetDefine(TEXT("HKT_VOXEL_BEVEL_VERTEX_FACTORY"), TEXT("1"));
	OutEnvironment.SetDefine(TEXT("HKT_VOXEL_GPU_SKINNING"), TEXT("1"));
}

void FHktVoxelBevelVertexFactory::InitRHI(FRHICommandListBase& RHICmdList)
{
	FVertexDeclarationElementList Elements;

	if (Data.PositionComponent.VertexBuffer)
	{
		Elements.Add(AccessStreamComponent(Data.PositionComponent, 0));
	}
	if (Data.NormalComponent.VertexBuffer)
	{
		Elements.Add(AccessStreamComponent(Data.NormalComponent, 1));
	}
	if (Data.MaterialComponent.VertexBuffer)
	{
		Elements.Add(AccessStreamComponent(Data.MaterialComponent, 2));
	}

	InitDeclaration(Elements);
}

void FHktVoxelBevelVertexFactory::ReleaseRHI()
{
	FVertexFactory::ReleaseRHI();
}
