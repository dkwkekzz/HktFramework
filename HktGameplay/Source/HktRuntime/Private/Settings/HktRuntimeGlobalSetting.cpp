// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Settings/HktRuntimeGlobalSetting.h"
#include "HktTerrainGenerator.h"
#include "HktRuntimeLog.h"

UHktRuntimeGlobalSetting::UHktRuntimeGlobalSetting()
{
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
	const FVector Result(
		DefaultSpawnVoxelXY.X * VS + Half,
		DefaultSpawnVoxelXY.Y * VS + Half,
		(SurfaceZ.ToDouble() + 1.0) * VS + Half);  // +1: 표면 위 1복셀

	// [FloatRepro] 캐릭터 떠다님 race 추적 로그 — Z 가 어느 시점/어느 config 로 계산됐는지 가시화.
	// 본 메서드는 UHktTerrainSubsystem 을 거치지 않고 ProjectSettings 로 직접 폴백 Generator
	// 인스턴스화 → BakedAsset 의 GeneratorConfig 와 다르면 표면 Z 도 달라진다.
	UE_LOG(LogHktRuntime, Log,
		TEXT("[FloatRepro] ComputeDefaultSpawnLocation: VoxelXY=(%.1f, %.1f) → SurfaceZ=%.3f voxels → World=(%.1f, %.1f, %.1f) cm | VS=%.1f Seed=%d Epoch=%d"),
		DefaultSpawnVoxelXY.X, DefaultSpawnVoxelXY.Y, SurfaceZ.ToDouble(),
		Result.X, Result.Y, Result.Z, VS, Config.Seed, Config.Epoch);

	return Result;
}
