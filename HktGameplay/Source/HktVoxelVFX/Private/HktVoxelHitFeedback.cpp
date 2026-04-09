// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelHitFeedback.h"

float FHktVoxelHitFeedback::GetHitStopDuration(int32 HitType)
{
	switch (HitType)
	{
		case HIT_NORMAL:   return 0.03f;
		case HIT_CRITICAL: return 0.07f;
		case HIT_KILL:     return 0.15f;
		default:           return 0.0f;
	}
}

float FHktVoxelHitFeedback::GetCameraShakeIntensity(int32 HitType)
{
	switch (HitType)
	{
		case HIT_NORMAL:   return 0.3f;
		case HIT_CRITICAL: return 0.6f;
		case HIT_KILL:     return 1.0f;
		default:           return 0.0f;
	}
}

float FHktVoxelHitFeedback::GetChromaticAberrationIntensity(int32 HitType)
{
	switch (HitType)
	{
		case HIT_NORMAL:   return 0.0f;
		case HIT_CRITICAL: return 0.15f;
		case HIT_KILL:     return 0.3f;
		default:           return 0.0f;
	}
}
