// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktRuntimeTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetNPC.h"

namespace HktStoryNPCSpawnerProximity
{
	using namespace HktStoryTags;
	using namespace HktGameplayTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_DungeonEntrance, "Story.Flow.Spawner.DungeonEntrance", "Proximity-triggered dungeon entrance spawner.");

	/**
	 * ================================================================
	 * 근접 트리거 스포너 Flow (던전 입구)
	 *
	 * 자연어로 읽으면:
	 * "Self(앵커 엔티티) 반경 20m 안에 적이 있을 때
	 *  스켈레톤 인구가 3마리 미만이면 스켈레톤을 생성한다.
	 *  5초마다 체크한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_DungeonEntrance);
		FHktScopedReg r0(B);
		FHktScopedRegBlock pos(B, 3);

		B.Label(TEXT("check"))
				// 플레이어 존재 확인
				.HasPlayerInGroup(Flag)
				.JumpIfNot(Flag, TEXT("sleep"))

				// 반경 내 엔티티 검색 (20m = 2000cm)
				.FindInRadius(Self, 2000)
				.NextFound()
				.JumpIfNot(Flag, TEXT("sleep"))

				// 인구 체크
				.CountByTag(r0, Entity_NPC_Skeleton)
				.CmpGeConst(Flag, r0, 3)
				.JumpIf(Flag, TEXT("sleep"))

				// 위치 로드
				.GetPosition(pos, Self);

		// NPC 생성 + 스탯 설정 + 위치 지정
		HktSnippetNPC::SpawnNPCAtPosition(B, Entity_NPC_Skeleton, { 60, 20, 2, 100, 0 }, pos);

		B

			.Log(TEXT("DungeonEntrance: skeleton spawned"))

		.Label(TEXT("sleep"))
			.WaitSeconds(5.0f)
			.Jump(TEXT("check"))
		.BuildAndRegister();
	}
}
