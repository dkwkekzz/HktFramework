// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"

namespace HktStoryMoveTo
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_MoveTo, "Story.Event.Move.ToLocation", "Move to location action flow.");

	// VFX (클라이언트 즉시 재생 — PresentationSubsystem::OnIntentSubmitted에서 처리)
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_MoveIndicator, "VFX.Niagara.MoveIndicator", "Move destination indicator VFX.");

	/**
	 * ================================================================
	 * 위치 이동 Flow
	 *
	 * 자연어로 읽으면:
	 * "이동 상태 태그를 추가하면 AnimInstance가 자동으로 이동 애니메이션을 재생한다.
	 *  목표 위치로 이동하고, 도착하면 정지한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_MoveTo);

		B.CancelOnDuplicate()

			// 목표 위치로 이동 시작 (힘 1500, Mass=100일 때 가속도 15cm/s²)
			.MoveTowardProperty(Self, PropertyId::TargetPosX, 150)

			// 이동 완료 대기
			.WaitMoveEnd(Self)

			// 정지 — 상태 태그 전환
			.StopMovement(Self)

			.Halt()
			.BuildAndRegister();
	}
}
