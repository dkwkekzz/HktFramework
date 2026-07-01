// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

/**
 * HktSplatCore Module Interface
 *
 * 3D Gaussian Splatting 자체 렌더러 코어 — 기존 Hkt 플러그인과 완전히 독립.
 * PLY 스플랫 클라우드 로딩 → GPU 업로드 → FSceneViewExtension 기반 래스터 컴포짓.
 * 게임 로직/시뮬레이션 없음. 순수 프레젠테이션.
 */
class HKTSPLATCORE_API IHktSplatCoreModule : public IModuleInterface
{
public:
	static inline IHktSplatCoreModule& Get()
	{
		return FModuleManager::LoadModuleChecked<IHktSplatCoreModule>("HktSplatCore");
	}

	static inline bool IsAvailable()
	{
		return FModuleManager::Get().IsModuleLoaded("HktSplatCore");
	}
};
