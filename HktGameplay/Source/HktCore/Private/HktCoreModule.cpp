// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HktCoreArchetype.h"

class FHktCoreModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
		InitializeHktArchetypes();
	}

	virtual void ShutdownModule() override
	{
	}
};

IMPLEMENT_MODULE(FHktCoreModule, HktCore)
