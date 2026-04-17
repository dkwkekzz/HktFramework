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

	// 확장 표면 타입 (이상 바이옴 + 데코)
	constexpr uint16 GrassFlower     = 12;
	constexpr uint16 StoneMossy      = 13;
	constexpr uint16 CrystalGrass    = 14;  // CrystalForest 바이옴
	constexpr uint16 GrassEthereal   = 15;  // FloatingMeadow, LivingForest
	constexpr uint16 MossGlow        = 16;  // GlowMushroom — FLAG_EMISSIVE
	constexpr uint16 SoilDark        = 17;  // GlowMushroom
	constexpr uint16 SandBleached    = 18;  // BoneDesert
	constexpr uint16 StoneFractured  = 19;  // VoidRift

	// 데코 타입
	constexpr uint16 BoneFragment    = 20;
	constexpr uint16 CrystalShard    = 21;  // FLAG_TRANSLUCENT | FLAG_EMISSIVE
	constexpr uint16 Wood            = 22;
	constexpr uint16 Leaves          = 23;
	constexpr uint16 LeavesSnow      = 24;
	constexpr uint16 Cactus          = 25;
	constexpr uint16 Mushroom        = 26;
	constexpr uint16 MushroomGlow    = 27;  // FLAG_EMISSIVE

	// 광석 타입
	constexpr uint16 OreCoal         = 28;
	constexpr uint16 OreIron         = 29;
	constexpr uint16 OreGold         = 30;
	constexpr uint16 OreCrystal      = 31;  // FLAG_EMISSIVE
	constexpr uint16 OreVoidstone    = 32;  // FLAG_EMISSIVE

	constexpr uint16 TypeCount       = 33;
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
