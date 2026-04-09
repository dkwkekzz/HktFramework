// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktRuntimeTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetNPC.h"

namespace HktStoryNPCSpawnerWave
{
	using namespace HktStoryTags;
	using namespace HktGameplayTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_Wave_Arena, "Story.Flow.Spawner.Wave.Arena", "Wave-based arena spawner flow.");

	/**
	 * ================================================================
	 * 웨이브 스포너 Flow
	 *
	 * 자연어로 읽으면:
	 * "Wave 1: 고블린 3마리 스폰 → 전멸 대기 →
	 *  Wave 2: 스켈레톤 2마리 스폰 → 전멸 대기 → 완료."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_Wave_Arena);

		FHktScopedReg r5(B);       // SpawnPosX
		FHktScopedReg r6(B);       // SpawnPosY
		FHktScopedReg r7(B);       // SpawnPosZ

		B	// 이벤트 파라미터에서 스폰 위치 로드 (Self 엔티티 없음)
			.ReadProperty(r5, SpawnerParams::SpawnPosX)         // r5 = SpawnPosX
			.ReadProperty(r6, SpawnerParams::SpawnPosY)         // r6 = SpawnPosY
			.LoadConst(r7, 0)                                   // r7 = SpawnPosZ (ground)

			// === Wave 1: 고블린 3마리 ===
			.Log(TEXT("Wave 1: spawning goblins"))
			.Repeat(3);

		// 고블린 생성 + 스탯 설정 + 위치 지정
		HktSnippetNPC::SpawnNPCAtPosition(B, Entity_NPC_Goblin, { 80, 15, 0, 0, 0 }, r5);

		B	.EndRepeat()

			// Wave 1 전멸 대기
			.WaitUntilCountZero(Entity_NPC_Goblin, 2.0f)

			// === Wave 2: 스켈레톤 2마리 ===
			.Log(TEXT("Wave 2: spawning skeletons"))
			.Repeat(2);

		// 스켈레톤 생성 + 스탯 설정 + 위치 지정
		HktSnippetNPC::SpawnNPCAtPosition(B, Entity_NPC_Skeleton, { 60, 20, 0, 0, 0 }, r5);

		B	.EndRepeat()

			// Wave 2 전멸 대기
			.WaitUntilCountZero(Entity_NPC_Skeleton, 2.0f)

			.Halt()
		.BuildAndRegister();
	}
}
