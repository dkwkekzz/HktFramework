// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * 테레인 복셀 TypeID 정의.
 * VM과 공유하는 지형 타입 식별자.
 */
namespace HktTerrainType
{
	constexpr uint16 Air     = 0;
	constexpr uint16 Grass   = 1;
	constexpr uint16 Dirt    = 2;
	constexpr uint16 Stone   = 3;
	constexpr uint16 Sand    = 4;
	constexpr uint16 Water   = 5;   // FLAG_TRANSLUCENT
	constexpr uint16 Snow    = 6;
	constexpr uint16 Ice     = 7;   // FLAG_TRANSLUCENT
	constexpr uint16 Gravel  = 8;
	constexpr uint16 Clay    = 9;
	constexpr uint16 Bedrock = 10;
	constexpr uint16 Glass   = 11;  // FLAG_TRANSLUCENT | FLAG_DESTRUCTIBLE, Shatter 효과
}

/** 테레인 팔레트 행 (PaletteTexture의 Row 32~63을 테레인용으로 예약) */
namespace HktTerrainPalette
{
	constexpr uint8 Grassland = 32;
	constexpr uint8 Desert    = 33;
	constexpr uint8 Tundra    = 34;
	constexpr uint8 Volcanic  = 35;
	constexpr uint8 Forest    = 36;
	constexpr uint8 Swamp     = 37;
}
