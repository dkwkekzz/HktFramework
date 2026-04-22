// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "SHktSpriteBuilderPanel.h"
#include "Framework/Docking/TabManager.h"
#include "Widgets/Docking/SDockTab.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"
#include "HAL/IConsoleManager.h"

class FHktSpriteGeneratorModule : public IModuleInterface
{
public:
	static const FName BuilderTabName;

	virtual void StartupModule() override
	{
		FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
			BuilderTabName,
			FOnSpawnTab::CreateStatic(&FHktSpriteGeneratorModule::SpawnBuilderTab))
			.SetDisplayName(NSLOCTEXT("HktSpriteGen", "BuilderTab", "HKT Sprite Builder"))
			.SetTooltipText(NSLOCTEXT("HktSpriteGen", "BuilderTabTip", "Pack textures into an atlas and build UHktSpritePartTemplate."))
			.SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsMiscCategory())
			.SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "LevelEditor.Tabs.Details"));

		ConsoleCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktSprite.Builder"),
			TEXT("Open HKT Sprite Part Builder panel"),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FGlobalTabmanager::Get()->TryInvokeTab(BuilderTabName);
			}),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		if (ConsoleCommand)
		{
			IConsoleManager::Get().UnregisterConsoleObject(ConsoleCommand);
			ConsoleCommand = nullptr;
		}
		if (FGlobalTabmanager::Get()->HasTabSpawner(BuilderTabName))
		{
			FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(BuilderTabName);
		}
	}

private:
	static TSharedRef<SDockTab> SpawnBuilderTab(const FSpawnTabArgs& Args)
	{
		return SNew(SDockTab)
			.TabRole(NomadTab)
			.Label(NSLOCTEXT("HktSpriteGen", "BuilderTabLabel", "HKT Sprite Builder"))
			[ SNew(SHktSpriteBuilderPanel) ];
	}

	IConsoleObject* ConsoleCommand = nullptr;
};

const FName FHktSpriteGeneratorModule::BuilderTabName(TEXT("HktSpriteBuilder"));

IMPLEMENT_MODULE(FHktSpriteGeneratorModule, HktSpriteGenerator)
