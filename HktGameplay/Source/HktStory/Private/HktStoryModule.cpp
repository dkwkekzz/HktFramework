// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryModule.h"
#include "HktStoryRegistry.h"
#include "HktStoryJsonLoader.h"
#include "HktCoreEventLog.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktStory, Log, All); // Story 모듈은 단일 파일이므로 static 유지

IMPLEMENT_MODULE(FHktStoryModule, HktStory)

void FHktStoryModule::StartupModule()
{
	// 1) C++ 정의 Story 등록 (정적 초기화로 레지스트리에 추가된 것들)
	FHktStoryRegistry::InitializeAllStories();

	// 2) JSON 파일 기반 Story 로드 (Content/Stories/*.json)
	const int32 JsonCount = FHktStoryJsonLoader::LoadAllFromContentDirectory();
	UE_LOG(LogHktStory, Log, TEXT("Loaded %d JSON stories from Content/Stories"), JsonCount);

	HKT_EVENT_LOG(HktLogTags::Story, EHktLogLevel::Info, EHktLogSource::Server, FString::Printf(TEXT("HktStory module started (JSON: %d)"), JsonCount));
}

void FHktStoryModule::ShutdownModule()
{
	UE_LOG(LogHktStory, Log, TEXT("HktStory Module Shutdown"));
}
