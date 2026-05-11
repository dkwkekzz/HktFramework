// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTypes.h"

// ============================================================================
// FHktSpriteAnimation::ResolveStoredFacing
//
// NumDirections 별 매핑:
//   1 → 항상 index 0 (no mirror).
//   2 → 좌/우 — 슬롯 0 = E(우향), 슬롯 1 = W(좌향).
//        bFacingRight (화면-공간 우향) 로 결정 — 8방향 `In` 은 N/S/NE/SE 가 모두 E 로
//        양자화되어 카메라 yaw 가 바뀐 N/S 이동의 좌우 판단이 손실되므로 사용 안 함.
//        bMirror=true 이고 좌향이면 슬롯 0 + flipX 로 미러.
//   5 → N=0, NE=1, E=2, SE=3, S=4. W/SW/NW는 bMirror=true면 E/SE/NE flipX,
//        아니면 clamp(…, 4).
//   8 → 그대로 0..7 (bMirror 무시).
// ============================================================================

EHktSpriteFacing FHktSpriteAnimation::ResolveStoredFacing(
	EHktSpriteFacing In, int32 NumDirections, bool bMirror, bool& OutFlipX, bool bFacingRight)
{
	OutFlipX = false;

	if (NumDirections <= 1)
	{
		return EHktSpriteFacing::N; // 단일 = 인덱스 0
	}

	if (NumDirections == 2)
	{
		if (bFacingRight)
		{
			return EHktSpriteFacing::N;      // 슬롯 0 (E)
		}
		if (bMirror)
		{
			OutFlipX = true;
			return EHktSpriteFacing::N;      // 슬롯 0 (E) + flipX
		}
		return EHktSpriteFacing::NE;         // 슬롯 1 (W)
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
