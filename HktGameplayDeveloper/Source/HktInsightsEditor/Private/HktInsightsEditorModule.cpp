// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "Widgets/Docking/SDockTab.h"
#include "Framework/Docking/TabManager.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"
#include "ToolMenus.h"
#include "HktInsightsLog.h"

// Slate 패널
#include "Slate/SHktWorldStatePanel.h"
#include "Slate/SHktVMStatePanel.h"
#include "Slate/SHktRuntimeInsightsPanel.h"
#include "Slate/SHktGameplayLogPanel.h"

#define LOCTEXT_NAMESPACE "HktInsightsEditor"

DEFINE_LOG_CATEGORY_STATIC(LogHktInsightsEditor, Log, All);

static const FName HktVMStateTabName(TEXT("HktVMStateTab"));
static const FName HktRuntimeInsightsTabName(TEXT("HktRuntimeInsightsTab"));
static const FName HktWorldStateTabName(TEXT("HktWorldStateTab"));
static const FName HktGameplayLogTabName(TEXT("HktGameplayLogTab"));

/**
 * HktInsightsEditor 모듈 — 에디터 탭 등록 및 메뉴 통합
 */
class FHktInsightsEditorModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;

private:
    TSharedRef<SDockTab> SpawnVMStateTab(const FSpawnTabArgs& Args);
    TSharedRef<SDockTab> SpawnRuntimeTab(const FSpawnTabArgs& Args);
    TSharedRef<SDockTab> SpawnWorldStateTab(const FSpawnTabArgs& Args);
    TSharedRef<SDockTab> SpawnGameplayLogTab(const FSpawnTabArgs& Args);

    void RegisterMenuExtensions();
    void UnregisterMenuExtensions();

    bool bTabSpawnerRegistered = false;
};

IMPLEMENT_MODULE(FHktInsightsEditorModule, HktInsightsEditor)

void FHktInsightsEditorModule::StartupModule()
{
    UE_LOG(LogHktInsightsEditor, Log, TEXT("[HktInsightsEditor] Module starting up (HktGameplayDeveloper)"));

    // VM State 탭
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
        HktVMStateTabName,
        FOnSpawnTab::CreateRaw(this, &FHktInsightsEditorModule::SpawnVMStateTab))
        .SetDisplayName(LOCTEXT("VMStateTabTitle", "HKT VM State"))
        .SetTooltipText(LOCTEXT("VMStateTabTooltip", "VM execution state and intent events"))
        .SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsDebugCategory())
        .SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"));

    // Runtime Insights 탭
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
        HktRuntimeInsightsTabName,
        FOnSpawnTab::CreateRaw(this, &FHktInsightsEditorModule::SpawnRuntimeTab))
        .SetDisplayName(LOCTEXT("RuntimeTabTitle", "HKT Runtime"))
        .SetTooltipText(LOCTEXT("RuntimeTabTooltip", "Server, client, and proxy simulator runtime state"))
        .SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsDebugCategory())
        .SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"));

    // WorldState 탭
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
        HktWorldStateTabName,
        FOnSpawnTab::CreateRaw(this, &FHktInsightsEditorModule::SpawnWorldStateTab))
        .SetDisplayName(LOCTEXT("WorldStateTabTitle", "HKT World State"))
        .SetTooltipText(LOCTEXT("WorldStateTabTooltip", "Entity and property viewer for server/client WorldState"))
        .SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsDebugCategory())
        .SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"));

    // Gameplay Log 탭
    FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
        HktGameplayLogTabName,
        FOnSpawnTab::CreateRaw(this, &FHktInsightsEditorModule::SpawnGameplayLogTab))
        .SetDisplayName(LOCTEXT("GameplayLogTabTitle", "HKT Gameplay Log"))
        .SetTooltipText(LOCTEXT("GameplayLogTabTooltip", "Chronological gameplay event log with entity filtering"))
        .SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsDebugCategory())
        .SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"));

    bTabSpawnerRegistered = true;

    RegisterMenuExtensions();

    UE_LOG(LogHktInsightsEditor, Log, TEXT("[HktInsightsEditor] Module startup complete."));
}

void FHktInsightsEditorModule::ShutdownModule()
{
    UE_LOG(LogHktInsightsEditor, Log, TEXT("[HktInsightsEditor] Module shutting down..."));

    UnregisterMenuExtensions();

    if (bTabSpawnerRegistered)
    {
        FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(HktVMStateTabName);
        FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(HktRuntimeInsightsTabName);
        FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(HktWorldStateTabName);
        FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(HktGameplayLogTabName);
        bTabSpawnerRegistered = false;
    }

    UE_LOG(LogHktInsightsEditor, Log, TEXT("[HktInsightsEditor] Module shutdown complete."));
}

