// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktAdvTerrainLayers.h"
#include "Terrain/HktTerrainNoiseFloat.h"
#include "Terrain/HktAdvTerrainTypes.h"

using namespace HktTerrainHash;
using namespace HktAdvTerrainType;

// ============================================================================
// Layer 0: 결정론적 시드 파생
// ============================================================================

FHktChunkSeed FHktAdvTerrainSeed::Derive(uint64 WorldSeed, int32 ChunkX, int32 ChunkZ, uint32 Epoch)
{
	const uint64 Base = SplitMix64(WorldSeed ^ Hash2D(ChunkX, ChunkZ) ^ static_cast<uint64>(Epoch));

	FHktChunkSeed S;
	S.ClimateSeed   = SplitMix64(Base + 0x1);
	S.TectonicSeed  = SplitMix64(Base + 0x2);
	S.BiomeSeed     = SplitMix64(Base + 0x3);
	S.ExoticSeed    = SplitMix64(Base + 0x4);
	S.WFCSeed       = SplitMix64(Base + 0x5);
	S.LandmarkSeed  = SplitMix64(Base + 0x6);
	S.FeatureSeed   = SplitMix64(Base + 0x7);
	S.DecoSeed      = SplitMix64(Base + 0x8);
	return S;
}

// ============================================================================
// Layer 1: 기후 노이즈
// ============================================================================

void FHktAdvTerrainClimate::Generate(
	int32 ChunkX, int32 ChunkZ,
	const FHktChunkSeed& Seed,
	FHktClimateField& OutClimate)
{
	FHktTerrainNoiseFloat ClimateNoise(Seed.ClimateSeed);
	FHktTerrainNoiseFloat ClimateNoise2(Seed.ClimateSeed ^ 0xA1);
	FHktTerrainNoiseFloat MoistureNoise(Seed.ClimateSeed ^ 0xB2);
	FHktTerrainNoiseFloat TempNoise(Seed.ClimateSeed ^ 0xC3);
	FHktTerrainNoiseFloat ExoticNoise(Seed.ExoticSeed);

	constexpr int32 S = FHktClimateField::Size;

	for (int32 LZ = 0; LZ < S; ++LZ)
	{
		for (int32 LX = 0; LX < S; ++LX)
		{
			const float WorldX = static_cast<float>(ChunkX * S + LX);
			const float WorldZ = static_cast<float>(ChunkZ * S + LZ);

			// --- Elevation ---
			float WX = WorldX, WZ = WorldZ;
			ClimateNoise.DomainWarp2D(WX, WZ, 20.f);

			const float Continental = ClimateNoise.FBm2D(WX / 512.f, WZ / 512.f, 4, 2.f, 0.5f);
			const float Mountain = ClimateNoise2.FBm2D(WX / 128.f, WZ / 128.f, 6, 2.f, 0.5f);

			float ElevRaw = FHktTerrainNoiseFloat::Remap(Continental, -1.f, 1.f, 0.f, 1.f) * 0.7f
			              + FHktTerrainNoiseFloat::Remap(Mountain, -1.f, 1.f, 0.f, 1.f) * 0.3f;
			OutClimate.SetElevation(LX, LZ, FMath::Clamp(ElevRaw, 0.f, 1.f));

			// --- Moisture ---
			float Moist = FHktTerrainNoiseFloat::Remap(
				MoistureNoise.FBm2D(WorldX / 256.f, WorldZ / 256.f, 3, 2.f, 0.5f),
				-1.f, 1.f, 0.f, 1.f);
			if (ElevRaw > 0.7f) Moist *= 0.7f;
			OutClimate.SetMoisture(LX, LZ, FMath::Clamp(Moist, 0.f, 1.f));

			// --- Temperature ---
			const float LatFactor = 1.f - FMath::Abs(WorldZ / 4096.f);
			const float TempNoiseVal = FHktTerrainNoiseFloat::Remap(
				TempNoise.FBm2D(WorldX / 384.f, WorldZ / 384.f, 3, 2.f, 0.5f),
				-1.f, 1.f, 0.f, 1.f);
			const float Temp = FMath::Clamp(LatFactor * 0.7f + TempNoiseVal * 0.3f - ElevRaw * 0.4f, 0.f, 1.f);
			OutClimate.SetTemperature(LX, LZ, Temp);

			// --- Exoticness ---
			float ExW = WorldX, ExZ = WorldZ;
			const float ExWarpX = ExoticNoise.FBm2D(WorldX / 1024.f, WorldZ / 1024.f, 2, 2.f, 0.5f);
			ExW += ExWarpX * 100.f;
			const float ExWarpZ = ExoticNoise.FBm2D(WorldX / 1024.f + 999.f, WorldZ / 1024.f + 999.f, 2, 2.f, 0.5f);
			ExZ += ExWarpZ * 100.f;
			const float ExBase = FHktTerrainNoiseFloat::Remap(
				ExoticNoise.FBm2D(ExW / 768.f, ExZ / 768.f, 3, 2.f, 0.5f),
				-1.f, 1.f, 0.f, 1.f);
			const float Exotic = HktDetMath::Pow8(ExBase);
			OutClimate.SetExoticness(LX, LZ, FMath::Clamp(Exotic, 0.f, 1.f));
		}
	}
}

