// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktUIModule.h"
#include "HktUILog.h"
#include "Modules/ModuleManager.h"

DEFINE_LOG_CATEGORY(LogHktUI);

class FHktUIModule : public IHktUIModule
{
public:
	virtual void StartupModule() override { UE_LOG(LogHktUI, Log, TEXT("HktUI Module Started")); }
	virtual void ShutdownModule() override { UE_LOG(LogHktUI, Log, TEXT("HktUI Module Shutdown")); }
};

IMPLEMENT_MODULE(FHktUIModule, HktUI)
