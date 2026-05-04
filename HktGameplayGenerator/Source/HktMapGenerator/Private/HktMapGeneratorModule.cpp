// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktMapGeneratorModule.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktMapGeneratorModule, Log, All);

class FHktMapGeneratorModule : public IHktMapGeneratorModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktMapGeneratorModule, Log, TEXT("[HktMapGenerator] Module loaded"));
	}

	virtual void ShutdownModule() override
	{
	}
};

IMPLEMENT_MODULE(FHktMapGeneratorModule, HktMapGenerator)
