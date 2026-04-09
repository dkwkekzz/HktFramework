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

namespace HktStoryItemSpawnerAncientStaff
{
	using namespace HktStoryTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Spawner_Item_AncientStaff, "Story.Flow.Spawner.Item.AncientStaff", "Ancient staff item spawner.");

	// Entity
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_AncientStaff, "Entity.Item.AncientStaff", "Ancient staff item — Fireball skill.");

	// Tags
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Item_AncientStaff, "Entity.Attr.Item.AncientStaff", "Ancient staff item tag.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Fireball, "Entity.Attr.Skill.Fireball", "Item skill identifier: Fireball.");

	// Skill Story reference — 통합 UseSkill 파이프라인
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Skill_UseSkill_Ref, "Story.Event.Combat.UseSkill", "Unified skill pipeline story.");

	/**
	 * ================================================================
	 * 고대 지팡이 아이템 스폰 (EntitySpawner 패턴)
	 *
	 * 자연어로 읽으면:
	 * "플레이어가 있을 때 60초마다 고대 지팡이를 월드에 드랍한다.
	 *  아이템 수가 상한(1개)에 도달하면 대기한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Spawner_Item_AncientStaff);
		B.SetFlowMode();
		int32 LoopLabel = B.AllocLabel();
		int32 WaitLabel = B.AllocLabel();

		FHktScopedRegBlock pos(B, 3);

		// 주기적 스포너 루프 시작 (플레이어 체크 + 아이템 1개 상한)
		HktSnippetNPC::SpawnerLoopBegin(B, LoopLabel, WaitLabel, Tag_Item_AncientStaff, 1);

		// 위치 레지스터 로드 (이벤트 파라미터에서)
		B.ReadProperty(pos, SpawnerParams::SpawnPosX)
		 .ReadProperty(pos + 1, SpawnerParams::SpawnPosY)
		 .LoadConst(pos + 2, 0);

		// 아이템 엔티티 생성
		HktSnippetItem::SpawnGroundItemAtPos(B, Entity_Item_AncientStaff, { 200 }, pos);

		B	// 아이템 속성 설정
			.SaveConstEntity(Spawned, PropertyId::AttackPower, 8)
			.SaveConstEntity(Spawned, PropertyId::Equippable, 1)
			.SetItemSkillTag(Spawned, Skill_UseSkill_Ref)
			.SaveConstEntity(Spawned, PropertyId::SkillCPCost, 50)
			.SaveConstEntity(Spawned, PropertyId::RecoveryFrame, 90)
			.SaveConstEntity(Spawned, PropertyId::SkillTargetRequired, 1)
			.SaveConstEntity(Spawned, PropertyId::AttackRange, 800)
			.SetStance(Spawned, HktStance::Spear)
			.AddTag(Spawned, Tag_Item_AncientStaff)
			.AddTag(Spawned, Tag_Skill_Fireball)

			.Log(TEXT("AncientStaff: item spawned"));

		// 주기적 스포너 루프 종결 (60초 대기)
		HktSnippetNPC::SpawnerLoopEnd(B, LoopLabel, WaitLabel, 60.0f);

		B.BuildAndRegister();
	}
}
