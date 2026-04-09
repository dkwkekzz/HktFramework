// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"

class FHktRuntimeModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
	}

	virtual void ShutdownModule() override
	{
	}
};

IMPLEMENT_MODULE(FHktRuntimeModule, HktRuntime)
