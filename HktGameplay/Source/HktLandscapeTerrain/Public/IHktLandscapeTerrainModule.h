// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktLandscapeTerrain Module Interface
 *
 * UE5 네이티브 ALandscape 기반 지형 렌더링.
 * HktCore의 FHktTerrainGenerator를 재사용해 하이트맵과 바이옴 가중치 맵을
 * 생성하고, 런타임에 ALandscape 액터를 스폰·Import 한다.
 *
 * 복셀 파이프라인(HktVoxelTerrain)의 병렬 형제 모듈.
 */
class HKTLANDSCAPETERRAIN_API IHktLandscapeTerrainModule : public IModuleInterface
{
public:
	static inline IHktLandscapeTerrainModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktLandscapeTerrainModule>("HktLandscapeTerrain");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktLandscapeTerrain");
	}
};
