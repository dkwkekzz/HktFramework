// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktVoxelTerrain : ModuleRules
{
	public HktVoxelTerrain(ReadOnlyTargetRules Target) : base(Target)
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
				"HktCore",
				"HktVoxelCore",
				"Niagara",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"HktRuntime",
				"ImageWrapper",
			}
		);

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
