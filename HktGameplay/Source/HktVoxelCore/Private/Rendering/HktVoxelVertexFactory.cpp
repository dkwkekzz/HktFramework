// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelVertexFactory.h"
#include "MeshMaterialShader.h"
#include "ShaderParameterUtils.h"
#include "MeshDrawShaderBindings.h"
#include "HktVoxelCoreLog.h"

// ============================================================================
// 셰이더 파라미터 — HktPaletteTexture / HktPaletteSampler 바인딩
// ============================================================================

class FHktVoxelVertexFactoryShaderParameters : public FVertexFactoryShaderParameters
{
	DECLARE_TYPE_LAYOUT(FHktVoxelVertexFactoryShaderParameters, NonVirtual);

public:
	void Bind(const FShaderParameterMap& ParameterMap)
	{
		VoxelSizeParam.Bind(ParameterMap, TEXT("HktVoxelSize"));
		PaletteTextureParam.Bind(ParameterMap, TEXT("HktPaletteTexture"));
		PaletteSamplerParam.Bind(ParameterMap, TEXT("HktPaletteSampler"));
		BoneMatricesParam.Bind(ParameterMap, TEXT("HktBoneMatrices"));

		TileEnabledParam.Bind(ParameterMap, TEXT("HktTileEnabled"));
		TileArrayParam.Bind(ParameterMap, TEXT("HktTileArray"));
		TileArraySamplerParam.Bind(ParameterMap, TEXT("HktTileSampler"));
		TileIndexLUTParam.Bind(ParameterMap, TEXT("HktTileIndexLUT"));
		TileIndexLUTSamplerParam.Bind(ParameterMap, TEXT("HktTileIndexLUTSampler"));

		MaterialLUTEnabledParam.Bind(ParameterMap, TEXT("HktMaterialLUTEnabled"));
		MaterialLUTParam.Bind(ParameterMap, TEXT("HktMaterialLUT"));
		MaterialLUTSamplerParam.Bind(ParameterMap, TEXT("HktMaterialLUTSampler"));

		NormalEnabledParam.Bind(ParameterMap, TEXT("HktNormalEnabled"));
		NormalArrayParam.Bind(ParameterMap, TEXT("HktNormalArray"));
		NormalArraySamplerParam.Bind(ParameterMap, TEXT("HktNormalSampler"));
		NormalStrengthParam.Bind(ParameterMap, TEXT("HktNormalStrength"));

		StylizedEnabledParam.Bind(ParameterMap, TEXT("HktStylizedEnabled"));
		EdgeRoundStrengthParam.Bind(ParameterMap, TEXT("HktEdgeRoundStrength"));
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
		const FHktVoxelVertexFactory* VoxelVF = static_cast<const FHktVoxelVertexFactory*>(VertexFactory);

		if (VoxelSizeParam.IsBound())
		{
			ShaderBindings.Add(VoxelSizeParam, VoxelVF->VoxelSizeUU);
		}
		if (PaletteTextureParam.IsBound() && VoxelVF->PaletteTextureRHI)
		{
			ShaderBindings.Add(PaletteTextureParam, VoxelVF->PaletteTextureRHI);
		}
		if (PaletteSamplerParam.IsBound() && VoxelVF->PaletteSamplerRHI)
		{
			ShaderBindings.Add(PaletteSamplerParam, VoxelVF->PaletteSamplerRHI);
		}
		if (BoneMatricesParam.IsBound() && VoxelVF->BoneTransformSRV)
		{
			ShaderBindings.Add(BoneMatricesParam, VoxelVF->BoneTransformSRV);
		}

		const bool bTileEnabled = (VoxelVF->TileArrayRHI != nullptr && VoxelVF->TileIndexLUTRHI != nullptr);
		if (TileEnabledParam.IsBound())
		{
			ShaderBindings.Add(TileEnabledParam, bTileEnabled ? 1.0f : 0.0f);
		}

		// [진단] 최초 1회 — 셰이더 파라미터 바인딩 상태 전수 검사.
		// IsBound()=false면 셰이더가 해당 파라미터를 사용하지 않거나 컴파일되지 않은 것.
		// RHI=null이면 CPU 측에서 텍스처가 설정되지 않은 것.
		static bool bBindDiagLogged = false;
		if (!bBindDiagLogged && bTileEnabled)
		{
			bBindDiagLogged = true;
			UE_LOG(LogHktVoxelCore, Warning,
				TEXT("[VF Bind 진단] === 셰이더 파라미터 바인딩 상태 ===\n")
				TEXT("  TileEnabled: Bound=%d, Value=%d\n")
				TEXT("  TileArray:   Bound=%d, RHI=%p\n")
				TEXT("  TileSampler: Bound=%d, RHI=%p\n")
				TEXT("  IndexLUT:    Bound=%d, RHI=%p\n")
				TEXT("  LUTSampler:  Bound=%d, RHI=%p\n")
				TEXT("  Palette:     Bound=%d, RHI=%p\n")
				TEXT("  PalSampler:  Bound=%d, RHI=%p\n")
				TEXT("  MatLUT:      Bound=%d, RHI=%p\n")
				TEXT("  VoxelSize:   Bound=%d, Value=%.1f"),
				TileEnabledParam.IsBound() ? 1 : 0, bTileEnabled ? 1 : 0,
				TileArrayParam.IsBound() ? 1 : 0, VoxelVF->TileArrayRHI,
				TileArraySamplerParam.IsBound() ? 1 : 0, VoxelVF->TileArraySamplerRHI,
				TileIndexLUTParam.IsBound() ? 1 : 0, VoxelVF->TileIndexLUTRHI,
				TileIndexLUTSamplerParam.IsBound() ? 1 : 0, VoxelVF->TileIndexLUTSamplerRHI,
				PaletteTextureParam.IsBound() ? 1 : 0, VoxelVF->PaletteTextureRHI,
				PaletteSamplerParam.IsBound() ? 1 : 0, VoxelVF->PaletteSamplerRHI,
				MaterialLUTParam.IsBound() ? 1 : 0, VoxelVF->MaterialLUTRHI,
				VoxelSizeParam.IsBound() ? 1 : 0, VoxelVF->VoxelSizeUU);
		}
		if (TileArrayParam.IsBound() && VoxelVF->TileArrayRHI)
		{
			ShaderBindings.Add(TileArrayParam, VoxelVF->TileArrayRHI);
		}
		if (TileArraySamplerParam.IsBound() && VoxelVF->TileArraySamplerRHI)
		{
			ShaderBindings.Add(TileArraySamplerParam, VoxelVF->TileArraySamplerRHI);
		}
		if (TileIndexLUTParam.IsBound() && VoxelVF->TileIndexLUTRHI)
		{
			ShaderBindings.Add(TileIndexLUTParam, VoxelVF->TileIndexLUTRHI);
		}
		if (TileIndexLUTSamplerParam.IsBound() && VoxelVF->TileIndexLUTSamplerRHI)
		{
			ShaderBindings.Add(TileIndexLUTSamplerParam, VoxelVF->TileIndexLUTSamplerRHI);
		}

		const bool bMaterialLUTEnabled = (VoxelVF->MaterialLUTRHI != nullptr);
		if (MaterialLUTEnabledParam.IsBound())
		{
			ShaderBindings.Add(MaterialLUTEnabledParam, bMaterialLUTEnabled ? 1.0f : 0.0f);
		}
		if (MaterialLUTParam.IsBound() && VoxelVF->MaterialLUTRHI)
		{
			ShaderBindings.Add(MaterialLUTParam, VoxelVF->MaterialLUTRHI);
		}
		if (MaterialLUTSamplerParam.IsBound() && VoxelVF->MaterialLUTSamplerRHI)
		{
			ShaderBindings.Add(MaterialLUTSamplerParam, VoxelVF->MaterialLUTSamplerRHI);
		}

		const bool bNormalEnabled = (VoxelVF->NormalArrayRHI != nullptr);
		if (NormalEnabledParam.IsBound())
		{
			ShaderBindings.Add(NormalEnabledParam, bNormalEnabled ? 1.0f : 0.0f);
		}
		if (NormalArrayParam.IsBound() && VoxelVF->NormalArrayRHI)
		{
			ShaderBindings.Add(NormalArrayParam, VoxelVF->NormalArrayRHI);
		}
		if (NormalArraySamplerParam.IsBound() && VoxelVF->NormalArraySamplerRHI)
		{
			ShaderBindings.Add(NormalArraySamplerParam, VoxelVF->NormalArraySamplerRHI);
		}
		if (NormalStrengthParam.IsBound())
		{
			ShaderBindings.Add(NormalStrengthParam, VoxelVF->NormalMapStrength);
		}

		if (StylizedEnabledParam.IsBound())
		{
			ShaderBindings.Add(StylizedEnabledParam, VoxelVF->StylizedEnabled);
		}
		if (EdgeRoundStrengthParam.IsBound())
		{
			ShaderBindings.Add(EdgeRoundStrengthParam, VoxelVF->EdgeRoundStrength);
		}
	}

private:
	LAYOUT_FIELD(FShaderParameter, VoxelSizeParam);
	LAYOUT_FIELD(FShaderResourceParameter, PaletteTextureParam);
	LAYOUT_FIELD(FShaderResourceParameter, PaletteSamplerParam);
	LAYOUT_FIELD(FShaderResourceParameter, BoneMatricesParam);

