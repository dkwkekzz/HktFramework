// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktTerrainGenerator.h"
#include "Terrain/HktAdvTerrainTypes.h"
#include "Terrain/HktAdvTerrainLayers.h"
#include "Terrain/HktAdvTerrainFill.h"

using Fixed = FHktFixed32;

namespace
{
	constexpr uint16 TYPE_AIR   = 0;
	constexpr uint16 TYPE_WATER = 5;
	constexpr uint16 TYPE_ICE   = 7;
}

FHktTerrainGenerator::FHktTerrainGenerator(const FHktTerrainGeneratorConfig& InConfig)
	: Config(InConfig)
	, HeightNoise(InConfig.Seed)
	, MountainNoise(InConfig.Seed + 1)
	, CaveNoise(InConfig.Seed + 2)
	, TempNoise(InConfig.Seed + 3)
	, HumNoise(InConfig.Seed + 4)
	, BiomeMap(&TempNoise, &HumNoise)
{
	BiomeMap.SetNoiseScale(Config.BiomeNoiseScale);
	BiomeMap.SetMountainThreshold(Config.MountainBiomeThreshold);
}

void FHktTerrainGenerator::Reconfigure(const FHktTerrainGeneratorConfig& NewConfig)
{
	Config = NewConfig;
	HeightNoise.SetSeed(Config.Seed);
	MountainNoise.SetSeed(Config.Seed + 1);
	CaveNoise.SetSeed(Config.Seed + 2);
	TempNoise.SetSeed(Config.Seed + 3);
	HumNoise.SetSeed(Config.Seed + 4);
	BiomeMap.SetNoiseScale(Config.BiomeNoiseScale);
	BiomeMap.SetMountainThreshold(Config.MountainBiomeThreshold);
}

Fixed FHktTerrainGenerator::GetSurfaceHeight(Fixed WorldX, Fixed WorldY) const
{
	Fixed FBMHeight = HeightNoise.FBM2D(
		WorldX * Config.TerrainFreq,
		WorldY * Config.TerrainFreq,
		Config.TerrainOctaves,
		Config.Lacunarity,
		Config.Persistence);

	Fixed RidgeHeight = MountainNoise.RidgedMulti2D(
		WorldX * Config.MountainFreq,
		WorldY * Config.MountainFreq,
		Config.TerrainOctaves,
		Config.Lacunarity,
		Config.Persistence);

	Fixed Blend = Config.MountainBlend;
	Fixed Mixed = (Fixed::One() - Blend) * FBMHeight + Blend * RidgeHeight;

	return Mixed * Config.HeightScale + Config.HeightOffset;
}

bool FHktTerrainGenerator::IsCave(Fixed WorldX, Fixed WorldY, Fixed WorldZ, Fixed SurfaceHeight) const
{
	if (!Config.bEnableCaves)
	{
		return false;
	}

	// 표면 근처 (3블록 이내)에서는 동굴 생성 안 함
	const Fixed Three = Fixed::FromInt(3);
	if (WorldZ >= SurfaceHeight - Three)
	{
		return false;
	}

	Fixed CaveValue = CaveNoise.FBM3D(
		WorldX * Config.CaveFreq,
		WorldY * Config.CaveFreq,
		WorldZ * Config.CaveFreq,
		3);

	// 절대값이 작을수록 동굴 (스파게티 동굴)
	Fixed AbsCave = CaveValue.Abs();
	return AbsCave < (Fixed::One() - Config.CaveThreshold);
}

FHktTerrainVoxel FHktTerrainGenerator::DetermineVoxel(
	Fixed WorldX, Fixed WorldY, Fixed WorldZ,
	Fixed SurfaceHeight, EHktBiomeType Biome,
	const FHktBiomeMaterialRule& Rule) const
{
	FHktTerrainVoxel Voxel;

	Fixed Depth = SurfaceHeight - WorldZ;

	if (WorldZ > SurfaceHeight)
	{
		// 표면 위: 공기 또는 수면
		if (WorldZ <= Config.WaterLevel && Rule.WaterType != TYPE_AIR)
		{
			Voxel.TypeID = Rule.WaterType;
			if (Rule.WaterType == TYPE_WATER || Rule.WaterType == TYPE_ICE)
			{
				Voxel.Flags = FHktTerrainVoxel::FLAG_TRANSLUCENT;
			}
		}
		return Voxel;
	}

	// 표면 이하: 깊이 기반 재질 결정
	const Fixed FixedOne = Fixed::One();
	const Fixed FixedFour = Fixed::FromInt(4);
	const Fixed FixedTwo = Fixed::Two();

	if (Depth < FixedOne)
	{
		Voxel.TypeID = Rule.SurfaceType;
		Voxel.PaletteIndex = 0;
	}
	else if (Depth < FixedFour)
	{
		Voxel.TypeID = Rule.SubsurfaceType;
		Voxel.PaletteIndex = 1;
	}
	else if (WorldZ <= FixedTwo)
	{
		Voxel.TypeID = Rule.BedrockType;
		Voxel.PaletteIndex = 3;
	}
	else
	{
		Voxel.TypeID = Rule.DeepType;
		Voxel.PaletteIndex = 2;
	}

	return Voxel;
}

