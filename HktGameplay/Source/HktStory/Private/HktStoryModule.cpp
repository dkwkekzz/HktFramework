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
	// 0) JSON 파서에 HktSnippetItem op를 추가 등록 (JSON 로드 전에 필수)
	HktStory::RegisterSnippetJsonCommands();

	// 1) 최초 Story 등록 (네이티브 + JSON)
	ReloadAllStories();

#if WITH_EDITOR
	// 에디터에서는 PIE 시작마다 JSON/네이티브 Story를 재로드 (JSON 편집 즉시 반영)
	// FEditorDelegates는 GEditor 초기화 전에도 바인딩 가능 (정적 델리게이트)
	PreBeginPIEHandle = FEditorDelegates::PreBeginPIE.AddRaw(this, &FHktStoryModule::OnPreBeginPIE);
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

	// JSON 파일 기반 Story 재로드 (Content/Stories/*.json)
	const int32 JsonCount = FHktStoryJsonLoader::LoadAllFromContentDirectory();
	UE_LOG(LogHktStory, Log, TEXT("Loaded %d JSON stories from Content/Stories"), JsonCount);

	HKT_EVENT_LOG(HktLogTags::Story, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("HktStory reloaded (JSON: %d)"), JsonCount));
}

#if WITH_EDITOR
void FHktStoryModule::OnPreBeginPIE(bool bIsSimulating)
{
	UE_LOG(LogHktStory, Log, TEXT("PreBeginPIE — reloading all stories"));
	ReloadAllStories();
}
#endif
