// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktVFX Module Interface
 * 
 * VFX 레이어 - 게임 로직 없음
 * HktRuntime의 IHktModelProvider를 통해 데이터를 읽고 VFX만 수행
 */
class HKTVFX_API IHktVFXModule : public IModuleInterface
{
public:
	static inline IHktVFXModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktVFXModule>("HktVFX");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktVFX");
	}
};
