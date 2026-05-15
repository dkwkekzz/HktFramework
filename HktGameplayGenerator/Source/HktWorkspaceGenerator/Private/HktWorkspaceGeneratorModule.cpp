// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HAL/IConsoleManager.h"
#include "Framework/Docking/TabManager.h"
#include "Widgets/Docking/SDockTab.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"
#include "Styling/AppStyle.h"

#include "HktWorkspaceLog.h"
#include "HktWorkspaceFunctionLibrary.h"
#include "SHktWorkspacePanel.h"

DEFINE_LOG_CATEGORY(LogHktWorkspace);

class FHktWorkspaceGeneratorModule : public IModuleInterface
{
public:
	static const FName WorkspacePanelTabName;

	virtual void StartupModule() override
	{
		FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
			WorkspacePanelTabName,
			FOnSpawnTab::CreateStatic(&FHktWorkspaceGeneratorModule::SpawnPanelTab))
			.SetDisplayName(NSLOCTEXT("HktWorkspace", "PanelTab", "HKT Workspace"))
			.SetTooltipText(NSLOCTEXT("HktWorkspace", "PanelTabTip",
				"워크스페이스(2D/HISM) 자동 빌드 패널 — {Saved}/Workspace/{Cat}/{Tag} 를 스캔해 DataAsset 자동 산출"))
			.SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsMiscCategory())
			.SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "LevelEditor.Tabs.Details"));

		ScanCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktWorkspace.Scan"),
			TEXT("Workspace 스캔 — Tag 목록과 stale 상태 출력."),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktWorkspaceGeneratorModule::ConsoleScan),
			ECVF_Default);

		BuildAllCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktWorkspace.BuildAll"),
			TEXT("Workspace 일괄 빌드. 인자: [force=0|1] [root=path]"),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktWorkspaceGeneratorModule::ConsoleBuildAll),
			ECVF_Default);

		BuildTagCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktWorkspace.BuildTag"),
			TEXT("단일 Tag 빌드. 인자: <Category> <TagFolderName> [force=0|1]"),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktWorkspaceGeneratorModule::ConsoleBuildTag),
			ECVF_Default);

		PanelCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktWorkspace.Panel"),
			TEXT("HKT Workspace 패널 열기."),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FGlobalTabmanager::Get()->TryInvokeTab(FHktWorkspaceGeneratorModule::WorkspacePanelTabName);
			}),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		auto Unregister = [](IConsoleObject*& Cmd)
		{
			if (Cmd) { IConsoleManager::Get().UnregisterConsoleObject(Cmd); Cmd = nullptr; }
		};
		Unregister(ScanCommand);
		Unregister(BuildAllCommand);
		Unregister(BuildTagCommand);
		Unregister(PanelCommand);

		if (FGlobalTabmanager::Get()->HasTabSpawner(WorkspacePanelTabName))
		{
			FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(WorkspacePanelTabName);
		}
	}

private:
	static TSharedRef<SDockTab> SpawnPanelTab(const FSpawnTabArgs& /*Args*/)
	{
		return SNew(SDockTab)
			.TabRole(NomadTab)
			.Label(NSLOCTEXT("HktWorkspace", "PanelTabLabel", "HKT Workspace"))
			[
				SNew(SHktWorkspacePanel)
			];
	}

	static void ConsoleScan(const TArray<FString>& /*Args*/)
	{
		const FString Json = UHktWorkspaceFunctionLibrary::ListWorkspaceTags(FString());
		UE_LOG(LogHktWorkspace, Log, TEXT("%s"), *Json);
	}

	static bool ParseBoolArg(const FString& Arg)
	{
		return Arg.Equals(TEXT("1")) || Arg.Equals(TEXT("true"), ESearchCase::IgnoreCase);
	}

	static void ConsoleBuildAll(const TArray<FString>& Args)
	{
		bool bForce = false;
		FString Root;
		for (const FString& A : Args)
		{
			if (A.StartsWith(TEXT("force="))) bForce = ParseBoolArg(A.Mid(6));
			else if (A.StartsWith(TEXT("root="))) Root = A.Mid(5);
		}
		const FString Json = UHktWorkspaceFunctionLibrary::ScanAndBuildAll(Root, bForce);
		UE_LOG(LogHktWorkspace, Log, TEXT("%s"), *Json);
	}

	static void ConsoleBuildTag(const TArray<FString>& Args)
	{
		if (Args.Num() < 2)
		{
			UE_LOG(LogHktWorkspace, Warning,
				TEXT("HktWorkspace.BuildTag <Category> <TagFolderName> [force=0|1]"));
			return;
		}
		const FString Category   = Args[0];
		const FString FolderName = Args[1];
		bool bForce = false;
		for (int32 i = 2; i < Args.Num(); ++i)
		{
			if (Args[i].StartsWith(TEXT("force="))) bForce = ParseBoolArg(Args[i].Mid(6));
		}
		const FString Json = UHktWorkspaceFunctionLibrary::BuildTag(Category, FolderName, bForce, FString());
		UE_LOG(LogHktWorkspace, Log, TEXT("%s"), *Json);
	}

	IConsoleObject* ScanCommand     = nullptr;
	IConsoleObject* BuildAllCommand = nullptr;
	IConsoleObject* BuildTagCommand = nullptr;
	IConsoleObject* PanelCommand    = nullptr;
};

const FName FHktWorkspaceGeneratorModule::WorkspacePanelTabName(TEXT("HktWorkspacePanel"));

IMPLEMENT_MODULE(FHktWorkspaceGeneratorModule, HktWorkspaceGenerator)
