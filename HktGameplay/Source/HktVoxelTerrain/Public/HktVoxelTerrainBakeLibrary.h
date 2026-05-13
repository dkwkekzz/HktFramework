// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktVoxelTerrainBakeLibrary.generated.h"

class UHktVoxelTerrainStyleSet;

/**
 * 복셀 지형 스타일 베이킹 유틸리티.
 *
 * UHktVoxelTerrainStyleSet::BlockStyles (편집 소스) 를 컴파일하여
 * 동일 자산의 TileArray / NormalArray / TileMappings / Materials 를 채운다.
 * 한 번의 베이크가 BCn 텍스처 배열 컴파일을 DDC 에 캐시하므로 런타임 BeginPlay
 * 는 단순 자산 로드만 수행한다 (TextureDerivedData 메모리 폭증 회피).
 *
 * 에디터 전용. Python/Blueprint/Editor Utility Widget 에서 호출 가능.
 */
UCLASS()
class HKTVOXELTERRAIN_API UHktVoxelTerrainBakeLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * StyleSet 의 BlockStyles 를 베이크하여 동일 자산의 TileArray/NormalArray/매핑을 채운다.
	 * 자산은 dirty 표시되며 호출자가 별도로 저장(SavePackage)할 수 있다.
	 *
	 * @param StyleSet  베이크 대상 (BlockStyles 입력 + 산출물 출력 슬롯).
	 * @return 베이크 성공 여부.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|VoxelTerrain|Bake", meta = (DevelopmentOnly))
	static bool BakeStyleSet(UHktVoxelTerrainStyleSet* StyleSet);
};
