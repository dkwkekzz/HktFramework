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

void FHktTerrainGenerator::SamplePreviewRegion(int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
	FHktTerrainPreviewRegion& Out) const
{
	constexpr int32 S = FHktTerrainGeneratorConfig::ChunkSize;

	Out.MinWorldX = MinWorldX;
	Out.MinWorldY = MinWorldY;
	Out.Width = Width;
	Out.Height = Height;
	Out.WaterLevel = Config.WaterLevel.ToInt();
	Out.HeightMinZ = Config.HeightMinZ;
	Out.HeightMaxZ = Config.HeightMaxZ;
	Out.Samples.SetNum(Width * Height);

	if (Width <= 0 || Height <= 0)
	{
		return;
	}

	// ─── 고급 파이프라인 — 청크 단위 Layer 0~2.5 실행 ───
	if (Config.bAdvancedTerrain)
	{
		const uint64 WorldSeed = static_cast<uint64>(Config.Seed);
		const uint32 Epoch = Config.Epoch;

		FHktAdvTerrainHeightParams HeightParams;
		HeightParams.MaxHeight  = Config.HeightScale.ToInt();
		HeightParams.BaseHeight = Config.HeightOffset.ToInt();
		HeightParams.SeaLevel   = Config.WaterLevel.ToInt();

		auto FloorDiv = [](int32 A, int32 B) -> int32
		{
			return (A >= 0) ? (A / B) : -(((-A) + B - 1) / B);
		};

		const int32 ChunkMinX = FloorDiv(MinWorldX, S);
		const int32 ChunkMaxX = FloorDiv(MinWorldX + Width - 1, S);
		const int32 ChunkMinY = FloorDiv(MinWorldY, S);
		const int32 ChunkMaxY = FloorDiv(MinWorldY + Height - 1, S);

		for (int32 ChunkY = ChunkMinY; ChunkY <= ChunkMaxY; ++ChunkY)
		{
			for (int32 ChunkX = ChunkMinX; ChunkX <= ChunkMaxX; ++ChunkX)
			{
				FHktChunkSeed ChunkSeed = FHktAdvTerrainSeed::Derive(WorldSeed, ChunkX, ChunkY, Epoch);

				// Climate / Tectonic / Biome jitter 노이즈는 WorldSeed로 시드한다 —
				// 청크 경계를 가로지르는 연속성 보장.
				FHktClimateField Climate;
				FHktAdvTerrainClimate::Generate(ChunkX, ChunkY, WorldSeed, Climate);

				FHktTectonicMask Tectonic;
				FHktChunkSeed TecSeed = FHktAdvTerrainSeed::Derive(WorldSeed, ChunkX, ChunkY, 0);
				FHktAdvTerrainTectonic::Generate(ChunkX, ChunkY, WorldSeed, TecSeed, Tectonic);

				// Layer 1 후처리: Tectonic 마스크 적용 (GenerateChunk와 동일)
				for (int32 i = 0; i < S * S; ++i)
				{
					Climate.Elevation[i] = FMath::Clamp(
						Climate.Elevation[i] * Tectonic.ElevationMultiplier[i] + Tectonic.ElevationOffset[i],
						0.f, 1.f);
				}

				FHktAdvBiomeMap Biomes;
				FHktAdvTerrainBiome::Classify(ChunkX, ChunkY, WorldSeed, Climate, Biomes);
				FHktAdvTerrainExoticBiome::Apply(Biomes, Climate, ChunkSeed, ChunkX, ChunkY);

				// 청크 영역을 출력 그리드에 복사
				for (int32 LY = 0; LY < S; ++LY)
				{
					const int32 WorldY = ChunkY * S + LY;
					if (WorldY < MinWorldY || WorldY >= MinWorldY + Height) continue;
					const int32 OutY = WorldY - MinWorldY;

					for (int32 LX = 0; LX < S; ++LX)
					{
						const int32 WorldX = ChunkX * S + LX;
						if (WorldX < MinWorldX || WorldX >= MinWorldX + Width) continue;
						const int32 OutX = WorldX - MinWorldX;

						FHktTerrainPreviewSample& Sample = Out.Samples[OutX + OutY * Width];
						const float Elev = Climate.GetElevation(LX, LY);
						const EHktAdvBiome Biome = Biomes.Get(LX, LY);
						const int32 SurfaceH = FHktAdvTerrainFill::ComputeHeight(Elev, Biome, HeightParams);

						Sample.Elevation = Elev;
						Sample.Moisture = Climate.GetMoisture(LX, LY);
						Sample.Temperature = Climate.GetTemperature(LX, LY);
						Sample.BiomeId = static_cast<uint8>(Biome);
						Sample.TectonicPrimary = static_cast<uint8>(Tectonic.PrimaryType);
						Sample.SurfaceHeightVoxels = SurfaceH;
						Sample.bIsAdvanced = true;
						Sample.bIsOcean = (Biome == EHktAdvBiome::Ocean) || (SurfaceH <= HeightParams.SeaLevel);
					}
				}
			}
		}
		return;
	}

	// ─── 레거시 파이프라인 — 칼럼당 직접 쿼리 ───
	const int32 BaseHeight = Config.HeightOffset.ToInt();
	const int32 MaxHeight  = Config.HeightScale.ToInt();
	const int32 SeaLevel   = Config.WaterLevel.ToInt();
	const float InvMax = (MaxHeight > 0) ? 1.f / static_cast<float>(MaxHeight) : 0.f;

	for (int32 Y = 0; Y < Height; ++Y)
	{
		for (int32 X = 0; X < Width; ++X)
		{
			const int32 WX = MinWorldX + X;
			const int32 WY = MinWorldY + Y;
			const Fixed FX = Fixed::FromInt(WX);
			const Fixed FY = Fixed::FromInt(WY);
			const Fixed H = GetSurfaceHeight(FX, FY);
			const int32 HVoxels = H.ToInt();
			const EHktBiomeType Biome = BiomeMap.GetBiomeWithHeight(FX, FY, H);

			FHktTerrainPreviewSample& Sample = Out.Samples[X + Y * Width];
			Sample.SurfaceHeightVoxels = HVoxels;
			Sample.BiomeId = static_cast<uint8>(200 + static_cast<uint8>(Biome));  // 200+ = 레거시
			Sample.Elevation = FMath::Clamp(static_cast<float>(HVoxels - BaseHeight) * InvMax, 0.f, 1.f);
			Sample.bIsAdvanced = false;
			Sample.bIsOcean = HVoxels <= SeaLevel;
		}
	}
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

		// Layer 1: 기후 노이즈 — WorldSeed 기반 (청크 경계 연속)
		FHktClimateField Climate;
		FHktAdvTerrainClimate::Generate(ChunkX, ChunkY, WorldSeed, Climate);

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

		// Layer 2: 바이옴 분류 — WorldSeed 기반 jitter (청크 경계 연속)
		FHktAdvBiomeMap Biomes;
		FHktAdvTerrainBiome::Classify(ChunkX, ChunkY, WorldSeed, Climate, Biomes);

		// Layer 2.5: 이상 바이옴 오버레이
		FHktAdvTerrainExoticBiome::Apply(Biomes, Climate, ChunkSeed, ChunkX, ChunkY);

		// 수직 높이 파라미터 — Config에서 주입 (레거시 경로와 동일 파라미터 공유)
		FHktAdvTerrainHeightParams HeightParams;
		HeightParams.MaxHeight  = Config.HeightScale.ToInt();
		HeightParams.BaseHeight = Config.HeightOffset.ToInt();
		HeightParams.SeaLevel   = Config.WaterLevel.ToInt();

		// Layer 3: 하이트맵 + 컬럼 채우기
		FHktAdvTerrainFill::Fill(ChunkX, ChunkY, ChunkZ, Climate, Biomes, Tectonic, HeightParams, OutVoxels);

		// Layer 4: 랜드마크 + 강 — 강 노이즈는 WorldSeed로 청크 경계 연속
		FHktAdvTerrainLandmark::Apply(ChunkX, ChunkY, ChunkZ, WorldSeed, Climate, Biomes, Tectonic, ChunkSeed, HeightParams, OutVoxels);

		// Layer 5: 데코 (옵션 플래그로 단계별 분기)
		if (Config.bAdvEnableSubsurfaceOre)
		{
			FHktAdvTerrainDecoration::ApplySubsurface(ChunkX, ChunkY, ChunkZ, ChunkSeed, OutVoxels);
		}
		if (Config.bAdvEnableSurfaceScatter)
		{
			FHktAdvTerrainDecoration::ApplySurfaceScatter(ChunkX, ChunkY, ChunkZ, Biomes, ChunkSeed, OutVoxels);
		}

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

