// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// Layer 0 출력: 청크 시드
// ============================================================================

struct FHktChunkSeed
{
	uint64 ClimateSeed;
	uint64 TectonicSeed;
	uint64 BiomeSeed;
	uint64 ExoticSeed;
	uint64 WFCSeed;
	uint64 LandmarkSeed;
	uint64 FeatureSeed;
	uint64 DecoSeed;
};

// ============================================================================
// Layer 1 출력: 기후 필드
// ============================================================================

struct FHktClimateField
{
	static constexpr int32 Size = 32;
	float Elevation[Size * Size];
	float Moisture[Size * Size];
	float Temperature[Size * Size];
	float Exoticness[Size * Size];

	float GetElevation(int32 X, int32 Z) const { return Elevation[X + Z * Size]; }
	float GetMoisture(int32 X, int32 Z) const { return Moisture[X + Z * Size]; }
	float GetTemperature(int32 X, int32 Z) const { return Temperature[X + Z * Size]; }
	float GetExoticness(int32 X, int32 Z) const { return Exoticness[X + Z * Size]; }

	void SetElevation(int32 X, int32 Z, float V) { Elevation[X + Z * Size] = V; }
	void SetMoisture(int32 X, int32 Z, float V) { Moisture[X + Z * Size] = V; }
	void SetTemperature(int32 X, int32 Z, float V) { Temperature[X + Z * Size] = V; }
	void SetExoticness(int32 X, int32 Z, float V) { Exoticness[X + Z * Size] = V; }
};

// ============================================================================
// Layer 1.5: 대륙 타입
// ============================================================================

enum class EHktContinentType : uint8
{
	Pangea = 0,
	Archipelago,
	Rift,
	Spire,
	Crater,
	Plateau,
	Abyss,
	MAX
};

struct FHktTectonicMask
{
	EHktContinentType PrimaryType = EHktContinentType::Pangea;
	EHktContinentType SecondaryType = EHktContinentType::Pangea;
	float BlendFactor = 0.f;
	float ElevationMultiplier[32 * 32];
	float ElevationOffset[32 * 32];
};

// ============================================================================
// Layer 2/2.5: 바이옴
// ============================================================================

enum class EHktAdvBiome : uint8
{
	// 현실 바이옴
	Ocean = 0,
	Beach,
	Grassland,
	Forest,
	Desert,
	Savanna,
	Tundra,
	Taiga,
	RockyMountain,
	SnowPeak,
	Swamp,

	// 이상 바이옴 (100+)
	CrystalForest = 100,
	FloatingMeadow,
	GlowMushroom,
	BoneDesert,
	VoidRift,
	LivingForest,

	MAX = 200
};

struct FHktAdvBiomeMap
{
	static constexpr int32 Size = 32;
	EHktAdvBiome Cells[Size * Size];

	EHktAdvBiome Get(int32 X, int32 Z) const { return Cells[X + Z * Size]; }
	void Set(int32 X, int32 Z, EHktAdvBiome B) { Cells[X + Z * Size] = B; }
	bool IsExotic(int32 X, int32 Z) const { return static_cast<uint8>(Get(X, Z)) >= 100; }
};

// ============================================================================
// 바이옴별 재질 규칙 (확장)
// ============================================================================

struct FHktAdvBiomeMaterialRule
{
	uint16 SurfaceType;
	uint16 SubsurfaceType;
	uint16 DeepType;
	uint16 BedrockType;
	uint16 WaterType;
	uint8  PaletteRow;
};

// ============================================================================
// 확장 테레인 TypeID (HktVoxelTerrainTypes.h 와 동일 값 공유)
// ============================================================================

namespace HktAdvTerrainType
{
	// 기존 타입 (0-11)
	constexpr uint16 Air          = 0;
	constexpr uint16 Grass        = 1;
	constexpr uint16 Dirt         = 2;
	constexpr uint16 Stone        = 3;
	constexpr uint16 Sand         = 4;
	constexpr uint16 Water        = 5;
	constexpr uint16 Snow         = 6;
	constexpr uint16 Ice          = 7;
	constexpr uint16 Gravel       = 8;
	constexpr uint16 Clay         = 9;
	constexpr uint16 Bedrock      = 10;
	constexpr uint16 Glass        = 11;

	// 확장 표면 타입 (12-19)
	constexpr uint16 GrassFlower     = 12;
	constexpr uint16 StoneMossy      = 13;
	constexpr uint16 CrystalGrass    = 14;
	constexpr uint16 GrassEthereal   = 15;
	constexpr uint16 MossGlow        = 16;
	constexpr uint16 SoilDark        = 17;
	constexpr uint16 SandBleached    = 18;
	constexpr uint16 StoneFractured  = 19;

	// 데코 타입 (20-27)
	constexpr uint16 BoneFragment    = 20;
	constexpr uint16 CrystalShard    = 21;
	constexpr uint16 Wood            = 22;
	constexpr uint16 Leaves          = 23;
	constexpr uint16 LeavesSnow      = 24;
	constexpr uint16 Cactus          = 25;
	constexpr uint16 Mushroom        = 26;
	constexpr uint16 MushroomGlow    = 27;

	// 광석 타입 (28-32)
	constexpr uint16 OreCoal         = 28;
	constexpr uint16 OreIron         = 29;
	constexpr uint16 OreGold         = 30;
	constexpr uint16 OreCrystal      = 31;
	constexpr uint16 OreVoidstone    = 32;

	constexpr uint16 TypeCount       = 33;
}

// ============================================================================
// 확장 팔레트 행
// ============================================================================

namespace HktAdvTerrainPalette
{
	constexpr uint8 Grassland     = 32;
	constexpr uint8 Desert        = 33;
	constexpr uint8 Tundra        = 34;
	constexpr uint8 Volcanic      = 35;
	constexpr uint8 Forest        = 36;
	constexpr uint8 Swamp         = 37;
	constexpr uint8 Ocean         = 38;
	constexpr uint8 Beach         = 39;
	constexpr uint8 Savanna       = 40;
	constexpr uint8 Taiga         = 41;
	constexpr uint8 RockyMountain = 42;
	constexpr uint8 SnowPeak      = 43;
	constexpr uint8 CrystalForest = 44;
	constexpr uint8 GlowMushroom  = 45;
	constexpr uint8 BoneDesert    = 46;
	constexpr uint8 VoidRift      = 47;
	constexpr uint8 LivingForest  = 48;
}

// ============================================================================
// 랜드마크 정의
// ============================================================================

enum class EHktLandmarkType : uint8
{
	Sinkhole = 0,
	Mesa,
	Monolith,
	SmallCrater,
	StoneArch,
	GiantTree,
	BoneSpire,
	CrystalColumn,
	VoidFissure,
	LonePeak,   // 비대칭 돔 봉우리 — 스카이라인 랜드마크
	Lake,       // 파라볼라 carve + Water fill
	MAX
};
