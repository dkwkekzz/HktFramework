// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVoxelVFXModule.h"
#include "HktVoxelVFXLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktVoxelVFXModule"

DEFINE_LOG_CATEGORY(LogHktVoxelVFX);

class FHktVoxelVFXModule : public IHktVoxelVFXModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktVoxelVFX, Log, TEXT("HktVoxelVFX Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktVoxelVFX, Log, TEXT("HktVoxelVFX Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktVoxelVFXModule, HktVoxelVFX)

#undef LOCTEXT_NAMESPACE
