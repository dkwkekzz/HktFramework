// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainNoise.h"

using Fixed = FHktFixed32;

// ============================================================================
// 고정소수점 상수 (컴파일 시 double→Fixed 변환, 런타임에는 정수만 사용)
// ============================================================================

// Simplex constants
// F2 = (sqrt(3)-1)/2 ≈ 0.36602540378
// G2 = (3-sqrt(3))/6 ≈ 0.21132486540
// F3 = 1/3 ≈ 0.33333333333
// G3 = 1/6 ≈ 0.16666666667
const Fixed FHktTerrainNoise::F2 = Fixed::FromRaw(23982);   // 0.36602540378 * 65536
const Fixed FHktTerrainNoise::G2 = Fixed::FromRaw(13846);   // 0.21132486540 * 65536
const Fixed FHktTerrainNoise::F3 = Fixed::FromRaw(21845);   // 0.33333333333 * 65536
const Fixed FHktTerrainNoise::G3 = Fixed::FromRaw(10923);   // 0.16666666667 * 65536

const Fixed FHktTerrainNoise::Scale2D = Fixed::FromRaw(70 * 65536);
const Fixed FHktTerrainNoise::Scale3D = Fixed::FromRaw(32 * 65536);
const Fixed FHktTerrainNoise::DefaultLacunarity = Fixed::FromRaw(2 * 65536);
const Fixed FHktTerrainNoise::DefaultPersistence = Fixed::FromRaw(32768);  // 0.5

// ============================================================================
// Gradient Vectors (고정소수점)
// ============================================================================

// 1/sqrt(2) ≈ 0.7071067811865476 → Raw = 46341
static constexpr int32 SQRT2_INV_RAW = 46341;

