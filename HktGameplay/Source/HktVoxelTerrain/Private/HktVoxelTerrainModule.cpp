// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVoxelTerrainModule.h"
#include "HktVoxelTerrainLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktVoxelTerrainModule"

DEFINE_LOG_CATEGORY(LogHktVoxelTerrain);

class FHktVoxelTerrainModule : public IHktVoxelTerrainModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktVoxelTerrain, Log, TEXT("HktVoxelTerrain Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktVoxelTerrain, Log, TEXT("HktVoxelTerrain Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktVoxelTerrainModule, HktVoxelTerrain)

#undef LOCTEXT_NAMESPACE
