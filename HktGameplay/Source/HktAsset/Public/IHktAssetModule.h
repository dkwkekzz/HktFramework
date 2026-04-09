// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktAssetInterface.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktAsset Module Interface
 * 
 * This module handles asset management and data queries.
 * It provides a generic tag-based asset loader for HktCodex.
 */
class HKTINTENT_API IHktAssetModule : public IModuleInterface
{
public:
	static inline IHktAssetModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktAssetModule>("HktAsset");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktAsset");
	}
};

