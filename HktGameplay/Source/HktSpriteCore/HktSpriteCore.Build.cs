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
		// Paper2D 는 UHktPaperCharacterTemplate / UHktPaperActorVisualDataAsset 가
		// UPaperFlipbook 을 하드 참조하기 때문에 (Public 헤더에서 forward declare
		// 한 뒤 cpp 에서 include 하지만, UPROPERTY 직렬화 경로상 모듈 의존이 필수).
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
				"Paper2D",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"RHI",
				"RenderCore",
				// Niagara 기반 신규 크라우드 렌더러 (UHktSpriteNiagaraCrowdRenderer).
				// 기존 HISM 경로와 평행 운용 — CVar hkt.Sprite.Renderer 로 토글.
				"Niagara",
				"NiagaraCore",
			}
		);

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
