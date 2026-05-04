// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HAL/IConsoleManager.h"
#include "Framework/Docking/TabManager.h"
#include "Widgets/Docking/SDockTab.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"
#include "Styling/AppStyle.h"

#include "HktPaper2DGeneratorLog.h"
#include "HktPaperSpriteBuilderFunctionLibrary.h"
#include "SHktPaperSpriteBuilderPanel.h"

DEFINE_LOG_CATEGORY(LogHktPaper2DGenerator);

class FHktPaper2DGeneratorModule : public IModuleInterface
{
public:
	static const FName BuilderTabName;

	virtual void StartupModule() override
	{
		// Builder 탭 — `SHktSpriteBuilderPanel` 의 Paper2D 미러.
		FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
			BuilderTabName,
			FOnSpawnTab::CreateStatic(&FHktPaper2DGeneratorModule::SpawnBuilderTab))
			.SetDisplayName(NSLOCTEXT("HktPaper2DGen", "BuilderTab", "HKT Paper2D Sprite Builder"))
			.SetTooltipText(NSLOCTEXT("HktPaper2DGen", "BuilderTabTip",
				"Paper2D 빌더 패널 — Workspace 의 atlas PNG 들을 임포트해 UPaperSprite/UPaperFlipbook/DA_Paper* 자산을 빌드한다."))
			.SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsMiscCategory())
			.SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "LevelEditor.Tabs.Details"));

		BuildCharacterCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktPaperSprite.BuildCharacter"),
			TEXT("Build all Paper2D animations for a character. Args: <CharacterTag> [PixelToWorld] [VisualIdentifierTag]"),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktPaper2DGeneratorModule::ConsoleBuildCharacter),
			ECVF_Default);

		BuilderCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktPaperSprite.Builder"),
			TEXT("Open HKT Paper2D Sprite Builder panel."),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FGlobalTabmanager::Get()->TryInvokeTab(BuilderTabName);
			}),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		auto Unregister = [](IConsoleObject*& Cmd)
		{
			if (Cmd) { IConsoleManager::Get().UnregisterConsoleObject(Cmd); Cmd = nullptr; }
		};
		Unregister(BuildCharacterCommand);
		Unregister(BuilderCommand);

		if (FGlobalTabmanager::Get()->HasTabSpawner(BuilderTabName))
		{
			FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(BuilderTabName);
		}
	}

private:
	static TSharedRef<SDockTab> SpawnBuilderTab(const FSpawnTabArgs& /*Args*/)
	{
		return SNew(SDockTab)
			.TabRole(NomadTab)
			.Label(NSLOCTEXT("HktPaper2DGen", "BuilderTabLabel", "HKT Paper2D Sprite Builder"))
			[
				SNew(SHktPaperSpriteBuilderPanel)
			];
	}

	static void ConsoleBuildCharacter(const TArray<FString>& Args)
	{
		if (Args.Num() < 1)
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("HktPaperSprite.BuildCharacter <CharacterTag> [PixelToWorld] [VisualIdentifierTag]"));
			return;
		}
		const FString CharacterTagStr = Args[0];
		const float PixelToWorld = (Args.Num() >= 2) ? FCString::Atof(*Args[1]) : 2.0f;
		const FString VisualIdentifierTagStr = (Args.Num() >= 3) ? Args[2] : FString();

		const FString Result = UHktPaperSpriteBuilderFunctionLibrary::BuildPaperCharacter(
			CharacterTagStr, VisualIdentifierTagStr, PixelToWorld, /*OutputDir=*/FString());
		UE_LOG(LogHktPaper2DGenerator, Log, TEXT("BuildPaperCharacter result: %s"), *Result);
	}

	IConsoleObject* BuildCharacterCommand = nullptr;
	IConsoleObject* BuilderCommand        = nullptr;
};

const FName FHktPaper2DGeneratorModule::BuilderTabName(TEXT("HktPaper2DSpriteBuilder"));

IMPLEMENT_MODULE(FHktPaper2DGeneratorModule, HktPaper2DGenerator)
