// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktRuntimeTags.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetCombat.h"
#include "Snippets/HktSnippetItem.h"

namespace HktStoryCombatUseSkill
{
	using namespace HktStoryTags;
	using namespace HktGameplayTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Event_Combat_UseSkill, "Story.Event.Combat.UseSkill",
		"Unified skill pipeline — cooldown, CP (item), then dispatch to specific skill story or innate BasicAttack.");

	// Innate skill dispatch target
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_BasicAttack, "Story.Event.Attack.Basic", "Basic attack story (innate fallback).");

	// Anim (기본 일괄 데미지용)
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_UpperBody_Combat_Skill, "Anim.UpperBody.Combat.Skill",
		"Item skill upper body state tag.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_Montage_Skill, "Anim.Montage.Skill",
		"Item skill montage state tag.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_SkillHit, "VFX.Niagara.SkillHit", "Item skill hit VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_SkillHit, "Sound.SkillHit", "Item skill hit sound.");

	// 사망 마킹 태그
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_State_Dead, "State.Dead", "Dead state tag — lifecycle stories watch for this.");

	// === 아이템 스킬 식별 태그 (dispatch 분기용) ===
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Fireball,   "Entity.Attr.Skill.Fireball",   "Item skill identifier: Fireball.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Heal,       "Entity.Attr.Skill.Heal",       "Item skill identifier: Heal.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Lightning,   "Entity.Attr.Skill.Lightning",   "Item skill identifier: Lightning.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Skill_Buff,       "Entity.Attr.Skill.Buff",       "Item skill identifier: Buff.");

	// === Dispatch 대상 Story 태그 ===
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Fireball,   "Story.Event.Skill.Fireball",   "Fireball skill story.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Heal,       "Story.Event.Skill.Heal",       "Heal skill story.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Lightning,   "Story.Event.Skill.Lightning",   "Lightning skill story.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Buff,       "Story.Event.Skill.Buff",       "Buff skill story.");

	/**
	 * ================================================================
	 * 통합 스킬 사용 Flow (Story.Event.Combat.UseSkill)
	 *
	 * 자연어로 읽으면:
	 * "쿨타임을 확인한다. Param1 슬롯에 아이템이 있으면 아이템 스킬을 사용한다.
	 *  CP를 검증하고 차감한 뒤, 아이템 태그에 따라 고유 스킬 Story로 디스패치한다.
	 *  태그가 없으면 기본 일괄 데미지(공격력*2)를 실행한다.
	 *  슬롯에 아이템이 없으면 캐릭터 본연의 기본 공격(BasicAttack)을 디스패치한다."
	 *
	 * 쿨타임 갱신은 각 AttackStory가 자체 RecoveryFrame으로 수행한다.
	 * (인라인 기본 아이템 스킬만 아이템 RecoveryFrame 사용)
	 *
	 * 두 가지 진입 경로:
	 * 1. 슬롯 키: Param0 = 타겟 EntityId, Param1 = 슬롯 인덱스
	 * 2. TargetDefault: Target 레지스터에 타겟, Param1 = 0 (기본 슬롯)
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Event_Combat_UseSkill);

		int32 FailLabel = B.AllocLabel();
		int32 InnateLabel = B.AllocLabel();

		FHktScopedReg r0(B);       // 범용 임시
		FHktScopedReg r1(B);       // 범용 임시
		FHktScopedReg r2(B);       // 아이템 엔티티
		FHktScopedReg r3(B);       // CP 소모량
		FHktScopedReg r4(B);       // 현재 CP
		FHktScopedReg r5(B);       // 타겟 오버라이드 / 태그 체크

		B.SetPrecondition([](const FHktWorldState& WS, const FHktEvent& E) -> bool
			{
				if (!WS.IsValidEntity(E.SourceEntity))
					return false;

				// 공속 기반 쿨타임 검증
				int32 NextFrame = WS.GetProperty(E.SourceEntity, PropertyId::NextActionFrame);
				if (WS.FrameNumber < NextFrame)
					return false;

				// 쿨타임만 통과하면 허용 — CP 부족 시에도 본연 스킬(innate)로 fallback
				return true;
			});

		// === 공속 기반 쿨타임 검증 (서버 이중 검증) ===
		HktSnippetCombat::CooldownCheck(B, FailLabel);

		// === NextActionFrame 즉시 잠금 — 동일 프레임 중복 실행 방지 ===
		// 각 AttackStory가 CooldownUpdateConst로 실제 값을 덮어씀
		B.WriteConst(PropertyId::NextActionFrame, 0x7FFFFFFF);

		// === 타겟 해석: TargetOverride가 유효하면 사용, 아니면 기존 Target 레지스터 유지 ===
		B	.ReadProperty(r5, UseSkillParams::TargetOverride)
			.IfNeConst(r5, 0)
				.Move(Target, r5)
			.EndIf();

		// === Param1(슬롯)로 아이템 로드 시도 — 실패 시 innate 경로 ===
		HktSnippetItem::LoadItemFromSlot(B, r2, InnateLabel);

		B	// === 아이템 스킬 경로: CP 검증 및 차감 ===
			.LoadEntityProperty(r3, r2, PropertyId::SkillCPCost)        // r3 = CP 소모량
			.ReadProperty(r4, PropertyId::CP)                           // r4 = 현재 CP
			.CmpLt(Flag, r4, r3)                                        // CP < Cost?
			.JumpIf(Flag, InnateLabel)                                   // CP 부족 → 본연 스킬로 fallback

			// CP 차감
			.Sub(r4, r4, r3)
			.WriteProperty(PropertyId::CP, r4);

		// === 아이템 스킬 태그 확인 → 고유 스킬 dispatch ===
		// 쿨타임 갱신은 각 스킬 Story가 자체 RecoveryFrame으로 수행
		B	.HasTag(r5, r2, Tag_Skill_Fireball)
			.JumpIf(r5, TEXT("dispatch_fireball"))

			.HasTag(r5, r2, Tag_Skill_Heal)
			.JumpIf(r5, TEXT("dispatch_heal"))

			.HasTag(r5, r2, Tag_Skill_Lightning)
			.JumpIf(r5, TEXT("dispatch_lightning"))

			.HasTag(r5, r2, Tag_Skill_Buff)
			.JumpIf(r5, TEXT("dispatch_buff"))

			// === 기본 일괄 데미지 (고유 스킬 태그 없는 아이템 — 목검 등) ===
			;
		// 인라인 스킬은 아이템 RecoveryFrame으로 쿨타임 갱신
		HktSnippetCombat::CooldownUpdateFromEntity(B, r2);

		B	.AddTag(Self, Tag_Anim_UpperBody_Combat_Skill)
			.AddTag(Self, Tag_Anim_Montage_Skill)
			.WaitAnimEnd(Self)

			.ReadProperty(r0, PropertyId::AttackPower)
			.LoadConst(r1, 2)
			.Mul(r0, r0, r1)
			.ApplyDamage(Target, r0)
			.PlayVFXAttached(Target, VFX_SkillHit)
			.PlaySound(Sound_SkillHit);

		// 사망 판정
		HktSnippetCombat::CheckDeath(B, Target, Tag_State_Dead);

		B	.RemoveTag(Self, Tag_Anim_UpperBody_Combat_Skill)
			.RemoveTag(Self, Tag_Anim_Montage_Skill)

			.Log(TEXT("UseSkill: 아이템 기본 스킬 완료"))
			.Halt()

		// === 고유 스킬 Dispatch 분기 ===
		.Label(TEXT("dispatch_fireball"))
			.Log(TEXT("UseSkill: → Fireball"))
			.DispatchEvent(Story_Fireball)
			.Halt()

		.Label(TEXT("dispatch_heal"))
			.Log(TEXT("UseSkill: → Heal"))
			.DispatchEvent(Story_Heal)
			.Halt()

		.Label(TEXT("dispatch_lightning"))
			.Log(TEXT("UseSkill: → Lightning"))
			.DispatchEvent(Story_Lightning)
			.Halt()

		.Label(TEXT("dispatch_buff"))
			.Log(TEXT("UseSkill: → Buff"))
			.DispatchEvent(Story_Buff)
			.Halt()

		// === 본연 스킬 경로 (아이템 없음 → BasicAttack) ===
		// 쿨타임 갱신은 BasicAttack Story에서 자체 수행
		.Label(InnateLabel)
			.Log(TEXT("UseSkill: → 본연 스킬 (BasicAttack)"))
			.DispatchEvent(Story_BasicAttack)
			.Halt()

		.Label(FailLabel)
			.Fail()
		.BuildAndRegister();
	}
}
