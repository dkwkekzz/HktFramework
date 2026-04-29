// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktVoxelTerrainActor.h"  // FHktVoxelBlockStyle USTRUCT (UFUNCTION param)
#include "HktVoxelTerrainBakeLibrary.generated.h"

class UHktTerrainStyleSet;

/**
 * 복셀 지형 스타일 베이킹 유틸리티.
 *
 * AHktVoxelTerrainActor::BlockStyles 배열을 에디터-타임에 컴파일하여
 * UHktTerrainStyleSet (.uasset) 으로 저장한다. 이 한 번의 베이크가
 * BCn 텍스처 배열 컴파일을 DDC 에 캐시하므로, 런타임 BeginPlay 에서는
 * 단순 자산 로드만 수행된다 (TextureDerivedData 메모리 폭증 회피).
 *
 * 에디터 전용. Python/Blueprint/Editor Utility Widget 에서 호출 가능.
 *
 * Python 예시:
 *   import unreal
 *   actor = unreal.EditorLevelLibrary.get_selected_level_actors()[0]
 *   asset = unreal.HktVoxelTerrainBakeLibrary.bake_style_set(
 *       actor.block_styles, '/Game/VoxelTerrain/SS_Default')
 */
UCLASS()
class HKTVOXELTERRAIN_API UHktVoxelTerrainBakeLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * BlockStyles 배열을 베이크하여 UHktTerrainStyleSet 자산으로 저장.
	 *
	 * 동작:
	 *   1. 소스 텍스처 호환성 검증 (해상도/포맷 동일성)
	 *   2. inner subobject 로 UTexture2DArray (TileArray, NormalArray) 생성
	 *   3. UpdateSourceFromSourceTextures(true) → DDC 컴파일 (에디터-타임 1회)
	 *   4. 텍스처 컴파일 완료 대기 (FinishCompilation)
	 *   5. TileMappings / Materials 채우기
	 *   6. UPackage::SavePackage 로 .uasset 저장
	 *
	 * @param BlockStyles    베이크 대상 (보통 AHktVoxelTerrainActor::BlockStyles)
	 * @param SavePath       저장 경로 (예: "/Game/VoxelTerrain/SS_Default")
	 * @return 생성된 자산 (실패 시 nullptr)
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|VoxelTerrain|Bake", meta = (DevelopmentOnly))
	static UHktTerrainStyleSet* BakeStyleSet(
		const TArray<FHktVoxelBlockStyle>& BlockStyles,
		const FString& SavePath = TEXT("/Game/VoxelTerrain/SS_Default"));
};
