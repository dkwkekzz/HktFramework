// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;
using System.IO;

public class HktAutomationTests : ModuleRules
{
    public HktAutomationTests(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "GameplayTags",
            "HktCore"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
        });

        // HktCore Private 헤더 접근 (VM, Runtime, Context, Proxy)
        string HktCorePrivatePath = Path.GetFullPath(
            Path.Combine(ModuleDirectory, "../../..", "HktGameplay", "Source", "HktCore", "Private"));
        PrivateIncludePaths.Add(HktCorePrivatePath);
    }
}