void FHktTerrainGenerator::GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ, FHktTerrainVoxel* OutVoxels) const
{
	// ─── 고급 파이프라인 ───
	if (Config.bAdvancedTerrain)
	{
		const uint64 WorldSeed = static_cast<uint64>(Config.Seed);
		const uint32 Epoch = Config.Epoch;

		// Layer 0: 시드 파생 (X,Y = 수평축)
		FHktChunkSeed ChunkSeed = FHktAdvTerrainSeed::Derive(WorldSeed, ChunkX, ChunkY, Epoch);

		// Layer 1: 기후 노이즈
		FHktClimateField Climate;
		FHktAdvTerrainClimate::Generate(ChunkX, ChunkY, ChunkSeed, Climate);

		// Layer 1.5: 대륙 템플릿 (epoch 무시 — 대륙 구조는 영구 불변)
		FHktTectonicMask Tectonic;
		FHktChunkSeed TecSeed = FHktAdvTerrainSeed::Derive(WorldSeed, ChunkX, ChunkY, 0);
		FHktAdvTerrainTectonic::Generate(ChunkX, ChunkY, WorldSeed, TecSeed, Tectonic);

		// Layer 1 후처리: 대륙 마스크를 Elevation에 적용
		constexpr int32 S2 = FHktClimateField::Size;
		for (int32 i = 0; i < S2 * S2; ++i)
		{
			Climate.Elevation[i] = FMath::Clamp(
				Climate.Elevation[i] * Tectonic.ElevationMultiplier[i] + Tectonic.ElevationOffset[i],
				0.f, 1.f);
		}

		// Layer 2: 바이옴 분류
		FHktAdvBiomeMap Biomes;
		FHktAdvTerrainBiome::Classify(Climate, ChunkSeed, Biomes);

		// Layer 2.5: 이상 바이옴 오버레이
		FHktAdvTerrainExoticBiome::Apply(Biomes, Climate, ChunkSeed, ChunkX, ChunkY);

		// Layer 3: 하이트맵 + 컬럼 채우기
		FHktAdvTerrainFill::Fill(ChunkX, ChunkY, ChunkZ, Climate, Biomes, Tectonic, OutVoxels);

		// Layer 4: 랜드마크 + 강
		FHktAdvTerrainLandmark::Apply(ChunkX, ChunkY, ChunkZ, Climate, Biomes, Tectonic, ChunkSeed, OutVoxels);

		// Layer 5: 데코 (광석 + 표면 산포)
		FHktAdvTerrainDecoration::Apply(ChunkX, ChunkY, ChunkZ, Climate, Biomes, ChunkSeed, OutVoxels);

		return;
	}

	// ─── 레거시 파이프라인 ───
	constexpr int32 S = FHktTerrainGeneratorConfig::ChunkSize;

	const Fixed BaseX = Fixed::FromInt(ChunkX * S);
	const Fixed BaseY = Fixed::FromInt(ChunkY * S);
	const Fixed BaseZ = Fixed::FromInt(ChunkZ * S);

	// XY 컬럼별 높이/바이옴 캐시 (Z 루프에서 재사용 — 32배 절약)
	Fixed HeightCache[S][S];
	EHktBiomeType BiomeCache[S][S];
	const FHktBiomeMaterialRule* RuleCache[S][S];

	for (int32 X = 0; X < S; ++X)
	{
		const Fixed WorldX = BaseX + Fixed::FromInt(X);
		for (int32 Y = 0; Y < S; ++Y)
		{
			const Fixed WorldY = BaseY + Fixed::FromInt(Y);
			Fixed H = GetSurfaceHeight(WorldX, WorldY);
			HeightCache[X][Y] = H;
			BiomeCache[X][Y] = BiomeMap.GetBiomeWithHeight(WorldX, WorldY, H);
			RuleCache[X][Y] = &BiomeMap.GetMaterialRule(BiomeCache[X][Y]);
		}
	}

	// 복셀 생성: 인덱스 = X + Y*S + Z*S*S (WorldToLocalIndex와 동일한 Z-major 레이아웃)
	for (int32 X = 0; X < S; ++X)
	{
		const Fixed WorldX = BaseX + Fixed::FromInt(X);

		for (int32 Y = 0; Y < S; ++Y)
		{
			const Fixed WorldY = BaseY + Fixed::FromInt(Y);
			const Fixed SurfaceH = HeightCache[X][Y];
			const FHktBiomeMaterialRule& Rule = *RuleCache[X][Y];
			const EHktBiomeType Biome = BiomeCache[X][Y];

			for (int32 Z = 0; Z < S; ++Z)
			{
				const Fixed WorldZ = BaseZ + Fixed::FromInt(Z);
				// WorldToLocalIndex와 동일: X + Y*S + Z*S*S (Z-major 레이아웃)
				const int32 Index = X + Y * S + Z * S * S;

				FHktTerrainVoxel Voxel = DetermineVoxel(WorldX, WorldY, WorldZ, SurfaceH, Biome, Rule);

				// 동굴 카빙
				if (Voxel.TypeID != TYPE_AIR && IsCave(WorldX, WorldY, WorldZ, SurfaceH))
				{
					if (WorldZ <= Config.WaterLevel && Rule.WaterType != TYPE_AIR)
					{
						Voxel.TypeID = Rule.WaterType;
						Voxel.PaletteIndex = 0;
						Voxel.Flags = FHktTerrainVoxel::FLAG_TRANSLUCENT;
					}
					else
					{
						Voxel = FHktTerrainVoxel();
					}
				}

				OutVoxels[Index] = Voxel;
			}
		}
	}
}
