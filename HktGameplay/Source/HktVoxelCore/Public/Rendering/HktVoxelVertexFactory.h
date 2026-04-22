// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "RenderResource.h"
#include "VertexFactory.h"
#include "ShaderParameters.h"

/**
 * FHktVoxelVertexFactory — 복셀 전용 Vertex Factory
 *
 * FHktVoxelVertex (8바이트)의 두 uint32 스트림을 읽어
 * 셰이더에서 위치, 크기, 법선, 재질, AO를 언팩한다.
 *
 * Phase 3 (프로덕션) 에서 사용. Phase 1은 PMC로 대체.
 */
class HKTVOXELCORE_API FHktVoxelVertexFactory : public FVertexFactory
{
	DECLARE_VERTEX_FACTORY_TYPE(FHktVoxelVertexFactory);

public:
	struct FDataType
	{
		FVertexStreamComponent PositionComponent;   // PackedPositionAndSize (uint32)
		FVertexStreamComponent MaterialComponent;   // PackedMaterialAndAO  (uint32)
	};

	FHktVoxelVertexFactory(ERHIFeatureLevel::Type InFeatureLevel);

	void SetData(const FDataType& InData);

	/** 팔레트 텍스처 설정 — 셰이더의 HktPaletteTexture 바인딩용 */
	void SetPaletteTexture(FRHITexture* InTexture, FRHISamplerState* InSampler);

	/** 본 트랜스폼 SRV 설정 — 셰이더의 HktBoneMatrices 바인딩용 (GPU 스키닝) */
	void SetBoneTransformSRV(FRHIShaderResourceView* InSRV);

	/** 셰이더 퍼뮤테이션 — 복셀 전용이므로 제한적 컴파일 */
	static bool ShouldCompilePermutation(const FVertexFactoryShaderPermutationParameters& Parameters);

	/** 셰이더 컴파일 환경 설정 — HKT_VOXEL_VERTEX_FACTORY 매크로 주입 */
	static void ModifyCompilationEnvironment(
		const FVertexFactoryShaderPermutationParameters& Parameters,
		FShaderCompilerEnvironment& OutEnvironment);

	virtual void InitRHI(FRHICommandListBase& RHICmdList) override;
	virtual void ReleaseRHI() override;

	/** 복셀 크기 (UE 유닛). 셰이더의 HktVoxelSize에 바인딩 */
	float VoxelSizeUU = 15.0f;

	FRHITexture* PaletteTextureRHI = nullptr;
	FRHISamplerState* PaletteSamplerRHI = nullptr;
	FRHIShaderResourceView* BoneTransformSRV = nullptr;

	// --- Tile Texture (Phase 1: 타일 아틀라스) ---
	FRHITexture* TileArrayRHI = nullptr;           // Texture2DArray — 타일 텍스처
	FRHISamplerState* TileArraySamplerRHI = nullptr;
	FRHITexture* TileIndexLUTRHI = nullptr;         // 256×3 R8 — TypeID→슬라이스 LUT
	FRHISamplerState* TileIndexLUTSamplerRHI = nullptr;

	/** 타일 텍스처 설정 — nullptr이면 타일 비활성 (기존 팔레트 폴백) */
	void SetTileTextures(FRHITexture* InTileArray, FRHISamplerState* InTileSampler,
	                     FRHITexture* InTileIndexLUT, FRHISamplerState* InLUTSampler);

	// --- Material LUT (Phase 2: PBR 질감 차별화) ---
	FRHITexture* MaterialLUTRHI = nullptr;           // 256×1 RGBA8 — TypeID별 PBR 속성
	FRHISamplerState* MaterialLUTSamplerRHI = nullptr;

	/** 머티리얼 LUT 설정 — nullptr이면 기존 하드코딩 PBR 폴백 */
	void SetMaterialLUT(FRHITexture* InLUT, FRHISamplerState* InSampler);

	// --- 노멀맵 배열 (Phase 3: 표면 디테일) ---
	FRHITexture* NormalArrayRHI = nullptr;           // Texture2DArray — TileArray와 동일 슬라이싱
	FRHISamplerState* NormalArraySamplerRHI = nullptr;

	/** 노멀맵 설정 — nullptr이면 플랫 노멀 폴백 */
	void SetNormalArray(FRHITexture* InArray, FRHISamplerState* InSampler);

	// --- 스타일라이즈 렌더링 (메이플2풍 카툰 셰이딩) ---
	float StylizedEnabled = 0.0f;

	// --- 엣지 라운딩 — PS 노멀 벤딩 강도 (0=off, 0.3~0.6 권장) ---
	// 스타일라이즈와 독립. 지오메트리는 그대로, 라이팅만 둥글게.
	float EdgeRoundStrength = 0.0f;

	// --- 엣지 알파 — Dithered clip으로 쿼드 경계 픽셀 discard (실루엣 둥글리기) ---
	// EdgeRound와 독립 토글. 둘 다 켜면 실루엣/라이팅 모두 둥글게.
	// Strength: 0=off, 0.3~0.7 권장. Start: 페이드 시작 거리(쿼드 중심=0, 경계=1), 0.6~0.9 권장.
	float EdgeAlphaStrength = 0.0f;
	float EdgeAlphaStart = 0.75f;

	/** 노멀맵 강도 (0=off, 1=원본, >1=과장). NormalArrayRHI가 null이면 무시됨 */
	float NormalMapStrength = 1.0f;

private:
	FDataType Data;
};
