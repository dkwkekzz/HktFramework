// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainBakeLibrary.generated.h"

/**
 * UHktTerrainBakeLibrary — 청크 베이크 유틸리티 (Editor 전용).
 *
 * Editor 시점에 `FHktTerrainGenerator::GenerateChunk` 를 청크 단위로 호출하고,
 * 각 청크 결과를 oodle 압축하여 `UHktTerrainBakedAsset` 에 저장한다.
 *
 * 런타임에는 `UHktTerrainSubsystem` 이 이 자산을 비동기 로드하여 청크 lookup 의
 * 1차 데이터 소스로 사용한다 (미존재 청크는 동일 Generator 로 폴백).
 *
 * Python / Editor Utility Widget 에서 호출 가능.
 *   import unreal
 *   asset = unreal.HktTerrainBakeLibrary.bake_region(
 *       baked_config, unreal.IntVector(-2, -2, 0), unreal.IntVector(2, 2, 3),
 *       '/Game/Terrain/Baked/RegionDefault')
 */
UCLASS()
class HKTTERRAIN_API UHktTerrainBakeLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * 지정 영역의 청크를 모두 베이크하여 .uasset 으로 저장.
	 *
	 * @param BakedConfig    베이크 설정 (UHktTerrainBakedAsset 에 그대로 캡처됨).
	 * @param ChunkMin       베이크 영역 시작 청크 좌표 (포함).
	 * @param ChunkMax       베이크 영역 끝 청크 좌표 (포함).
	 * @param SavePath       저장 경로 (예: "/Game/Terrain/Baked/RegionDefault").
	 * @return 생성된 자산 (실패 시 nullptr).
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Terrain|Bake", meta = (DevelopmentOnly))
	static UHktTerrainBakedAsset* BakeRegion(
		const FHktTerrainBakedConfig& BakedConfig,
		FIntVector ChunkMin,
		FIntVector ChunkMax,
		const FString& SavePath = TEXT("/Game/Terrain/Baked/RegionDefault"));
};
