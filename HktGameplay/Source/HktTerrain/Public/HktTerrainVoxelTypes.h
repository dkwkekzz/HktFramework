// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTerrainVoxelTypes.generated.h"

/**
 * EHktTerrainType — 테레인 복셀 TypeID 의 단일 출처 (HktTerrain 모듈 소유).
 *
 * `FHktTerrainVoxel::TypeID` (uint16) 와 동일 정수값을 갖는 UENUM. BlockStyle 편집 UI,
 * VoxelSpawnRule 키 등 디자이너 노출 표면에서 정수 ID 대신 의미 있는 이름으로 표시.
 * 런타임 비교/저장은 `static_cast<uint16>(EHktTerrainType::Xxx)` 로 캐스트.
 *
 * 값 범위는 0~255 (UENUM uint8 한계). 현재 33 종 (Air..OreVoidstone) 이므로 충분.
 * 신규 타입 추가 시 `FHktTerrainVoxel` 사용처들과 정수값을 맞춘다.
 *
 * 이전 별도 존재했던 `HktTerrainType` / `HktTerrainPalette` 네임스페이스 (uint16/uint8
 * constexpr) 는 실사용처가 없어 제거 — enum 단일화. 팔레트 row 가 다시 필요해지면 별도
 * UENUM (EHktTerrainPalette) 으로 도입.
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
