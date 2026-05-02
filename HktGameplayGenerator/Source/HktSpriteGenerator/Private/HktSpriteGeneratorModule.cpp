// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "SHktSpriteToolsWindow.h"
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
	static const FName ToolsTabName;

	virtual void StartupModule() override
	{
		FGlobalTabmanager::Get()->RegisterNomadTabSpawner(
			ToolsTabName,
			FOnSpawnTab::CreateStatic(&FHktSpriteGeneratorModule::SpawnToolsTab))
			.SetDisplayName(NSLOCTEXT("HktSpriteGen", "ToolsTab", "HKT Sprite Tools"))
			.SetTooltipText(NSLOCTEXT("HktSpriteGen", "ToolsTabTip",
				"통합 Sprite 도구 창 — Builder / Anim Capture / Video / Terrain / MCP JSON 탭."))
			.SetGroup(WorkspaceMenu::GetMenuStructure().GetDeveloperToolsMiscCategory())
			.SetIcon(FSlateIcon(FAppStyle::GetAppStyleSetName(), "LevelEditor.Tabs.Details"));

		// 통합 창 — 새 표준 명령.
		ToolsCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktSprite.Tools"),
			TEXT("Open HKT Sprite Tools (unified Builder / AnimCapture / Video / Terrain / McpJson tabs)"),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FHktSpriteGeneratorModule::OpenToolsTab(SHktSpriteToolsWindow::ETabId::Builder);
			}),
			ECVF_Default);

		// 호환성: 기존 명령은 통합 창의 해당 탭으로 점프.
		BuilderCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktSprite.Builder"),
			TEXT("Open HKT Sprite Tools (Builder tab)"),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FHktSpriteGeneratorModule::OpenToolsTab(SHktSpriteToolsWindow::ETabId::Builder);
			}),
			ECVF_Default);

		AnimCaptureCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktSprite.AnimCapture"),
			TEXT("Open HKT Sprite Tools (Anim Capture tab)"),
			FConsoleCommandDelegate::CreateLambda([]()
			{
				FHktSpriteGeneratorModule::OpenToolsTab(SHktSpriteToolsWindow::ETabId::AnimCapture);
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
		auto Unregister = [](IConsoleObject*& Cmd)
		{
			if (Cmd) { IConsoleManager::Get().UnregisterConsoleObject(Cmd); Cmd = nullptr; }
		};
		Unregister(ToolsCommand);
		Unregister(BuilderCommand);
		Unregister(AnimCaptureCommand);
		Unregister(BuildBillboardCommand);

		if (PostEngineInitHandle.IsValid())
		{
			FCoreDelegates::OnPostEngineInit.Remove(PostEngineInitHandle);
			PostEngineInitHandle.Reset();
		}
		if (FGlobalTabmanager::Get()->HasTabSpawner(ToolsTabName))
		{
			FGlobalTabmanager::Get()->UnregisterNomadTabSpawner(ToolsTabName);
		}
	}

private:
	static TSharedRef<SDockTab> SpawnToolsTab(const FSpawnTabArgs& Args)
	{
		TSharedRef<SHktSpriteToolsWindow> Window = SNew(SHktSpriteToolsWindow);
		// 새로 스폰된 창 핸들을 약하게 저장해 다음 콘솔 명령에서 SelectTab 호출 가능.
		ActiveWindow = Window;
		return SNew(SDockTab)
			.TabRole(NomadTab)
			.Label(NSLOCTEXT("HktSpriteGen", "ToolsTabLabel", "HKT Sprite Tools"))
			[ Window ];
	}

	static void OpenToolsTab(SHktSpriteToolsWindow::ETabId InitialTab)
	{
		FGlobalTabmanager::Get()->TryInvokeTab(ToolsTabName);
		// TryInvokeTab 후에는 SpawnToolsTab 이 실행되어 ActiveWindow 가 갱신됐을 수도,
		// 이미 떠 있던 창을 재활성화한 것일 수도 있다. 어느 쪽이든 활성 창에 탭을 지정.
		if (TSharedPtr<SHktSpriteToolsWindow> W = ActiveWindow.Pin())
		{
			W->SelectTab(static_cast<int32>(InitialTab));
		}
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

	IConsoleObject* ToolsCommand          = nullptr;
	IConsoleObject* BuilderCommand        = nullptr;
	IConsoleObject* AnimCaptureCommand    = nullptr;
	IConsoleObject* BuildBillboardCommand = nullptr;
	FDelegateHandle PostEngineInitHandle;

	// 콘솔 명령으로 탭을 지정하기 위해 마지막으로 스폰된 창을 약하게 보관.
	static TWeakPtr<SHktSpriteToolsWindow> ActiveWindow;
};

const FName FHktSpriteGeneratorModule::ToolsTabName(TEXT("HktSpriteTools"));
TWeakPtr<SHktSpriteToolsWindow> FHktSpriteGeneratorModule::ActiveWindow;

IMPLEMENT_MODULE(FHktSpriteGeneratorModule, HktSpriteGenerator)
