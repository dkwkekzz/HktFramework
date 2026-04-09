// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HktInsightsLog.h"
#include "HktCoreDataCollector.h"

DEFINE_LOG_CATEGORY(LogHktInsights);

/**
 * HktInsights 모듈 — 콘솔 명령어 등록
 */
class FHktInsightsModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;

private:
    TArray<IConsoleObject*> ConsoleCommands;
};

IMPLEMENT_MODULE(FHktInsightsModule, HktInsights)

void FHktInsightsModule::StartupModule()
{
    UE_LOG(LogHktInsights, Log, TEXT("[HktInsights] Module starting up (HktGameplayDeveloper)"));

    // 콘솔 명령어 등록
    ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
        TEXT("hkt.insights.clear"),
        TEXT("Clear all HktInsights collected data"),
        FConsoleCommandDelegate::CreateLambda([]()
        {
            FHktCoreDataCollector::Get().Clear();
            UE_LOG(LogHktInsights, Log, TEXT("All insight data cleared"));
        }),
        ECVF_Default));

    ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
        TEXT("hkt.insights.categories"),
        TEXT("List all collected data categories"),
        FConsoleCommandDelegate::CreateLambda([]()
        {
            TArray<FString> Categories = FHktCoreDataCollector::Get().GetCategories();
            UE_LOG(LogHktInsights, Log, TEXT("=== HktInsights Categories (%d) ==="), Categories.Num());
            for (const FString& Cat : Categories)
            {
                TArray<TPair<FString, FString>> Entries = FHktCoreDataCollector::Get().GetEntries(Cat);
                UE_LOG(LogHktInsights, Log, TEXT("  [%s] (%d entries)"), *Cat, Entries.Num());
            }
        }),
        ECVF_Default));

    ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
        TEXT("hkt.insights.dump"),
        TEXT("Dump all data for a category. Usage: hkt.insights.dump <CategoryName>"),
        FConsoleCommandWithArgsDelegate::CreateLambda([](const TArray<FString>& Args)
        {
            if (Args.Num() == 0)
            {
                UE_LOG(LogHktInsights, Warning, TEXT("Usage: hkt.insights.dump <CategoryName>"));
                return;
            }
            const FString& Cat = Args[0];
            TArray<TPair<FString, FString>> Entries = FHktCoreDataCollector::Get().GetEntries(Cat);
            UE_LOG(LogHktInsights, Log, TEXT("=== %s (%d entries) ==="), *Cat, Entries.Num());
            for (const auto& Entry : Entries)
            {
                UE_LOG(LogHktInsights, Log, TEXT("  %s = %s"), *Entry.Key, *Entry.Value);
            }
        }),
        ECVF_Default));
}

void FHktInsightsModule::ShutdownModule()
{
    for (IConsoleObject* Cmd : ConsoleCommands)
    {
        IConsoleManager::Get().UnregisterConsoleObject(Cmd);
    }
    ConsoleCommands.Empty();

    UE_LOG(LogHktInsights, Log, TEXT("[HktInsights] Module shut down"));
}
