// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"

namespace HktStoryFireball
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Fireball, "Story.Event.Skill.Fireball", "Fireball skill flow.");

	// Entity
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Projectile_Fireball, "Entity.Projectile.Fireball", "Fireball projectile entity.");

	// State Tags — AnimInstance가 태그를 보고 애니메이션을 자동 재생
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_UpperBody_Cast_Fireball, "Anim.UpperBody.Cast.Fireball", "Fireball cast state tag.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_FireballLaunch, "Sound.FireballLaunch", "Fireball launch sound.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Explosion, "Sound.Explosion", "Explosion sound.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_DirectHit, "VFX.Niagara.DirectHit", "Direct hit impact VFX.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_FireballExplosion, "VFX.Niagara.FireballExplosion", "Fireball explosion VFX.");

	// Effect
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Effect_Burn, "Effect.Burn", "Burn effect: fire damage over time.");

	// 사망 마킹 태그
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_State_Dead, "State.Dead", "Dead state tag — lifecycle stories watch for this.");

	/** Fireball 고유 후딜레이 (긴 시전 + 투사체) */
	static constexpr int32 RecoveryFrame = 45;

	/**
	 * ================================================================
	 * 파이어볼 스킬 Flow
	 *
	 * 자연어로 읽으면:
	 * "시전 상태 태그를 추가하면 AnimInstance가 자동으로 시전 애니메이션을 재생한다.
	 *  1초 대기 후 파이어볼을 생성하여 앞으로 날린다.
	 *  충돌하면 파이어볼을 제거하고 직격 대상에게 100 피해를 준다.
	 *  주변 300 범위 내 대상들에게 각각 50 피해와 화상을 입힌다.
	 *  완료 시 시전 상태 태그를 제거한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Fireball);
		FHktScopedRegBlock explosionPos(B, 3);
		FHktScopedReg hitTarget(B);     // Hit → GP 레지스터 복사용 (Label 합류점 무효화 방지)

		// === 공격별 쿨타임 갱신 ===
		HktSnippetCombat::CooldownUpdateConst(B, RecoveryFrame);

		B	// === 시전 시작 ===
			.AddTag(Self, Tag_Anim_UpperBody_Cast_Fireball)
			.WaitSeconds(1.0f)                          // 1초 대기

			// === 파이어볼 생성 및 발사 ===
			.Log(TEXT("Fireball: 투사체 생성"))
			.SpawnEntity(Entity_Projectile_Fireball)
			.SaveConstEntity(Spawned, PropertyId::IsGrounded, 0)  // 투사체: 비접지

			// 파이어볼 위치를 시전자 위치로 설정
			.CopyPosition(Spawned, Self)

			// 파이어볼을 전방으로 이동 (속도 500 cm/s)
			.MoveForward(Spawned, 500)
			.PlaySound(Sound_FireballLaunch)

			// === 충돌 대기 ===
			.Log(TEXT("Fireball: 충돌 대기 중..."))
			.WaitCollision(Spawned)                     // 충돌 시 Hit = 충돌 대상
			.Move(hitTarget, Hit)                       // Hit → GP 레지스터 (Label 무효화 방지)

			// === 충돌 처리 ===
			.Log(TEXT("Fireball: 충돌! 폭발 처리"))

			// 파이어볼 위치 저장 (폭발 위치)
			.GetPosition(explosionPos, Spawned)          // explosionPos = 폭발 위치

			// 파이어볼 제거
			.DestroyEntity(Spawned)

			// 직격 대상에게 100 피해
			.ApplyDamageConst(hitTarget, 100)
			.PlayVFXAttached(hitTarget, VFX_DirectHit);

		// 직격 사망 판정
		HktSnippetCombat::CheckDeath(B, hitTarget, Tag_State_Dead);

		B	// 폭발 이펙트
			.PlayVFX(explosionPos, VFX_FireballExplosion)
			.PlaySoundAtLocation(explosionPos, Sound_Explosion)

			// === 범위 피해 (반경 300cm) ===
			.Log(TEXT("Fireball: 범위 피해 적용"))

			.ForEachInRadius(hitTarget, 300)             // hitTarget 주변 300cm 내 적들
				.IfHasTrait(Iter, HktTrait::Hittable)
				.Move(Target, Iter)                      // Target = 현재 순회 대상
				.ApplyDamageConst(Target, 50)            // 50 피해
				.ApplyEffect(Target, Effect_Burn);

			// AoE 사망 판정
			HktSnippetCombat::CheckDeath(B, Target, Tag_State_Dead);

		B	.EndIf()
			.EndForEach()

			// 시전 상태 태그 제거
			.RemoveTag(Self, Tag_Anim_UpperBody_Cast_Fireball)

			.Halt()
			.BuildAndRegister();
	}
}
