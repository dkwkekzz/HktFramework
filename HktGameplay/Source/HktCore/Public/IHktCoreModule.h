// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktCore Module Interface
 * 
 * This module provides core functionality and shared utilities
 * for the HktGameplay plugin system.
 */
class HKTCORE_API IHktCoreModule : public IModuleInterface
{
public:
	static inline IHktCoreModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktCoreModule>("HktCore");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktCore");
	}
};
