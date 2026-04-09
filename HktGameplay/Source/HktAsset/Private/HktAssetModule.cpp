// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"

class FHktAssetModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
	}

	virtual void ShutdownModule() override
	{
	}
};

IMPLEMENT_MODULE(FHktAssetModule, HktAsset)
