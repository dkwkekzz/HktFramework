// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "LandscapeLayerInfoObject.h"
#include "HktBiomeLandscapeLayer.generated.h"

/**
 * FHktBiomeLandscapeLayer
 *
 * 바이옴 ID → Landscape Paint Layer 매핑 테이블 엔트리.
 *
 * BiomeId는 FHktTerrainPreviewSample::BiomeId 와 일치해야 한다.
 *   - Advanced 모드(bIsAdvanced=true):  EHktAdvBiome raw 값
 *   - Legacy  모드(bIsAdvanced=false): EHktBiomeType + 200 (레거시 오프셋)
 *
 * AHktLandscapeTerrainActor는 이 매핑으로 바이옴 샘플 각 셀에 단일 레이어에만
 * 255 가중치를 찍어 Additive Import 와 정합을 맞춘다. 미매핑 바이옴은 첫 번째
 * 레이어로 폴백한다.
 */
USTRUCT(BlueprintType)
struct HKTLANDSCAPETERRAIN_API FHktBiomeLandscapeLayer
{
	GENERATED_BODY()

	/** 매핑 대상 바이옴 ID (FHktTerrainPreviewSample::BiomeId 와 동일 인코딩) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Biome")
	uint8 BiomeId = 0;

	/** Landscape 페인트 레이어 인포 에셋 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Biome")
	TObjectPtr<ULandscapeLayerInfoObject> LayerInfo = nullptr;

	/** 에디터 표시 + Import Layer 이름 (비어있으면 Biome_{BiomeId} 로 자동 생성) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Biome")
	FName DebugName;
};
