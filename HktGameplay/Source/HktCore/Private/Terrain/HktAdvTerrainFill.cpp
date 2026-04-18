// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktAdvTerrainFill.h"
#include "Terrain/HktAdvTerrainLayers.h"
#include "Terrain/HktTerrainNoiseFloat.h"
#include "Terrain/HktTerrainVoxelDef.h"

using namespace HktTerrainHash;
using namespace HktAdvTerrainType;

// ============================================================================
// Layer 3: 하이트맵 + 컬럼 채우기
// 좌표 규칙: X,Y = 수평축, Z = 높이축
// 복셀 인덱스 = LX + LY * S + LZ * S * S
// ============================================================================

int32 FHktAdvTerrainFill::ComputeHeight(float Elevation, EHktAdvBiome Biome, const FHktAdvTerrainHeightParams& Params)
{
	int32 H = FMath::FloorToInt(Elevation * Params.MaxHeight) + Params.BaseHeight;

	switch (Biome)
	{
	case EHktAdvBiome::BoneDesert:
		H = FMath::FloorToInt(H * 0.85f);
		break;
	case EHktAdvBiome::VoidRift:
		H = FMath::FloorToInt(H * 1.1f);
		break;
	default:
		break;
	}

	return FMath::Clamp(H, 1, 255);
}

void FHktAdvTerrainFill::Fill(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktClimateField& Climate,
	const FHktAdvBiomeMap& Biomes,
	const FHktTectonicMask& Tectonic,
	const FHktAdvTerrainHeightParams& Params,
	FHktTerrainVoxel* OutVoxels)
{
	constexpr int32 S = ChunkSize;
	const int32 HeightBase = ChunkZ * S;

	for (int32 LX = 0; LX < S; ++LX)
	{
		for (int32 LY = 0; LY < S; ++LY)
		{
			// Elevation은 GenerateChunk에서 Tectonic 마스크 적용 완료 상태
			const float Elev = Climate.GetElevation(LX, LY);
			const EHktAdvBiome Biome = Biomes.Get(LX, LY);
			const FHktAdvBiomeMaterialRule& Rule = HktAdvBiomeMaterial::GetRule(Biome);
			const int32 SurfaceHeight = ComputeHeight(Elev, Biome, Params);

			for (int32 LZ = 0; LZ < S; ++LZ)
			{
				const int32 WorldZ = HeightBase + LZ;
				const int32 Index = LX + LY * S + LZ * S * S;

				FHktTerrainVoxel& V = OutVoxels[Index];
				V = FHktTerrainVoxel();

				if (WorldZ > SurfaceHeight)
				{
					if (Biome == EHktAdvBiome::Ocean || WorldZ <= Params.SeaLevel)
					{
						if (WorldZ <= Params.SeaLevel && Rule.WaterType != Air)
						{
							V = HktTerrainVoxelDef::MakeVoxel(Rule.WaterType, Rule.PaletteRow);
						}
					}
					continue;
				}

				const int32 Depth = SurfaceHeight - WorldZ;

				if (WorldZ <= 2)
				{
					V = HktTerrainVoxelDef::MakeVoxel(Rule.BedrockType, Rule.PaletteRow);
				}
				else if (Depth >= 4)
				{
					V = HktTerrainVoxelDef::MakeVoxel(Rule.DeepType, Rule.PaletteRow);
				}
				else if (Depth >= 1)
				{
					V = HktTerrainVoxelDef::MakeVoxel(Rule.SubsurfaceType, Rule.PaletteRow);
				}
				else
				{
					V = HktTerrainVoxelDef::MakeVoxel(Rule.SurfaceType, Rule.PaletteRow);
				}
			}
		}
	}
}

// ============================================================================
// Layer 4: 랜드마크 주입
// ============================================================================

