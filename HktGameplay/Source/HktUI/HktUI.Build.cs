// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktUI : ModuleRules
{
	public HktUI(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.AddRange(
			new string[] {
				System.IO.Path.Combine(ModuleDirectory, "..", "HktCore", "Public"),
				System.IO.Path.Combine(ModuleDirectory, "..", "HktRuntime", "Public"),
				System.IO.Path.Combine(ModuleDirectory, "..", "HktRule", "Public"),
			}
		);

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"InputCore",
				"GameplayTags",
				"UMG",
				"Slate",
				"SlateCore",
				"MediaAssets",
				"CommonUI",
				"CommonInput",
				"HktCore",
				"HktRuntime",
				"HktAsset",
				"HktPresentation",
				"HktRule"
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"DeveloperSettings"
			}
		);
	}
}
