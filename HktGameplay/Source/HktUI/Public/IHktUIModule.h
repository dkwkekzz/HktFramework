// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktUI Module Interface
 * 
 * This module handles UI management and user interface components.
 */
class HKTUI_API IHktUIModule : public IModuleInterface
{
public:
	static inline IHktUIModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktUIModule>("HktUI");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktUI");
	}
};
