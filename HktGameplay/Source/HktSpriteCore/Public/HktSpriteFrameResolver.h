// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktSpriteTypes.h"

// ============================================================================
// Sprite Frame Resolver — Pure Function
//
// VM은 프레임을 모른다. (animState, animStartTick, now, facing) → (frameIndex, ...)는
// 프레젠테이션 레이어의 순수 함수로 해결한다. 같은 입력이면 항상 같은 출력.
// 히트스톱은 호출자가 NowTick/알파를 고정해 구현한다.
// ============================================================================

struct HKTSPRITECORE_API FHktSpriteFrameResolveInput
{
	const FHktSpriteAction* Action = nullptr;

	/** AnimState 전환 시점 (VM frame) */
	int64 AnimStartTick = 0;

	/** 현재 렌더 프레임의 VM tick (히트스톱 시 고정) */
	int64 NowTick = 0;

	/** VM tick 하나가 대응하는 밀리초 (예: 30Hz → ~33.33) */
	float TickDurationMs = 1000.f / 30.f;

	/** 렌더러가 원한 방향. 호출자가 Loadout/Facing에서 산출. */
	EHktSpriteFacing Facing = EHktSpriteFacing::S;

	/** 외부 속도 배율 (예: AttackSpeed 스탯). <=0이면 1.0. */
	float PlayRate = 1.f;
};

struct HKTSPRITECORE_API FHktSpriteFrameResolveResult
{
	/** 실제 렌더에 쓸 프레임 인덱스 */
	int32 FrameIndex = 0;

	/** 실제 샘플링할 방향 (mirror 결과 포함) */
	EHktSpriteFacing StoredFacing = EHktSpriteFacing::S;

	/** true면 UV를 좌우 반전 (미러 처리) */
	bool bFlipX = false;

	/** 다음 프레임까지의 보간 알파 [0,1). 미사용 시 0. */
	float BlendAlpha = 0.f;

	/** 비루프 액션이 마지막 프레임에 도달함 */
	bool bFinished = false;

	/** 유효한 프레임을 찾지 못했음 (Action null, Frames empty) */
	bool bInvalid = false;
};

/**
 * 프레임 선택 함수.
 * - PerFrameDurationMs가 비어있으면 고정 Duration으로 나눠 프레임 결정.
 * - 있으면 누적 비교로 정확한 프레임 선택.
 * - 루프면 % NumFrames, 비루프면 마지막 프레임 고정 + bFinished=true.
 */
HKTSPRITECORE_API FHktSpriteFrameResolveResult
HktResolveSpriteFrame(const FHktSpriteFrameResolveInput& In);

/** 월드 트랜스폼(yaw/카메라 yaw)에서 8방향 Facing을 도출하는 보조 함수. */
HKTSPRITECORE_API EHktSpriteFacing
HktFacingFromYaw(float EntityYawDegrees, float CameraYawDegrees);
