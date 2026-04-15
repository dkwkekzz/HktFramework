// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktPresentation : ModuleRules
{
	public HktPresentation(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.AddRange(
			new string[] {
				System.IO.Path.Combine(ModuleDirectory, "..", "HktCore", "Public"),
				System.IO.Path.Combine(ModuleDirectory, "..", "HktRuntime", "Public"),
			}
		);

		PrivateIncludePaths.AddRange(
			new string[] {
				System.IO.Path.Combine(ModuleDirectory, "Private"),
			}
		);

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"InputCore",
				"EnhancedInput",
				"GameplayTags",
				"UMG",
				"Slate",
				"SlateCore",
				"Niagara",
				"HktCore",
				"HktRuntime",
				"HktAsset",
				"HktVFX",
				"HktVoxelCore",
				"HktVoxelSkin",
				"HktVoxelTerrain"
			}
		);
			
		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"DeveloperSettings"
			}
		);
		
		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
