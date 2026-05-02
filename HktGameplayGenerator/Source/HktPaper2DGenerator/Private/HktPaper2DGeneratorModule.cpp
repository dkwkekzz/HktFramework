// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HAL/IConsoleManager.h"
#include "Misc/CoreDelegates.h"

#include "HktPaper2DGeneratorLog.h"
#include "HktPaperUnlitMaterialBuilder.h"
#include "HktPaperSpriteBuilderFunctionLibrary.h"

DEFINE_LOG_CATEGORY(LogHktPaper2DGenerator);

class FHktPaper2DGeneratorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
		// 기본 Paper2D Unlit 머티리얼 자산을 보장:
		//   - 엔진 초기화 후(AssetRegistry / Package 안정) 체크.
		//   - 없으면 자동 생성·저장 → 개발자가 커밋해 Shipping 쿠킹에 포함.
		//   - 강제 재생성은 `HktPaperSprite.BuildUnlitMaterial`.
		PostEngineInitHandle = FCoreDelegates::OnPostEngineInit.AddStatic(
			&FHktPaper2DGeneratorModule::EnsureUnlitMaterial);

		BuildMaterialCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktPaperSprite.BuildUnlitMaterial"),
			TEXT("Force (re)build the default Paper2D sprite Unlit material asset (M_HktPaperUnlit)."),
			FConsoleCommandDelegate::CreateStatic(&FHktPaper2DGeneratorModule::ForceBuildUnlitMaterial),
			ECVF_Default);

		BuildCharacterCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktPaperSprite.BuildCharacter"),
			TEXT("Build all Paper2D animations for a character. Args: <CharacterTag> [PixelToWorld] [VisualIdentifierTag]"),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktPaper2DGeneratorModule::ConsoleBuildCharacter),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		auto Unregister = [](IConsoleObject*& Cmd)
		{
			if (Cmd) { IConsoleManager::Get().UnregisterConsoleObject(Cmd); Cmd = nullptr; }
		};
		Unregister(BuildMaterialCommand);
		Unregister(BuildCharacterCommand);

		if (PostEngineInitHandle.IsValid())
		{
			FCoreDelegates::OnPostEngineInit.Remove(PostEngineInitHandle);
			PostEngineInitHandle.Reset();
		}
	}

private:
	static void EnsureUnlitMaterial()
	{
		// Cook 등 commandlet 컨텍스트에서는 새 에셋을 디스크에 만들지 않는다 —
		// 개발자가 에디터에서 한 번 실행해 생성·커밋하는 것이 정상 경로.
		if (IsRunningCommandlet())
		{
			return;
		}
		if (HktPaperUnlitMaterialBuilder::Exists())
		{
			return;
		}
		UE_LOG(LogHktPaper2DGenerator, Log,
			TEXT("[HktPaper2DGenerator] 기본 Paper2D Unlit 머티리얼 에셋 없음 — 자동 생성한다."));
		HktPaperUnlitMaterialBuilder::BuildAndSave(/*bForceOverwrite=*/false);
	}

	static void ForceBuildUnlitMaterial()
	{
		HktPaperUnlitMaterialBuilder::BuildAndSave(/*bForceOverwrite=*/true);
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

	IConsoleObject* BuildMaterialCommand  = nullptr;
	IConsoleObject* BuildCharacterCommand = nullptr;
	FDelegateHandle PostEngineInitHandle;
};

IMPLEMENT_MODULE(FHktPaper2DGeneratorModule, HktPaper2DGenerator)
