// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetNPC.h"

namespace HktStoryItemSpawnerTreeDrop
{
	using namespace HktStoryTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_Item_TreeDrop, "Story.Flow.Spawner.Item.TreeDrop", "Natural item spawner - tree drops.");

	// Entity
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_Wood, "Entity.Item.Wood", "Wood material item.");

	// Tags
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Item_Wood, "Entity.Attr.Item.Wood", "Wood item tag.");

	/**
	 * ================================================================
	 * 자연 아이템 스폰 (EntitySpawner 패턴)
	 *
	 * 자연어로 읽으면:
	 * "플레이어가 있을 때 30초마다 나무 아이템을 월드에 드랍한다.
	 *  아이템 수가 상한에 도달하면 대기한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_Item_TreeDrop);
		int32 LoopLabel = B.AllocLabel();
		int32 WaitLabel = B.AllocLabel();

		FHktScopedRegBlock pos(B, 3); // 위치 (X, Y, Z)

		// 주기적 스포너 루프 시작 (플레이어 체크 + 아이템 10개 상한)
		HktSnippetNPC::SpawnerLoopBegin(B, LoopLabel, WaitLabel, Tag_Item_Wood, 10);

		B	// 아이템 엔티티 생성
			.SpawnEntity(Entity_Item_Wood)
			.SaveConstEntity(Spawned, PropertyId::ItemState, 0)               // Ground
			.SaveConstEntity(Spawned, PropertyId::ItemId, 101)                // Wood = 101
			.SaveConstEntity(Spawned, PropertyId::EquipIndex, -1)             // 미등록
			.AddTag(Spawned, Tag_Item_Material)
			.AddTag(Spawned, Tag_Item_Wood)

			// 위치 설정
			.ReadProperty(pos, SpawnerParams::SpawnPosX)
			.ReadProperty(pos + 1, SpawnerParams::SpawnPosY)
			.LoadConst(pos + 2, 0)
			.SetPosition(Spawned, pos)

			.Log(TEXT("TreeDrop: wood spawned"));

		// 주기적 스포너 루프 종결 (30초 대기)
		HktSnippetNPC::SpawnerLoopEnd(B, LoopLabel, WaitLabel, 30.0f);

		B.BuildAndRegister();
	}
}