	LAYOUT_FIELD(FShaderParameter, TileEnabledParam);
	LAYOUT_FIELD(FShaderResourceParameter, TileArrayParam);
	LAYOUT_FIELD(FShaderResourceParameter, TileArraySamplerParam);
	LAYOUT_FIELD(FShaderResourceParameter, TileIndexLUTParam);
	LAYOUT_FIELD(FShaderResourceParameter, TileIndexLUTSamplerParam);

	LAYOUT_FIELD(FShaderParameter, MaterialLUTEnabledParam);
	LAYOUT_FIELD(FShaderResourceParameter, MaterialLUTParam);
	LAYOUT_FIELD(FShaderResourceParameter, MaterialLUTSamplerParam);

	LAYOUT_FIELD(FShaderParameter, NormalEnabledParam);
	LAYOUT_FIELD(FShaderResourceParameter, NormalArrayParam);
	LAYOUT_FIELD(FShaderResourceParameter, NormalArraySamplerParam);
	LAYOUT_FIELD(FShaderParameter, NormalStrengthParam);

	LAYOUT_FIELD(FShaderParameter, StylizedEnabledParam);
	LAYOUT_FIELD(FShaderParameter, EdgeRoundStrengthParam);
};

IMPLEMENT_TYPE_LAYOUT(FHktVoxelVertexFactoryShaderParameters);