const Fixed FHktTerrainNoise::Grad2[12][2] = {
	{ Fixed::FromRaw( 65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw(-65536) },
	{ Fixed::FromRaw( SQRT2_INV_RAW), Fixed::FromRaw( SQRT2_INV_RAW) },
	{ Fixed::FromRaw(-SQRT2_INV_RAW), Fixed::FromRaw( SQRT2_INV_RAW) },
	{ Fixed::FromRaw( SQRT2_INV_RAW), Fixed::FromRaw(-SQRT2_INV_RAW) },
	{ Fixed::FromRaw(-SQRT2_INV_RAW), Fixed::FromRaw(-SQRT2_INV_RAW) },
	{ Fixed::FromRaw( 65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw(-65536) },
};

const Fixed FHktTerrainNoise::Grad3[12][3] = {
	{ Fixed::FromRaw( 65536), Fixed::FromRaw( 65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw( 65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw( 65536), Fixed::FromRaw(-65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw(-65536), Fixed::FromRaw(     0) },
	{ Fixed::FromRaw( 65536), Fixed::FromRaw(     0), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw(     0), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw( 65536), Fixed::FromRaw(     0), Fixed::FromRaw(-65536) },
	{ Fixed::FromRaw(-65536), Fixed::FromRaw(     0), Fixed::FromRaw(-65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw( 65536), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw(-65536), Fixed::FromRaw( 65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw( 65536), Fixed::FromRaw(-65536) },
	{ Fixed::FromRaw(     0), Fixed::FromRaw(-65536), Fixed::FromRaw(-65536) },
};

// ============================================================================
// Construction
// ============================================================================

FHktTerrainNoise::FHktTerrainNoise(int64 Seed)
{
	BuildPermTable(Seed);
}

void FHktTerrainNoise::SetSeed(int64 NewSeed)
{
	BuildPermTable(NewSeed);
}

void FHktTerrainNoise::BuildPermTable(int64 Seed)
{
	// Fisher-Yates shuffle with LCG
	uint8 Source[256];
	for (int32 i = 0; i < 256; ++i)
	{
		Source[i] = static_cast<uint8>(i);
	}

	// LCG parameters (Knuth)
	uint64 State = static_cast<uint64>(Seed) * 6364136223846793005ULL + 1442695040888963407ULL;

	for (int32 i = 255; i > 0; --i)
	{
		State = State * 6364136223846793005ULL + 1442695040888963407ULL;
		int32 j = static_cast<int32>((State >> 33) % (i + 1));
		uint8 Tmp = Source[i];
		Source[i] = Source[j];
		Source[j] = Tmp;
	}

	for (int32 i = 0; i < 256; ++i)
	{
		Perm[i] = Source[i];
		Perm[i + 256] = Source[i];
		Perm12[i] = static_cast<int8>(Perm[i] % 12);
		Perm12[i + 256] = Perm12[i];
	}
}

// ============================================================================
// 2D Simplex Noise
// ============================================================================

Fixed FHktTerrainNoise::Noise2D(Fixed X, Fixed Y) const
{
	// Skew input space
	Fixed S = (X + Y) * F2;
	int32 I = Fixed::FastFloor(X + S);
	int32 J = Fixed::FastFloor(Y + S);

	Fixed T = Fixed::FromInt(I + J) * G2;
	Fixed X0 = X - (Fixed::FromInt(I) - T);
	Fixed Y0 = Y - (Fixed::FromInt(J) - T);

	// Simplex 삼각형 결정
	int32 I1, J1;
	if (X0 > Y0) { I1 = 1; J1 = 0; }
	else          { I1 = 0; J1 = 1; }

	Fixed X1 = X0 - Fixed::FromInt(I1) + G2;
	Fixed Y1 = Y0 - Fixed::FromInt(J1) + G2;
	Fixed X2 = X0 - Fixed::One() + G2 + G2;
	Fixed Y2 = Y0 - Fixed::One() + G2 + G2;

	int32 II = I & 255;
	int32 JJ = J & 255;

	// 3개 코너 기여도 계산
	Fixed N0 = Fixed::Zero(), N1 = Fixed::Zero(), N2 = Fixed::Zero();

	Fixed T0 = Fixed::Half() - X0 * X0 - Y0 * Y0;
	if (T0 >= Fixed::Zero())
	{
		int32 Gi0 = Perm12[II + Perm[JJ]];
		T0 = T0 * T0;
		N0 = T0 * T0 * (Grad2[Gi0][0] * X0 + Grad2[Gi0][1] * Y0);
	}

	Fixed T1 = Fixed::Half() - X1 * X1 - Y1 * Y1;
	if (T1 >= Fixed::Zero())
	{
		int32 Gi1 = Perm12[II + I1 + Perm[JJ + J1]];
		T1 = T1 * T1;
		N1 = T1 * T1 * (Grad2[Gi1][0] * X1 + Grad2[Gi1][1] * Y1);
	}

	Fixed T2 = Fixed::Half() - X2 * X2 - Y2 * Y2;
	if (T2 >= Fixed::Zero())
	{
		int32 Gi2 = Perm12[II + 1 + Perm[JJ + 1]];
		T2 = T2 * T2;
		N2 = T2 * T2 * (Grad2[Gi2][0] * X2 + Grad2[Gi2][1] * Y2);
	}

	// [-1, 1] 범위로 스케일
	return Scale2D * (N0 + N1 + N2);
}

// ============================================================================
// 3D Simplex Noise
// ============================================================================

Fixed FHktTerrainNoise::Noise3D(Fixed X, Fixed Y, Fixed Z) const
{
	Fixed S = (X + Y + Z) * F3;
	int32 I = Fixed::FastFloor(X + S);
	int32 J = Fixed::FastFloor(Y + S);
	int32 K = Fixed::FastFloor(Z + S);

	Fixed T = Fixed::FromInt(I + J + K) * G3;
	Fixed X0 = X - (Fixed::FromInt(I) - T);
	Fixed Y0 = Y - (Fixed::FromInt(J) - T);
	Fixed Z0 = Z - (Fixed::FromInt(K) - T);

	// 사면체 결정
	int32 I1, J1, K1, I2, J2, K2;
	if (X0 >= Y0)
	{
		if (Y0 >= Z0)      { I1=1; J1=0; K1=0; I2=1; J2=1; K2=0; }
		else if (X0 >= Z0) { I1=1; J1=0; K1=0; I2=1; J2=0; K2=1; }
		else               { I1=0; J1=0; K1=1; I2=1; J2=0; K2=1; }
	}
	else
	{
		if (Y0 < Z0)       { I1=0; J1=0; K1=1; I2=0; J2=1; K2=1; }
		else if (X0 < Z0)  { I1=0; J1=1; K1=0; I2=0; J2=1; K2=1; }
		else               { I1=0; J1=1; K1=0; I2=1; J2=1; K2=0; }
	}

	Fixed X1 = X0 - Fixed::FromInt(I1) + G3;
	Fixed Y1 = Y0 - Fixed::FromInt(J1) + G3;
	Fixed Z1 = Z0 - Fixed::FromInt(K1) + G3;
	Fixed X2 = X0 - Fixed::FromInt(I2) + G3 + G3;
	Fixed Y2 = Y0 - Fixed::FromInt(J2) + G3 + G3;
	Fixed Z2 = Z0 - Fixed::FromInt(K2) + G3 + G3;
	Fixed X3 = X0 - Fixed::One() + G3 + G3 + G3;
	Fixed Y3 = Y0 - Fixed::One() + G3 + G3 + G3;
	Fixed Z3 = Z0 - Fixed::One() + G3 + G3 + G3;

	int32 II = I & 255;
	int32 JJ = J & 255;
	int32 KK = K & 255;

	// 0.6 = 39322 raw
	const Fixed PointSix = Fixed::FromRaw(39322);

	Fixed N0 = Fixed::Zero(), N1 = Fixed::Zero(), N2 = Fixed::Zero(), N3 = Fixed::Zero();

	Fixed T0 = PointSix - X0*X0 - Y0*Y0 - Z0*Z0;
	if (T0 >= Fixed::Zero())
	{
		int32 Gi = Perm12[II + Perm[JJ + Perm[KK]]];
		T0 = T0 * T0;
		N0 = T0 * T0 * (Grad3[Gi][0]*X0 + Grad3[Gi][1]*Y0 + Grad3[Gi][2]*Z0);
	}

	Fixed T1 = PointSix - X1*X1 - Y1*Y1 - Z1*Z1;
	if (T1 >= Fixed::Zero())
	{
		int32 Gi = Perm12[II+I1 + Perm[JJ+J1 + Perm[KK+K1]]];
		T1 = T1 * T1;
		N1 = T1 * T1 * (Grad3[Gi][0]*X1 + Grad3[Gi][1]*Y1 + Grad3[Gi][2]*Z1);
	}

	Fixed T2 = PointSix - X2*X2 - Y2*Y2 - Z2*Z2;
	if (T2 >= Fixed::Zero())
	{
		int32 Gi = Perm12[II+I2 + Perm[JJ+J2 + Perm[KK+K2]]];
		T2 = T2 * T2;
		N2 = T2 * T2 * (Grad3[Gi][0]*X2 + Grad3[Gi][1]*Y2 + Grad3[Gi][2]*Z2);
	}

	Fixed T3 = PointSix - X3*X3 - Y3*Y3 - Z3*Z3;
	if (T3 >= Fixed::Zero())
	{
		int32 Gi = Perm12[II+1 + Perm[JJ+1 + Perm[KK+1]]];
		T3 = T3 * T3;
		N3 = T3 * T3 * (Grad3[Gi][0]*X3 + Grad3[Gi][1]*Y3 + Grad3[Gi][2]*Z3);
	}

	return Scale3D * (N0 + N1 + N2 + N3);
}

// ============================================================================
// Fractal Brownian Motion
// ============================================================================

Fixed FHktTerrainNoise::FBM2D(Fixed X, Fixed Y, int32 Octaves) const
{
	return FBM2D(X, Y, Octaves, DefaultLacunarity, DefaultPersistence);
}

Fixed FHktTerrainNoise::FBM2D(Fixed X, Fixed Y, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const
{
	if (Octaves < 1) Octaves = 1;
	if (Octaves > 8) Octaves = 8;

	Fixed Sum = Fixed::Zero();
	Fixed Amplitude = Fixed::One();
	Fixed Frequency = Fixed::One();
	Fixed MaxAmplitude = Fixed::Zero();

	for (int32 i = 0; i < Octaves; ++i)
	{
		Sum += Noise2D(X * Frequency, Y * Frequency) * Amplitude;
		MaxAmplitude += Amplitude;
		Amplitude *= Persistence;
		Frequency *= Lacunarity;
	}

	return Sum / MaxAmplitude;
}

Fixed FHktTerrainNoise::FBM3D(Fixed X, Fixed Y, Fixed Z, int32 Octaves) const
{
	return FBM3D(X, Y, Z, Octaves, DefaultLacunarity, DefaultPersistence);
}

Fixed FHktTerrainNoise::FBM3D(Fixed X, Fixed Y, Fixed Z, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const
{
	if (Octaves < 1) Octaves = 1;
	if (Octaves > 8) Octaves = 8;

	Fixed Sum = Fixed::Zero();
	Fixed Amplitude = Fixed::One();
	Fixed Frequency = Fixed::One();
	Fixed MaxAmplitude = Fixed::Zero();

	for (int32 i = 0; i < Octaves; ++i)
	{
		Sum += Noise3D(X * Frequency, Y * Frequency, Z * Frequency) * Amplitude;
		MaxAmplitude += Amplitude;
		Amplitude *= Persistence;
		Frequency *= Lacunarity;
	}

	return Sum / MaxAmplitude;
}

Fixed FHktTerrainNoise::RidgedMulti2D(Fixed X, Fixed Y, int32 Octaves) const
{
	return RidgedMulti2D(X, Y, Octaves, DefaultLacunarity, DefaultPersistence);
}

Fixed FHktTerrainNoise::RidgedMulti2D(Fixed X, Fixed Y, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const
{
	if (Octaves < 1) Octaves = 1;
	if (Octaves > 8) Octaves = 8;

	Fixed Sum = Fixed::Zero();
	Fixed Amplitude = Fixed::One();
	Fixed Frequency = Fixed::One();
	Fixed Weight = Fixed::One();
	Fixed MaxAmplitude = Fixed::Zero();

	for (int32 i = 0; i < Octaves; ++i)
	{
		Fixed Signal = Noise2D(X * Frequency, Y * Frequency);
		Signal = Fixed::One() - Signal.Abs();  // abs → 반전
		Signal = Signal * Signal;
		Signal = Signal * Weight;
		Weight = Signal * Fixed::Two();
		Weight = Fixed::Clamp(Weight, Fixed::Zero(), Fixed::One());

		Sum += Signal * Amplitude;
		MaxAmplitude += Amplitude;
		Amplitude *= Persistence;
		Frequency *= Lacunarity;
	}

	return Sum / MaxAmplitude;
}
