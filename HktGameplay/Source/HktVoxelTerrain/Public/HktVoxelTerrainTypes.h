// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelTerrainTypes.generated.h"

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

/**
 * EHktTerrainType — 에디터 친화적 TypeID 표현.
 *
 * `HktTerrainType` 네임스페이스와 동일 값을 갖는 UENUM. BlockStyle 편집 UI 에서
 * 정수 ID 대신 의미 있는 이름으로 표시하기 위한 용도.
 *
 * 새 타입 추가 시 양쪽(namespace + enum) 둘 다 동기화 — 동일 정수값을 유지해야 한다.
 * 값 범위는 0~255 (UENUM uint8 한계). 현재 TypeCount=33 이므로 충분.
 */
UENUM(BlueprintType)
enum class EHktTerrainType : uint8
{
	Air            = 0  UMETA(DisplayName = "Air (Empty)"),
	Grass          = 1  UMETA(DisplayName = "Grass"),
	Dirt           = 2  UMETA(DisplayName = "Dirt"),
	Stone          = 3  UMETA(DisplayName = "Stone"),
	Sand           = 4  UMETA(DisplayName = "Sand"),
	Water          = 5  UMETA(DisplayName = "Water (Translucent)"),
	Snow           = 6  UMETA(DisplayName = "Snow"),
	Ice            = 7  UMETA(DisplayName = "Ice (Translucent)"),
	Gravel         = 8  UMETA(DisplayName = "Gravel"),
	Clay           = 9  UMETA(DisplayName = "Clay"),
	Bedrock        = 10 UMETA(DisplayName = "Bedrock"),
	Glass          = 11 UMETA(DisplayName = "Glass (Translucent)"),

	GrassFlower    = 12 UMETA(DisplayName = "Grass - Flower"),
	StoneMossy     = 13 UMETA(DisplayName = "Stone - Mossy"),
	CrystalGrass   = 14 UMETA(DisplayName = "Crystal Grass"),
	GrassEthereal  = 15 UMETA(DisplayName = "Grass - Ethereal"),
	MossGlow       = 16 UMETA(DisplayName = "Moss - Glow (Emissive)"),
	SoilDark       = 17 UMETA(DisplayName = "Soil - Dark"),
	SandBleached   = 18 UMETA(DisplayName = "Sand - Bleached"),
	StoneFractured = 19 UMETA(DisplayName = "Stone - Fractured"),

	BoneFragment   = 20 UMETA(DisplayName = "Bone Fragment"),
	CrystalShard   = 21 UMETA(DisplayName = "Crystal Shard (Emissive)"),
	Wood           = 22 UMETA(DisplayName = "Wood"),
	Leaves         = 23 UMETA(DisplayName = "Leaves"),
	LeavesSnow     = 24 UMETA(DisplayName = "Leaves - Snow"),
	Cactus         = 25 UMETA(DisplayName = "Cactus"),
	Mushroom       = 26 UMETA(DisplayName = "Mushroom"),
	MushroomGlow   = 27 UMETA(DisplayName = "Mushroom - Glow (Emissive)"),

	OreCoal        = 28 UMETA(DisplayName = "Ore - Coal"),
	OreIron        = 29 UMETA(DisplayName = "Ore - Iron"),
	OreGold        = 30 UMETA(DisplayName = "Ore - Gold"),
	OreCrystal     = 31 UMETA(DisplayName = "Ore - Crystal (Emissive)"),
	OreVoidstone   = 32 UMETA(DisplayName = "Ore - Voidstone (Emissive)"),
};

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
