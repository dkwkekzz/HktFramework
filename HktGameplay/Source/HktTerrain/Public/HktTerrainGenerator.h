// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainDataSource.h"
#include "HktTerrainNoise.h"
#include "HktTerrainBiome.h"

/**
 * FHktTerrainPreviewSample
 *
 * Top-down 프리뷰 한 칸의 샘플. GenerateChunk 없이 Layer 0~2.5(고급) 또는
 * GetSurfaceHeight + BiomeMap(레거시)만 실행해 얻은 결과.
 *
 * BiomeId 해석:
 *   bIsAdvanced=true  → EHktAdvBiome   (0~10 현실, 100~ 이상)
 *   bIsAdvanced=false → EHktBiomeType + 200 (레거시와 구분용 오프셋)
 */
struct FHktTerrainPreviewSample
{
	float Elevation = 0.f;            // [0,1] 정규화 높이
	int32 SurfaceHeightVoxels = 0;    // 월드 Z 복셀 단위
	uint8 BiomeId = 0;
	uint8 TectonicPrimary = 0;        // EHktContinentType (고급만 유효)
	float Moisture = 0.f;             // 고급만
	float Temperature = 0.f;          // 고급만
	bool bIsAdvanced = false;
	bool bIsOcean = false;
};

struct FHktTerrainPreviewRegion
{
	int32 MinWorldX = 0;
	int32 MinWorldY = 0;
	int32 Width = 0;
	int32 Height = 0;
	int32 WaterLevel = 0;
	int32 HeightMinZ = 0;             // 청크 좌표
	int32 HeightMaxZ = 0;
	TArray<FHktTerrainPreviewSample> Samples;  // row-major: Idx = X + Y * Width

	const FHktTerrainPreviewSample& At(int32 X, int32 Y) const
	{
		return Samples[X + Y * Width];
	}
};

/**
 * FHktTerrainGenerator
 *
 * 시드 기반 결정론적 지형 생성기 (HktTerrain 모듈 소유).
 * 청크 좌표를 입력하면 32×32×32 FHktVoxel 배열을 채운다.
 *
 * `IHktTerrainDataSource` 를 구현하여 HktCore 의 시뮬레이션 측이 청크 데이터를 소비할 때
 * 동일 인터페이스로 접근할 수 있게 한다 (절대 원칙: HktCore 는 생성에 관여하지 않는다).
 *
 * 순수 C++ — UE 런타임 의존 없음. 모든 연산은 FHktFixed32 고정소수점 → 결정론 보장.
 *
 * 생성 파이프라인:
 *   1. 하이트맵: FBM + RidgedMulti 혼합 → 표면 높이 결정
 *   2. 바이옴: 온도+습도 노이즈 → 바이옴 타입 결정
 *   3. 재질: 바이옴 규칙 + 높이/깊이 → TypeID 배정
 *   4. 동굴: 3D 노이즈로 내부 공간 카빙
 *   5. 수면: WaterLevel 아래 빈 공간을 Water로 채움
 */
class HKTTERRAIN_API FHktTerrainGenerator : public IHktTerrainDataSource
{
public:
	using Fixed = FHktFixed32;

	explicit FHktTerrainGenerator(const FHktTerrainGeneratorConfig& Config);

	// IHktTerrainDataSource ----------------------------------------------------
	virtual void GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ, FHktTerrainVoxel* OutVoxels) const override;
	virtual const FHktTerrainGeneratorConfig& GetConfig() const override { return Config; }
	// --------------------------------------------------------------------------

	/**
	 * 특정 월드 좌표의 표면 높이를 반환한다.
	 * @param WorldX, WorldY  월드 복셀 좌표 (고정소수점)
	 * @return  표면 높이 (고정소수점, 복셀 단위)
	 */
	Fixed GetSurfaceHeight(Fixed WorldX, Fixed WorldY) const;

	/** 설정 변경 (노이즈 재생성) */
	void Reconfigure(const FHktTerrainGeneratorConfig& NewConfig);

	/**
	 * Top-down 프리뷰용 영역 샘플링.
	 * 복셀 채우기(Layer 3~5)는 건너뛰고 Elevation/Biome/SurfaceHeight만 칼럼당 1회 계산한다.
	 * 고급 모드: 청크 단위로 Layer 0~2.5 실행 후 복사. 레거시 모드: 칼럼당 GetSurfaceHeight.
	 *
	 * @param MinWorldX, MinWorldY  샘플링 시작 복셀 좌표
	 * @param Width, Height         샘플링 크기 (복셀 = 픽셀)
	 * @param Out                   결과. Samples 배열은 Width*Height로 리사이즈됨.
	 */
	void SamplePreviewRegion(int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
		FHktTerrainPreviewRegion& Out) const;

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
