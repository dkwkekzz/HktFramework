// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTypes.h"

// ============================================================================
// FHktSpriteAction::ResolveStoredFacing
// 5방향(N/NE/E/SE/S) 저장 + W/SW/NW를 E/SE/NE 미러로 매핑.
// 저장 인덱스: N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7
// ============================================================================

EHktSpriteFacing FHktSpriteAction::ResolveStoredFacing(EHktSpriteFacing In, bool bMirror, bool& OutFlipX)
{
	OutFlipX = false;
	if (!bMirror)
	{
		return In;
	}

	switch (In)
	{
		case EHktSpriteFacing::W:
			OutFlipX = true;
			return EHktSpriteFacing::E;
		case EHktSpriteFacing::SW:
			OutFlipX = true;
			return EHktSpriteFacing::SE;
		case EHktSpriteFacing::NW:
			OutFlipX = true;
			return EHktSpriteFacing::NE;
		default:
			return In;
	}
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
