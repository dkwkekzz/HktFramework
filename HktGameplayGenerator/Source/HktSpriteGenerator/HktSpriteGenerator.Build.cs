// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktSpriteGenerator : ModuleRules
{
	public HktSpriteGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"Json",
				"JsonUtilities",
				"GameplayTags",
				"HktSpriteCore",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"UnrealEd",
				"AssetRegistry",
				"AssetTools",
				"ImageWrapper",
				"Slate",
				"SlateCore",
				"EditorStyle",
				"ToolMenus",
				"WorkspaceMenuStructure",
				"InputCore",
				"DesktopPlatform",
			}
		);
	}
}
