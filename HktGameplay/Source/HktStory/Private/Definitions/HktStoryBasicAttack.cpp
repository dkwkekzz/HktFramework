// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"

namespace HktStoryBasicAttack
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_BasicAttack, "Story.Event.Attack.Basic", "Basic attack ability flow.");

	// 공격 애니메이션 (트리거)
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_Montage_Attack, "Anim.Montage.Attack", "Basic attack montage trigger tag.");

	// 피격 애니메이션
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_Montage_HitReaction, "Anim.Montage.HitReaction", "Hit reaction montage trigger tag.");

	// 사망 마킹 태그
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_State_Dead, "State.Dead", "Dead state tag — lifecycle stories watch for this.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_HitSpark, "VFX.Niagara.HitSpark", "Melee hit spark VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Swing, "Sound.Swing", "Melee swing sound.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Hit, "Sound.Hit", "Melee hit sound.");

	/** 기본 공격 사거리 (cm) — 히트테스트 반경으로 사용 */
	static constexpr int32 DefaultAttackRange = 200;

	/** BasicAttack 고유 후딜레이 (빠른 기본 공격) */
	static constexpr int32 RecoveryFrame = 20;

	/**
	 * ================================================================
	 * Basic Attack Flow
	 *
	 * 자연어로 읽으면:
	 * "타겟을 바라보고 공격 애니메이션을 재생한다.
	 *  공격 사거리 내 히트테스트 영역을 생성하여 적을 검색한다.
	 *  맞은 대상에게 데미지를 부여하고 피격 이펙트를 생성한다.
	 *  체력이 0 이하이면 사망 태그를 부여한다."
	 *
	 * 사거리 검증과 접근은 TargetDefault에서 완료됨.
	 * 쿨타임 검증은 UseSkill에서, 갱신은 이 Story에서 자체 수행.
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_BasicAttack);

		FHktScopedReg atkPow(B);     // 공격력 (루프 내 보존)

		// === 공격별 쿨타임 갱신 ===
		HktSnippetCombat::CooldownUpdateConst(B, RecoveryFrame);

		B	// === 1. 타겟을 바라본다 ===
			.LookAt(Self, Target)

			// === 2. 공격 애니메이션 트리거 + 스윙 사운드 ===
			.PlaySound(Sound_Swing);
		HktSnippetCombat::AnimTrigger(B, Self, Tag_Anim_Montage_Attack);

		B	// === 3. 히트테스트 준비 ===
			.ReadProperty(atkPow, PropertyId::AttackPower)       // atkPow = 공격력 (루프 내 보존)

			// === 4. terrain 상호작용 (셀 예측 + Precondition) ===
			.InteractTerrain(Self, DefaultAttackRange)

			// === 5. 히트테스트 영역 — entity-only 공간 쿼리 ===
			.ForEachInRadius(Self, DefaultAttackRange)
				// Self 제외 + Hittable 대상만
				.IfNe(Iter, Self)
				.IfHasTrait(Iter, HktTrait::Hittable)

					// === Hit! 데미지 + 피격 처리 ===
					.Move(Target, Iter)
					.ApplyDamage(Target, atkPow)
					.PlayVFXAtEntity(Target, VFX_HitSpark)
					.PlaySound(Sound_Hit);
				HktSnippetCombat::AnimTrigger(B, Target, Tag_Anim_Montage_HitReaction);

				// 사망 판정 — 태그 마킹만, 처리는 Lifecycle에 위임
				HktSnippetCombat::CheckDeath(B, Target, Tag_State_Dead);

			B.EndIf()
			.EndIf()
			.EndForEach();

		// 공격 애니메이션 종료 대기 후 태그 정리
		B.WaitAnimEnd(Self)
		 .RemoveTag(Self, Tag_Anim_Montage_Attack)
		 .RemoveTag(Target, Tag_Anim_Montage_HitReaction)

		 .Halt()
		.BuildAndRegister();
	}
}
