// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktVoxelCore Module Interface
 *
 * 복셀 렌더링 엔진 코어 — 게임 로직 없음
 * VM 복셀 데이터의 읽기 전용 사본을 관리하고 Greedy Meshing → GPU 업로드 파이프라인 제공
 */
class HKTVOXELCORE_API IHktVoxelCoreModule : public IModuleInterface
{
public:
	static inline IHktVoxelCoreModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktVoxelCoreModule>("HktVoxelCore");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktVoxelCore");
	}
};
