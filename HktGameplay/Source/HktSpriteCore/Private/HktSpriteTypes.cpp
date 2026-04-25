// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTypes.h"

// ============================================================================
// FHktSpriteAnimation::ResolveStoredFacing
//
// NumDirections 별 매핑:
//   1 → 항상 index 0 (no mirror).
//   5 → N=0, NE=1, E=2, SE=3, S=4. W/SW/NW는 bMirror=true면 E/SE/NE flipX,
//        아니면 clamp(…, 4).
//   8 → 그대로 0..7 (bMirror 무시).
// ============================================================================

EHktSpriteFacing FHktSpriteAnimation::ResolveStoredFacing(
	EHktSpriteFacing In, int32 NumDirections, bool bMirror, bool& OutFlipX)
{
	OutFlipX = false;

	if (NumDirections <= 1)
	{
		return EHktSpriteFacing::N; // 단일 = 인덱스 0
	}
	if (NumDirections >= 8)
	{
		return In;
	}

	// 5방향 저장
	if (bMirror)
	{
		switch (In)
		{
			case EHktSpriteFacing::W:  OutFlipX = true; return EHktSpriteFacing::E;
			case EHktSpriteFacing::SW: OutFlipX = true; return EHktSpriteFacing::SE;
			case EHktSpriteFacing::NW: OutFlipX = true; return EHktSpriteFacing::NE;
			default: break;
		}
		return In;
	}

	// mirror 없이 5방향만 저장되어 있을 때 폴백
	switch (In)
	{
		case EHktSpriteFacing::W:  return EHktSpriteFacing::E;
		case EHktSpriteFacing::SW: return EHktSpriteFacing::SE;
		case EHktSpriteFacing::NW: return EHktSpriteFacing::NE;
		default: return In;
	}
}

// ============================================================================
// FHktSpriteAnimation::MakeFrame — Frames[dir * FPD + frameIdx] 조회
// ============================================================================

FHktSpriteFrame FHktSpriteAnimation::MakeFrame(int32 DirIdx, int32 FrameIdx) const
{
	const int32 SafeDir   = FMath::Max(DirIdx, 0);
	const int32 SafeFrame = FMath::Max(FrameIdx, 0);
	const int32 FPD       = FMath::Max(FramesPerDirection, 1);
	const int32 Linear    = SafeDir * FPD + SafeFrame;

	if (Frames.IsValidIndex(Linear))
	{
		return Frames[Linear];
	}

	// 배열이 비거나 잘렸으면 피벗만 채운 기본 프레임 반환 — 렌더러 측 안전망.
	FHktSpriteFrame Fallback;
	Fallback.PivotOffset = PivotOffset;
	return Fallback;
}
