// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktSpriteCore : ModuleRules
{
	public HktSpriteCore(ReadOnlyTargetRules Target) : base(Target)
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

		// 2D 스프라이트 파츠 파이프라인: 데이터 모델 + 순수 함수 프레임 리졸버 +
		// HISM 기반 Crowd 렌더러 + Presentation Processor.
		// HktCore / HktRuntime / HktPresentation / HktAsset에 의존.
		// HktRuntime은 Anim.* GameplayTag 공유 선언(HktRuntimeTags.h) 때문에 필요.
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"GameplayTags",
				"HktCore",
				"HktRuntime",
				"HktPresentation",
				"HktAsset",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"RHI",
				"RenderCore",
			}
		);

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
