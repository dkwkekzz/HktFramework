// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktVoxelVFX Module Interface
 *
 * 복셀 타격감/이펙트 시스템 — 게임 로직 없음
 * VM 이벤트를 받아 파편, 히트스탑, 카메라 셰이크 등 시각 연출만 담당
 */
class HKTVOXELVFX_API IHktVoxelVFXModule : public IModuleInterface
{
public:
	static inline IHktVoxelVFXModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktVoxelVFXModule>("HktVoxelVFX");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktVoxelVFX");
	}
};
