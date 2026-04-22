// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryRegistry.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"
#include "VM/HktVMProgram.h"

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
    // 에디터에서 PIE 시작 시 재호출 가능해야 하므로 실행 후 비우지 않는다.
    for (const auto& RegisterFunc : GetRegistry())
    {
        if (RegisterFunc)
        {
            RegisterFunc();
        }
    }

    HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("InitializeAllStories: %d stories initialized"), StoryCount));
}

void FHktStoryRegistry::ClearCompiledPrograms()
{
    FHktVMProgramRegistry::Get().Clear();
}
