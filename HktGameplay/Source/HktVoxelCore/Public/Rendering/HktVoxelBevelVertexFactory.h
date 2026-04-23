// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "RenderResource.h"
#include "VertexFactory.h"
#include "ShaderParameters.h"

/**
 * FHktVoxelBevelVertexFactory — LOD0 볼록 모서리 베벨 전용 Vertex Factory.
 *
 * FHktVoxelBevelVertex (20바이트)의 세 스트림을 읽어 셰이더에서
 * 위치, 법선(8가지 45° 방향), 색상(팔레트 룩업)을 생성한다.
 *
 * 플랫 greedy 메시 VF와 별개 — 베벨 쿼드는 sub-voxel 위치에 놓이므로
 * 6-bit 정수 위치 패킹이 불가능하여 분리한다.
 */
class HKTVOXELCORE_API FHktVoxelBevelVertexFactory : public FVertexFactory
{
	DECLARE_VERTEX_FACTORY_TYPE(FHktVoxelBevelVertexFactory);

public:
	struct FDataType
	{
		FVertexStreamComponent PositionComponent;   // float3 — voxel 단위
		FVertexStreamComponent NormalComponent;     // uint32 — PackedNormal
		FVertexStreamComponent MaterialComponent;   // uint32 — PackedMaterial (기존 레이아웃 공유)
	};

	FHktVoxelBevelVertexFactory(ERHIFeatureLevel::Type InFeatureLevel);

	void SetData(const FDataType& InData);

	/** 팔레트 텍스처 설정 — 메인 복셀 VF와 동일 레이아웃 공유 */
	void SetPaletteTexture(FRHITexture* InTexture, FRHISamplerState* InSampler);

	/** 본 트랜스폼 SRV 설정 (GPU 스키닝) */
	void SetBoneTransformSRV(FRHIShaderResourceView* InSRV);

	static bool ShouldCompilePermutation(const FVertexFactoryShaderPermutationParameters& Parameters);

	static void ModifyCompilationEnvironment(
		const FVertexFactoryShaderPermutationParameters& Parameters,
		FShaderCompilerEnvironment& OutEnvironment);

	virtual void InitRHI(FRHICommandListBase& RHICmdList) override;
	virtual void ReleaseRHI() override;

	/** 복셀 크기 (UE 유닛) — 셰이더의 HktVoxelSize */
	float VoxelSizeUU = 15.0f;

	/** 스타일라이즈 토글 — 메인 VF와 동일 값 미러링 */
	float StylizedEnabled = 0.0f;

	FRHITexture* PaletteTextureRHI = nullptr;
	FRHISamplerState* PaletteSamplerRHI = nullptr;
	FRHIShaderResourceView* BoneTransformSRV = nullptr;

private:
	FDataType Data;
};
