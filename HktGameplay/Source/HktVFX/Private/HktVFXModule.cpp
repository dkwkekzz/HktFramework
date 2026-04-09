// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVFXModule.h"
#include "HktVFXLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktVFXModule"

DEFINE_LOG_CATEGORY(LogHktVFX);

class FHktVFXModule : public IHktVFXModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktVFX, Log, TEXT("HktVFX Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktVFX, Log, TEXT("HktVFX Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktVFXModule, HktVFX)

#undef LOCTEXT_NAMESPACE
