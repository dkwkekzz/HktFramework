// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktRuntime : ModuleRules
{
	public HktRuntime(ReadOnlyTargetRules Target) : base(Target)
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
				"GameplayTags",
                "NetCore",
                "EnhancedInput",
                "InputCore",
				"Json",
				"JsonUtilities",
				"HktCore",
				"HktTerrain",
				"HktRule",
				"HktAsset"
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

        // ENABLE_HKT_INSIGHTS는 HktCore에서 PublicDefinitions로 전파됨
    }
}
