// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/**
 * HktStory Module
 *
 * Story 정의를 자동으로 등록하는 모듈입니다.
 * 모듈이 로드되면 모든 Story 정의가 자동으로 등록됩니다.
 * 에디터 빌드에서는 PIE 시작마다 JSON Story를 재로드하여, 런타임 중 JSON 편집이
 * 다음 PIE에 즉시 반영되도록 합니다.
 */
class FHktStoryModule : public IModuleInterface
{
public:
	/** IModuleInterface implementation */
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

private:
	/** 네이티브 + JSON Story 전체 재등록 (VMProgramRegistry 비운 뒤 다시 빌드) */
	static void ReloadAllStories();

#if WITH_EDITOR
	void OnPreBeginPIE(bool bIsSimulating);
	FDelegateHandle PreBeginPIEHandle;
#endif
};
