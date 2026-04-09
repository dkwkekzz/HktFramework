// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktTerrainBiome.h"
#include "Terrain/HktTerrainNoise.h"

using Fixed = FHktFixed32;

// TypeID는 HktVoxelTerrainTypes.h와 동일 값 (양쪽 모듈에서 공유)
namespace TerrainTypeID
{
	constexpr uint16 Air     = 0;
	constexpr uint16 Grass   = 1;
	constexpr uint16 Dirt    = 2;
	constexpr uint16 Stone   = 3;
	constexpr uint16 Sand    = 4;
	constexpr uint16 Water   = 5;
	constexpr uint16 Snow    = 6;
	constexpr uint16 Ice     = 7;
	constexpr uint16 Gravel  = 8;
	constexpr uint16 Clay    = 9;
	constexpr uint16 Bedrock = 10;
}

FHktTerrainBiomeMap::FHktTerrainBiomeMap(const FHktTerrainNoise* TemperatureNoise, const FHktTerrainNoise* HumidityNoise)
	: TempNoise(TemperatureNoise)
	, HumNoise(HumidityNoise)
{
	InitDefaultRules();
}

void FHktTerrainBiomeMap::InitDefaultRules()
{
	using namespace TerrainTypeID;

	// Grassland: 초원
	MaterialRules[static_cast<int32>(EHktBiomeType::Grassland)] = {
		Grass, Dirt, Stone, Bedrock, Water, 32
	};

	// Desert: 사막
	MaterialRules[static_cast<int32>(EHktBiomeType::Desert)] = {
		Sand, Sand, Stone, Bedrock, Air, 33
	};

	// Tundra: 설원
	MaterialRules[static_cast<int32>(EHktBiomeType::Tundra)] = {
		Snow, Dirt, Stone, Bedrock, Ice, 34
	};

	// Forest: 숲
	MaterialRules[static_cast<int32>(EHktBiomeType::Forest)] = {
		Grass, Dirt, Stone, Bedrock, Water, 36
	};

	// Swamp: 늪
	MaterialRules[static_cast<int32>(EHktBiomeType::Swamp)] = {
		Clay, Clay, Stone, Bedrock, Water, 37
	};

	// Mountain: 산악
	MaterialRules[static_cast<int32>(EHktBiomeType::Mountain)] = {
		Gravel, Stone, Stone, Bedrock, Water, 35
	};
}

EHktBiomeType FHktTerrainBiomeMap::GetBiome(Fixed WorldX, Fixed WorldY) const
{
	if (!TempNoise || !HumNoise)
	{
		return EHktBiomeType::Grassland;
	}

	// 온도/습도: FBM 2D [-1, 1] → [0, 1], 클램프 적용
	Fixed Temp = (TempNoise->FBM2D(WorldX * NoiseScale, WorldY * NoiseScale, 4) + Fixed::One()) * Fixed::Half();
	Fixed Hum  = (HumNoise->FBM2D(WorldX * NoiseScale, WorldY * NoiseScale, 4) + Fixed::One()) * Fixed::Half();
	Temp = Fixed::Clamp(Temp, Fixed::Zero(), Fixed::One());
	Hum  = Fixed::Clamp(Hum,  Fixed::Zero(), Fixed::One());

	// 3×3 매트릭스 룩업
	// Temperature: Low [0, 0.33), Mid [0.33, 0.66), High [0.66, 1.0]
	// Humidity:    Low [0, 0.33), Mid [0.33, 0.66), High [0.66, 1.0]
	// 0.33 ≈ 21627 raw, 0.66 ≈ 43254 raw
	const Fixed OneThird = Fixed::FromRaw(21627);
	const Fixed TwoThirds = Fixed::FromRaw(43254);

	int32 TempBand = (Temp < OneThird) ? 0 : (Temp < TwoThirds) ? 1 : 2;
	int32 HumBand  = (Hum  < OneThird) ? 0 : (Hum  < TwoThirds) ? 1 : 2;

	// 바이옴 결정 매트릭스
	static const EHktBiomeType BiomeMatrix[3][3] = {
		//                  Low Humidity            Mid Humidity            High Humidity
		/* Low Temp  */  { EHktBiomeType::Tundra,  EHktBiomeType::Tundra,  EHktBiomeType::Forest   },
		/* Mid Temp  */  { EHktBiomeType::Desert,  EHktBiomeType::Grassland, EHktBiomeType::Forest  },
		/* High Temp */  { EHktBiomeType::Desert,  EHktBiomeType::Grassland, EHktBiomeType::Swamp   },
	};

	return BiomeMatrix[TempBand][HumBand];
}

EHktBiomeType FHktTerrainBiomeMap::GetBiomeWithHeight(Fixed WorldX, Fixed WorldY, Fixed Height) const
{
	if (Height >= MountainThreshold)
	{
		return EHktBiomeType::Mountain;
	}
	return GetBiome(WorldX, WorldY);
}

const FHktBiomeMaterialRule& FHktTerrainBiomeMap::GetMaterialRule(EHktBiomeType Biome) const
{
	int32 Index = static_cast<int32>(Biome);
	if (Index < 0 || Index >= static_cast<int32>(EHktBiomeType::Count))
	{
		Index = 0;
	}
	return MaterialRules[Index];
}

void FHktTerrainBiomeMap::SetMaterialRule(EHktBiomeType Biome, const FHktBiomeMaterialRule& Rule)
{
	int32 Index = static_cast<int32>(Biome);
	if (Index >= 0 && Index < static_cast<int32>(EHktBiomeType::Count))
	{
		MaterialRules[Index] = Rule;
	}
}
