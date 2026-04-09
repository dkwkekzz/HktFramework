// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktFixed32.h"

class FHktTerrainNoise;

/**
 * 바이옴 타입.
 * 온도/습도 2D 노이즈 조합으로 결정된다.
 */
enum class EHktBiomeType : uint8
{
	Grassland = 0,  // 온화 + 중습도
	Desert    = 1,  // 고온 + 저습도
	Tundra    = 2,  // 저온 + 저습도
	Forest    = 3,  // 온화 + 고습도
	Swamp     = 4,  // 고온 + 고습도
	Mountain  = 5,  // 높이 기반 (온도/습도 무관)
	Count
};

/**
 * 바이옴별 지형 재질 규칙.
 * 각 바이옴은 높이/경사/깊이에 따라 어떤 TypeID를 사용할지 정의한다.
 */
struct FHktBiomeMaterialRule
{
	uint16 SurfaceType;      // 표면 (Grass, Sand, Snow, ...)
	uint16 SubsurfaceType;   // 표면 아래 3블록 (Dirt, Sandstone, ...)
	uint16 DeepType;         // 깊은 곳 (Stone)
	uint16 BedrockType;      // 최하층 (Bedrock)
	uint16 WaterType;        // 수면 아래 빈 공간 (Water, Ice, ...)
	uint8  PaletteRow;       // 바이옴 팔레트 텍스처 행
};

/**
 * FHktTerrainBiomeMap
 *
 * 온도/습도 2축 노이즈로 바이옴을 결정한다.
 * 순수 C++ — VM에서 결정론적으로 실행 가능.
 * 모든 연산은 FHktFixed32 고정소수점.
 *
 * 바이옴 결정 매트릭스 (Temperature × Humidity):
 *
 *              Low Humidity    Mid Humidity    High Humidity
 *   Low Temp   Tundra          Tundra          Forest
 *   Mid Temp   Desert          Grassland       Forest
 *   High Temp  Desert          Grassland       Swamp
 *
 * 높이가 일정 이상이면 Mountain으로 오버라이드.
 */
class HKTCORE_API FHktTerrainBiomeMap
{
public:
	using Fixed = FHktFixed32;

	/**
	 * 생성자.
	 * @param TemperatureNoise  온도 노이즈 (별도 시드 권장)
	 * @param HumidityNoise     습도 노이즈 (별도 시드 권장)
	 */
	FHktTerrainBiomeMap(const FHktTerrainNoise* TemperatureNoise, const FHktTerrainNoise* HumidityNoise);

	/**
	 * 월드 XY 좌표에서 바이옴 타입 결정.
	 * @param WorldX, WorldY  월드 좌표 (복셀 단위, 고정소수점)
	 * @return  바이옴 타입
	 */
	EHktBiomeType GetBiome(Fixed WorldX, Fixed WorldY) const;

	/**
	 * 월드 XY 좌표에서 바이옴 + 높이를 고려한 최종 바이옴.
	 * 높이가 MountainThreshold 이상이면 Mountain으로 오버라이드.
	 */
	EHktBiomeType GetBiomeWithHeight(Fixed WorldX, Fixed WorldY, Fixed Height) const;

	/** 바이옴별 재질 규칙 조회 */
	const FHktBiomeMaterialRule& GetMaterialRule(EHktBiomeType Biome) const;

	/** 산악 판정 높이 임계값 (복셀 단위) */
	void SetMountainThreshold(Fixed Threshold) { MountainThreshold = Threshold; }

	/** 노이즈 스케일 (값이 작을수록 바이옴이 넓어짐) */
	void SetNoiseScale(Fixed Scale) { NoiseScale = Scale; }

	/** 바이옴별 재질 규칙 커스터마이즈 */
	void SetMaterialRule(EHktBiomeType Biome, const FHktBiomeMaterialRule& Rule);

private:
	const FHktTerrainNoise* TempNoise;
	const FHktTerrainNoise* HumNoise;

	Fixed NoiseScale = Fixed::FromRaw(131);          // 0.002
	Fixed MountainThreshold = Fixed::FromRaw(80 * 65536); // 80.0

	FHktBiomeMaterialRule MaterialRules[static_cast<int32>(EHktBiomeType::Count)];

	void InitDefaultRules();
};
