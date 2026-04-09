// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktRuntimeTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetItem.h"

namespace HktStoryPlayerInWorld
{
	using namespace HktStoryTags;
	using namespace HktGameplayTags;
	using namespace HktArchetypeTags;

	// Item
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_WoodenSword, "Entity.Item.WoodenSword", "Wooden sword starter item.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Weapon_Sword, "Entity.Attr.Weapon.Sword", "Sword weapon tag.");

	// Skill (목검의 고유 스킬 태그 — 추후 아이템별 고유 스킬 Story 등록 시 사용)
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Skill_WoodenSwordSlash, "Story.Event.Skill.WoodenSwordSlash", "Wooden sword slash skill.");
	// 통합 UseSkill Story로 라우팅
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Event_Combat_UseSkill_Ref, "Story.Event.Combat.UseSkill", "Unified skill pipeline story.");

	/**
	 * ================================================================
	 * 플레이어 월드 진입 상태 Flow
	 *
	 * 자연어로 읽으면:
	 * "플레이어 캐릭터를 생성하고 위치를 설정한다.
	 *  플레이어 속성을 초기화한다.
	 *  캐릭터가 파괴되기 전까지 이 상태를 유지한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_PlayerInWorld);
		FHktScopedRegBlock pos(B, 3);
		FHktScopedReg r0(B);

		B	// 캐릭터 엔티티 생성
			.SpawnEntity(Entity_Character_Player)
			.Move(Self, Spawned)                        // Self = 새로 생성된 캐릭터

			// 위치 설정 (이벤트의 Location에서)
			.LoadStore(pos, PropertyId::TargetPosX)
			.LoadStore(pos + 1, PropertyId::TargetPosY)
			.LoadStore(pos + 2, PropertyId::TargetPosZ)
			.SetPosition(Self, pos)

			// 스폰 이펙트
			.PlayVFXAttached(Self, VFX_SpawnEffect)
			.PlaySound(Sound_Spawn)

			// 플레이어 속성 설정
			.SetStance(Self, HktStance::Unarmed)
			.SaveConstEntity(Self, PropertyId::BagCapacity, 8)          // 가방 용량 8
			.SaveConstEntity(Self, PropertyId::MaxCP, 100)              // CP 최대 100
			.SaveConstEntity(Self, PropertyId::CP, 0)                   // CP 초기 0
			.SaveConstEntity(Self, PropertyId::AttackSpeed, 100)        // 공속 기본 1.0x (100 = 1.0)
			.SaveConstEntity(Self, PropertyId::NextActionFrame, 0)      // 즉시 행동 가능

			// === 복귀 플레이어 검사 ===
			.CountByOwner(r0, Self, Entity_Item)
			.CmpNeConst(Flag, r0, 0)
			.JumpIf(Flag, TEXT("skip_grant"))

			// === 초기 아이템: 목검 (신규 플레이어만) ===
			.Log(TEXT("PlayerInWorld: 목검 지급"))
			.SpawnEntity(Entity_Item_WoodenSword);

		// 소유권 설정
		HktSnippetItem::AssignOwnership(B, Spawned, Self);

		B
			.SaveConstEntity(Spawned, PropertyId::ItemState, 2)                // Active (자동 장착)
			.SaveConstEntity(Spawned, PropertyId::ItemId, 100)                 // 목검 ID
			.SaveConstEntity(Spawned, PropertyId::EquipIndex, 0)               // 액션 슬롯 0 (주무기)
			.SaveEntityProperty(Self, PropertyId::EquipSlot0, Spawned)          // 캐릭터.EquipSlot0 = 아이템 EntityId
			.SaveConstEntity(Spawned, PropertyId::AttackPower, 5)              // 공격력 5
			.SaveConstEntity(Spawned, PropertyId::Equippable, 1)               // 장착 가능
			.SetStance(Spawned, HktStance::Sword1H)                            // Stance
			.AddTag(Spawned, Tag_Weapon_Sword)
			// 아이템 스킬 데이터
			.SetItemSkillTag(Spawned, Event_Combat_UseSkill_Ref)            // 범용 아이템 스킬 Story로 라우팅
			.SaveConstEntity(Spawned, PropertyId::SkillCPCost, 30)             // 스킬 CP 소모 30
			.SaveConstEntity(Spawned, PropertyId::RecoveryFrame, 60);          // 기본 후딜레이 60프레임

		// 자동 장착: 아이템 스탯 + Stance를 캐릭터에 적용
		HktSnippetItem::ApplyItemStats(B, Spawned, Self);

		B.Label(TEXT("skip_grant"))
			.Log(TEXT("PlayerInWorld: 준비 완료, 상태 유지"))

			.BuildAndRegister();
	}
}
