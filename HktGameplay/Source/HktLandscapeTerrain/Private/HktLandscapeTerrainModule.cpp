// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktLandscapeTerrainModule.h"
#include "HktLandscapeTerrainLog.h"

DEFINE_LOG_CATEGORY(LogHktLandscapeTerrain);

class FHktLandscapeTerrainModule : public IHktLandscapeTerrainModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktLandscapeTerrain, Log, TEXT("HktLandscapeTerrain Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktLandscapeTerrain, Log, TEXT("HktLandscapeTerrain Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktLandscapeTerrainModule, HktLandscapeTerrain)
