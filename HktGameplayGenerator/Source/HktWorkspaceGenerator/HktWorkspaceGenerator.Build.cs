// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktWorkspaceGenerator : ModuleRules
{
	public HktWorkspaceGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// I-0008 — 워크스페이스 자동 변환 디스패처. 기존 HktPaper2DGenerator /
		// HktSpriteGenerator 의 공개 빌더 API 만 호출하고, 그 내부에는 손대지 않는다.
		// 카테고리: Paper2D (HktPaper2DGenerator) / HISM (HktSpriteGenerator bridge).
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"Json",
				"JsonUtilities",
				"GameplayTags",
				"DeveloperSettings",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				// 디스패처가 호출하는 카테고리별 빌더.
				"HktPaper2DGenerator",   // UHktPaperSpriteBuilderFunctionLibrary
				"HktSpriteGenerator",    // EditorPackBundleFolderToAtlasPng / EditorExtractAtlasAndBundle / GetConventionBundleRoot
				"HktSpriteCore",         // UHktPaperAnimationDataAsset
				// Slate UI (워크스페이스 패널)
				"Slate",
				"SlateCore",
				"InputCore",
				"WorkspaceMenuStructure",
				"ToolMenus",
			}
		);

		// editor-only: 동적 GameplayTag 등록 — IGameplayTagsEditorModule::AddNewGameplayTagToINI
		if (Target.Type == TargetType.Editor)
		{
			PrivateDependencyModuleNames.Add("GameplayTagsEditor");
		}
	}
}
