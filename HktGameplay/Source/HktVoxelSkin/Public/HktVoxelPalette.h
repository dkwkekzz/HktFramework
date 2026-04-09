// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelPalette.generated.h"

class UTexture2D;

/**
 * UHktVoxelPaletteManager
 *
 * 팔레트 텍스처 관리. 모든 복셀은 하나의 머티리얼로 렌더링되며,
 * 색상은 팔레트 텍스처 룩업으로 결정한다.
 *
 * 텍스처 구성:
 *   PaletteTexture (256 x 8, RGBA8)
 *   - 각 행 = 하나의 8색 팔레트
 *   - 256개 팔레트 = 256가지 스킨/블록 색상 세트
 *   - 스킨 교체 = 팔레트 행 번호만 변경 → GPU 부담 제로
 *
 *   VoxelTypeTexture (1D, 최대 65536 엔트리)
 *   - TypeID → 기본 팔레트 행 매핑
 *   - TypeID → 재질 속성 (금속도, 거칠기, 발광 강도)
 */
UCLASS()
class HKTVOXELSKIN_API UHktVoxelPaletteManager : public UObject
{
	GENERATED_BODY()

public:
	/** 팔레트 텍스처 반환 (셰이더 바인딩용) */
	UFUNCTION(BlueprintCallable, Category = "HktVoxel|Palette")
	UTexture2D* GetPaletteTexture() const { return PaletteTexture; }

	/** 팔레트 텍스처 설정 */
	void SetPaletteTexture(UTexture2D* InTexture) { PaletteTexture = InTexture; }

	/** 활성 팔레트 행 설정 (스킨 교체 시) */
	void SetActivePalette(int32 PaletteRow);
	int32 GetActivePalette() const { return ActivePaletteRow; }

	/** 팔레트 행의 특정 색상 반환 (CPU 디버그/UI용) */
	FLinearColor GetPaletteColor(int32 PaletteRow, int32 ColorIndex) const;

	/** 팔레트 텍스처를 프로시저럴 생성 (에디터/프로토타입용) */
	UFUNCTION(BlueprintCallable, Category = "HktVoxel|Palette")
	UTexture2D* CreateDefaultPaletteTexture();

	static constexpr int32 PALETTE_WIDTH = 8;      // 팔레트당 색상 수
	static constexpr int32 PALETTE_HEIGHT = 256;    // 팔레트 수

private:
	UPROPERTY()
	UTexture2D* PaletteTexture = nullptr;

	int32 ActivePaletteRow = 0;
};
