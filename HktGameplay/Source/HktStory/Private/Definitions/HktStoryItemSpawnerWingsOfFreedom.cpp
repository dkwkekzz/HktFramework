// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetNPC.h"
#include "Snippets/HktSnippetItem.h"

namespace HktStoryItemSpawnerWingsOfFreedom
{
	using namespace HktStoryTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_Item_WingsOfFreedom, "Story.Flow.Spawner.Item.WingsOfFreedom", "Wings of Freedom item spawner.");

	// Entity
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_WingsOfFreedom, "Entity.Item.WingsOfFreedom", "Wings of Freedom item — Buff skill.");

	// Tags
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Item_WingsOfFreedom, "Entity.Attr.Item.WingsOfFreedom", "Wings of Freedom item tag.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Buff, "Entity.Attr.Skill.Buff", "Item skill identifier: Buff.");

	// Skill Story reference — 통합 UseSkill 파이프라인
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Skill_UseSkill_Ref, "Story.Event.Combat.UseSkill", "Unified skill pipeline story.");

	/**
	 * ================================================================
	 * 자유의 날개 아이템 스폰 (EntitySpawner 패턴)
	 *
	 * 자연어로 읽으면:
	 * "플레이어가 있을 때 60초마다 자유의 날개를 월드에 드랍한다.
	 *  아이템 수가 상한(1개)에 도달하면 대기한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_Item_WingsOfFreedom);
		B.SetFlowMode();
		int32 LoopLabel = B.AllocLabel();
		int32 WaitLabel = B.AllocLabel();

		FHktScopedRegBlock pos(B, 3);

		// 주기적 스포너 루프 시작 (플레이어 체크 + 아이템 1개 상한)
		HktSnippetNPC::SpawnerLoopBegin(B, LoopLabel, WaitLabel, Tag_Item_WingsOfFreedom, 1);

		// 위치 레지스터 로드 (이벤트 파라미터에서)
		B.ReadProperty(pos, SpawnerParams::SpawnPosX)
		 .ReadProperty(pos + 1, SpawnerParams::SpawnPosY)
		 .LoadConst(pos + 2, 0);

		// 아이템 엔티티 생성
		HktSnippetItem::SpawnGroundItemAtPos(B, Entity_Item_WingsOfFreedom, { 204 }, pos);

		B	// 아이템 속성 설정 — 날개는 공격력 없음, 자가 버프용
			.SaveConstEntity(Spawned, PropertyId::AttackPower, 0)
			.SetItemSkillTag(Spawned, Skill_UseSkill_Ref)
			.SaveConstEntity(Spawned, PropertyId::SkillCPCost, 30)
			.SaveConstEntity(Spawned, PropertyId::RecoveryFrame, 150)
			.SaveConstEntity(Spawned, PropertyId::SkillTargetRequired, 0)       // 셀프 버프
			.AddTag(Spawned, Tag_Item_WingsOfFreedom)
			.AddTag(Spawned, Tag_Skill_Buff)

			.Log(TEXT("WingsOfFreedom: item spawned"));

		// 주기적 스포너 루프 종결 (60초 대기)
		HktSnippetNPC::SpawnerLoopEnd(B, LoopLabel, WaitLabel, 60.0f);

		B.BuildAndRegister();
	}
}
