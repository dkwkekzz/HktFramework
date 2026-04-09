// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktTerrainVoxel
 *
 * 지형 생성기의 출력 복셀 타입. HktCore 내부 전용.
 * 레이아웃이 HktVoxelCore의 FHktVoxel과 동일하여 직접 복사 가능.
 *
 * 이렇게 분리하는 이유:
 *   HktCore는 HktVoxelCore에 의존하면 안 됨 (순수 C++ VM)
 *   하지만 동일 메모리 레이아웃이므로 HktVoxelTerrain에서 안전하게 캐스팅 가능
 */
struct HKTCORE_API FHktTerrainVoxel
{
	uint16 TypeID = 0;        // 0 = 빈 공간
	uint8  PaletteIndex = 0;  // 팔레트 내 색상 인덱스
	uint8  Flags = 0;         // 비트플래그

	static constexpr uint8 FLAG_TRANSLUCENT  = 0x01;
	static constexpr uint8 FLAG_EMISSIVE     = 0x02;
	static constexpr uint8 FLAG_DESTRUCTIBLE = 0x04;

	bool IsEmpty() const { return TypeID == 0; }
};

// FHktVoxel과 동일 레이아웃 검증
static_assert(sizeof(FHktTerrainVoxel) == 4, "FHktTerrainVoxel must be 4 bytes to match FHktVoxel");
