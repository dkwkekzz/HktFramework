// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Engine/EngineTypes.h"
#include "HktVoxelTerrainTypes.h"
#include "HktVoxelTerrainStyleSet.generated.h"

class UTexture2D;
class UTexture2DArray;
class UHktVoxelTileAtlas;
class UHktVoxelMaterialLUT;

/**
 * FHktVoxelBlockStyle — 블록 타입별 시각 정의 (편집 소스).
 *
 * EHktTerrainType 별 Top/Side/Bottom 텍스처·노멀·PBR 을 한 묶음으로 표현한다.
 * 텍스처가 모두 비어있으면 BaseColor 솔리드 컬러로 폴백 렌더링.
 */
USTRUCT(BlueprintType)
struct FHktVoxelBlockStyle
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	EHktTerrainType BlockType = EHktTerrainType::Grass;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	FString DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	FLinearColor BaseColor = FLinearColor::White;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|BaseColor",
		meta = (DisplayName = "Top (+Z) BaseColor"))
	TObjectPtr<UTexture2D> TopTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|BaseColor",
		meta = (DisplayName = "Side (XY) BaseColor"))
	TObjectPtr<UTexture2D> SideTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|BaseColor",
		meta = (DisplayName = "Bottom (-Z) BaseColor"))
	TObjectPtr<UTexture2D> BottomTexture;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|Normal",
		meta = (DisplayName = "Top (+Z) Normal"))
	TObjectPtr<UTexture2D> TopNormal;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|Normal",
		meta = (DisplayName = "Side (XY) Normal"))
	TObjectPtr<UTexture2D> SideNormal;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture|Normal",
		meta = (DisplayName = "Bottom (-Z) Normal"))
	TObjectPtr<UTexture2D> BottomNormal;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Roughness = 0.8f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Metallic = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Specular = 0.5f;

	FORCEINLINE uint16 GetTypeID() const { return static_cast<uint16>(BlockType); }

	FORCEINLINE bool HasAnyTexture() const
	{
		return TopTexture != nullptr || SideTexture != nullptr || BottomTexture != nullptr;
	}
};

/**
 * 베이크된 단일 TypeID 슬라이스 매핑. 슬라이스 인덱스 255 = 미매핑(팔레트 폴백).
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
 * UHktVoxelTerrainStyleSet — 복셀 지형 스타일 통합 자산
 *
 * 한 자산이 편집 소스 + 베이크 산출물을 모두 보유한다:
 *
 *   [SOURCE]                     [BAKED OUTPUT]
 *   SourceDirectory   ─Import──> BlockStyles ─Bake──> TileArray / NormalArray /
 *   AtlasGuess.....                                   TileMappings / Materials
 *
 * AHktVoxelTerrainActor 는 본 자산 1개만 참조하며 런타임에는 BakedOutput 만 사용한다.
 *
 * Editor 워크플로:
 *   1) SourceDirectory 지정 (예: /Game/VoxelTerrain/Tiles)
 *   2) "Import From Directory" 버튼 → 파일명 prefix 규칙으로 BlockStyles 자동 채움.
 *      그리드 아틀라스(`<Type>_Atlas_<COLS>x<ROWS>`) 는 셀 별 sub-Texture2D 자산으로
 *      분해되어 `<Dir>/_Split/<Type>/` 아래 저장된다.
 *   3) "Bake" 버튼 → Texture2DArray + 매핑 컴파일.
 *
 * 디렉토리 파일명 규칙 (case-insensitive, `T_` 접두 무시):
 *   - `<TypeName>`            → SideTexture (단일 텍스처 = 전 면 공유)
 *   - `<TypeName>_Top`        → TopTexture
 *   - `<TypeName>_Side`       → SideTexture
 *   - `<TypeName>_Bottom`     → BottomTexture
 *   - `<TypeName>_<Face>_N`   → 대응 Normal (suffix `_N`)
 *   - `<TypeName>_Atlas_<C>x<R>` → 그리드 아틀라스. 셀 순서(row-major):
 *        1×1, 1xN, Nx1 → 한 셀만 = Side
 *        2 셀          → Top, Side
 *        3 셀 이상     → Top, Side, Bottom (이후 셀 무시)
 *
 * EHktTerrainType 매핑은 enum DisplayName 또는 enum 식별자명으로 모두 인식.
 */
UCLASS(BlueprintType)
class HKTVOXELTERRAIN_API UHktVoxelTerrainStyleSet : public UDataAsset
{
	GENERATED_BODY()

public:
	// ================================================================
	// SOURCE — 편집/임포트 소스
	// ================================================================

	/** 텍스처/아틀라스를 자동 임포트할 콘텐츠 디렉토리 (예: /Game/VoxelTerrain/Tiles). */
	UPROPERTY(EditAnywhere, Category = "HKT|Source")
	FDirectoryPath SourceDirectory;

	/**
	 * EHktTerrainType 별 시각 정의.
	 * ImportFromDirectory 가 자동으로 채우거나 수동 편집 가능.
	 */
	UPROPERTY(EditAnywhere, Category = "HKT|Source",
		meta = (TitleProperty = "{BlockType} - {DisplayName}"))
	TArray<FHktVoxelBlockStyle> BlockStyles;

	// ================================================================
	// BAKED OUTPUT — Bake 산출물 (런타임이 사용)
	// ================================================================

	/** 베이크된 BaseColor 텍스처 배열 — 본 자산의 inner subobject */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked")
	TObjectPtr<UTexture2DArray> TileArray;

	/** 베이크된 노멀 텍스처 배열 (선택) — TileArray와 동일 슬라이스 인덱싱 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked")
	TObjectPtr<UTexture2DArray> NormalArray;

	/** TypeID → 슬라이스 인덱스 매핑 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked")
	TArray<FHktBakedTileMapping> TileMappings;

	/** TypeID → PBR 속성 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked")
	TArray<FHktBakedMaterialEntry> Materials;

	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked|Debug")
	int32 SourceBlockStyleCount = 0;

	UPROPERTY(VisibleAnywhere, Category = "HKT|Baked|Debug")
	int32 SliceCount = 0;

	// ================================================================
	// Runtime API
	// ================================================================

	/**
	 * 베이크 결과를 런타임 아틀라스/머티리얼 LUT 에 주입.
	 * 텍스처 배열은 참조만 연결 (재컴파일 없음).
	 */
	void ApplyTo(UHktVoxelTileAtlas* Atlas, UHktVoxelMaterialLUT* MaterialLUT) const;

	/** 베이크 산출물이 사용 가능한지 (TileArray + 매핑이 1개 이상) */
	bool HasBakedData() const
	{
		return TileArray != nullptr && TileMappings.Num() > 0;
	}

#if WITH_EDITOR
	// ================================================================
	// Editor API — Import & Bake
	// ================================================================

	/**
	 * SourceDirectory 를 스캔하여 BlockStyles 를 자동으로 채운다.
	 * 그리드 아틀라스는 셀별 sub-Texture2D 자산으로 분해되어 사이드카로 저장된다.
	 * 에디터-전용.
	 */
	UFUNCTION(CallInEditor, Category = "HKT|Source")
	void ImportFromDirectory();

	/**
	 * BlockStyles 를 베이크하여 TileArray/NormalArray/매핑/Materials 를 채운다.
	 * 동작 후 본 자산을 dirty 표시. 에디터-전용.
	 */
	UFUNCTION(CallInEditor, Category = "HKT|Bake")
	void Bake();
#endif
};
