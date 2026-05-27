// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Settings/HktRuntimeGlobalSetting.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainSubsystem.h"
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

FVector UHktRuntimeGlobalSetting::ComputeDefaultSpawnLocation(UWorld* World) const
{
	using Fixed = FHktFixed32;

	// 지형 height/VoxelSize 단일 출처 — 물리 스냅(FHktPhysicsSystem)이 사용하는 것과 동일한
	// effective config(BakedAsset 우선)를 써야 스폰 Z 가 지형 표면과 일치한다.
	// 글로벌 ToTerrainConfig() 를 직접 쓰면 baked 와 갈라져 캐릭터가 떠다닌다. [FloatRepro]
	UHktTerrainSubsystem* Sub = World ? UHktTerrainSubsystem::Get(World) : nullptr;
	const bool bFromSubsystem = (Sub != nullptr);
	const FHktTerrainGeneratorConfig Config = bFromSubsystem ? Sub->GetEffectiveConfig() : ToTerrainConfig();
	const FHktTerrainGenerator Generator(Config);

	const Fixed VoxelX = Fixed::FromDouble(DefaultSpawnVoxelXY.X);
	const Fixed VoxelY = Fixed::FromDouble(DefaultSpawnVoxelXY.Y);
	const Fixed SurfaceZ = Generator.GetSurfaceHeight(VoxelX, VoxelY);

	// 복셀 → cm 변환 (복셀 중심 = voxel * VoxelSize + Half). VS 도 effective config 에서.
	const double VS = static_cast<double>(Config.VoxelSizeCm);
	const double Half = VS * 0.5;
	const FVector Result(
		DefaultSpawnVoxelXY.X * VS + Half,
		DefaultSpawnVoxelXY.Y * VS + Half,
		(SurfaceZ.ToDouble() + 1.0) * VS + Half);  // +1: 표면 위 1복셀

	// [FloatRepro] 캐릭터 떠다님 race 추적 로그 — Z 가 어느 출처/config 로 계산됐는지 가시화.
	// bFromSubsystem=false 면 Subsystem 부재 폴백(글로벌)이라 baked 와 어긋날 수 있음.
	UE_LOG(LogHktRuntime, Log,
		TEXT("[FloatRepro] ComputeDefaultSpawnLocation: VoxelXY=(%.1f, %.1f) → SurfaceZ=%.3f voxels → World=(%.1f, %.1f, %.1f) cm | VS=%.1f Seed=%d Epoch=%d Source=%s"),
		DefaultSpawnVoxelXY.X, DefaultSpawnVoxelXY.Y, SurfaceZ.ToDouble(),
		Result.X, Result.Y, Result.Z, VS, Config.Seed, Config.Epoch,
		bFromSubsystem ? TEXT("Subsystem(Effective)") : TEXT("GlobalFallback"));

	return Result;
}
