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
// FHktSpriteAnimation::ResolveAtlasForDirection — slot 또는 단일 Atlas 폴백
// 규약: AtlasSlotIdx == dirIdx.
// ============================================================================

void FHktSpriteAnimation::ResolveAtlasForDirection(int32 DirIdx,
	TSoftObjectPtr<UTexture2D>& OutAtlas, FVector2f& OutCellSize) const
{
	if (AtlasSlots.Num() > 0)
	{
		// 인덱스 초과 시 슬롯 0 으로 클램프 — 데이터/방향 불일치에 대한 안전망.
		const FHktSpriteAtlasSlot& Slot = AtlasSlots[AtlasSlots.IsValidIndex(DirIdx) ? DirIdx : 0];
		OutAtlas = Slot.Atlas;
		OutCellSize = (Slot.CellSize.X > 0.f && Slot.CellSize.Y > 0.f) ? Slot.CellSize : AtlasCellSize;
		return;
	}

	// 단일 atlas 경로 — 구식/통합 데이터.
	OutAtlas = Atlas;
	OutCellSize = AtlasCellSize;
}
