// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktPaper2DGenerator : ModuleRules
{
	public HktPaper2DGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// Paper2D 경로 데이터 빌더 — 워크스페이스(`{Saved}/Workspace/Paper2D/{Tag}`) 가
		// 진실의 단일 출처. legacy SpriteGenerator 컨벤션·패널·MCP 진입점은 제거됐다.
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"Json",
				"JsonUtilities",
				"GameplayTags",
				"HktSpriteCore",   // UHktPaperAnimationDataAsset / UHktPaperActorVisualDataAsset / HktPaperUnlitMaterial
				"HktAsset",        // UHktTagDataAsset
				"HktPresentation", // UHktActorVisualDataAsset
				"Paper2D",         // UPaperSprite / UPaperFlipbook
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"UnrealEd",
				"AssetRegistry",
				"AssetTools",
				"ImageWrapper",
				"RenderCore",
				"RHI",
				"Paper2DEditor",   // FSpriteAssetInitParameters / FScopedFlipbookMutator
			}
		);

		// editor-only: 동적 GameplayTag 등록 — IGameplayTagsEditorModule::AddNewGameplayTagToINI
		if (Target.Type == TargetType.Editor)
		{
			PrivateDependencyModuleNames.Add("GameplayTagsEditor");
		}
	}
}
