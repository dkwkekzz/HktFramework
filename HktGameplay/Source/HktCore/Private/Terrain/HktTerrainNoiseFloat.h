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
// HktDetMath — 크로스 플랫폼 결정론적 수학 함수
// IEEE 754 기본 연산(+,-,*,/)만 사용하여 플랫폼 간 동일 결과 보장.
// FMath::Exp/Pow/Sin/Cos/SmoothStep 등 초월함수 대체.
// ============================================================================

namespace HktDetMath
{
	// x² — FMath::Pow(x,2.f) 대체
	inline float Sq(float X) { return X * X; }

	// x⁸ — FMath::Pow(x,8.f) 대체 (반복 제곱, 3회 곱셈)
	inline float Pow8(float X)
	{
		const float X2 = X * X;
		const float X4 = X2 * X2;
		return X4 * X4;
	}

	// e^(-X), X >= 0 — FMath::Exp 대체
	// Padé[3,3] 근사 + /4 범위 축소: 최대 상대 오차 < 1%
	inline float ExpNeg(float X)
	{
		if (X <= 0.f) return 1.f;
		if (X >= 16.f) return 0.f;

		const float T = X * 0.25f;
		const float T2 = T * T;
		const float T3 = T2 * T;
		const float Num = 120.f - 60.f * T + 12.f * T2 - T3;
		const float Den = 120.f + 60.f * T + 12.f * T2 + T3;
		float R = Num / Den;
		R *= R;
		R *= R;
		return R;
	}

	// e^(-X²) — 가우시안 감쇠
	inline float GaussianFalloff(float X)
	{
		return ExpNeg(X * X);
	}

	// sin(X) — 7차 Taylor + [-π/2,π/2] 범위 축소
	inline float Sin(float X)
	{
		constexpr float PI = 3.14159265358979323846f;
		constexpr float HALF_PI = PI * 0.5f;
		constexpr float TWO_PI = PI * 2.f;
		constexpr float INV_TWO_PI = 1.f / TWO_PI;

		X -= TWO_PI * FMath::FloorToFloat(X * INV_TWO_PI + 0.5f);

		if (X > HALF_PI) X = PI - X;
		else if (X < -HALF_PI) X = -PI - X;

		const float X2 = X * X;
		return X * (1.f - X2 * (1.f / 6.f - X2 * (1.f / 120.f - X2 * (1.f / 5040.f))));
	}

	// cos(X) = sin(X + π/2)
	inline float Cos(float X)
	{
		constexpr float HALF_PI = 3.14159265358979323846f * 0.5f;
		return Sin(X + HALF_PI);
	}

	// smoothstep — 명시적 3차 다항식 (t²(3-2t))
	inline float SmoothStep(float Edge0, float Edge1, float X)
	{
		float T = FMath::Clamp((X - Edge0) / (Edge1 - Edge0), 0.f, 1.f);
		return T * T * (3.f - 2.f * T);
	}
}

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
