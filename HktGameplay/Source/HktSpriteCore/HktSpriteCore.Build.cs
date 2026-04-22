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
		// HktCore / HktPresentation / HktAsset에 의존.
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"GameplayTags",
				"HktCore",
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

		// 에디터 최초 실행 시 기본 Y-axis 빌보드 머티리얼을
		// `/HktGameplay/Materials/M_HktSpriteYBillboard.uasset`에 저장하기 위한
		// 에디터 전용 의존. Shipping 빌드에는 포함되지 않으므로 런타임 에셋 로드
		// (`LoadObject`)에만 의존해 동작한다.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(
				new string[]
				{
					"AssetRegistry",
				}
			);
		}

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
