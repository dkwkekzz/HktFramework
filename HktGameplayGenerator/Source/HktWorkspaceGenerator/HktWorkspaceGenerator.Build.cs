// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktWorkspaceGenerator : ModuleRules
{
	public HktWorkspaceGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// I-0008 — 워크스페이스 자동 변환 디스패처. 기존 HktPaper2DGenerator /
		// HktSpriteGenerator 의 공개 빌더 API 만 호출하고, 그 내부에는 손대지 않는다.
		// Paper2D 라인이 1차 범위. HISM 카테고리는 인터페이스만 마련.
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
				// Slate UI (워크스페이스 패널)
				"Slate",
				"SlateCore",
				"InputCore",
				"WorkspaceMenuStructure",
				"ToolMenus",
			}
		);
	}
}
