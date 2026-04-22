// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktSpriteCore Module Interface
 *
 * 라그나로크 방식 2D 스프라이트 스켈레탈 애니메이션 파이프라인.
 *  - FHktSpriteFrame/Action/PartTemplate/Loadout 데이터 모델
 *  - HktResolveSpriteFrame 순수 함수 (tick → frame)
 *  - UHktSpriteCrowdRenderer (HISM-based 파츠별 인스턴싱)
 *  - AHktSpriteCrowdHost (CrowdRenderer 호스트 Actor + IHktPresentationProcessor)
 */
class HKTSPRITECORE_API IHktSpriteCoreModule : public IModuleInterface
{
public:
	static inline IHktSpriteCoreModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktSpriteCoreModule>("HktSpriteCore");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktSpriteCore");
	}
};
