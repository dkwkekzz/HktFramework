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

	/**
	 * 디렉토리 → StyleSet 자산 1방 생성 (Editor Utility / Python 용 원샷).
	 *
	 * 동작 순서:
	 *   1) SavePath 위치에 UHktVoxelTerrainStyleSet 새 자산 생성 (이미 있으면 재사용).
	 *   2) SourceDirectory 지정 후 ImportFromDirectory 호출 (텍스처/아틀라스 자동 분해).
	 *   3) BakeStyleSet 호출 (TileArray + NormalArray + 매핑 빌드).
	 *   4) UPackage::SavePackage 로 .uasset 영속화.
	 *
	 * Python 예:
	 *   import unreal
	 *   asset = unreal.HktVoxelTerrainBakeLibrary.create_style_set_from_directory(
	 *       '/Game/VoxelTerrain/Tiles', '/Game/VoxelTerrain/SS_Default')
	 *
	 * **주의:** 동일 SavePath 로 재호출하면 BlockStyles 가 초기화(Reset)되어 디렉토리 내용으로
	 * 다시 채워진다. 자산에서 수동 보정한 Roughness/Metallic/BaseColor 같은 값이 있다면
	 * 이 함수 대신 자산을 열어 Import 만 호출(또는 PBR 만 수정 후 Bake)할 것.
	 *
	 * @param SourceDirectory  스캔할 콘텐츠 디렉토리 (예: "/Game/VoxelTerrain/Tiles").
	 * @param SavePath         생성될 자산 풀 패스 (예: "/Game/VoxelTerrain/SS_Default").
	 * @return 생성·베이크·저장된 자산 (실패 시 nullptr).
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|VoxelTerrain|Bake", meta = (DevelopmentOnly))
	static UHktVoxelTerrainStyleSet* CreateStyleSetFromDirectory(
		const FString& SourceDirectory,
		const FString& SavePath = TEXT("/Game/VoxelTerrain/SS_Default"));
};