// ============================================================================
// Layer 1.5: 대륙 템플릿
// ============================================================================

EHktContinentType FHktAdvTerrainTectonic::ClassifyCell(int32 CellX, int32 CellZ, uint64 WorldSeed)
{
	const uint64 CellSeed = SplitMix64(WorldSeed ^ Hash2D(CellX, CellZ) ^ 0xC0DEBEEFULL);
	const float Roll = SplitMix64ToFloat(CellSeed);

	if (Roll < 0.50f) return EHktContinentType::Pangea;
	if (Roll < 0.65f) return EHktContinentType::Plateau;
	if (Roll < 0.77f) return EHktContinentType::Archipelago;
	if (Roll < 0.87f) return EHktContinentType::Rift;
	if (Roll < 0.93f) return EHktContinentType::Crater;
	if (Roll < 0.98f) return EHktContinentType::Spire;
	return EHktContinentType::Pangea; // Abyss → Phase 0 폴백
}

void FHktAdvTerrainTectonic::Generate(
	int32 ChunkX, int32 ChunkZ,
	uint64 WorldSeed,
	const FHktChunkSeed& Seed,
	FHktTectonicMask& OutMask)
{
	constexpr int32 S = 32;

	// 청크 중심의 대륙 셀
	const float ChunkCenterX = static_cast<float>(ChunkX * S) + S * 0.5f;
	const float ChunkCenterZ = static_cast<float>(ChunkZ * S) + S * 0.5f;
	const int32 CellX = FMath::FloorToInt(ChunkCenterX / CELL_SIZE);
	const int32 CellZ = FMath::FloorToInt(ChunkCenterZ / CELL_SIZE);

	OutMask.PrimaryType = ClassifyCell(CellX, CellZ, WorldSeed);

	FHktTerrainNoiseFloat TecNoise(Seed.TectonicSeed ^ Hash2D(CellX, CellZ));

	const float CellCenterX = (static_cast<float>(CellX) + 0.5f) * CELL_SIZE;
	const float CellCenterZ = (static_cast<float>(CellZ) + 0.5f) * CELL_SIZE;

	for (int32 LZ = 0; LZ < S; ++LZ)
	{
		for (int32 LX = 0; LX < S; ++LX)
		{
			const float WX = static_cast<float>(ChunkX * S + LX);
			const float WZ = static_cast<float>(ChunkZ * S + LZ);
			const int32 Idx = LX + LZ * S;

			float Mul = 1.f, Off = 0.f;

			switch (OutMask.PrimaryType)
			{
			case EHktContinentType::Pangea:
				Mul = 1.f;
				Off = 0.f;
				break;

			case EHktContinentType::Archipelago:
			{
				const float IslandNoise = TecNoise.FBm2D(WX / 300.f, WZ / 300.f, 4, 2.f, 0.5f);
				if (IslandNoise < 0.f)
				{
					Mul = 0.5f;
					Off = -0.2f;
				}
				else
				{
					Mul = 1.3f;
					Off = 0.1f;
				}
				break;
			}

			case EHktContinentType::Rift:
			{
				const uint64 AngleSeed = SplitMix64(WorldSeed ^ Hash2D(CellX, CellZ) ^ 0xABCDULL);
				const float RiftAngle = SplitMix64ToFloat(AngleSeed) * 6.2831853f;
				const float DX = WX - CellCenterX;
				const float DZ = WZ - CellCenterZ;
				const float CosA = HktDetMath::Cos(RiftAngle);
				const float SinA = HktDetMath::Sin(RiftAngle);
				const float LocalZ = -DX * SinA + DZ * CosA;
				const float RiftIntensity = HktDetMath::GaussianFalloff(LocalZ / 200.f);
				Mul = 1.f;
				Off = -0.5f * RiftIntensity;
				break;
			}

			case EHktContinentType::Spire:
			{
				const float VDist = TecNoise.VoronoiDistance(WX, WZ, 60.f);
				Mul = 1.f + 2.f * HktDetMath::ExpNeg(VDist / 30.f);
				Off = 0.f;
				break;
			}

			case EHktContinentType::Crater:
			{
				const float DX = WX - CellCenterX;
				const float DZ = WZ - CellCenterZ;
				const float Dist = FMath::Sqrt(DX * DX + DZ * DZ);
				constexpr float CraterRadius = 1500.f;
				if (Dist < CraterRadius)
				{
					const float T = Dist / CraterRadius;
					Off = -0.6f * (1.f - T * T) + 0.2f * HktDetMath::SmoothStep(0.85f, 1.f, T);
				}
				Mul = 1.f;
				break;
			}

			case EHktContinentType::Plateau:
			{
				const float PlateauNoise = TecNoise.FBm2D(WX / 400.f, WZ / 400.f, 3, 2.f, 0.5f);
				if (PlateauNoise > 0.2f)
				{
					Mul = 0.3f;
					Off = 0.5f;
				}
				else
				{
					Mul = 0.8f;
					Off = 0.f;
				}
				break;
			}

			default:
				break;
			}

			// 경계 블렌딩
			const float DistToCenter = FMath::Sqrt(
				HktDetMath::Sq(WX - CellCenterX) + HktDetMath::Sq(WZ - CellCenterZ))
				/ (CELL_SIZE * 0.5f);
			constexpr float BlendZone = 0.3f;

			if (DistToCenter > (1.f - BlendZone))
			{
				const float BlendT = FMath::Clamp(
					(DistToCenter - (1.f - BlendZone)) / BlendZone, 0.f, 1.f);
				// 블렌드 시 Pangea(기본)으로 서서히 전이
				Mul = FMath::Lerp(Mul, 1.f, BlendT);
				Off = FMath::Lerp(Off, 0.f, BlendT);
			}

			OutMask.ElevationMultiplier[Idx] = Mul;
			OutMask.ElevationOffset[Idx] = Off;
		}
	}
}

