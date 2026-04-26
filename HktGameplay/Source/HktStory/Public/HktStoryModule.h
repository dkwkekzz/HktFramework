// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/**
 * HktStory Module
 *
 * Story 정의를 자동으로 등록하는 모듈입니다.
 * 모듈이 로드되면 네이티브 Story 및 JSON Story가 등록됩니다.
 *
 * GameplayTag 등록은 더 이상 런타임에서 수행되지 않습니다 (DoneAddingNativeTags 이후
 * AddNativeGameplayTag 호출은 ensure 위반). 대신 UHktStoryEditorLibrary의 에디터 함수가
 * Config/Tags/HktStoryTags.ini에 태그를 기록하고, 엔진 부팅 시 자동 로드됩니다.
 */
class HKTSTORY_API FHktStoryModule : public IModuleInterface
{
public:
	/** IModuleInterface implementation */
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	/** 네이티브 + JSON Story 전체 재등록 (VMProgramRegistry 비운 뒤 다시 빌드) */
	static void ReloadAllStories();

#if WITH_EDITOR
private:
	void OnPreBeginPIE(bool bIsSimulating);
	FDelegateHandle PreBeginPIEHandle;
#endif
};
