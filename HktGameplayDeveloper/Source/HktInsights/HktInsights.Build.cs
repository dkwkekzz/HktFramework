// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktInsights : ModuleRules
{
    public HktInsights(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "Slate",
            "SlateCore",
            "InputCore",
			"GameplayTags",
            "HktCore"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
        });
    }
}
