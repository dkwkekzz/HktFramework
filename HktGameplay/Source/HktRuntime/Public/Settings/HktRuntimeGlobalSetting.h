// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "Engine/World.h"
#include "Terrain/HktTerrainGenerator.h"
#include "HktRuntimeGlobalSetting.generated.h"

/**
 * HktRuntime 전역 설정
 * Project Settings -> Game -> Hkt Runtime Settings 에서 편집 가능
 */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Hkt Gameplay Settings"))
class HKTRUNTIME_API UHktRuntimeGlobalSetting : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UHktRuntimeGlobalSetting();

	virtual FName GetContainerName() const override { return FName("Project"); }
	virtual FName GetCategoryName() const override { return FName("Game"); }
	virtual FName GetSectionName() const override { return FName("HktGameplay"); }

	// === 로그인 / 레벨 전환 ===

	/** 인게임 맵 (로그인 성공 후 이동할 맵 Soft Path, 예: /Game/TopDown/Maps/TopDownMap.TopDownMap) */
	UPROPERTY(Config, EditAnywhere, Category = "Login", meta = (DisplayName = "In-Game Map"))
	TSoftObjectPtr<UWorld> InGameMap;

	// === 지형 생성 ===

	/**
	 * 복셀 1개의 월드 크기 (cm = UE 유닛).
	 * HktCore 시뮬레이션 / HktVoxelCore 렌더링 / 디버그 렌더러 전체가 이 값을 단일 출처로 사용.
	 * 변경 시 런타임 리로드 필요.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (ClampMin = 1.0, ClampMax = 500.0, DisplayName = "Voxel Size (cm)"))
	float VoxelSizeCm = 15.0f;

	// === 지형 월드 경계 (시뮬레이션 + 렌더 공유) ===

	/**
	 * 월드 Z축 청크 좌표 최소값. 이 아래로는 청크가 생성/로드되지 않는다.
	 * 시뮬레이션 `FHktTerrainSystem`과 렌더 `FHktVoxelTerrainStreamer`가 공유.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|World Bounds", meta = (DisplayName = "Height Min Z (chunks)"))
	int32 HeightMinZ = 0;

	/**
	 * 월드 Z축 청크 좌표 최대값. 이 위로는 청크가 생성/로드되지 않는다.
	 * 시뮬레이션 `FHktTerrainSystem`과 렌더 `FHktVoxelTerrainStreamer`가 공유.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|World Bounds", meta = (DisplayName = "Height Max Z (chunks)"))
	int32 HeightMaxZ = 3;

	// === 시뮬레이션 청크 스트리밍 ===
	// 렌더러의 스트리밍(`ViewDistance`, `MaxLoadedChunks`)과 독립된 시뮬레이션 전용 설정.

	/** 엔티티 주변 XY 청크 로드 반경 (0이면 엔티티 셀만) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|Simulation Streaming", meta = (ClampMin = 0, ClampMax = 16))
	int32 SimLoadRadiusXY = 2;

	/** 엔티티 주변 Z 청크 로드 반경 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|Simulation Streaming", meta = (ClampMin = 0, ClampMax = 8))
	int32 SimLoadRadiusZ = 1;

	/** 시뮬레이션 청크 캐시 상한 (메모리 예산) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|Simulation Streaming", meta = (ClampMin = 16, ClampMax = 16384))
	int32 SimMaxChunksLoaded = 256;

	/** 시뮬레이션 프레임당 최대 청크 로드 수 (스파이크 방지) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain|Simulation Streaming", meta = (ClampMin = 1, ClampMax = 64))
	int32 SimMaxChunkLoadsPerFrame = 4;

	/** 지형 시드 (동일 시드 = 동일 지형) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (DisplayName = "Terrain Seed"))
	int64 TerrainSeed = 42;

	/** 최대 높이 (복셀 단위) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (ClampMin = 8, ClampMax = 256))
	double HeightScale = 64.0;

	/** 기본 해수면 높이 오프셋 (복셀 단위) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double HeightOffset = 32.0;

	/** 지형 노이즈 주파수 (작을수록 완만) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double TerrainFreq = 0.008;

	/** FBM 옥타브 수 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (ClampMin = 1, ClampMax = 12))
	int32 TerrainOctaves = 6;

	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double Lacunarity = 2.0;

	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double Persistence = 0.5;

	/** 산악 리지 주파수 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double MountainFreq = 0.004;

	/** FBM과 Ridged 혼합 비율 (0=FBM only, 1=Ridge only) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (ClampMin = 0.0, ClampMax = 1.0))
	double MountainBlend = 0.4;

	/** 해수면 높이 (복셀 단위) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double WaterLevel = 30.0;

	/** 동굴 생성 활성화 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	bool bEnableCaves = true;

	/** 동굴 노이즈 주파수 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double CaveFreq = 0.03;

	/** 동굴 임계값 (이 값 이상이면 동굴 공간) */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain", meta = (ClampMin = 0.0, ClampMax = 1.0))
	double CaveThreshold = 0.6;

	/** 바이옴 노이즈 스케일 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double BiomeNoiseScale = 0.002;

	/** 산악 바이옴 임계값 */
	UPROPERTY(Config, EditAnywhere, Category = "Terrain")
	double MountainBiomeThreshold = 80.0;

	// === 스폰 ===

	/** 기본 스폰 위치 XY (복셀 좌표). Z는 지형 표면에서 자동 결정 */
	UPROPERTY(Config, EditAnywhere, Category = "Spawn")
	FVector2D DefaultSpawnVoxelXY = FVector2D(16.0, 16.0);

	/** UPROPERTY → 순수 C++ config 변환 */
	FHktTerrainGeneratorConfig ToTerrainConfig() const;

	/** 기본 스폰 위치를 지형 높이 쿼리하여 cm 좌표로 반환 */
	FVector ComputeDefaultSpawnLocation() const;
};
