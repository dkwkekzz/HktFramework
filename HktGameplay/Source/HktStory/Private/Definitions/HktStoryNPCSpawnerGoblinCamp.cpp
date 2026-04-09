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

namespace HktStoryNPCSpawnerGoblinCamp
{
	using namespace HktStoryTags;
	using namespace HktGameplayTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_GoblinCamp, "Story.Flow.Spawner.GoblinCamp", "Periodic goblin camp spawner flow.");

	/**
	 * ================================================================
	 * 고블린 캠프 주기적 스포너 Flow
	 *
	 * 자연어로 읽으면:
	 * "플레이어가 그룹에 있을 때만 고블린을 생성한다.
	 *  인구 상한(5마리)에 도달하면 대기한다.
	 *  10초마다 한 마리씩 스폰한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_GoblinCamp);
		int32 LoopLabel = B.AllocLabel();
		int32 WaitLabel = B.AllocLabel();

		FHktScopedRegBlock pos(B, 3);

		// 주기적 스포너 루프 시작 (플레이어 체크 + 인구 5마리 상한)
		HktSnippetNPC::SpawnerLoopBegin(B, LoopLabel, WaitLabel, Entity_NPC_Goblin, 5);

			// 위치 레지스터 로드 (이벤트 파라미터에서)
		B.ReadProperty(pos, SpawnerParams::SpawnPosX)          // SpawnPosX
		 .ReadProperty(pos + 1, SpawnerParams::SpawnPosY)      // SpawnPosY
		 .LoadConst(pos + 2, 0);                               // Z = ground

		// NPC 생성 + 스탯 설정 + 위치 지정
		HktSnippetNPC::SpawnNPCAtPosition(B, Entity_NPC_Goblin, { 80, 15, 3, 120, 0 }, pos);

		B.Log(TEXT("GoblinCamp: goblin spawned"));

		// 주기적 스포너 루프 종결 (10초 대기)
		HktSnippetNPC::SpawnerLoopEnd(B, LoopLabel, WaitLabel, 10.0f);

		B.BuildAndRegister();
	}
}
