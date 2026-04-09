// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"

namespace HktStoryLightning
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Lightning, "Story.Event.Skill.Lightning", "Lightning strike skill flow.");

	// State Tags — AnimInstance가 태그를 보고 애니메이션을 자동 재생
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_UpperBody_Cast_Lightning, "Anim.UpperBody.Cast.Lightning", "Lightning cast state tag.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_ThunderStrike, "Sound.ThunderStrike", "Thunder strike sound.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_ThunderExplosion, "Sound.ThunderExplosion", "Thunder explosion sound.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_LightningStrike, "VFX.Niagara.LightningStrike", "Lightning strike VFX.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_LightningExplosion, "VFX.Niagara.LightningExplosion", "Lightning explosion AoE VFX.");

	// Effect
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Effect_Shock, "Effect.Shock", "Shock effect: stun.");

	// 사망 마킹 태그
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_State_Dead, "State.Dead", "Dead state tag — lifecycle stories watch for this.");

	/** Lightning 고유 후딜레이 (빠른 시전) */
	static constexpr int32 RecoveryFrame = 35;

	/**
	 * ================================================================
	 * 번개 스킬 Flow
	 *
	 * 자연어로 읽으면:
	 * "시전 상태 태그를 추가하면 AnimInstance가 자동으로 시전 애니메이션을 재생한다.
	 *  0.6초 대기 후 타겟 위치에 번개를 떨어뜨린다.
	 *  직격 대상에게 80 피해를 주고,
	 *  주변 200 범위 내 대상들에게 각각 30 피해와 감전을 입힌다.
	 *  완료 시 시전 상태 태그를 제거한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Lightning);
		FHktScopedRegBlock targetPos(B, 3);
		FHktScopedReg r6(B);

		// === 공격별 쿨타임 갱신 ===
		HktSnippetCombat::CooldownUpdateConst(B, RecoveryFrame);

		B	// === 시전 시작 ===
			.AddTag(Self, Tag_Anim_UpperBody_Cast_Lightning)
			.WaitSeconds(0.6f)                          // 0.6초 대기

			// === 타겟 위치에 번개 VFX ===
			.Log(TEXT("Lightning: 번개 낙뢰"))
			.GetPosition(targetPos, Target)              // targetPos = 타겟 위치
			.PlayVFX(targetPos, VFX_LightningStrike)
			.PlaySoundAtLocation(targetPos, Sound_ThunderStrike)

			// === 직격 대상에게 80 피해 ===
			.ApplyDamageConst(Target, 80)
			.PlayVFXAttached(Target, VFX_LightningExplosion);

		// 직격 사망 판정
		HktSnippetCombat::CheckDeath(B, Target, Tag_State_Dead);

		B	// === 범위 피해 (반경 200cm) ===
			.Log(TEXT("Lightning: 범위 피해 적용"))
			.PlaySoundAtLocation(targetPos, Sound_ThunderExplosion)

			.ForEachInRadius(Target, 200)               // Target 주변 200cm 내 적들
				.IfHasTrait(Iter, HktTrait::Hittable)
				.Move(r6, Iter)
				.ApplyDamageConst(r6, 30)               // 30 피해
				.ApplyEffect(r6, Effect_Shock);

			// AoE 사망 판정
			HktSnippetCombat::CheckDeath(B, r6, Tag_State_Dead);

		B	.EndIf()
			.EndForEach()

			// 시전 상태 태그 제거
			.RemoveTag(Self, Tag_Anim_UpperBody_Cast_Lightning)

			.Halt()
			.BuildAndRegister();
	}
}
