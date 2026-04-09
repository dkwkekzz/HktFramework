// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktVoxelHitFeedback — 히트스탑 / 카메라 피드백 유틸리티
 *
 * 핵심: VM 틱은 절대 멈추지 않는다.
 * 히트스탑은 UE5 보간 레이어에서 TickAlpha 진행을 잠시 멈춰서
 * "화면이 정지한 것처럼" 보이게 하는 것. VM의 결정론성에 영향 없음.
 */
class HKTVOXELVFX_API FHktVoxelHitFeedback
{
public:
	/** HitType별 히트스탑 지속 시간 (초) */
	static float GetHitStopDuration(int32 HitType);

	/** HitType별 카메라 셰이크 강도 (0~1) */
	static float GetCameraShakeIntensity(int32 HitType);

	/** HitType별 크로매틱 에버레이션 강도 (0~1) */
	static float GetChromaticAberrationIntensity(int32 HitType);

	// HitType 상수
	static constexpr int32 HIT_NORMAL   = 0;
	static constexpr int32 HIT_CRITICAL = 1;
	static constexpr int32 HIT_KILL     = 2;
};
