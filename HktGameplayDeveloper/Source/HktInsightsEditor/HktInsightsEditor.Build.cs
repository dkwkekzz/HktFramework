// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktInsightsEditor : ModuleRules
{
    public HktInsightsEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "Slate",
            "SlateCore",
            "HktInsights"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "UnrealEd",
            "EditorStyle",
            "WorkspaceMenuStructure",
            "ToolMenus",
            "InputCore"
        });
    }
}
