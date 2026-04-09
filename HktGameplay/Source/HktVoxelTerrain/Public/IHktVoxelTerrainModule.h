// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktVoxelTerrain Module Interface
 *
 * 복셀 기반 대규모 지형 렌더링.
 * HktVoxelCore의 메싱/렌더링 파이프라인을 재사용하여
 * 카메라 기반 스트리밍으로 대형 맵(128×128+ 청크)을 표시한다.
 */
class HKTVOXELTERRAIN_API IHktVoxelTerrainModule : public IModuleInterface
{
public:
	static inline IHktVoxelTerrainModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktVoxelTerrainModule>("HktVoxelTerrain");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktVoxelTerrain");
	}
};
