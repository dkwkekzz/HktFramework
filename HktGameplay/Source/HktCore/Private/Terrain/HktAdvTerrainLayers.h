// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktAdvTerrainTypes.h"

class FHktTerrainNoiseFloat;

// ============================================================================
// 노이즈 채널 태그 — WorldSeed 기반 시드를 채널별로 분리한다.
// 청크 경계를 넘어 매끄러워야 하는 필드(Elevation/Moisture/Temp 등)는
// 이 태그로 만든 시드를 사용해 노이즈 함수 자체가 전 월드에서 단일하도록
// 보장한다. 청크 내부 랜덤 결정(랜드마크 선택, 광석 위치 등)은
// FHktChunkSeed의 청크별 시드를 그대로 사용해도 시각적 문제가 없다.
// ============================================================================

namespace HktAdvNoiseTag
{
	constexpr uint64 ClimateContinental = 0xC0117117C0117117ULL;
	constexpr uint64 ClimateMountain    = 0xA001A001A001A001ULL;
	constexpr uint64 ClimateDetail      = 0xD05E7AD05E7AULL;
	constexpr uint64 ClimateDomainWarp  = 0xD06D06D06D06D06DULL;
	constexpr uint64 ClimateMoisture    = 0xB002B002B002B002ULL;
	constexpr uint64 ClimateTemp        = 0x7003700370037003ULL;
	constexpr uint64 ClimateExotic      = 0xE004E004E004E004ULL;
	constexpr uint64 ClimateExoticWarpX = 0xE005E005E005E005ULL;
	constexpr uint64 ClimateExoticWarpZ = 0xE006E006E006E006ULL;
	constexpr uint64 BiomeJitter        = 0xB10E7E04B10E7E04ULL;
	constexpr uint64 TectonicCell       = 0x7EC707EC707EC70ULL;
	constexpr uint64 RiverFeature       = 0x21CE21CE21CE21CEULL;
}

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
		uint64 WorldSeed,
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
		int32 ChunkX, int32 ChunkZ,
		uint64 WorldSeed,
		const FHktClimateField& Climate,
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
