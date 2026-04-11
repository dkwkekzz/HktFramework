// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Terrain/HktTerrainNoise.h"
#include "Terrain/HktTerrainBiome.h"

/**
 * FHktTerrainGeneratorConfig
 *
 * 지형 생성 파라미터. 시드 + 지형 형태 + 수면 높이 등을 정의한다.
 * 모든 연속 값은 FHktFixed32 (Q16.16) — 결정론 보장.
 */
struct HKTCORE_API FHktTerrainGeneratorConfig
{
	using Fixed = FHktFixed32;

	int64 Seed = 42;

	// 지형 형태
	Fixed HeightScale     = Fixed::FromRaw(64 * 65536);    // 64.0
	Fixed HeightOffset    = Fixed::FromRaw(32 * 65536);    // 32.0
	Fixed TerrainFreq     = Fixed::FromRaw(524);           // 0.008 * 65536 ≈ 524
	int32 TerrainOctaves  = 6;
	Fixed Lacunarity      = Fixed::FromRaw(2 * 65536);     // 2.0
	Fixed Persistence     = Fixed::FromRaw(32768);          // 0.5

	// 산악
	Fixed MountainFreq    = Fixed::FromRaw(262);           // 0.004 * 65536 ≈ 262
	Fixed MountainBlend   = Fixed::FromRaw(26214);         // 0.4 * 65536 ≈ 26214

	// 수면
	Fixed WaterLevel      = Fixed::FromRaw(30 * 65536);    // 30.0

	// 동굴
	bool  bEnableCaves    = true;
	Fixed CaveFreq        = Fixed::FromRaw(1966);          // 0.03 * 65536 ≈ 1966
	Fixed CaveThreshold   = Fixed::FromRaw(39322);         // 0.6 * 65536 ≈ 39322

	// 바이옴
	Fixed BiomeNoiseScale = Fixed::FromRaw(131);           // 0.002 * 65536 ≈ 131
	Fixed MountainBiomeThreshold = Fixed::FromRaw(80 * 65536); // 80.0

	// 복셀 크기 (cm 단위). HktVoxelCore / HktCore / 디버그 렌더러 등
	// 프레임워크 전체가 이 값을 단일 출처로 사용한다.
	float VoxelSizeCm = 15.0f;

	// 청크 크기 (HktVoxelCore와 동일)
	static constexpr int32 ChunkSize = 32;
};

/**
 * FHktTerrainGenerator
 *
 * 시드 기반 결정론적 지형 생성기.
 * 청크 좌표를 입력하면 32×32×32 FHktVoxel 배열을 채운다.
 *
 * 순수 C++ — VM(HktCore)에서 실행 가능.
 * 모든 연산은 FHktFixed32 고정소수점 → cross-platform 결정론 보장.
 *
 * 생성 파이프라인:
 *   1. 하이트맵: FBM + RidgedMulti 혼합 → 표면 높이 결정
 *   2. 바이옴: 온도+습도 노이즈 → 바이옴 타입 결정
 *   3. 재질: 바이옴 규칙 + 높이/깊이 → TypeID 배정
 *   4. 동굴: 3D 노이즈로 내부 공간 카빙
 *   5. 수면: WaterLevel 아래 빈 공간을 Water로 채움
 */
class HKTCORE_API FHktTerrainGenerator
{
public:
	using Fixed = FHktFixed32;

	explicit FHktTerrainGenerator(const FHktTerrainGeneratorConfig& Config);

	/**
	 * 단일 청크의 복셀 데이터를 생성한다.
	 * @param ChunkX, ChunkY, ChunkZ  청크 좌표
	 * @param OutVoxels  32×32×32 = 32768개 복셀 배열 (호출자가 할당)
	 *                   인덱스 = X + Y*32 + Z*32*32
	 */
	void GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ, FHktTerrainVoxel* OutVoxels) const;

	/**
	 * 특정 월드 좌표의 표면 높이를 반환한다.
	 * @param WorldX, WorldY  월드 복셀 좌표 (고정소수점)
	 * @return  표면 높이 (고정소수점, 복셀 단위)
	 */
	Fixed GetSurfaceHeight(Fixed WorldX, Fixed WorldY) const;

	/** 설정 변경 (노이즈 재생성) */
	void Reconfigure(const FHktTerrainGeneratorConfig& NewConfig);

	const FHktTerrainGeneratorConfig& GetConfig() const { return Config; }

private:
	FHktTerrainGeneratorConfig Config;

	// 노이즈 인스턴스 (각각 다른 시드)
	FHktTerrainNoise HeightNoise;     // 하이트맵
	FHktTerrainNoise MountainNoise;   // 산악 리지
	FHktTerrainNoise CaveNoise;       // 동굴
	FHktTerrainNoise TempNoise;       // 바이옴 온도
	FHktTerrainNoise HumNoise;        // 바이옴 습도

	// 바이옴 맵
	FHktTerrainBiomeMap BiomeMap;

	/** 높이 기반 재질 결정 */
	FHktTerrainVoxel DetermineVoxel(
		Fixed WorldX, Fixed WorldY, Fixed WorldZ,
		Fixed SurfaceHeight, EHktBiomeType Biome,
		const FHktBiomeMaterialRule& Rule) const;

	/** 동굴 여부 판정 */
	bool IsCave(Fixed WorldX, Fixed WorldY, Fixed WorldZ, Fixed SurfaceHeight) const;
};
