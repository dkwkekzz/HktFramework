// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktRule : ModuleRules
{
	public HktRule(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"GameplayTags",
				"HktCore"
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[] { }
		);
	}
}