IMPLEMENT_VERTEX_FACTORY_PARAMETER_TYPE(FHktVoxelVertexFactory, SF_Vertex, FHktVoxelVertexFactoryShaderParameters);
IMPLEMENT_VERTEX_FACTORY_PARAMETER_TYPE(FHktVoxelVertexFactory, SF_Pixel, FHktVoxelVertexFactoryShaderParameters);

IMPLEMENT_VERTEX_FACTORY_TYPE(FHktVoxelVertexFactory, "/Plugin/HktVoxelCore/HktVoxelVertexFactory.ush",
	EVertexFactoryFlags::UsedWithMaterials
	| EVertexFactoryFlags::SupportsDynamicLighting
);

FHktVoxelVertexFactory::FHktVoxelVertexFactory(ERHIFeatureLevel::Type InFeatureLevel)
	: FVertexFactory(InFeatureLevel)
{
}

void FHktVoxelVertexFactory::SetData(const FDataType& InData)
{
	Data = InData;
	UpdateRHI(FRHICommandListImmediate::Get());
}

void FHktVoxelVertexFactory::SetPaletteTexture(FRHITexture* InTexture, FRHISamplerState* InSampler)
{
	PaletteTextureRHI = InTexture;
	PaletteSamplerRHI = InSampler;
}

void FHktVoxelVertexFactory::SetBoneTransformSRV(FRHIShaderResourceView* InSRV)
{
	BoneTransformSRV = InSRV;
}

void FHktVoxelVertexFactory::SetTileTextures(
	FRHITexture* InTileArray, FRHISamplerState* InTileSampler,
	FRHITexture* InTileIndexLUT, FRHISamplerState* InLUTSampler)
{
	TileArrayRHI = InTileArray;
	TileArraySamplerRHI = InTileSampler;
	TileIndexLUTRHI = InTileIndexLUT;
	TileIndexLUTSamplerRHI = InLUTSampler;
}

void FHktVoxelVertexFactory::SetMaterialLUT(FRHITexture* InLUT, FRHISamplerState* InSampler)
{
	MaterialLUTRHI = InLUT;
	MaterialLUTSamplerRHI = InSampler;
}

void FHktVoxelVertexFactory::SetNormalArray(FRHITexture* InArray, FRHISamplerState* InSampler)
{
	NormalArrayRHI = InArray;
	NormalArraySamplerRHI = InSampler;
}

bool FHktVoxelVertexFactory::ShouldCompilePermutation(const FVertexFactoryShaderPermutationParameters& Parameters)
{
	// Surface 도메인만 허용 (wireframe/debug 포함 — SpecialEngineMaterial 차단하면 와이어프레임 불가)
	return Parameters.MaterialParameters.MaterialDomain == MD_Surface;
}

void FHktVoxelVertexFactory::ModifyCompilationEnvironment(
	const FVertexFactoryShaderPermutationParameters& Parameters,
	FShaderCompilerEnvironment& OutEnvironment)
{
	FVertexFactory::ModifyCompilationEnvironment(Parameters, OutEnvironment);
	OutEnvironment.SetDefine(TEXT("HKT_VOXEL_VERTEX_FACTORY"), TEXT("1"));
	OutEnvironment.SetDefine(TEXT("HKT_VOXEL_GPU_SKINNING"), TEXT("1"));
	// 타일 텍스처 디버그 색상 출력: 1 = 활성 (빨강/초록/파랑 진단), 0 = 비활성 (정상 렌더링)
	OutEnvironment.SetDefine(TEXT("HKT_VOXEL_DEBUG_COLOR"), TEXT("0"));
}

void FHktVoxelVertexFactory::InitRHI(FRHICommandListBase& RHICmdList)
{
	FVertexDeclarationElementList Elements;

	// Stream 0: PackedPositionAndSize (uint32)
	if (Data.PositionComponent.VertexBuffer)
	{
		Elements.Add(AccessStreamComponent(Data.PositionComponent, 0));
	}

	// Stream 1: PackedMaterialAndAO (uint32)
	if (Data.MaterialComponent.VertexBuffer)
	{
		Elements.Add(AccessStreamComponent(Data.MaterialComponent, 1));
	}

	InitDeclaration(Elements);
}

void FHktVoxelVertexFactory::ReleaseRHI()
{
	FVertexFactory::ReleaseRHI();
}