void FHktAdvTerrainLandmark::CarveSphericalHole(
	int32 CX, int32 CY, int32 CZ,
	int32 Radius, int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	FHktTerrainVoxel* Voxels)
{
	constexpr int32 S = 32;
	const int32 BaseX = ChunkX * S;
	const int32 BaseY = ChunkY * S;
	const int32 BaseZ = ChunkZ * S;
	const int32 R2 = Radius * Radius;

	for (int32 LX = 0; LX < S; ++LX)
	{
		const int32 WX = BaseX + LX;
		for (int32 LY = 0; LY < S; ++LY)
		{
			const int32 WY = BaseY + LY;
			for (int32 LZ = 0; LZ < S; ++LZ)
			{
				const int32 WZ = BaseZ + LZ;
				const int32 DX = WX - CX;
				const int32 DY = WY - CY;
				const int32 DZ = WZ - CZ;
				if (DX * DX + DY * DY + DZ * DZ < R2)
				{
					const int32 Idx = LX + LY * S + LZ * S * S;
					Voxels[Idx] = FHktTerrainVoxel();
				}
			}
		}
	}
}

void FHktAdvTerrainLandmark::StampCylinder(
	int32 CenterX, int32 CenterY, int32 BaseZ,
	int32 Radius, int32 Height, uint16 TypeID, uint8 Palette,
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	FHktTerrainVoxel* Voxels)
{
	constexpr int32 S = 32;
	const int32 BX = ChunkX * S;
	const int32 BY = ChunkY * S;
	const int32 BZ = ChunkZ * S;
	const int32 R2 = Radius * Radius;

	for (int32 LX = 0; LX < S; ++LX)
	{
		const int32 WX = BX + LX;
		for (int32 LY = 0; LY < S; ++LY)
		{
			const int32 WY = BY + LY;
			const int32 DX = WX - CenterX;
			const int32 DY = WY - CenterY;
			if (DX * DX + DY * DY > R2) continue;

			for (int32 LZ = 0; LZ < S; ++LZ)
			{
				const int32 WZ = BZ + LZ;
				if (WZ < BaseZ || WZ >= BaseZ + Height) continue;

				const int32 Idx = LX + LY * S + LZ * S * S;
				Voxels[Idx] = HktTerrainVoxelDef::MakeVoxel(TypeID, Palette);
			}
		}
	}
}

