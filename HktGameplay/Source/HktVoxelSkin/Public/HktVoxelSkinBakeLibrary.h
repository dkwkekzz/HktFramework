// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktVoxelSkinBakeLibrary.generated.h"

class USkeletalMesh;
class UHktVoxelSkinLayerAsset;

/**
 * 복셀 스킨 베이킹 유틸리티.
 *
 * SkeletalMesh를 복셀화하여 UHktVoxelSkinLayerAsset으로 저장한다.
 * 에디터 전용. Python/Blueprint에서 호출 가능.
 *
 * Python 예시:
 *   import unreal
 *   mesh = unreal.load_asset('/Game/Characters/SK_Knight')
 *   asset = unreal.HktVoxelSkinBakeLibrary.bake_skeletal_mesh(
 *       mesh, '/Game/VoxelSkins/VS_Knight', 32, True)
 *
 * Blueprint:
 *   Editor Utility Widget에서 BakeSkeletalMesh 노드 사용
 */
UCLASS()
class HKTVOXELSKIN_API UHktVoxelSkinBakeLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * SkeletalMesh를 복셀화하여 VoxelSkinLayerAsset으로 저장.
	 *
	 * @param SkeletalMesh    원본 메시 (LOD0 레퍼런스 포즈 사용)
	 * @param SavePath        저장 경로 (예: "/Game/VoxelSkins/VS_Knight")
	 * @param GridSize        복셀 그리드 크기 (기본 32, 최대 64)
	 * @param bSolidFill      내부 채우기 여부 (기본 true)
	 * @return 생성된 에셋 (실패 시 nullptr)
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|VoxelSkin|Bake", meta = (DevelopmentOnly))
	static UHktVoxelSkinLayerAsset* BakeSkeletalMesh(
		USkeletalMesh* SkeletalMesh,
		const FString& SavePath = TEXT("/Game/VoxelSkins/VS_Default"),
		int32 GridSize = 32,
		bool bSolidFill = true);

	/**
	 * 복셀화만 수행 (저장 없음). 결과 미리보기/디버그용.
	 *
	 * @param SkeletalMesh    원본 메시
	 * @param GridSize        복셀 그리드 크기
	 * @param OutVoxelCount   총 복셀 수
	 * @param OutBoneCount    본 그룹 수
	 * @return 성공 여부
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|VoxelSkin|Bake", meta = (DevelopmentOnly))
	static bool PreviewVoxelize(
		USkeletalMesh* SkeletalMesh,
		int32 GridSize,
		int32& OutVoxelCount,
		int32& OutBoneCount);
};
