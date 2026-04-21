// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktSpriteCoreModule.h"
#include "HktSpriteCoreLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktSpriteCoreModule"

DEFINE_LOG_CATEGORY(LogHktSpriteCore);

class FHktSpriteCoreModule : public IHktSpriteCoreModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktSpriteCoreModule, HktSpriteCore)

#undef LOCTEXT_NAMESPACE
