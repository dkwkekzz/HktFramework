// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktPaper2DGenerator : ModuleRules
{
	public HktPaper2DGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// Paper2D 경로 데이터 빌더 — 기존 HktSpriteGenerator(HISM/Niagara) 와 평행 운영.
		// HktSpriteGenerator 는 public static 컨벤션 헬퍼만 호출해 워크스페이스 위치를 얻는다 —
		// 헤더/cpp/패널/MCP 함수에 한 글자도 손대지 않는다.
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"Json",
				"JsonUtilities",
				"GameplayTags",
				"HktSpriteCore",   // UHktPaperCharacterTemplate / UHktPaperActorVisualDataAsset / HktPaperUnlitMaterial
				"HktAsset",        // UHktTagDataAsset
				"HktPresentation", // UHktActorVisualDataAsset
				"Paper2D",         // UPaperSprite / UPaperFlipbook
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"UnrealEd",
				"AssetRegistry",
				"AssetTools",
				"ImageWrapper",
				"RenderCore",
				"RHI",
				"Paper2DEditor",   // FSpriteAssetInitParameters / FScopedFlipbookMutator
				// 입력 헬퍼 — public static convention helper 호출 전용 (UHktSpriteGeneratorFunctionLibrary).
				"HktSpriteGenerator",
			}
		);
	}
}
