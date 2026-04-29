// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Modules/ModuleManager.h"

class IHktSpriteTerrainModule : public IModuleInterface
{
public:
	static IHktSpriteTerrainModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktSpriteTerrainModule>("HktSpriteTerrain");
	}

	static bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktSpriteTerrain");
	}
};