void FHktAdvTerrainLandmark::ApplyLandmarks(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktAdvBiomeMap& Biomes,
	const FHktTectonicMask& Tectonic,
	const FHktChunkSeed& Seed,
	const FHktClimateField& Climate,
	const FHktAdvTerrainHeightParams& Params,
	FHktTerrainVoxel* InOutVoxels)
{
	const EHktAdvBiome CenterBiome = Biomes.Get(16, 16);
	if (CenterBiome == EHktAdvBiome::Ocean) return;

	struct LandmarkDef
	{
		EHktLandmarkType Type;
		float Probability;
		bool bAllowedBiome;
	};

	const bool bExotic = static_cast<uint8>(CenterBiome) >= 100;
	const float CenterElev = Climate.GetElevation(16, 16);

	LandmarkDef Catalog[] = {
		{EHktLandmarkType::Sinkhole,      0.02f, !bExotic && CenterElev > 0.4f && CenterElev < 0.75f},
		{EHktLandmarkType::Mesa,           0.015f, CenterBiome == EHktAdvBiome::Desert},
		{EHktLandmarkType::Monolith,       0.005f, true},
		{EHktLandmarkType::SmallCrater,    0.01f, !bExotic && Tectonic.PrimaryType != EHktContinentType::Crater},
		{EHktLandmarkType::StoneArch,      0.008f, CenterBiome == EHktAdvBiome::RockyMountain || CenterBiome == EHktAdvBiome::Desert},
		{EHktLandmarkType::GiantTree,      0.003f, CenterBiome == EHktAdvBiome::Forest || CenterBiome == EHktAdvBiome::CrystalForest},
		{EHktLandmarkType::BoneSpire,      0.02f, CenterBiome == EHktAdvBiome::BoneDesert},
		{EHktLandmarkType::CrystalColumn,  0.025f, CenterBiome == EHktAdvBiome::CrystalForest},
		{EHktLandmarkType::VoidFissure,    0.015f, CenterBiome == EHktAdvBiome::VoidRift},
	};

	for (const auto& LM : Catalog)
	{
		if (!LM.bAllowedBiome) continue;

		const uint64 RollSeed = Seed.LandmarkSeed ^ static_cast<uint64>(LM.Type) ^ Hash2D(ChunkX, ChunkY);
		if (SplitMix64ToFloat(RollSeed) >= LM.Probability) continue;

		// 배치 위치 — 청크 내 중심 근처 (수평 XY)
		const int32 LocalX = static_cast<int32>(SplitMix64(RollSeed + 1) % 8) + 12;
		const int32 LocalY = static_cast<int32>(SplitMix64(RollSeed + 2) % 8) + 12;
		const float Elev = Climate.GetElevation(LocalX, LocalY);
		const int32 SurfaceH = FHktAdvTerrainFill::ComputeHeight(Elev, CenterBiome, Params);
		const int32 WorldX = ChunkX * 32 + LocalX;
		const int32 WorldY = ChunkY * 32 + LocalY;

		// CarveSphericalHole(CX, CY, CZ) = (수평X, 수평Y, 높이Z)
		// StampCylinder(CenterX, CenterY, BaseZ) = (수평X, 수평Y, 높이Z)
		switch (LM.Type)
		{
		case EHktLandmarkType::Sinkhole:
			CarveSphericalHole(WorldX, WorldY, SurfaceH - 40, 30, ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::Mesa:
			StampCylinder(WorldX, WorldY, SurfaceH, 20, 50, Stone, HktAdvTerrainPalette::Desert,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::Monolith:
			StampCylinder(WorldX, WorldY, SurfaceH, 3, 80, Stone, HktAdvTerrainPalette::RockyMountain,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::SmallCrater:
			CarveSphericalHole(WorldX, WorldY, SurfaceH - 8, 25, ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::StoneArch:
			StampCylinder(WorldX - 8, WorldY, SurfaceH, 3, 25, Stone, HktAdvTerrainPalette::RockyMountain,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			StampCylinder(WorldX + 8, WorldY, SurfaceH, 3, 25, Stone, HktAdvTerrainPalette::RockyMountain,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			StampCylinder(WorldX, WorldY, SurfaceH + 23, 10, 3, Stone, HktAdvTerrainPalette::RockyMountain,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::GiantTree:
			StampCylinder(WorldX, WorldY, SurfaceH, 4, 60, Wood, HktAdvTerrainPalette::Forest,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			CarveSphericalHole(WorldX, WorldY, SurfaceH + 60, 1, ChunkX, ChunkY, ChunkZ, InOutVoxels);
			StampCylinder(WorldX, WorldY, SurfaceH + 45, 15, 20, Leaves, HktAdvTerrainPalette::Forest,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::BoneSpire:
			StampCylinder(WorldX, WorldY, SurfaceH, 4, 50, BoneFragment, HktAdvTerrainPalette::BoneDesert,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::CrystalColumn:
			StampCylinder(WorldX, WorldY, SurfaceH, 5, 40, CrystalShard, HktAdvTerrainPalette::CrystalForest,
				ChunkX, ChunkY, ChunkZ, InOutVoxels);
			break;

		case EHktLandmarkType::VoidFissure:
			for (int32 DX = -30; DX <= 30; ++DX)
			{
				CarveSphericalHole(WorldX + DX, WorldY, SurfaceH - 40, 5, ChunkX, ChunkY, ChunkZ, InOutVoxels);
			}
			break;

		default:
			break;
		}

		break; // 청크당 1개만
	}
}

void FHktAdvTerrainLandmark::ApplyRivers(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktClimateField& Climate,
	const FHktAdvBiomeMap& Biomes,
	const FHktChunkSeed& Seed,
	const FHktAdvTerrainHeightParams& Params,
	FHktTerrainVoxel* InOutVoxels)
{
	FHktTerrainNoiseFloat RiverNoise(Seed.FeatureSeed);
	constexpr int32 S = 32;
	const int32 BaseX = ChunkX * S;
	const int32 BaseY = ChunkY * S;
	const int32 HeightBase = ChunkZ * S;

	for (int32 LX = 0; LX < S; ++LX)
	{
		for (int32 LY = 0; LY < S; ++LY)
		{
			const EHktAdvBiome Biome = Biomes.Get(LX, LY);
			if (Biome == EHktAdvBiome::Ocean || Biome == EHktAdvBiome::VoidRift) continue;

			const float Elev = Climate.GetElevation(LX, LY);
			if (Elev <= 0.34f || Elev > 0.7f) continue;

			const float WX = static_cast<float>(BaseX + LX);
			const float WY = static_cast<float>(BaseY + LY);
			const float RiverVal = FMath::Abs(RiverNoise.FBm2D(WX / 256.f, WY / 256.f, 4, 2.f, 0.5f));

			if (RiverVal < 0.03f)
			{
				const int32 SurfaceH = FHktAdvTerrainFill::ComputeHeight(Elev, Biome, Params);

				for (int32 LZ = 0; LZ < S; ++LZ)
				{
					const int32 WZ = HeightBase + LZ;
					if (WZ == SurfaceH || WZ == SurfaceH - 1)
					{
						const int32 Idx = LX + LY * S + LZ * S * S;
						InOutVoxels[Idx] = HktTerrainVoxelDef::MakeVoxel(Water, 0);
					}
				}
			}
		}
	}
}

void FHktAdvTerrainLandmark::Apply(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktClimateField& Climate,
	const FHktAdvBiomeMap& Biomes,
	const FHktTectonicMask& Tectonic,
	const FHktChunkSeed& Seed,
	const FHktAdvTerrainHeightParams& Params,
	FHktTerrainVoxel* InOutVoxels)
{
	ApplyLandmarks(ChunkX, ChunkY, ChunkZ, Biomes, Tectonic, Seed, Climate, Params, InOutVoxels);
	ApplyRivers(ChunkX, ChunkY, ChunkZ, Climate, Biomes, Seed, Params, InOutVoxels);
}

// ============================================================================
// Layer 5: 데코레이션
// ============================================================================

void FHktAdvTerrainDecoration::ApplySubsurface(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktChunkSeed& Seed,
	FHktTerrainVoxel* InOutVoxels)
{
	constexpr int32 S = 32;
	const int32 BaseX = ChunkX * S;
	const int32 BaseY = ChunkY * S;
	const int32 HeightBase = ChunkZ * S;

	static constexpr int32 OreCount = 5;

	struct OreDef
	{
		uint16 TypeID;
		int32 MaxHeight;
		float Scale;
		float Threshold;
		uint64 SeedOffset;
	};

	static const OreDef Ores[OreCount] = {
		{OreCoal,      100, 16.f, 0.65f, 0x10},
		{OreIron,       80, 14.f, 0.70f, 0x20},
		{OreGold,       40, 12.f, 0.78f, 0x30},
		{OreCrystal,    30, 10.f, 0.82f, 0x40},
		{OreVoidstone,  25,  8.f, 0.85f, 0x50},
	};

	FHktTerrainNoiseFloat OreNoises[OreCount] = {
		FHktTerrainNoiseFloat(Seed.DecoSeed ^ Ores[0].SeedOffset),
		FHktTerrainNoiseFloat(Seed.DecoSeed ^ Ores[1].SeedOffset),
		FHktTerrainNoiseFloat(Seed.DecoSeed ^ Ores[2].SeedOffset),
		FHktTerrainNoiseFloat(Seed.DecoSeed ^ Ores[3].SeedOffset),
		FHktTerrainNoiseFloat(Seed.DecoSeed ^ Ores[4].SeedOffset),
	};

	for (int32 LX = 0; LX < S; ++LX)
	{
		for (int32 LY = 0; LY < S; ++LY)
		{
			for (int32 LZ = 0; LZ < S; ++LZ)
			{
				const int32 WZ = HeightBase + LZ;
				const int32 Idx = LX + LY * S + LZ * S * S;
				if (InOutVoxels[Idx].TypeID != Stone) continue;

				const float WX = static_cast<float>(BaseX + LX);
				const float WY = static_cast<float>(BaseY + LY);

				for (int32 OI = 0; OI < OreCount; ++OI)
				{
					const OreDef& Ore = Ores[OI];
					if (WZ > Ore.MaxHeight) continue;

					const float N = OreNoises[OI].Noise3D(WX / Ore.Scale, WY / Ore.Scale, static_cast<float>(WZ) / Ore.Scale);
					if (N > Ore.Threshold)
					{
						InOutVoxels[Idx] = HktTerrainVoxelDef::MakeVoxel(Ore.TypeID, 0);
						break;
					}
				}
			}
		}
	}
}

void FHktAdvTerrainDecoration::ApplySurfaceScatter(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktAdvBiomeMap& Biomes,
	const FHktChunkSeed& Seed,
	FHktTerrainVoxel* InOutVoxels)
{
	constexpr int32 S = 32;
	const int32 BaseX = ChunkX * S;
	const int32 BaseY = ChunkY * S;

	for (int32 LX = 0; LX < S; ++LX)
	{
		for (int32 LY = 0; LY < S; ++LY)
		{
			const EHktAdvBiome Biome = Biomes.Get(LX, LY);
			if (Biome == EHktAdvBiome::Ocean || Biome == EHktAdvBiome::Beach) continue;

			// 표면 Z 찾기 (이 컬럼에서 가장 높은 비공기 복셀)
			int32 SurfaceLocalZ = -1;
			for (int32 LZ = S - 1; LZ >= 0; --LZ)
			{
				const int32 Idx = LX + LY * S + LZ * S * S;
				if (InOutVoxels[Idx].TypeID != Air && InOutVoxels[Idx].TypeID != Water)
				{
					SurfaceLocalZ = LZ;
					break;
				}
			}

			if (SurfaceLocalZ < 0 || SurfaceLocalZ >= S - 1) continue;

			const int32 AboveIdx = LX + LY * S + (SurfaceLocalZ + 1) * S * S;
			if (InOutVoxels[AboveIdx].TypeID != Air) continue;

			const int32 WX = BaseX + LX;
			const int32 WY = BaseY + LY;
			const uint64 CellSeed = Seed.DecoSeed ^ Hash2D(WX, WY);
			const float Roll = SplitMix64ToFloat(CellSeed);

			uint16 DecoType = Air;
			uint8 DecoPalette = 0;
			int32 DecoHeight = 1;

			switch (Biome)
			{
			case EHktAdvBiome::Forest:
			case EHktAdvBiome::LivingForest:
				if (Roll < 0.04f) { DecoType = Wood; DecoPalette = HktAdvTerrainPalette::Forest; DecoHeight = 5 + static_cast<int32>(SplitMix64(CellSeed + 3) % 4); }
				else if (Roll < 0.08f) { DecoType = Mushroom; DecoPalette = HktAdvTerrainPalette::Forest; }
				break;

			case EHktAdvBiome::Grassland:
			case EHktAdvBiome::Savanna:
				if (Roll < 0.02f) { DecoType = Wood; DecoPalette = HktAdvTerrainPalette::Grassland; DecoHeight = 4 + static_cast<int32>(SplitMix64(CellSeed + 3) % 3); }
				else if (Roll < 0.06f) { DecoType = GrassFlower; DecoPalette = HktAdvTerrainPalette::Grassland; }
				break;

			case EHktAdvBiome::Desert:
				if (Roll < 0.01f) { DecoType = Cactus; DecoPalette = HktAdvTerrainPalette::Desert; DecoHeight = 2 + static_cast<int32>(SplitMix64(CellSeed + 3) % 3); }
				break;

			case EHktAdvBiome::Taiga:
				if (Roll < 0.05f) { DecoType = Wood; DecoPalette = HktAdvTerrainPalette::Taiga; DecoHeight = 6 + static_cast<int32>(SplitMix64(CellSeed + 3) % 4); }
				break;

			case EHktAdvBiome::Tundra:
				if (Roll < 0.005f) { DecoType = Wood; DecoPalette = HktAdvTerrainPalette::Tundra; DecoHeight = 3; }
				break;

			case EHktAdvBiome::CrystalForest:
				if (Roll < 0.06f) { DecoType = CrystalShard; DecoPalette = HktAdvTerrainPalette::CrystalForest; DecoHeight = 3 + static_cast<int32>(SplitMix64(CellSeed + 3) % 5); }
				break;

			case EHktAdvBiome::GlowMushroom:
				if (Roll < 0.08f) { DecoType = MushroomGlow; DecoPalette = HktAdvTerrainPalette::GlowMushroom; DecoHeight = 2 + static_cast<int32>(SplitMix64(CellSeed + 3) % 4); }
				break;

			case EHktAdvBiome::BoneDesert:
				if (Roll < 0.04f) { DecoType = BoneFragment; DecoPalette = HktAdvTerrainPalette::BoneDesert; DecoHeight = 2 + static_cast<int32>(SplitMix64(CellSeed + 3) % 3); }
				break;

			default:
				break;
			}

			if (DecoType == Air) continue;

			const bool bIsTree = (DecoType == Wood);
			const int32 TrunkHeight = DecoHeight;

			for (int32 DZ = 1; DZ <= DecoHeight && (SurfaceLocalZ + DZ) < S; ++DZ)
			{
				const int32 PlaceIdx = LX + LY * S + (SurfaceLocalZ + DZ) * S * S;
				InOutVoxels[PlaceIdx] = HktTerrainVoxelDef::MakeVoxel(DecoType, DecoPalette);
			}

			// 나무 캐노피
			if (bIsTree && (SurfaceLocalZ + TrunkHeight + 1) < S)
			{
				uint16 LeafType = Leaves;
				if (Biome == EHktAdvBiome::Taiga || Biome == EHktAdvBiome::Tundra) LeafType = LeavesSnow;

				const int32 CanopyBaseZ = SurfaceLocalZ + TrunkHeight - 1;
				for (int32 DZ = 0; DZ < 3 && (CanopyBaseZ + DZ) < S; ++DZ)
				{
					for (int32 DX = -2; DX <= 2; ++DX)
					{
						for (int32 DY = -2; DY <= 2; ++DY)
						{
							if (FMath::Abs(DX) == 2 && FMath::Abs(DY) == 2) continue;
							const int32 NX = LX + DX;
							const int32 NY = LY + DY;
							if (NX < 0 || NX >= S || NY < 0 || NY >= S) continue;
							const int32 NZ = CanopyBaseZ + DZ;
							if (NZ >= S) continue;
							const int32 LeafIdx = NX + NY * S + NZ * S * S;
							if (InOutVoxels[LeafIdx].TypeID == Air)
							{
								InOutVoxels[LeafIdx] = HktTerrainVoxelDef::MakeVoxel(LeafType, DecoPalette);
							}
						}
					}
				}
			}
		}
	}
}

void FHktAdvTerrainDecoration::Apply(
	int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	const FHktClimateField& Climate,
	const FHktAdvBiomeMap& Biomes,
	const FHktChunkSeed& Seed,
	FHktTerrainVoxel* InOutVoxels)
{
	ApplySubsurface(ChunkX, ChunkY, ChunkZ, Seed, InOutVoxels);
	ApplySurfaceScatter(ChunkX, ChunkY, ChunkZ, Biomes, Seed, InOutVoxels);
}
