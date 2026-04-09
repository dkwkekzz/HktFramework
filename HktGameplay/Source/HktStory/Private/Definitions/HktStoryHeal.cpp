// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"

namespace HktStoryHeal
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Heal, "Story.Event.Skill.Heal", "Heal skill ability flow.");

	// State Tags — AnimInstance가 태그를 보고 애니메이션을 자동 재생
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_UpperBody_Cast_Heal, "Anim.UpperBody.Cast.Heal", "Heal cast state tag.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_HealCast, "VFX.Niagara.HealCast", "Heal cast VFX.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_HealBurst, "VFX.Niagara.HealBurst", "Heal burst VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Heal, "Sound.Heal", "Heal sound.");

	/** Heal 고유 후딜레이 (회복 스킬은 긴 쿨타임) */
	static constexpr int32 RecoveryFrame = 60;

	/**
	 * ================================================================
	 * 회복 스킬 Flow
	 *
	 * 자연어로 읽으면:
	 * "시전 상태 태그를 추가하면 AnimInstance가 자동으로 시전 애니메이션을 재생한다.
	 *  자신의 체력을 회복량만큼 회복하고 최대치를 넘지 않도록 한다.
	 *  완료 시 시전 상태 태그를 제거한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Heal);
		FHktScopedReg r0(B);
		FHktScopedReg r1(B);
		FHktScopedReg r2(B);

		// === 공격별 쿨타임 갱신 ===
		HktSnippetCombat::CooldownUpdateConst(B, RecoveryFrame);

		B	// 시전 상태 태그 추가 → AnimInstance가 태그를 감지하여 시전 애니메이션 자동 재생
			.AddTag(Self, Tag_Anim_UpperBody_Cast_Heal)
			.PlayVFXAttached(Self, VFX_HealCast)
			.WaitSeconds(0.8f)

			// 현재 체력과 최대 체력 로드
			.ReadProperty(r0, PropertyId::Health)
			.ReadProperty(r1, PropertyId::MaxHealth)

			// 회복량 (HealParams에서, 기본 50)
			.ReadProperty(r2, HealParams::HealAmount)
			.IfEqConst(r2, 0)
				.LoadConst(r2, 50)                          // 기본값 50
			.EndIf()

			// 새 체력 = 현재 + 회복량
			.Add(r0, r0, r2)

			// 최대 체력 제한
			.IfGt(r0, r1)
				.Move(r0, r1)                               // 최대로 제한
			.EndIf()

			// 체력 저장
			.WriteProperty(PropertyId::Health, r0)

			// 회복 이펙트
			.PlayVFXAttached(Self, VFX_HealBurst)
			.PlaySound(Sound_Heal)

			// 시전 상태 태그 제거
			.RemoveTag(Self, Tag_Anim_UpperBody_Cast_Heal)

			.Halt()
			.BuildAndRegister();
	}
}
