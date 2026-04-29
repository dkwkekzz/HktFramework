// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainNoiseFloat.h"

// ============================================================================
// 순열 테이블 초기화
// ============================================================================

FHktTerrainNoiseFloat::FHktTerrainNoiseFloat(uint64 Seed)
{
	BuildPermTable(Seed);
}

void FHktTerrainNoiseFloat::SetSeed(uint64 NewSeed)
{
	BuildPermTable(NewSeed);
}

void FHktTerrainNoiseFloat::BuildPermTable(uint64 Seed)
{
	uint8 Base[256];
	for (int32 i = 0; i < 256; ++i)
	{
		Base[i] = static_cast<uint8>(i);
	}

	// Fisher-Yates 셔플 (SplitMix64 기반)
	uint64 S = Seed;
	for (int32 i = 255; i > 0; --i)
	{
		S = HktTerrainHash::SplitMix64(S);
		const int32 J = static_cast<int32>(S % static_cast<uint64>(i + 1));
		const uint8 Tmp = Base[i];
		Base[i] = Base[J];
		Base[J] = Tmp;
	}

	for (int32 i = 0; i < 256; ++i)
	{
		Perm[i] = Base[i];
		Perm[i + 256] = Base[i];
	}
}

// ============================================================================
// 그래디언트 함수
// ============================================================================

float FHktTerrainNoiseFloat::Grad2(int32 Hash, float X, float Y) const
{
	const int32 H = Hash & 7;
	const float U = H < 4 ? X : Y;
	const float V = H < 4 ? Y : X;
	return ((H & 1) ? -U : U) + ((H & 2) ? -2.f * V : 2.f * V);
}

float FHktTerrainNoiseFloat::Grad3(int32 Hash, float X, float Y, float Z) const
{
	const int32 H = Hash & 15;
	const float U = H < 8 ? X : Y;
	const float V = H < 4 ? Y : (H == 12 || H == 14) ? X : Z;
	return ((H & 1) ? -U : U) + ((H & 2) ? -V : V);
}

// ============================================================================
// 2D 퍼린 노이즈
// ============================================================================

float FHktTerrainNoiseFloat::Noise2D(float X, float Y) const
{
	const int32 Xi = FMath::FloorToInt(X) & 255;
	const int32 Yi = FMath::FloorToInt(Y) & 255;
	const float Xf = X - FMath::FloorToFloat(X);
	const float Yf = Y - FMath::FloorToFloat(Y);

	// Fade 커브: 6t^5 - 15t^4 + 10t^3
	const float U = Xf * Xf * Xf * (Xf * (Xf * 6.f - 15.f) + 10.f);
	const float V = Yf * Yf * Yf * (Yf * (Yf * 6.f - 15.f) + 10.f);

	const int32 AA = Perm[Perm[Xi] + Yi];
	const int32 AB = Perm[Perm[Xi] + Yi + 1];
	const int32 BA = Perm[Perm[Xi + 1] + Yi];
	const int32 BB = Perm[Perm[Xi + 1] + Yi + 1];

	const float X1 = FMath::Lerp(Grad2(AA, Xf, Yf), Grad2(BA, Xf - 1.f, Yf), U);
	const float X2 = FMath::Lerp(Grad2(AB, Xf, Yf - 1.f), Grad2(BB, Xf - 1.f, Yf - 1.f), U);

	return FMath::Lerp(X1, X2, V) * 0.5f;
}

// ============================================================================
// 3D 퍼린 노이즈
// ============================================================================

