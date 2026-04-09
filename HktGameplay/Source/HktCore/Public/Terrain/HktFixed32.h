// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktFixed32 — Q16.16 고정소수점 타입
 *
 * 결정론적 시뮬레이션을 위한 플랫폼 독립 산술 타입.
 * 부동소수점(float/double) 대신 사용하여 cross-platform 동일 결과를 보장한다.
 *
 * 포맷: 부호 1비트 + 정수 15비트 + 소수 16비트
 * 범위: [-32768.0, 32767.99998]
 * 정밀도: 1/65536 ≈ 0.0000153
 *
 * 곱셈/나눗셈은 int64 중간값을 사용하여 오버플로를 방지한다.
 */
struct HKTCORE_API FHktFixed32
{
	int32 Raw;

	static constexpr int32 FRAC_BITS = 16;
	static constexpr int32 ONE_RAW   = 1 << FRAC_BITS;        // 65536
	static constexpr int32 HALF_RAW  = 1 << (FRAC_BITS - 1);  // 32768

	// ======================================================================
	// 생성
	// ======================================================================

	FHktFixed32() : Raw(0) {}

	static FHktFixed32 FromRaw(int32 InRaw)
	{
		FHktFixed32 F;
		F.Raw = InRaw;
		return F;
	}

	static FHktFixed32 FromInt(int32 V)
	{
		FHktFixed32 F;
		F.Raw = V << FRAC_BITS;
		return F;
	}

	/**
	 * double에서 변환 — 설정(Config) 초기화 전용.
	 * 시뮬레이션 런타임에서는 사용 금지.
	 */
	static FHktFixed32 FromDouble(double V)
	{
		FHktFixed32 F;
		F.Raw = static_cast<int32>(V * ONE_RAW + (V >= 0.0 ? 0.5 : -0.5));
		return F;
	}

	int32 ToInt() const
	{
		// 0 방향으로 절삭 (truncate toward zero)
		if (Raw >= 0) return Raw >> FRAC_BITS;
		return -((-Raw) >> FRAC_BITS);
	}

	int32 FloorToInt() const
	{
		// 음수 방향으로 내림 (floor)
		return Raw >> FRAC_BITS;  // 산술 시프트: 음수에서 자동 floor
	}

	double ToDouble() const
	{
		return static_cast<double>(Raw) / ONE_RAW;
	}

	// ======================================================================
	// 산술 연산
	// ======================================================================

	FHktFixed32 operator+(FHktFixed32 B) const { return FromRaw(Raw + B.Raw); }
	FHktFixed32 operator-(FHktFixed32 B) const { return FromRaw(Raw - B.Raw); }
	FHktFixed32 operator-() const { return FromRaw(-Raw); }

	FHktFixed32& operator+=(FHktFixed32 B) { Raw += B.Raw; return *this; }
	FHktFixed32& operator-=(FHktFixed32 B) { Raw -= B.Raw; return *this; }

	/** 곱셈: int64 중간값으로 오버플로 방지 */
	FHktFixed32 operator*(FHktFixed32 B) const
	{
		int64 Wide = static_cast<int64>(Raw) * B.Raw;
		return FromRaw(static_cast<int32>(Wide >> FRAC_BITS));
	}

	FHktFixed32& operator*=(FHktFixed32 B)
	{
		int64 Wide = static_cast<int64>(Raw) * B.Raw;
		Raw = static_cast<int32>(Wide >> FRAC_BITS);
		return *this;
	}

	/** 나눗셈: int64 중간값으로 정밀도 유지 */
	FHktFixed32 operator/(FHktFixed32 B) const
	{
		int64 Wide = static_cast<int64>(Raw) << FRAC_BITS;
		return FromRaw(static_cast<int32>(Wide / B.Raw));
	}

	FHktFixed32& operator/=(FHktFixed32 B)
	{
		int64 Wide = static_cast<int64>(Raw) << FRAC_BITS;
		Raw = static_cast<int32>(Wide / B.Raw);
		return *this;
	}

	// ======================================================================
	// 비교
	// ======================================================================

	bool operator==(FHktFixed32 B) const { return Raw == B.Raw; }
	bool operator!=(FHktFixed32 B) const { return Raw != B.Raw; }
	bool operator< (FHktFixed32 B) const { return Raw <  B.Raw; }
	bool operator<=(FHktFixed32 B) const { return Raw <= B.Raw; }
	bool operator> (FHktFixed32 B) const { return Raw >  B.Raw; }
	bool operator>=(FHktFixed32 B) const { return Raw >= B.Raw; }

	// ======================================================================
	// 수학 유틸리티
	// ======================================================================

	FHktFixed32 Abs() const { return FromRaw(Raw >= 0 ? Raw : -Raw); }

	static FHktFixed32 Min(FHktFixed32 A, FHktFixed32 B) { return A.Raw <= B.Raw ? A : B; }
	static FHktFixed32 Max(FHktFixed32 A, FHktFixed32 B) { return A.Raw >= B.Raw ? A : B; }

	static FHktFixed32 Clamp(FHktFixed32 V, FHktFixed32 Lo, FHktFixed32 Hi)
	{
		if (V.Raw < Lo.Raw) return Lo;
		if (V.Raw > Hi.Raw) return Hi;
		return V;
	}

	/** 정수 floor (Fast floor for noise) */
	static int32 FastFloor(FHktFixed32 V)
	{
		return V.Raw >> FRAC_BITS;  // 산술 시프트 = floor
	}

	// ======================================================================
	// 자주 사용하는 상수
	// ======================================================================

	static FHktFixed32 Zero()    { return FromRaw(0); }
	static FHktFixed32 One()     { return FromRaw(ONE_RAW); }
	static FHktFixed32 Half()    { return FromRaw(HALF_RAW); }
	static FHktFixed32 Two()     { return FromRaw(2 * ONE_RAW); }
	static FHktFixed32 Three()   { return FromRaw(3 * ONE_RAW); }
	static FHktFixed32 NegOne()  { return FromRaw(-ONE_RAW); }
};

// int32 * Fixed 편의 연산 (좌표 스케일링용)
inline FHktFixed32 operator*(int32 A, FHktFixed32 B)
{
	return FHktFixed32::FromRaw(A * B.Raw);
}

inline FHktFixed32 operator*(FHktFixed32 A, int32 B)
{
	return FHktFixed32::FromRaw(A.Raw * B);
}
