// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktSpriteGenerator : ModuleRules
{
	public HktSpriteGenerator(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"Json",
				"JsonUtilities",
				"GameplayTags",
				"HktSpriteCore",
				"HktPresentation",  // UHktCameraModeBase / UHktCameraFramingProfile (Public/Camera)
				"DeveloperSettings",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
				"UnrealEd",
				"AssetRegistry",
				"AssetTools",
				"ImageWrapper",
				"Slate",
				"SlateCore",
				"AppFramework",          // SColorPicker (라이트 컬러 선택용)
				"EditorStyle",
				"ToolMenus",
				"WorkspaceMenuStructure",
				"InputCore",
				"DesktopPlatform",
				// AnimCaptureEditor (애니메이션 8방향 캡처 툴)
				"RenderCore",
				"RHI",
				"PropertyEditor",
				"EditorWidgets",
			}
		);
	}
}
