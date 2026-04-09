// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"

namespace HktStoryCharacterSpawn
{
	using namespace HktStoryTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_CharacterSpawn, "Story.Flow.Character.Spawn", "Character spawn event flow.");

	// State Tags
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_Montage_Intro, "Anim.Montage.Intro", "Character intro montage state tag.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_ActivateGlow, "VFX.Niagara.ActivateGlow", "Item activate glow VFX.");

	// Item (장비 아이템)
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_Sword, "Entity.Item.Sword", "Sword weapon item entity.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_Shield, "Entity.Item.Shield", "Shield item entity.");

	/**
	 * ================================================================
	 * 캐릭터 입장 Flow
	 *
	 * 자연어로 읽으면:
	 * "캐릭터를 생성하고 스폰 상태 태그를 추가한다.
	 *  0.5초 후 장비를 생성하고 인트로 몽타주 태그를 추가한다.
	 *  완료 후 스폰/인트로 태그를 제거한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_CharacterSpawn);
		FHktScopedRegBlock pos(B, 3);

		B	// 캐릭터 스폰
			.SpawnEntity(Entity_Character_Player)
			.Move(Self, Spawned)                        // Self = 새로 생성된 캐릭터

			// 스폰 위치 설정 (IntentEvent에서 TargetPosX/Y/Z 로드)
			// 지형 높이 보정은 MovementSystem이 IsGrounded 엔티티를 자동 스냅
			.LoadStore(pos,                                        PropertyId::TargetPosX)
			.LoadStore(static_cast<RegisterIndex>(pos + 1),        PropertyId::TargetPosY)
			.LoadStore(static_cast<RegisterIndex>(pos + 2),        PropertyId::TargetPosZ)
			.SetPosition(Self, pos)

			// 스폰 이펙트
				.PlayVFXAttached(Self, VFX_SpawnEffect)
				.PlaySound(Sound_Spawn)

			// 스폰 상태 태그 추가 → AnimInstance가 태그를 감지하여 스폰 애니메이션 자동 재생
			.AddTag(Self, Tag_Anim_FullBody_Action_Spawn)

			// 0.5초 대기
			.WaitSeconds(0.5f)

			// === 장비 아이템 생성 (Entity로 통합) ===
			.Log(TEXT("CharacterSpawn: 장비 아이템 생성"))

			// 메인 무기 (슬롯 0)
			.SpawnEntity(Entity_Item_Sword)
			.SaveConstEntity(Spawned, PropertyId::EquipIndex, 0)
			.SaveConstEntity(Spawned, PropertyId::Equippable, 1)
			.SetStance(Spawned, HktStance::Sword1H)
			.PlayVFXAttached(Spawned, VFX_ActivateGlow)

			// 보조 장비 (슬롯 1)
			.SpawnEntity(Entity_Item_Shield)
			.SaveConstEntity(Spawned, PropertyId::EquipIndex, 1)

			// 인트로 몽타주 상태 태그 추가
			.AddTag(Self, Tag_Anim_Montage_Intro)
			.WaitAnimEnd(Self)

			// 준비 완료 - 스폰/인트로 태그 제거
			.RemoveTag(Self, Tag_Anim_FullBody_Action_Spawn)
			.RemoveTag(Self, Tag_Anim_Montage_Intro)

			.Halt()
			.BuildAndRegister();
	}
}