// ============================================================================
// Layer 2: 바이옴 분류
// ============================================================================

EHktAdvBiome FHktAdvTerrainBiome::Decide(float Elev, float Moist, float Temp)
{
	if (Elev < 0.30f) return EHktAdvBiome::Ocean;
	if (Elev < 0.34f) return EHktAdvBiome::Beach;
	if (Elev > 0.85f) return EHktAdvBiome::SnowPeak;
	if (Elev > 0.70f) return EHktAdvBiome::RockyMountain;

	if (Temp < 0.25f)
	{
		return Moist > 0.5f ? EHktAdvBiome::Taiga : EHktAdvBiome::Tundra;
	}
	if (Temp < 0.55f)
	{
		if (Moist < 0.30f) return EHktAdvBiome::Grassland;
		if (Moist < 0.65f) return EHktAdvBiome::Forest;
		return EHktAdvBiome::Swamp;
	}
	if (Moist < 0.20f) return EHktAdvBiome::Desert;
	if (Moist < 0.45f) return EHktAdvBiome::Savanna;
	if (Moist < 0.70f) return EHktAdvBiome::Grassland;
	return EHktAdvBiome::Forest;
}

void FHktAdvTerrainBiome::Classify(
	const FHktClimateField& Climate,
	const FHktChunkSeed& Seed,
	FHktAdvBiomeMap& OutBiomes)
{
	FHktTerrainNoiseFloat JitterNoise(Seed.BiomeSeed);
	constexpr int32 S = FHktClimateField::Size;

	for (int32 LZ = 0; LZ < S; ++LZ)
	{
		for (int32 LX = 0; LX < S; ++LX)
		{
			// 경계 지터 (±0.02)
			const float Jitter = JitterNoise.Noise2D(
				static_cast<float>(LX) * 3.7f,
				static_cast<float>(LZ) * 3.7f) * 0.02f;

			const float E = FMath::Clamp(Climate.GetElevation(LX, LZ) + Jitter, 0.f, 1.f);
			const float M = Climate.GetMoisture(LX, LZ);
			const float T = Climate.GetTemperature(LX, LZ);

			OutBiomes.Set(LX, LZ, Decide(E, M, T));
		}
	}
}

