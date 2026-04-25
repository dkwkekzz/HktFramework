// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "SHktSpriteBuilderPanel.h"
#include "HktSpriteBillboardMaterialBuilder.h"
#include "HktSpriteCoreLog.h"
#include "Framework/Docking/TabManager.h"
#include "Widgets/Docking/SDockTab.h"
#include "WorkspaceMenuStructure.h"
#include "WorkspaceMenuStructureModule.h"
#include "HAL/IConsoleManager.h"
#include "Misc/CoreDelegates.h"

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
			.SetTooltipText(NSLOCTEXT("HktSpriteGen", "BuilderTabTip", "Pack textures into an atlas and build UHktSpriteCharacterTemplate."))
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

		// 기본 Y-axis 빌보드 머티리얼 에셋을 보장:
		//   - 엔진 초기화가 끝난 시점(AssetRegistry / Package 시스템 안정)에 체크.
		//   - 없으면 자동 생성·저장 → 개발자가 커밋해 Shipping 쿠킹에 포함.
		//   - 강제 재생성은 `HktSprite.BuildBillboardMaterial` 명령으로.
		PostEngineInitHandle = FCoreDelegates::OnPostEngineInit.AddStatic(
			&FHktSpriteGeneratorModule::EnsureBillboardMaterial);

		BuildBillboardCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktSprite.BuildBillboardMaterial"),
			TEXT("Force (re)build the default Y-axis sprite billboard material asset."),
			FConsoleCommandDelegate::CreateStatic(&FHktSpriteGeneratorModule::ForceBuildBillboardMaterial),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		if (ConsoleCommand)
		{
			IConsoleManager::Get().UnregisterConsoleObject(ConsoleCommand);
			ConsoleCommand = nullptr;
		}
		if (BuildBillboardCommand)
		{
			IConsoleManager::Get().UnregisterConsoleObject(BuildBillboardCommand);
			BuildBillboardCommand = nullptr;
		}
		if (PostEngineInitHandle.IsValid())
		{
			FCoreDelegates::OnPostEngineInit.Remove(PostEngineInitHandle);
			PostEngineInitHandle.Reset();
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

	static void EnsureBillboardMaterial()
	{
		// Cook 등 commandlet 컨텍스트에서는 새 에셋을 디스크에 생성하지 않는다 —
		// 개발자가 에디터에서 한 번 실행해 생성·커밋하는 것이 정상 경로.
		if (IsRunningCommandlet())
		{
			return;
		}
		if (HktSpriteBillboardMaterialBuilder::Exists())
		{
			return;
		}
		UE_LOG(LogHktSpriteCore, Log,
			TEXT("[HktSpriteGenerator] 기본 빌보드 머티리얼 에셋 없음 — 자동 생성한다."));
		HktSpriteBillboardMaterialBuilder::BuildAndSave(/*bForceOverwrite=*/false);
	}

	static void ForceBuildBillboardMaterial()
	{
		HktSpriteBillboardMaterialBuilder::BuildAndSave(/*bForceOverwrite=*/true);
	}

	IConsoleObject* ConsoleCommand         = nullptr;
	IConsoleObject* BuildBillboardCommand  = nullptr;
	FDelegateHandle PostEngineInitHandle;
};

const FName FHktSpriteGeneratorModule::BuilderTabName(TEXT("HktSpriteBuilder"));

IMPLEMENT_MODULE(FHktSpriteGeneratorModule, HktSpriteGenerator)
