// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainBakedAsset.h"
#include "HktTerrainLog.h"
#include "Terrain/HktFixed32.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Misc/Compression.h"

// ============================================================================
// FHktTerrainBakedConfig — USTRUCT ↔ POD Config 변환
// ============================================================================

FHktTerrainGeneratorConfig FHktTerrainBakedConfig::ToConfig() const
{
	using Fixed = FHktFixed32;

	FHktTerrainGeneratorConfig Out;
	Out.Seed                       = Seed;
	Out.bAdvancedTerrain          = bAdvancedTerrain;
	Out.bAdvEnableSubsurfaceOre   = bAdvEnableSubsurfaceOre;
	Out.bAdvEnableSurfaceScatter  = bAdvEnableSurfaceScatter;
	Out.Epoch                      = static_cast<uint32>(Epoch);
	Out.HeightScale                = Fixed::FromRaw(HeightScaleRaw);
	Out.HeightOffset               = Fixed::FromRaw(HeightOffsetRaw);
	Out.TerrainFreq                = Fixed::FromRaw(TerrainFreqRaw);
	Out.TerrainOctaves             = TerrainOctaves;
	Out.Lacunarity                 = Fixed::FromRaw(LacunarityRaw);
	Out.Persistence                = Fixed::FromRaw(PersistenceRaw);
	Out.MountainFreq               = Fixed::FromRaw(MountainFreqRaw);
	Out.MountainBlend              = Fixed::FromRaw(MountainBlendRaw);
	Out.WaterLevel                 = Fixed::FromRaw(WaterLevelRaw);
	Out.bEnableCaves               = bEnableCaves;
	Out.CaveFreq                   = Fixed::FromRaw(CaveFreqRaw);
	Out.CaveThreshold              = Fixed::FromRaw(CaveThresholdRaw);
	Out.BiomeNoiseScale            = Fixed::FromRaw(BiomeNoiseScaleRaw);
	Out.MountainBiomeThreshold     = Fixed::FromRaw(MountainBiomeThresholdRaw);
	Out.VoxelSizeCm                = VoxelSizeCm;
	Out.HeightMinZ                 = HeightMinZ;
	Out.HeightMaxZ                 = HeightMaxZ;
	Out.SimLoadRadiusXY            = SimLoadRadiusXY;
	Out.SimLoadRadiusZ             = SimLoadRadiusZ;
	Out.SimMaxChunksLoaded         = SimMaxChunksLoaded;
	Out.SimMaxChunkLoadsPerFrame   = SimMaxChunkLoadsPerFrame;
	return Out;
}

void FHktTerrainBakedConfig::FromConfig(const FHktTerrainGeneratorConfig& InConfig)
{
	Seed                          = InConfig.Seed;
	bAdvancedTerrain             = InConfig.bAdvancedTerrain;
	bAdvEnableSubsurfaceOre      = InConfig.bAdvEnableSubsurfaceOre;
	bAdvEnableSurfaceScatter     = InConfig.bAdvEnableSurfaceScatter;
	Epoch                         = static_cast<int32>(InConfig.Epoch);
	HeightScaleRaw                = InConfig.HeightScale.Raw;
	HeightOffsetRaw               = InConfig.HeightOffset.Raw;
	TerrainFreqRaw                = InConfig.TerrainFreq.Raw;
	TerrainOctaves                = InConfig.TerrainOctaves;
	LacunarityRaw                 = InConfig.Lacunarity.Raw;
	PersistenceRaw                = InConfig.Persistence.Raw;
	MountainFreqRaw               = InConfig.MountainFreq.Raw;
	MountainBlendRaw              = InConfig.MountainBlend.Raw;
	WaterLevelRaw                 = InConfig.WaterLevel.Raw;
	bEnableCaves                  = InConfig.bEnableCaves;
	CaveFreqRaw                   = InConfig.CaveFreq.Raw;
	CaveThresholdRaw              = InConfig.CaveThreshold.Raw;
	BiomeNoiseScaleRaw            = InConfig.BiomeNoiseScale.Raw;
	MountainBiomeThresholdRaw     = InConfig.MountainBiomeThreshold.Raw;
	VoxelSizeCm                   = InConfig.VoxelSizeCm;
	HeightMinZ                    = InConfig.HeightMinZ;
	HeightMaxZ                    = InConfig.HeightMaxZ;
	SimLoadRadiusXY               = InConfig.SimLoadRadiusXY;
	SimLoadRadiusZ                = InConfig.SimLoadRadiusZ;
	SimMaxChunksLoaded            = InConfig.SimMaxChunksLoaded;
	SimMaxChunkLoadsPerFrame      = InConfig.SimMaxChunkLoadsPerFrame;
}

// ============================================================================
// UHktTerrainBakedAsset
// ============================================================================

void UHktTerrainBakedAsset::PostLoad()
{
	Super::PostLoad();

	if (BakeVersion != CurrentBakeVersion)
	{
		UE_LOG(LogHktTerrain, Warning,
			TEXT("UHktTerrainBakedAsset '%s' BakeVersion=%d (current=%d) — 재베이크 권장"),
			*GetName(), BakeVersion, CurrentBakeVersion);
	}

	RebuildIndex();
}

void UHktTerrainBakedAsset::RebuildIndex()
{
	CoordToIndex.Reset();
	CoordToIndex.Reserve(Chunks.Num());
	for (int32 i = 0; i < Chunks.Num(); ++i)
	{
		CoordToIndex.Add(Chunks[i].Coord, i);
	}
}

const FHktTerrainBakedChunk* UHktTerrainBakedAsset::FindChunk(const FIntVector& Coord) const
{
	const int32* Idx = CoordToIndex.Find(Coord);
	if (!Idx || !Chunks.IsValidIndex(*Idx))
	{
		return nullptr;
	}
	return &Chunks[*Idx];
}

bool UHktTerrainBakedAsset::TryDecompressChunk(const FIntVector& Coord, FHktTerrainVoxel* OutVoxels) const
{
	const FHktTerrainBakedChunk* Chunk = FindChunk(Coord);
	if (!Chunk || Chunk->CompressedData.Num() == 0 || OutVoxels == nullptr)
	{
		return false;
	}

	constexpr int32 ExpectedBytes = 32 * 32 * 32 * sizeof(FHktTerrainVoxel);
	if (Chunk->UncompressedSize != ExpectedBytes)
	{
		UE_LOG(LogHktTerrain, Warning,
			TEXT("BakedChunk %s UncompressedSize=%d (expected=%d) — 자산 손상 가능성"),
			*Coord.ToString(), Chunk->UncompressedSize, ExpectedBytes);
		return false;
	}

	const bool bOk = FCompression::UncompressMemory(
		NAME_Oodle,
		OutVoxels,
		ExpectedBytes,
		Chunk->CompressedData.GetData(),
		Chunk->CompressedData.Num());

	if (!bOk)
	{
		UE_LOG(LogHktTerrain, Warning,
			TEXT("BakedChunk %s Oodle 디컴프레스 실패 (Compressed=%d → Uncompressed=%d)"),
			*Coord.ToString(), Chunk->CompressedData.Num(), ExpectedBytes);
		return false;
	}

	return true;
}

bool UHktTerrainBakedAsset::IsCoordInBakedRegion(const FIntVector& Coord) const
{
	return Coord.X >= RegionMin.X && Coord.X <= RegionMax.X
	    && Coord.Y >= RegionMin.Y && Coord.Y <= RegionMax.Y
	    && Coord.Z >= RegionMin.Z && Coord.Z <= RegionMax.Z;
}
