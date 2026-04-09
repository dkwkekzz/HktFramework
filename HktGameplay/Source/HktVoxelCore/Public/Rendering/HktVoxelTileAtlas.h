// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "HktVoxelTileAtlas.generated.h"

class UTexture2DArray;
class UTexture2D;

/**
 * UHktVoxelTileAtlas — 복셀 타일 텍스처 아틀라스 매니저
 *
 * TypeID별 Texture2DArray 슬라이스 매핑을 관리한다.
 * 타일 텍스처가 설정되지 않으면 기존 팔레트 렌더링 경로가 그대로 동작한다.
 *
 * 사용법:
 *   1. 에디터에서 TileArray(Texture2DArray)와 TileIndexLUT 에셋 할당
 *      또는 CreateDebugTileArray() / CreateDebugLUT()로 테스트 텍스처 생성
 *   2. ChunkComponent/Proxy에 RHI 핸들 전달
 */
UCLASS(BlueprintType)
class HKTVOXELCORE_API UHktVoxelTileAtlas : public UObject
{
	GENERATED_BODY()

public:
	/** 타일 텍스처 배열 — 각 슬라이스 = 하나의 블록 면 텍스처 (64×64) */
	UPROPERTY(EditAnywhere, Category = "Tile")
	TObjectPtr<UTexture2DArray> TileArray;

	/** 타일 인덱스 LUT — 256×3 R8 텍스처. Row=TypeID, Col=FaceVariant(Top/Side/Bottom) */
	UPROPERTY(EditAnywhere, Category = "Tile")
	TObjectPtr<UTexture2D> TileIndexLUT;

	/** RHI 텍스처 핸들 반환 — nullptr이면 타일 시스템 미사용 (팔레트 폴백) */
	FRHITexture* GetTileArrayRHI() const;
	FRHITexture* GetTileIndexLUTRHI() const;

	// ================================================================
	// CPU 매핑 API
	// ================================================================

	/**
	 * TypeID에 대한 타일 슬라이스 매핑 설정.
	 * @param TypeID    복셀 타입 (0~255, 256 이상은 % 256)
	 * @param TopSlice  +Z 면 슬라이스 인덱스 (255 = 미매핑 → 팔레트 폴백)
	 * @param SideSlice ±X/±Y 면 슬라이스 인덱스
	 * @param BottomSlice -Z 면 슬라이스 인덱스
	 */
	void SetTileMapping(uint16 TypeID, uint8 TopSlice, uint8 SideSlice, uint8 BottomSlice);

	/** CPU 매핑 테이블을 GPU 텍스처(TileIndexLUT)로 업로드 */
	void BuildLUTTexture();

	// ================================================================
	// 디버그/테스트 유틸
	// ================================================================

	/** 프로시저럴 디버그 타일 Texture2DArray 생성 — TypeID별 고유 색상 + 체크무늬 */
	UFUNCTION(BlueprintCallable, Category = "Tile|Debug")
	void CreateDebugTileArray(int32 NumSlices = 16);

	/** HktTerrainType에 맞는 디버그 LUT 매핑 자동 설정 + GPU 업로드 */
	UFUNCTION(BlueprintCallable, Category = "Tile|Debug")
	void CreateDebugLUT();

private:
	/** CPU 측 매핑 테이블: [TypeID][FaceVariant] = SliceIndex (255 = unmapped) */
	uint8 TileMappingTable[256][3];

	/** 매핑 테이블 초기화 여부 */
	bool bMappingInitialized = false;

	void EnsureMappingInitialized();
};
