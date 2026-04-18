// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktAdvTerrainTypes.h"
#include "Terrain/HktTerrainVoxel.h"

// ============================================================================
// Layer 3: 하이트맵 + 컬럼 채우기
// ============================================================================

// 월드 수직 높이 파라미터 — FHktTerrainGeneratorConfig에서 주입되어
// 레거시/고급 경로가 동일한 HeightScale/Offset/WaterLevel을 공유한다.
struct FHktAdvTerrainHeightParams
{
	int32 MaxHeight;   // = HeightScale (voxel). elevation ∈ [0,1] 의 곱 계수
	int32 BaseHeight;  // = HeightOffset (voxel). 기본 지면 오프셋
	int32 SeaLevel;    // = WaterLevel  (voxel). 수면 높이
};

struct FHktAdvTerrainFill
{
	static constexpr int32 ChunkSize = 32;

	static void Fill(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		const FHktAdvTerrainHeightParams& Params,
		FHktTerrainVoxel* OutVoxels);

	static int32 ComputeHeight(float Elevation, EHktAdvBiome Biome, const FHktAdvTerrainHeightParams& Params);
};

// ============================================================================
// Layer 4: 랜드마크 주입
// ============================================================================

struct FHktAdvTerrainLandmark
{
	static void Apply(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		uint64 WorldSeed,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		const FHktChunkSeed& Seed,
		const FHktAdvTerrainHeightParams& Params,
		FHktTerrainVoxel* InOutVoxels);

private:
	static void ApplyLandmarks(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktAdvBiomeMap& Biomes,
		const FHktTectonicMask& Tectonic,
		const FHktChunkSeed& Seed,
		const FHktClimateField& Climate,
		const FHktAdvTerrainHeightParams& Params,
		FHktTerrainVoxel* InOutVoxels);

	static void ApplyRivers(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		uint64 WorldSeed,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktChunkSeed& Seed,
		const FHktAdvTerrainHeightParams& Params,
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
	// 기본 Apply — 두 단계 모두 실행 (하위 호환)
	static void Apply(
		int32 ChunkX, int32 ChunkY, int32 ChunkZ,
		const FHktClimateField& Climate,
		const FHktAdvBiomeMap& Biomes,
		const FHktChunkSeed& Seed,
		FHktTerrainVoxel* InOutVoxels);

	// 개별 단계 — 외부에서 플래그로 선택 실행
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
