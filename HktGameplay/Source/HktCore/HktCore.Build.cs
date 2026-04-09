// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktCore : ModuleRules
{
	public HktCore(ReadOnlyTargetRules Target) : base(Target)
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
				"GameplayTags",
				"Json",
				"JsonUtilities"
			}
		);
			
		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
			}
		);
		
		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);

		// ENABLE_HKT_INSIGHTS - 비-Shipping 빌드에서 인사이트 데이터 수집 활성화
		if (Target.Configuration != UnrealTargetConfiguration.Shipping)
		{
			PublicDefinitions.Add("ENABLE_HKT_INSIGHTS=1");
		}
		else
		{
			PublicDefinitions.Add("ENABLE_HKT_INSIGHTS=0");
		}
	}
}
