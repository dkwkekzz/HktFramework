// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HAL/IConsoleManager.h"

#include "HktPaper2DGeneratorLog.h"
#include "HktPaperSpriteBuilderFunctionLibrary.h"

DEFINE_LOG_CATEGORY(LogHktPaper2DGenerator);

class FHktPaper2DGeneratorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
		BuildCharacterCommand = IConsoleManager::Get().RegisterConsoleCommand(
			TEXT("HktPaperSprite.BuildCharacter"),
			TEXT("Build all Paper2D animations for a character. Args: <CharacterTag> [PixelToWorld] [VisualIdentifierTag]"),
			FConsoleCommandWithArgsDelegate::CreateStatic(&FHktPaper2DGeneratorModule::ConsoleBuildCharacter),
			ECVF_Default);
	}

	virtual void ShutdownModule() override
	{
		if (BuildCharacterCommand)
		{
			IConsoleManager::Get().UnregisterConsoleObject(BuildCharacterCommand);
			BuildCharacterCommand = nullptr;
		}
	}

private:
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
};

IMPLEMENT_MODULE(FHktPaper2DGeneratorModule, HktPaper2DGenerator)
