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
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"HktRuntime",
				"ImageWrapper",
			}
		);

		// 에디터 전용 — 스타일 셋 베이킹 (UHktVoxelTerrainBakeLibrary).
		// Runtime/Shipping 빌드에는 누설되지 않는다.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
		}

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
