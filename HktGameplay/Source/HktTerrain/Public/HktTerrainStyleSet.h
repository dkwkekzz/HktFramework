// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HktTerrainStyleSet.generated.h"

class UTexture2DArray;

/**
 * 베이크된 단일 TypeID 슬라이스 매핑.
 *
 * Editor-time 베이크 결과로, 런타임에는 렌더러 측 아틀라스에 그대로 주입된다.
 * 슬라이스 인덱스 255 = 미매핑(팔레트 폴백).
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
 * UHktTerrainStyleSet — 베이크된 지형 스타일 자산
 *
 * BlockStyles 배열을 에디터-타임에 한 번만 컴파일하여 다음 산출물을
 * 단일 .uasset 으로 저장한다:
 *   1. TileArray   : Texture2DArray (지형 BaseColor)
 *   2. NormalArray : Texture2DArray (선택, 노멀맵)
 *   3. TileMappings: TypeID → (Top/Side/Bottom 슬라이스)
 *   4. Materials   : TypeID → (Roughness/Metallic/Specular)
 *
 * 본 자산은 렌더러 비종속 — 어떤 엔진 의존(HktVoxelCore 의 TileAtlas/MaterialLUT)도 갖지
 * 않는다. Voxel 경로는 `HktVoxelTerrain` 의 free helper(`HktTerrainStyleApply`)를 통해
 * 본 자산을 아틀라스에 적용한다. Sprite 경로(PR-D)는 동일 자산을 별도 어댑터로 소비.
 *
 * UTexture2DArray 두 개는 본 자산의 inner subobject 로 저장되어 cooking 단계에서
 * 정상 패키징된다 (별도 asset 분리 불필요).
 *
 * 절대 원칙 (CLAUDE.md):
 *   - HktTerrain 은 HktVoxelCore 에 의존하지 않는다 (단방향: 렌더러 → HktTerrain).
 */
UCLASS(BlueprintType)
class HKTTERRAIN_API UHktTerrainStyleSet : public UDataAsset
{
	GENERATED_BODY()

public:
	/** 베이크된 BaseColor 텍스처 배열 — 본 자산의 inner subobject */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style")
	TObjectPtr<UTexture2DArray> TileArray;

	/** 베이크된 노멀 텍스처 배열 (선택) — TileArray와 동일 슬라이스 인덱싱 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style")
	TObjectPtr<UTexture2DArray> NormalArray;

	/** TypeID → 슬라이스 인덱스 매핑 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style")
	TArray<FHktBakedTileMapping> TileMappings;

	/** TypeID → PBR 속성 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style")
	TArray<FHktBakedMaterialEntry> Materials;

	/** 디버그용: 베이크 시 소스 BlockStyles 개수 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style|Debug")
	int32 SourceBlockStyleCount = 0;

	/** 디버그용: 베이크된 슬라이스 개수 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Terrain|Style|Debug")
	int32 SliceCount = 0;

	/** 베이크 결과가 사용 가능한지 (TileArray + 매핑이 1개 이상) */
	bool HasBakedData() const
	{
		return TileArray != nullptr && TileMappings.Num() > 0;
	}
};
