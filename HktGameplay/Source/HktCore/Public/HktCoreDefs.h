// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// ============================================================================
// Entity ID
// ============================================================================

using FHktEntityId = int32;
constexpr FHktEntityId InvalidEntityId = -1;

/**
 * VoxelTargetEntityId — voxel 을 Target 으로 가리킬 때 사용하는 sentinel EntityId.
 *
 * Selection/Target 시스템은 voxel 도 FHktEntityId 로 추상화한다 — 별도 voxel-target
 * API/델리게이트를 두지 않기 위함. EntityId == VoxelTargetEntityId 이면
 *   - Target Location 은 voxel 중앙
 *   - 상세 정보(TypeID/VoxelCoord 등) 는 IHktPlayerInteractionInterface::GetCurrentVoxelTarget()
 *     사이드카로 조회 (FHktVoxelSelection)
 *
 * 서버/시뮬레이션 단계로 넘어가는 FHktEvent 에는 이 sentinel 을 넣지 않는다 —
 * Rule 이 이벤트 빌드 직전에 InvalidEntityId 로 변환한다 (위치 기반 동작은 그대로).
 */
constexpr FHktEntityId VoxelTargetEntityId = -2;

/** WorldState 에 실제로 존재할 수 있는 EntityId 인지 검사 (>= 0). */
constexpr bool IsRealEntityId(FHktEntityId Id) { return Id >= 0; }

// ============================================================================
// Stance (무기별 동작 모드) — FGameplayTag 기반
// ============================================================================

namespace HktArchetypeTags
{
	// --- Entity Classification ---
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_NPC);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Building);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Projectile);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Item);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Debris);
}

namespace HktStance
{
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Unarmed);  // Entity.Stance.Unarmed
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Spear);    // Entity.Stance.Spear
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Gun);      // Entity.Stance.Gun
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Sword1H);  // Entity.Stance.Sword1H
}
