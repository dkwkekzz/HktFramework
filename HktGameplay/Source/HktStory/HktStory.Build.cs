// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktStory : ModuleRules
{
	public HktStory(ReadOnlyTargetRules Target) : base(Target)
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
			
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"GameplayTags",
				"HktCore",
				"HktRuntime"
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
			}
		);

		// 에디터 전용 — UHktStoryEditorLibrary가 IGameplayTagsEditorModule::AddNewGameplayTagToINI를 호출.
		// (FFileHelper로 ini 직접 쓰기 + EditorRefreshGameplayTagTree 만으로는 Manager가 신규 ini를 재스캔하지 않음)
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(new string[]
			{
				"GameplayTagsEditor",
				"UnrealEd",
			});
		}

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
