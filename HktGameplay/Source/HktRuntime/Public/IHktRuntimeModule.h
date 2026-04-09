// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktRuntime Module Interface
 * 
 * This module provides runtime functionality for the HktGameplay plugin,
 * including game logic execution and state management.
 */
class HKTRUNTIME_API IHktRuntimeModule : public IModuleInterface
{
public:
	static inline IHktRuntimeModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktRuntimeModule>("HktRuntime");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktRuntime");
	}
};
