// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HktVoxelTerrainStyleSet.generated.h"

class UTexture2DArray;
class UHktVoxelTileAtlas;
class UHktVoxelMaterialLUT;

/**
 * 베이크된 단일 TypeID 슬라이스 매핑.
 *
 * Editor-time 베이크 결과로, 런타임에는 UHktVoxelTileAtlas::SetTileMapping에
 * 그대로 주입된다. 슬라이스 인덱스 255 = 미매핑(팔레트 폴백).
 */
USTRUCT()
struct FHktBakedTileMapping
{
	GENERATED_BODY()

	UPROPERTY()
	int32 TypeID = 0;

	UPROPERTY()
	uint8 TopSlice = 255;

	UPROPERTY()
	uint8 SideSlice = 255;

	UPROPERTY()
	uint8 BottomSlice = 255;
};

/**
 * 베이크된 단일 TypeID PBR 머티리얼 엔트리.
 */
USTRUCT()
struct FHktBakedMaterialEntry
{
	GENERATED_BODY()

	UPROPERTY()
	int32 TypeID = 0;

	UPROPERTY()
	float Roughness = 0.8f;

	UPROPERTY()
	float Metallic = 0.0f;

	UPROPERTY()
	float Specular = 0.5f;
};

/**
 * UHktVoxelTerrainStyleSet — 베이크된 복셀 지형 스타일 자산
 *
 * BlockStyles 배열을 에디터-타임에 한 번만 컴파일하여 다음 산출물을
 * 단일 .uasset 으로 저장한다:
 *   1. TileArray   : Texture2DArray (지형 BaseColor)
 *   2. NormalArray : Texture2DArray (선택, 노멀맵)
 *   3. TileMappings: TypeID → (Top/Side/Bottom 슬라이스)
 *   4. Materials   : TypeID → (Roughness/Metallic/Specular)
 *
 * 본 자산은 **Voxel 렌더링 전용**이다 — Top/Side/Bottom 면 슬라이스, per-face PBR 등
 * 모두 voxel face-meshing 파이프라인에 묶인 데이터. Sprite/HISM 경로는 별도 자산
 * (`UHktSpriteTerrainStyleSet`, PR-D 신설 예정) 을 사용한다.
 *
 * 런타임에는 ApplyTo()로 UHktVoxelTileAtlas / UHktVoxelMaterialLUT 에
 * 즉시 주입한다. UpdateSourceFromSourceTextures 같은 DDC 트리거 경로를
 * 거치지 않으므로 BCn 컴파일 메모리 폭증이 발생하지 않는다.
 *
 * UTexture2DArray 두 개는 본 자산의 inner subobject 로 저장되어 cooking
 * 단계에서 정상 패키징된다 (별도 asset 분리 불필요).
 */
UCLASS(BlueprintType)
class HKTVOXELTERRAIN_API UHktVoxelTerrainStyleSet : public UDataAsset
{
	GENERATED_BODY()

public:
	/** 베이크된 BaseColor 텍스처 배열 — 본 자산의 inner subobject */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style")
	TObjectPtr<UTexture2DArray> TileArray;

	/** 베이크된 노멀 텍스처 배열 (선택) — TileArray와 동일 슬라이스 인덱싱 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style")
	TObjectPtr<UTexture2DArray> NormalArray;

	/** TypeID → 슬라이스 인덱스 매핑 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style")
	TArray<FHktBakedTileMapping> TileMappings;

	/** TypeID → PBR 속성 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style")
	TArray<FHktBakedMaterialEntry> Materials;

	/** 디버그용: 베이크 시 소스 BlockStyles 개수 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style|Debug")
	int32 SourceBlockStyleCount = 0;

	/** 디버그용: 베이크된 슬라이스 개수 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|VoxelTerrain|Style|Debug")
	int32 SliceCount = 0;

	/**
	 * 본 StyleSet 의 매핑/머티리얼 데이터를 런타임 아틀라스에 주입한다.
	 * 텍스처 배열은 그대로 참조만 연결한다 (재컴파일 없음).
	 *
	 * @param Atlas      대상 타일 아틀라스 (TileArray/NormalArray 핸들 + 인덱스 LUT)
	 * @param MaterialLUT 대상 PBR LUT
	 */
	void ApplyTo(UHktVoxelTileAtlas* Atlas, UHktVoxelMaterialLUT* MaterialLUT) const;

	/** 베이크 결과가 사용 가능한지 (TileArray + 매핑이 1개 이상) */
	bool HasBakedData() const
	{
		return TileArray != nullptr && TileMappings.Num() > 0;
	}
};
