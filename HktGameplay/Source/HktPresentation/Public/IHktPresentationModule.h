// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktPresentation Module Interface
 * 
 * 순수 View 레이어 - 게임 로직 없음
 * HktRuntime의 IHktModelProvider를 통해 데이터를 읽고 시각화만 수행
 */
class HKTPRESENTATION_API IHktPresentationModule : public IModuleInterface
{
public:
	static inline IHktPresentationModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktPresentationModule>("HktPresentation");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktPresentation");
	}
};
