// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktAdvTerrainTypes.h"
#include "Terrain/HktTerrainVoxel.h"

// ============================================================================
// Layer 3: 하이트맵 + 컬럼 채우기
// ============================================================================

struct FHktAdvTerrainFill
{
	static constexpr int32 ChunkSize = 32;
	static constexpr int32 SeaLevel = 60;
	static constexpr int32 MaxHeight = 200;
	static constexpr int32 BaseHeight = 20;

	static void Fill(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		FHktTerrainVoxel* OutVoxels);

	static int32 ComputeHeight(float Elevation, EHktAdvBiome Biome);
};

// ============================================================================
// Layer 4: 랜드마크 주입
// ============================================================================

struct FHktAdvTerrainLandmark
{
	static void Apply(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);

private:
	static void ApplyLandmarks(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		const FHktChunkSeed& Seed,
		const FHktClimateField& Climate,
		FHktTerrainVoxel* InOutVoxels);

	static void ApplyRivers(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);

	static void CarveSphericalHole(
		int32 CenterX, int32 CenterY, int32 CenterZ,
		int32 Radius, int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		FHktTerrainVoxel* Voxels);

	static void StampCylinder(
		int32 CenterX, int32 CenterY, int32 BaseZ,
		int32 Radius, int32 Height, uint16 TypeID, uint8 Palette,
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		FHktTerrainVoxel* Voxels);
};

// ============================================================================
// Layer 5: 데코레이션
// ============================================================================

struct FHktAdvTerrainDecoration
{
	static void Apply(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);

private:
	static void ApplySubsurface(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);

	static void ApplySurfaceScatter(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktAdvBiomeMap& Biomes,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);
};
