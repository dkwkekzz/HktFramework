// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktSplatCore : ModuleRules
{
	public HktSplatCore(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"RenderCore",
				"RHI",
				"Renderer",   // FSceneViewExtension 컴포짓 훅 (FPostProcessingInputs)
				"Projects",   // IPluginManager — 셰이더 디렉토리 매핑
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
