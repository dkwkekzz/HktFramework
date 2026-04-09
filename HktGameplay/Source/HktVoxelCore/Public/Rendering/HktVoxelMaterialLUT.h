// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "HktVoxelMaterialLUT.generated.h"

class UTexture2D;

/**
 * UHktVoxelMaterialLUT — TypeID별 PBR 머티리얼 속성 룩업 테이블
 *
 * 256×1 RGBA8 텍스처로 블록 타입별 Roughness/Metallic/Specular을 저장한다.
 * 셰이더에서 VoxelType으로 인덱싱하여 GBufferB를 동적으로 출력.
 *
 * 미사용 시 기존 하드코딩 (Roughness=0.8, Metallic=0.0) 동작 유지.
 */
UCLASS(BlueprintType)
class HKTVOXELCORE_API UHktVoxelMaterialLUT : public UObject
{
	GENERATED_BODY()

public:
	/** 머티리얼 LUT 텍스처 — 256×1, Row=TypeID%256 */
	UPROPERTY(EditAnywhere, Category = "Material")
	TObjectPtr<UTexture2D> MaterialLUT;

	/** RHI 핸들 — nullptr이면 LUT 미사용 (기존 하드코딩 폴백) */
	FRHITexture* GetMaterialLUTRHI() const;

	/**
	 * TypeID에 대한 PBR 속성 설정.
	 * @param TypeID    복셀 타입 (0~255)
	 * @param Roughness 표면 거칠기 (0=매끈, 1=거침)
	 * @param Metallic  금속성 (0=비금속, 1=금속)
	 * @param Specular  스페큘러 강도 (0~1, 기본 0.5)
	 */
	void SetMaterial(uint16 TypeID, float Roughness, float Metallic, float Specular);

	/** CPU 테이블 → GPU 텍스처 업로드 */
	void BuildLUTTexture();

	/** HktTerrainType에 맞는 디버그 PBR 속성 자동 설정 + GPU 업로드 */
	UFUNCTION(BlueprintCallable, Category = "Material|Debug")
	void CreateDefaultTerrainLUT();

private:
	struct FHktMaterialEntry
	{
		float Roughness = 0.8f;
		float Metallic = 0.0f;
		float Specular = 0.5f;
	};

	FHktMaterialEntry MaterialTable[256];
	bool bTableInitialized = false;

	void EnsureTableInitialized();
};
