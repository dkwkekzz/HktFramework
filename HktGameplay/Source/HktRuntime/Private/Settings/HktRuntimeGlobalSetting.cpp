// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Settings/HktRuntimeGlobalSetting.h"

UHktRuntimeGlobalSetting::UHktRuntimeGlobalSetting()
{
	// HktGameplay 플러그인 번들 Story(<Plugin>/Content/Stories/*.json)는
	// FHktStoryJsonLoader가 자동으로 스캔하므로 기본값은 비워둔다.
	// 프로젝트 측 커스텀 Story 디렉토리가 필요한 경우에만 Project Settings에서 추가.
}

FHktTerrainGeneratorConfig UHktRuntimeGlobalSetting::ToTerrainConfig() const
{
	using Fixed = FHktFixed32;

	FHktTerrainGeneratorConfig Config;
	Config.VoxelSizeCm              = VoxelSizeCm;
	Config.HeightMinZ               = HeightMinZ;
	Config.HeightMaxZ               = HeightMaxZ;
	Config.SimLoadRadiusXY          = SimLoadRadiusXY;
	Config.SimLoadRadiusZ           = SimLoadRadiusZ;
	Config.SimMaxChunksLoaded       = SimMaxChunksLoaded;
	Config.SimMaxChunkLoadsPerFrame = SimMaxChunkLoadsPerFrame;
	Config.bAdvancedTerrain        = bAdvancedTerrain;
	Config.bAdvEnableSubsurfaceOre = bAdvEnableSubsurfaceOre;
	Config.bAdvEnableSurfaceScatter= bAdvEnableSurfaceScatter;
	Config.Epoch                   = TerrainEpoch;
	Config.Seed                    = TerrainSeed;
	Config.HeightScale             = Fixed::FromDouble(HeightScale);
	Config.HeightOffset            = Fixed::FromDouble(HeightOffset);
	Config.TerrainFreq             = Fixed::FromDouble(TerrainFreq);
	Config.TerrainOctaves          = TerrainOctaves;
	Config.Lacunarity              = Fixed::FromDouble(Lacunarity);
	Config.Persistence             = Fixed::FromDouble(Persistence);
	Config.MountainFreq            = Fixed::FromDouble(MountainFreq);
	Config.MountainBlend           = Fixed::FromDouble(MountainBlend);
	Config.WaterLevel              = Fixed::FromDouble(WaterLevel);
	Config.bEnableCaves            = bEnableCaves;
	Config.CaveFreq                = Fixed::FromDouble(CaveFreq);
	Config.CaveThreshold           = Fixed::FromDouble(CaveThreshold);
	Config.BiomeNoiseScale         = Fixed::FromDouble(BiomeNoiseScale);
	Config.MountainBiomeThreshold  = Fixed::FromDouble(MountainBiomeThreshold);
	return Config;
}

FVector UHktRuntimeGlobalSetting::ComputeDefaultSpawnLocation() const
{
	using Fixed = FHktFixed32;

	const FHktTerrainGeneratorConfig Config = ToTerrainConfig();
	const FHktTerrainGenerator Generator(Config);

	const Fixed VoxelX = Fixed::FromDouble(DefaultSpawnVoxelXY.X);
	const Fixed VoxelY = Fixed::FromDouble(DefaultSpawnVoxelXY.Y);
	const Fixed SurfaceZ = Generator.GetSurfaceHeight(VoxelX, VoxelY);

	// 복셀 → cm 변환 (복셀 중심 = voxel * VoxelSize + Half)
	const double VS = static_cast<double>(VoxelSizeCm);
	const double Half = VS * 0.5;
	return FVector(
		DefaultSpawnVoxelXY.X * VS + Half,
		DefaultSpawnVoxelXY.Y * VS + Half,
		(SurfaceZ.ToDouble() + 1.0) * VS + Half);  // +1: 표면 위 1복셀
}
