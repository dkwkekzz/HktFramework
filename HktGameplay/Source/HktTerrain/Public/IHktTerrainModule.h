// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktTerrain Module Interface
 *
 * 지형 데이터 생성/관리/스트리밍의 단일 소스 모듈.
 * 베이크 산출물 우선 + 미존재 시 런타임 생성 폴백을 제공한다.
 *
 * HktCore 의 IHktTerrainDataSource 인터페이스를 구현하며,
 * StartupModule 에서 데이터 소스 팩토리를 HktCore 에 등록한다.
 */
class HKTTERRAIN_API IHktTerrainModule : public IModuleInterface
{
public:
	static inline IHktTerrainModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktTerrainModule>("HktTerrain");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktTerrain");
	}
};
