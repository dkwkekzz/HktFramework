// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktTerrainNoiseFloat
 *
 * float 기반 그래디언트 노이즈. 고급 지형 생성기용.
 * 결정론적 — 동일 시드+좌표 = 동일 결과 (동일 바이너리 전제).
 *
 * 기능: Noise2D/3D, FBm, DomainWarp, VoronoiDistance
 */
class FHktTerrainNoiseFloat
{
public:
	explicit FHktTerrainNoiseFloat(uint64 Seed = 0);

	void SetSeed(uint64 NewSeed);

	float Noise2D(float X, float Y) const;
	float Noise3D(float X, float Y, float Z) const;

	float FBm2D(float X, float Y, int32 Octaves, float Lacunarity = 2.f, float Persistence = 0.5f) const;
	float FBm3D(float X, float Y, float Z, int32 Octaves, float Lacunarity = 2.f, float Persistence = 0.5f) const;

	void DomainWarp2D(float& X, float& Y, float Strength) const;

	float VoronoiDistance(float X, float Y, float CellSize) const;

	static float Remap(float V, float InMin, float InMax, float OutMin, float OutMax);

private:
	uint8 Perm[512];

	void BuildPermTable(uint64 Seed);

	float Grad2(int32 Hash, float X, float Y) const;
	float Grad3(int32 Hash, float X, float Y, float Z) const;

	static float HashToFloat01(uint64 H);
};

// ============================================================================
// SplitMix64 — 시드 파생용 고품질 해시
// ============================================================================

namespace HktTerrainHash
{
	inline uint64 SplitMix64(uint64 X)
	{
		X += 0x9E3779B97F4A7C15ULL;
		X = (X ^ (X >> 30)) * 0xBF58476D1CE4E5B9ULL;
		X = (X ^ (X >> 27)) * 0x94D049BB133111EBULL;
		return X ^ (X >> 31);
	}

	inline uint32 Hash2D(int32 X, int32 Z)
	{
		return static_cast<uint32>((static_cast<uint64>(X) * 73856093ULL) ^ (static_cast<uint64>(Z) * 19349663ULL));
	}

	inline float SplitMix64ToFloat(uint64 H)
	{
		return static_cast<float>(HktTerrainHash::SplitMix64(H) & 0xFFFFFFFF) / 4294967295.f;
	}
}