float FHktTerrainNoiseFloat::Noise3D(float X, float Y, float Z) const
{
	const int32 Xi = FMath::FloorToInt(X) & 255;
	const int32 Yi = FMath::FloorToInt(Y) & 255;
	const int32 Zi = FMath::FloorToInt(Z) & 255;
	const float Xf = X - FMath::FloorToFloat(X);
	const float Yf = Y - FMath::FloorToFloat(Y);
	const float Zf = Z - FMath::FloorToFloat(Z);

	const float U = Xf * Xf * Xf * (Xf * (Xf * 6.f - 15.f) + 10.f);
	const float V = Yf * Yf * Yf * (Yf * (Yf * 6.f - 15.f) + 10.f);
	const float W = Zf * Zf * Zf * (Zf * (Zf * 6.f - 15.f) + 10.f);

	const int32 A  = Perm[Xi] + Yi;
	const int32 AA2 = Perm[A] + Zi;
	const int32 AB2 = Perm[A + 1] + Zi;
	const int32 B  = Perm[Xi + 1] + Yi;
	const int32 BA2 = Perm[B] + Zi;
	const int32 BB2 = Perm[B + 1] + Zi;

	return FMath::Lerp(
		FMath::Lerp(
			FMath::Lerp(Grad3(Perm[AA2], Xf, Yf, Zf),       Grad3(Perm[BA2], Xf-1, Yf, Zf), U),
			FMath::Lerp(Grad3(Perm[AB2], Xf, Yf-1, Zf),     Grad3(Perm[BB2], Xf-1, Yf-1, Zf), U),
			V),
		FMath::Lerp(
			FMath::Lerp(Grad3(Perm[AA2+1], Xf, Yf, Zf-1),   Grad3(Perm[BA2+1], Xf-1, Yf, Zf-1), U),
			FMath::Lerp(Grad3(Perm[AB2+1], Xf, Yf-1, Zf-1), Grad3(Perm[BB2+1], Xf-1, Yf-1, Zf-1), U),
			V),
		W);
}

// ============================================================================
// FBm
// ============================================================================

float FHktTerrainNoiseFloat::FBm2D(float X, float Y, int32 Octaves, float Lacunarity, float Persistence) const
{
	float Sum = 0.f;
	float Amp = 1.f;
	float Freq = 1.f;
	float MaxAmp = 0.f;

	for (int32 i = 0; i < Octaves; ++i)
	{
		Sum += Noise2D(X * Freq, Y * Freq) * Amp;
		MaxAmp += Amp;
		Amp *= Persistence;
		Freq *= Lacunarity;
	}

	return Sum / MaxAmp;
}

float FHktTerrainNoiseFloat::FBm3D(float X, float Y, float Z, int32 Octaves, float Lacunarity, float Persistence) const
{
	float Sum = 0.f;
	float Amp = 1.f;
	float Freq = 1.f;
	float MaxAmp = 0.f;

	for (int32 i = 0; i < Octaves; ++i)
	{
		Sum += Noise3D(X * Freq, Y * Freq, Z * Freq) * Amp;
		MaxAmp += Amp;
		Amp *= Persistence;
		Freq *= Lacunarity;
	}

	return Sum / MaxAmp;
}

// ============================================================================
// 도메인 워핑
// ============================================================================

void FHktTerrainNoiseFloat::DomainWarp2D(float& X, float& Y, float Strength) const
{
	const float WarpX = FBm2D(X + 100.f, Y + 100.f, 2) * Strength;
	const float WarpY = FBm2D(X + 200.f, Y + 200.f, 2) * Strength;
	X += WarpX;
	Y += WarpY;
}

// ============================================================================
// Voronoi 거리 (Spire 대륙용)
// ============================================================================

float FHktTerrainNoiseFloat::VoronoiDistance(float X, float Y, float CellSize) const
{
	const float CX = X / CellSize;
	const float CY = Y / CellSize;
	const int32 ICX = FMath::FloorToInt(CX);
	const int32 ICY = FMath::FloorToInt(CY);

	float MinDist = 1e10f;

	for (int32 DX = -1; DX <= 1; ++DX)
	{
		for (int32 DY = -1; DY <= 1; ++DY)
		{
			const int32 NX = ICX + DX;
			const int32 NY = ICY + DY;
			const uint64 H = HktTerrainHash::SplitMix64(
				static_cast<uint64>(HktTerrainHash::Hash2D(NX, NY)));

			const float PointX = static_cast<float>(NX) + static_cast<float>(H & 0xFFFF) / 65535.f;
			const float PointY = static_cast<float>(NY) + static_cast<float>((H >> 16) & 0xFFFF) / 65535.f;

			const float DistX = CX - PointX;
			const float DistY = CY - PointY;
			const float Dist = DistX * DistX + DistY * DistY;
			MinDist = FMath::Min(MinDist, Dist);
		}
	}

	return FMath::Sqrt(MinDist) * CellSize;
}

// ============================================================================
// 유틸리티
// ============================================================================

float FHktTerrainNoiseFloat::Remap(float V, float InMin, float InMax, float OutMin, float OutMax)
{
	const float T = FMath::Clamp((V - InMin) / (InMax - InMin), 0.f, 1.f);
	return OutMin + T * (OutMax - OutMin);
}

float FHktTerrainNoiseFloat::HashToFloat01(uint64 H)
{
	return static_cast<float>(H & 0xFFFFFFFF) / 4294967295.f;
}
