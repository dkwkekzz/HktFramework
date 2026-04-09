// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"

namespace HktStoryJump
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Jump, "Story.Event.Move.Jump", "Character jump action flow.");

	/**
	 * ================================================================
	 * 점프 Flow
	 *
	 * 자연어로 읽으면:
	 * "접지 상태에서만 점프 가능하다.
	 *  수직 속도를 부여하고 공중 상태로 전환한다.
	 *  점프 애니메이션을 재생하고 착지를 대기한다.
	 *  착지하면 점프 애니메이션을 제거하고 착지 몽타주를 재생한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Jump);

		B.CancelOnDuplicate()

			// Precondition: 접지 상태에서만 점프 가능
			.BeginPrecondition()
				.LoadStore(Flag, PropertyId::IsGrounded)
			.EndPrecondition()

			// 점프 시작: 수직 속도 부여 + 공중 상태 전환
			.ApplyJump(Self, 500)           // 500 cm/s 초기 수직 속도

			// 점프 애니메이션 태그 추가
			.AddTag(Self, HktStoryTags::Tag_Anim_FullBody_Jump)

			// 착지 대기 (중력 시스템이 IsGrounded=1로 전환 시 Grounded 이벤트 발생)
			.WaitGrounded(Self)

			// 착지 처리: 점프 애니메이션 제거, 착지 원샷 재생
			.RemoveTag(Self, HktStoryTags::Tag_Anim_FullBody_Jump)
			.PlayAnim(Self, HktStoryTags::Tag_Anim_Montage_Land)

			.Halt()
			.BuildAndRegister();
	}
}
