// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"

namespace HktStoryBuff
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Buff, "Story.Event.Skill.Buff", "Self-buff skill flow.");

	// State Tags — AnimInstance가 태그를 보고 애니메이션을 자동 재생
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_UpperBody_Cast_Buff, "Anim.UpperBody.Cast.Buff", "Buff cast state tag.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_BuffCast, "VFX.Niagara.BuffCast", "Buff cast VFX.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_BuffAura, "VFX.Niagara.BuffAura", "Buff aura VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Buff, "Sound.Buff", "Buff activation sound.");

	// Effect
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Effect_PowerUp, "Effect.PowerUp", "Power up buff effect: increased attack power.");

	/** Buff 고유 후딜레이 (표준) */
	static constexpr int32 RecoveryFrame = 30;

	/**
	 * ================================================================
	 * 자기 버프 스킬 Flow
	 *
	 * 자연어로 읽으면:
	 * "시전 상태 태그를 추가하면 AnimInstance가 자동으로 시전 애니메이션을 재생한다.
	 *  0.5초 대기 후 자신에게 파워업 이펙트를 적용하고
	 *  공격력을 10 증가시킨다.
	 *  완료 시 시전 상태 태그를 제거한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Buff);
		FHktScopedReg r0(B);

		// === 공격별 쿨타임 갱신 ===
		HktSnippetCombat::CooldownUpdateConst(B, RecoveryFrame);

		B	// 시전 상태 태그 추가 → AnimInstance가 태그를 감지하여 시전 애니메이션 자동 재생
			.AddTag(Self, Tag_Anim_UpperBody_Cast_Buff)
			.PlayVFXAttached(Self, VFX_BuffCast)
			.WaitSeconds(0.5f)

			// 버프 이펙트 적용
			.ApplyEffect(Self, Effect_PowerUp)

			// 공격력 +10
			.ReadProperty(r0, PropertyId::AttackPower)
			.AddImm(r0, r0, 10)
			.WriteProperty(PropertyId::AttackPower, r0)

			// 버프 오라 VFX + Sound
			.PlayVFXAttached(Self, VFX_BuffAura)
			.PlaySound(Sound_Buff)

			// 시전 상태 태그 제거
			.RemoveTag(Self, Tag_Anim_UpperBody_Cast_Buff)

			.Halt()
			.BuildAndRegister();
	}
}