// ============================================================================
// Layer 2.5: 이상 바이옴 오버레이
// ============================================================================

EHktAdvBiome FHktAdvTerrainExoticBiome::SelectExoticBiome(
	EHktAdvBiome Original, float /*Exoticness*/, float /*Elev*/, float /*Moist*/, float /*Temp*/, uint64 LocalSeed)
{
	const float Roll = SplitMix64ToFloat(LocalSeed);

	switch (Original)
	{
	case EHktAdvBiome::Forest:
	case EHktAdvBiome::Grassland:
		if (Roll < 0.5f) return EHktAdvBiome::CrystalForest;
		if (Roll < 0.83f) return EHktAdvBiome::LivingForest;
		return EHktAdvBiome::GlowMushroom;

	case EHktAdvBiome::Desert:
	case EHktAdvBiome::Savanna:
		if (Roll < 0.8f) return EHktAdvBiome::BoneDesert;
		return EHktAdvBiome::CrystalForest;

	case EHktAdvBiome::RockyMountain:
	case EHktAdvBiome::SnowPeak:
		if (Roll < 0.4f) return EHktAdvBiome::CrystalForest;
		return EHktAdvBiome::GlowMushroom; // VoidRift → Phase 0 폴백

	case EHktAdvBiome::Tundra:
	case EHktAdvBiome::Taiga:
		if (Roll < 0.67f) return EHktAdvBiome::GlowMushroom;
		return EHktAdvBiome::CrystalForest; // VoidRift → Phase 0 폴백

	case EHktAdvBiome::Swamp:
		if (Roll < 0.67f) return EHktAdvBiome::GlowMushroom;
		return EHktAdvBiome::LivingForest;

	default:
		return EHktAdvBiome::CrystalForest;
	}
}

void FHktAdvTerrainExoticBiome::Apply(
	FHktAdvBiomeMap& InOutBiomes,
	const FHktClimateField& Climate,
	const FHktChunkSeed& Seed,
	int32 ChunkX, int32 ChunkZ)
{
	constexpr int32 S = FHktClimateField::Size;

	for (int32 LZ = 0; LZ < S; ++LZ)
	{
		for (int32 LX = 0; LX < S; ++LX)
		{
			if (Climate.GetExoticness(LX, LZ) <= 0.95f) continue;

			const EHktAdvBiome Original = InOutBiomes.Get(LX, LZ);
			if (Original == EHktAdvBiome::Ocean) continue;

			const int32 WX = ChunkX * S + LX;
			const int32 WZ = ChunkZ * S + LZ;
			const uint64 LocalSeed = Seed.ExoticSeed ^ Hash2D(WX, WZ);

			const EHktAdvBiome Exotic = SelectExoticBiome(
				Original,
				Climate.GetExoticness(LX, LZ),
				Climate.GetElevation(LX, LZ),
				Climate.GetMoisture(LX, LZ),
				Climate.GetTemperature(LX, LZ),
				LocalSeed);

			InOutBiomes.Set(LX, LZ, Exotic);
		}
	}
}

