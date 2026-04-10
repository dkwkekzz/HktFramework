// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"

namespace HktStoryMoveForward
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_MoveForward, "Story.Event.Move.Forward", "Directional movement (ShoulderView WASD).");

	/**
	 * ================================================================
	 * 방향 이동 Flow (ShoulderView)
	 *
	 * 자연어로 읽으면:
	 * "카메라 기준 방향 벡터를 목표 위치로 설정하여 이동을 시작한다.
	 *  이동 애니메이션 상태로 전환하고, 즉시 종료한다.
	 *  물리 시스템이 이동을 지속하며, MoveStop 이벤트가 도착하면 정지한다."
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_MoveForward);

		B.CancelOnDuplicate()

			// 목표 위치로 이동 시작 (Event.Location → TargetPosX/Y/Z)
			.MoveTowardProperty(Self, PropertyId::TargetPosX, 150)

			// 즉시 종료 — 물리 시스템이 이동 지속 (MoveStop이 정지 처리)
			.Halt()
			.BuildAndRegister();
	}
}
