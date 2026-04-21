// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktLandscapeTerrain : ModuleRules
{
	public HktLandscapeTerrain(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.AddRange(
			new string[] {
			}
		);

		PrivateIncludePaths.AddRange(
			new string[] {
			}
		);

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"RHI",
				"RenderCore",
				"Landscape",
				"HktCore",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"HktRuntime",
			}
		);

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
