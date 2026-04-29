// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktTerrain : ModuleRules
{
	public HktTerrain(ReadOnlyTargetRules Target) : base(Target)
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

		// 지형 데이터 생성/관리/스트리밍 모듈.
		// HktCore 의 IHktTerrainDataSource 를 구현하며, 베이크/런타임 양 경로를 단일 모듈에서 소유한다.
		// HktCore 는 이 모듈에 의존하지 않는다 (단방향: HktTerrain → HktCore).
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"HktCore",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
			}
		);

		// 에디터 전용 — 베이크 라이브러리(UHktTerrainBakeLibrary)가 패키지 저장 / 자산 등록을 수행.
		// AssetRegistry 는 UnrealEd 가 transitive 하게 끌어오므로 별도 명시 불필요.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(new string[]
			{
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
