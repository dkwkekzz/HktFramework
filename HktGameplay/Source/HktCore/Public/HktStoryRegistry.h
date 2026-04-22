#pragma once

#include "CoreMinimal.h"

/**
 * Story 자가 등록 시스템
 * * 중앙 헤더 수정 없이 각 cpp 파일에서 스스로를 등록할 수 있게 합니다.
 */
class HKTCORE_API FHktStoryRegistry
{
public:
    using FStoryRegisterFunc = TFunction<void()>;

    /** 각 Story 구현부에서 등록을 위해 호출 */
    static void AddStoryRegistration(FStoryRegisterFunc InitFunc);

    /** 게임 시작 시(예: GameInstance Init) 호출하여 모든 등록된 Story 빌드 */
    static void InitializeAllStories();

    /** 이미 빌드된 VM 프로그램을 모두 폐기 (에디터 PIE 재시작 시 재빌드 전 호출) */
    static void ClearCompiledPrograms();

private:
    /** 정적 초기화 순서 문제 방지를 위해 함수 내 정적 변수 사용 (Meyers Singleton) */
    static TArray<FStoryRegisterFunc>& GetRegistry();
};

/**
 * 자가 등록 헬퍼 구조체
 * * 이 구조체의 정적 인스턴스를 생성하면 생성자에서 자동으로 레지스트리에 등록됩니다.
 */
struct HKTCORE_API FHktAutoRegisterStory
{
    FHktAutoRegisterStory(FHktStoryRegistry::FStoryRegisterFunc InitFunc)
    {
        FHktStoryRegistry::AddStoryRegistration(InitFunc);
    }
};

/**
 * 매크로: Story 등록을 간편하게 만듭니다.
 * 사용법:
 * HKT_REGISTER_STORY_BODY()
 * {
 * // Story 정의 로직
 * }
 */
#define HKT_REGISTER_STORY_BODY() \
    static void HktStoryRegisterImpl(); \
    static FHktAutoRegisterStory HktStoryAutoRegInstance(&HktStoryRegisterImpl); \
    void HktStoryRegisterImpl()
