// Copyright Hkt Studios, Inc. All Rights Reserved.

using UnrealBuildTool;

public class HktSpriteTerrain : ModuleRules
{
	public HktSpriteTerrain(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;

		// 스프라이트 기반 지형 렌더 모듈.
		// UHktTerrainSubsystem 에서 청크 데이터를 받아 표면 셀을 추출, 단일 HISM 으로 렌더한다.
		// HktVoxelCore (메싱) 의존 0 — 데이터 소스는 HktTerrain 만.
		// HktSpriteCore 는 본 모듈과 무관 — 머티리얼/메시 슬롯이 별개 (Z-up plane vs Y-axis billboard).
		// 향후 공용 헬퍼 추출 시 의존 추가 예정.
		PublicDependencyModuleNames.AddRange(
			new string[]
			{
				"Core",
				"CoreUObject",
				"Engine",
				"HktCore",
				"HktTerrain",
			}
		);

		PrivateDependencyModuleNames.AddRange(
			new string[]
			{
			}
		);

		DynamicallyLoadedModuleNames.AddRange(
			new string[]
			{
			}
		);
	}
}
