// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"

namespace HktStoryMoveStop
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_MoveStop, "Story.Event.Move.Stop", "Stop directional movement (ShoulderView WASD release).");

	/**
	 * ================================================================
	 * 이동 정지 Flow (ShoulderView)
	 *
	 * 자연어로 읽으면:
	 * "이동을 정지한다.
	 *  MoveForce를 0으로 설정하고 IsMoving을 해제한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_MoveStop);

		B.CancelOnDuplicate()

			// 이동 정지 — MoveForce=0, IsMoving=0
			.StopMovement(Self)

			.Halt()
			.BuildAndRegister();
	}
}
