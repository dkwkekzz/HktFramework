// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktVoxelSkin Module Interface
 *
 * 복셀 스킨/팔레트 시스템
 * 팔레트 텍스처 관리, 모듈러 스킨 조합(7레이어), 스킨별 이펙트 파라미터
 */
class HKTVOXELSKIN_API IHktVoxelSkinModule : public IModuleInterface
{
public:
	static inline IHktVoxelSkinModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktVoxelSkinModule>("HktVoxelSkin");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktVoxelSkin");
	}
};