// ============================================================================
// 바이옴 재질 규칙 테이블
// ============================================================================

const FHktAdvBiomeMaterialRule& HktAdvBiomeMaterial::GetRule(EHktAdvBiome Biome)
{
	using namespace HktAdvTerrainPalette;

	// 현실 바이옴
	static const FHktAdvBiomeMaterialRule OceanRule       = {Air, Sand, Stone, Bedrock, Water, Ocean};
	static const FHktAdvBiomeMaterialRule BeachRule        = {Sand, Sand, Stone, Bedrock, Water, Beach};
	static const FHktAdvBiomeMaterialRule GrasslandRule    = {Grass, Dirt, Stone, Bedrock, Water, Grassland};
	static const FHktAdvBiomeMaterialRule ForestRule       = {Grass, Dirt, Stone, Bedrock, Water, Forest};
	static const FHktAdvBiomeMaterialRule DesertRule       = {Sand, Sand, Stone, Bedrock, Air, Desert};
	static const FHktAdvBiomeMaterialRule SavannaRule      = {Grass, Dirt, Stone, Bedrock, Air, Savanna};
	static const FHktAdvBiomeMaterialRule TundraRule       = {Snow, Dirt, Stone, Bedrock, Ice, Tundra};
	static const FHktAdvBiomeMaterialRule TaigaRule        = {Snow, Dirt, Stone, Bedrock, Ice, Taiga};
	static const FHktAdvBiomeMaterialRule RockyRule        = {Gravel, Stone, Stone, Bedrock, Water, RockyMountain};
	static const FHktAdvBiomeMaterialRule SnowPeakRule     = {Snow, Stone, Stone, Bedrock, Ice, SnowPeak};
	static const FHktAdvBiomeMaterialRule SwampRule        = {Clay, Clay, Stone, Bedrock, Water, Swamp};

	// 이상 바이옴
	static const FHktAdvBiomeMaterialRule CrystalRule      = {CrystalGrass, Dirt, Stone, Bedrock, Water, CrystalForest};
	static const FHktAdvBiomeMaterialRule GlowMushroomRule = {SoilDark, SoilDark, Stone, Bedrock, Water, GlowMushroom};
	static const FHktAdvBiomeMaterialRule BoneDesertRule   = {SandBleached, Sand, Stone, Bedrock, Air, BoneDesert};
	static const FHktAdvBiomeMaterialRule VoidRiftRule     = {StoneFractured, Stone, Stone, Bedrock, Water, VoidRift};
	static const FHktAdvBiomeMaterialRule LivingForestRule = {GrassEthereal, Dirt, Stone, Bedrock, Water, LivingForest};

	// FloatingMeadow → Phase 0에서 CrystalForest로 폴백
	static const FHktAdvBiomeMaterialRule DefaultRule      = {Grass, Dirt, Stone, Bedrock, Water, Grassland};

	switch (Biome)
	{
	case EHktAdvBiome::Ocean:         return OceanRule;
	case EHktAdvBiome::Beach:         return BeachRule;
	case EHktAdvBiome::Grassland:     return GrasslandRule;
	case EHktAdvBiome::Forest:        return ForestRule;
	case EHktAdvBiome::Desert:        return DesertRule;
	case EHktAdvBiome::Savanna:       return SavannaRule;
	case EHktAdvBiome::Tundra:        return TundraRule;
	case EHktAdvBiome::Taiga:         return TaigaRule;
	case EHktAdvBiome::RockyMountain: return RockyRule;
	case EHktAdvBiome::SnowPeak:      return SnowPeakRule;
	case EHktAdvBiome::Swamp:         return SwampRule;
	case EHktAdvBiome::CrystalForest: return CrystalRule;
	case EHktAdvBiome::FloatingMeadow:return CrystalRule;
	case EHktAdvBiome::GlowMushroom:  return GlowMushroomRule;
	case EHktAdvBiome::BoneDesert:    return BoneDesertRule;
	case EHktAdvBiome::VoidRift:      return VoidRiftRule;
	case EHktAdvBiome::LivingForest:  return LivingForestRule;
	default:                          return DefaultRule;
	}
}
