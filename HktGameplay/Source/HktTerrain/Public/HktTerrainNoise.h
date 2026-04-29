// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktFixed32.h"

/**
 * FHktTerrainNoise
 *
 * OpenSimplex2 기반 노이즈 생성기 (순수 C++, UE5 의존 없음).
 * 결정론적 — 동일 시드 + 좌표 = 동일 결과.
 *
 * 모든 연산은 FHktFixed32 (Q16.16 고정소수점)로 수행.
 * 부동소수점 미사용 → cross-platform 결정론 보장.
 *
 * 용도:
 *   - 하이트맵 생성 (2D)
 *   - 바이옴 온도/습도 맵 (2D)
 *   - 동굴 카빙 (3D)
 *   - 광물 분포 (3D)
 */
class HKTTERRAIN_API FHktTerrainNoise
{
public:
	using Fixed = FHktFixed32;

	explicit FHktTerrainNoise(int64 Seed = 0);

	/** 시드 변경 (내부 순열 테이블 재생성) */
	void SetSeed(int64 NewSeed);

	/** 2D Simplex Noise — 범위 [-1, 1] */
	Fixed Noise2D(Fixed X, Fixed Y) const;

	/** 3D Simplex Noise — 범위 [-1, 1] */
	Fixed Noise3D(Fixed X, Fixed Y, Fixed Z) const;

	/**
	 * 프랙탈 브라우니안 모션 (FBM) — 옥타브 중첩
	 * @param X, Y          좌표
	 * @param Octaves       옥타브 수 (1~8)
	 * @param Lacunarity    주파수 배율 (기본 2.0)
	 * @param Persistence   진폭 감쇠 (기본 0.5)
	 * @return              범위 대략 [-1, 1]
	 */
	Fixed FBM2D(Fixed X, Fixed Y, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const;
	Fixed FBM2D(Fixed X, Fixed Y, int32 Octaves) const;

	/** 3D FBM */
	Fixed FBM3D(Fixed X, Fixed Y, Fixed Z, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const;
	Fixed FBM3D(Fixed X, Fixed Y, Fixed Z, int32 Octaves) const;

	/**
	 * 리지드 멀티프랙탈 — 산악 지형에 적합한 뾰족한 능선
	 * @return  범위 [0, 1]
	 */
	Fixed RidgedMulti2D(Fixed X, Fixed Y, int32 Octaves, Fixed Lacunarity, Fixed Persistence) const;
	Fixed RidgedMulti2D(Fixed X, Fixed Y, int32 Octaves) const;

private:
	/** 순열 테이블 (512개 — 256개 × 2배 래핑) */
	uint8 Perm[512];
	int8 Perm12[512];

	void BuildPermTable(int64 Seed);

	// Simplex 기울기 벡터 (고정소수점)
	static const Fixed Grad2[12][2];
	static const Fixed Grad3[12][3];

	// Simplex 상수 (고정소수점, 컴파일 시 계산)
	static const Fixed F2;  // (sqrt(3)-1)/2
	static const Fixed G2;  // (3-sqrt(3))/6
	static const Fixed F3;  // 1/3
	static const Fixed G3;  // 1/6

	// 스케일 상수
	static const Fixed Scale2D;  // 70.0 (2D 출력 스케일)
	static const Fixed Scale3D;  // 32.0 (3D 출력 스케일)

	// 기본 파라미터
	static const Fixed DefaultLacunarity;  // 2.0
	static const Fixed DefaultPersistence; // 0.5
};
