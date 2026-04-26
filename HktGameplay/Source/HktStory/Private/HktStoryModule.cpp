// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryModule.h"
#include "HktStoryRegistry.h"
#include "HktStoryJsonLoader.h"
#include "HktSnippetJsonCommands.h"
#include "HktCoreEventLog.h"

#if WITH_EDITOR
#include "Editor.h"
#endif

DEFINE_LOG_CATEGORY_STATIC(LogHktStory, Log, All); // Story 모듈은 단일 파일이므로 static 유지

IMPLEMENT_MODULE(FHktStoryModule, HktStory)

void FHktStoryModule::StartupModule()
{
	// JSON 파서에 HktSnippetItem op를 추가 등록 (JSON 로드 전에 필수)
	HktStory::RegisterSnippetJsonCommands();

#if WITH_EDITOR
	// 에디터: 모듈 시작 시점엔 Story를 등록하지 않는다.
	//   - 부팅 직후엔 사용자가 JSON 편집/태그 재생성을 마치지 않았을 수 있고,
	//   - PIE 시작 시점이 실제로 시뮬레이션이 필요한 시점이므로 그 때 1회 빌드한다.
	PreBeginPIEHandle = FEditorDelegates::PreBeginPIE.AddRaw(this, &FHktStoryModule::OnPreBeginPIE);
#else
	// 게임/쿠킹 빌드: 모듈 시작 시 1회 등록.
	//   ini로 사전 등록된 GameplayTag만 사용되므로 RequestGameplayTag가 모두 성공해야 한다.
	ReloadAllStories();
#endif
}

void FHktStoryModule::ShutdownModule()
{
#if WITH_EDITOR
	if (PreBeginPIEHandle.IsValid())
	{
		FEditorDelegates::PreBeginPIE.Remove(PreBeginPIEHandle);
		PreBeginPIEHandle.Reset();
	}
#endif

	UE_LOG(LogHktStory, Log, TEXT("HktStory Module Shutdown"));
}

void FHktStoryModule::ReloadAllStories()
{
	// 기존 컴파일된 프로그램 폐기 — 네이티브/JSON 모두 재빌드로 갱신
	FHktStoryRegistry::ClearCompiledPrograms();

	// 네이티브 C++ Story 재등록 (정적 초기화로 레지스트리에 누적된 것들)
	FHktStoryRegistry::InitializeAllStories();

	// JSON 파일 기반 Story 재로드 (StoryDirectories/*.json)
	const int32 JsonCount = FHktStoryJsonLoader::LoadAllFromContentDirectory();
	UE_LOG(LogHktStory, Log, TEXT("Loaded %d JSON stories"), JsonCount);

	HKT_EVENT_LOG(HktLogTags::Story, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("HktStory reloaded (JSON: %d)"), JsonCount));
}

#if WITH_EDITOR
void FHktStoryModule::OnPreBeginPIE(bool bIsSimulating)
{
	UE_LOG(LogHktStory, Log, TEXT("PreBeginPIE — registering all stories"));
	ReloadAllStories();
}
#endif
