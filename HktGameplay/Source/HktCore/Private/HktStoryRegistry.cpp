// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryRegistry.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"

TArray<FHktStoryRegistry::FStoryRegisterFunc>& FHktStoryRegistry::GetRegistry()
{
    static TArray<FStoryRegisterFunc> Registry;
    return Registry;
}

void FHktStoryRegistry::AddStoryRegistration(FStoryRegisterFunc InitFunc)
{
    GetRegistry().Add(InitFunc);
}

void FHktStoryRegistry::InitializeAllStories()
{
    const int32 StoryCount = GetRegistry().Num();

    // 등록된 모든 Story 생성 로직 실행
    for (const auto& RegisterFunc : GetRegistry())
    {
        if (RegisterFunc)
        {
            RegisterFunc();
        }
    }

    // 메모리 절약을 위해 실행 후 비움 (필요에 따라 유지 가능)
    GetRegistry().Empty();

    HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("InitializeAllStories: %d stories initialized"), StoryCount));
}
