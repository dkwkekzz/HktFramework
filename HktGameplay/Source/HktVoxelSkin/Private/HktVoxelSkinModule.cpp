// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVoxelSkinModule.h"
#include "HktVoxelSkinLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktVoxelSkinModule"

DEFINE_LOG_CATEGORY(LogHktVoxelSkin);

class FHktVoxelSkinModule : public IHktVoxelSkinModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktVoxelSkin, Log, TEXT("HktVoxelSkin Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktVoxelSkin, Log, TEXT("HktVoxelSkin Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktVoxelSkinModule, HktVoxelSkin)

#undef LOCTEXT_NAMESPACE
