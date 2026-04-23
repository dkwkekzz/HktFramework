// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTypes.h"

// ============================================================================
// FHktSpriteAction::ResolveStoredFacing
//
// NumDirections 별 매핑:
//   1 → 항상 index 0 (no mirror).
//   5 → N=0, NE=1, E=2, SE=3, S=4. W/SW/NW는 bMirror=true면 E/SE/NE flipX,
//        아니면 clamp(…, 4).
//   8 → 그대로 0..7 (bMirror 무시).
// ============================================================================

EHktSpriteFacing FHktSpriteAction::ResolveStoredFacing(
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
// FHktSpriteAction::MakeFrame — 그리드 규칙 + Overrides 합성
// ============================================================================

FHktSpriteFrame FHktSpriteAction::MakeFrame(int32 DirIdx, int32 FrameIdx) const
{
	FHktSpriteFrame Out;
	Out.AtlasIndex  = StartAtlasIndex + FMath::Max(DirIdx, 0) * FMath::Max(FramesPerDirection, 1) + FMath::Max(FrameIdx, 0);
	Out.PivotOffset = PivotOffset;

	// Overrides는 소수 항목이므로 선형 스캔으로 충분.
	for (const FHktSpriteFrameOverride& Ov : FrameOverrides)
	{
		const bool bDirMatches   = (Ov.DirectionIndex < 0) || (Ov.DirectionIndex == DirIdx);
		const bool bFrameMatches = (Ov.FrameIndex < 0)     || (Ov.FrameIndex == FrameIdx);
		if (!bDirMatches || !bFrameMatches) continue;

		if (Ov.bOverrideAtlasIndex) Out.AtlasIndex  = Ov.Frame.AtlasIndex;
		if (Ov.bOverridePivot)      Out.PivotOffset = Ov.Frame.PivotOffset;

		// 나머지는 기본값에서 멀어진 경우만 반영 — 완전 기본이면 무시.
		if (Ov.Frame.Scale != FVector2f(1.f, 1.f))        Out.Scale    = Ov.Frame.Scale;
		if (Ov.Frame.Rotation != 0.f)                     Out.Rotation = Ov.Frame.Rotation;
		if (Ov.Frame.Tint != FLinearColor::White)         Out.Tint     = Ov.Frame.Tint;
		if (Ov.Frame.ZBias != 0)                          Out.ZBias    = Ov.Frame.ZBias;
		if (Ov.Frame.ChildAnchors.Num() > 0)              Out.ChildAnchors = Ov.Frame.ChildAnchors;
	}
	return Out;
}

// ============================================================================
// FHktSpriteLoadout
// ============================================================================

FGameplayTag FHktSpriteLoadout::GetSlotTag(EHktSpritePartSlot Slot) const
{
	switch (Slot)
	{
		case EHktSpritePartSlot::Body:        return BodyPart;
		case EHktSpritePartSlot::Head:        return HeadPart;
		case EHktSpritePartSlot::Weapon:      return WeaponPart;
		case EHktSpritePartSlot::Shield:      return ShieldPart;
		case EHktSpritePartSlot::HeadgearTop: return HeadgearTop;
		case EHktSpritePartSlot::HeadgearMid: return HeadgearMid;
		case EHktSpritePartSlot::HeadgearLow: return HeadgearLow;
		default:                              return FGameplayTag();
	}
}

void FHktSpriteLoadout::SetSlotTag(EHktSpritePartSlot Slot, FGameplayTag Tag)
{
	switch (Slot)
	{
		case EHktSpritePartSlot::Body:        BodyPart = Tag;    break;
		case EHktSpritePartSlot::Head:        HeadPart = Tag;    break;
		case EHktSpritePartSlot::Weapon:      WeaponPart = Tag;  break;
		case EHktSpritePartSlot::Shield:      ShieldPart = Tag;  break;
		case EHktSpritePartSlot::HeadgearTop: HeadgearTop = Tag; break;
		case EHktSpritePartSlot::HeadgearMid: HeadgearMid = Tag; break;
		case EHktSpritePartSlot::HeadgearLow: HeadgearLow = Tag; break;
		default: break;
	}
}

bool FHktSpriteLoadout::IsEqual(const FHktSpriteLoadout& Other) const
{
	return BodyPart == Other.BodyPart
		&& HeadPart == Other.HeadPart
		&& WeaponPart == Other.WeaponPart
		&& ShieldPart == Other.ShieldPart
		&& HeadgearTop == Other.HeadgearTop
		&& HeadgearMid == Other.HeadgearMid
		&& HeadgearLow == Other.HeadgearLow;
}
