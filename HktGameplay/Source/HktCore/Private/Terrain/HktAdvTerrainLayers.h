// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktAdvTerrainTypes.h"

class FHktTerrainNoiseFloat;

// ============================================================================
// Layer 0: 결정론적 시드 파생
// ============================================================================

struct FHktAdvTerrainSeed
{
	static FHktChunkSeed Derive(uint64 WorldSeed, int32 ChunkX, int32 ChunkZ, uint32 Epoch);
};

// ============================================================================
// Layer 1: 기후 노이즈 (4채널)
// ============================================================================

struct FHktAdvTerrainClimate
{
	static void Generate(
		int32 ChunkX, int32 ChunkZ,
		const FHktChunkSeed& Seed,
		FHktClimateField& OutClimate);
};

// ============================================================================
// Layer 1.5: 대륙 템플릿
// ============================================================================

struct FHktAdvTerrainTectonic
{
	static void Generate(
		int32 ChunkX, int32 ChunkZ,
		uint64 WorldSeed,
		const FHktChunkSeed& Seed,
		FHktTectonicMask& OutMask);

	static EHktContinentType ClassifyCell(int32 CellX, int32 CellZ, uint64 WorldSeed);

	static constexpr int32 CELL_SIZE = 4096;
};

// ============================================================================
// Layer 2: 바이옴 분류
// ============================================================================

struct FHktAdvTerrainBiome
{
	static void Classify(
		const FHktClimateField& Climate,
		const FHktChunkSeed& Seed,
		FHktAdvBiomeMap& OutBiomes);

	static EHktAdvBiome Decide(float Elev, float Moist, float Temp);
};

// ============================================================================
// Layer 2.5: 이상 바이옴 ��버레이
// ============================================================================

struct FHktAdvTerrainExoticBiome
{
	static void Apply(
		FHktAdvBiomeMap& InOutBiomes,
		const FHktClimateField& Climate,
		const FHktChunkSeed& Seed,
		int32 ChunkX, int32 ChunkZ);

	static EHktAdvBiome SelectExoticBiome(
		EHktAdvBiome Original, float Exoticness, float Elev, float Moist, float Temp, uint64 LocalSeed);
};

// ============================================================================
// 바이옴 재질 규칙 테이블
// ============================================================================

namespace HktAdvBiomeMaterial
{
	const FHktAdvBiomeMaterialRule& GetRule(EHktAdvBiome Biome);
}
