// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktSpriteTerrainModule.h"
#include "HktSpriteTerrainLog.h"

DEFINE_LOG_CATEGORY(LogHktSpriteTerrain);

class FHktSpriteTerrainModule : public IHktSpriteTerrainModule
{
public:
	virtual void StartupModule() override {}
	virtual void ShutdownModule() override {}
};

IMPLEMENT_MODULE(FHktSpriteTerrainModule, HktSpriteTerrain);