TSharedRef<SDockTab> FHktInsightsEditorModule::SpawnVMStateTab(const FSpawnTabArgs& Args)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        .Label(LOCTEXT("VMStateTabLabel", "HKT VM State"))
        [
            SNew(SHktVMStatePanel)
        ];
}

TSharedRef<SDockTab> FHktInsightsEditorModule::SpawnRuntimeTab(const FSpawnTabArgs& Args)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        .Label(LOCTEXT("RuntimeTabLabel", "HKT Runtime"))
        [
            SNew(SHktRuntimeInsightsPanel)
        ];
}

TSharedRef<SDockTab> FHktInsightsEditorModule::SpawnWorldStateTab(const FSpawnTabArgs& Args)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        .Label(LOCTEXT("WorldStateTabLabel", "HKT World State"))
        [
            SNew(SHktWorldStatePanel)
        ];
}

TSharedRef<SDockTab> FHktInsightsEditorModule::SpawnGameplayLogTab(const FSpawnTabArgs& Args)
{
    return SNew(SDockTab)
        .TabRole(ETabRole::NomadTab)
        .Label(LOCTEXT("GameplayLogTabLabel", "HKT Gameplay Log"))
        [
            SNew(SHktGameplayLogPanel)
        ];
}

void FHktInsightsEditorModule::RegisterMenuExtensions()
{
    UToolMenus::RegisterStartupCallback(FSimpleMulticastDelegate::FDelegate::CreateLambda([this]()
    {
        UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Window");
        if (Menu)
        {
            FToolMenuSection& Section = Menu->FindOrAddSection("WindowLayout");

            Section.AddMenuEntry("HktVMState",
                LOCTEXT("VMStateMenu", "HKT VM State"),
                LOCTEXT("VMStateMenuTooltip", "Open VM State debug panel"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktVMStateTabName);
                })));

            Section.AddMenuEntry("HktRuntime",
                LOCTEXT("RuntimeMenu", "HKT Runtime"),
                LOCTEXT("RuntimeMenuTooltip", "Open Runtime Insights panel"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktRuntimeInsightsTabName);
                })));

            Section.AddMenuEntry("HktWorldState",
                LOCTEXT("WorldStateMenu", "HKT World State"),
                LOCTEXT("WorldStateMenuTooltip", "Open WorldState entity viewer"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktWorldStateTabName);
                })));

            Section.AddMenuEntry("HktGameplayLog",
                LOCTEXT("GameplayLogMenu", "HKT Gameplay Log"),
                LOCTEXT("GameplayLogMenuTooltip", "Open chronological gameplay event log"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktGameplayLogTabName);
                })));
        }

        // Tools 메뉴에도 추가
        UToolMenu* ToolsMenu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
        if (ToolsMenu)
        {
            FToolMenuSection& Section = ToolsMenu->FindOrAddSection("Instrumentation");

            Section.AddMenuEntry("HktVMStateTools",
                LOCTEXT("VMStateToolsMenu", "HKT VM State"),
                LOCTEXT("VMStateToolsTooltip", "Open VM State debug panel"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktVMStateTabName);
                })));

            Section.AddMenuEntry("HktRuntimeTools",
                LOCTEXT("RuntimeToolsMenu", "HKT Runtime"),
                LOCTEXT("RuntimeToolsTooltip", "Open Runtime Insights panel"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktRuntimeInsightsTabName);
                })));

            Section.AddMenuEntry("HktWorldStateTools",
                LOCTEXT("WorldStateToolsMenu", "HKT World State"),
                LOCTEXT("WorldStateToolsTooltip", "Open WorldState entity viewer"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktWorldStateTabName);
                })));

            Section.AddMenuEntry("HktGameplayLogTools",
                LOCTEXT("GameplayLogToolsMenu", "HKT Gameplay Log"),
                LOCTEXT("GameplayLogToolsTooltip", "Open chronological gameplay event log"),
                FSlateIcon(FAppStyle::GetAppStyleSetName(), "Debug"),
                FUIAction(FExecuteAction::CreateLambda([]()
                {
                    FGlobalTabmanager::Get()->TryInvokeTab(HktGameplayLogTabName);
                })));
        }
    }));
}

void FHktInsightsEditorModule::UnregisterMenuExtensions()
{
    UToolMenus::UnRegisterStartupCallback(this);
}

#undef LOCTEXT_NAMESPACE
