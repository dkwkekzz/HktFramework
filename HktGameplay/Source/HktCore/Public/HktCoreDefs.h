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
// Public Limits — 서버 시뮬레이션 ↔ 클라이언트 사이에 *동일해야* 하는 상수들.
//   서버 권위 (Story 의 precondition) 와 클라이언트 인지 (자동 픽업 등) 가
//   같은 값을 봐야 *눈에 보이는 범위* 와 *판정 범위* 가 어긋나지 않는다.
// HktCore/Private/HktSimulationLimits.h 는 sim 내부 한계 (풀 크기 / 백프레셔) 전용.
// ============================================================================

namespace HktLimits
{
	/**
	 * 자동 픽업 인지 반경 (cm). 서버 Story_ItemPickup 의 거리 precondition 과
	 * 클라이언트 AHktIngamePlayerController::TickAutoPickup 의 스캔 반경이 같은
	 * 값을 본다. 변경 시 두 곳을 한 번에 업데이트.
	 */
	constexpr int32 DefaultPickupRangeCm = 300;
}

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
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Natural); // 자연 entity 부모 태그 — Birch/Oak/... 이 매치 (Hittable + Spatial)
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Region);  // PR-2 — region 가상 엔티티

	// --- Region Record (PR-3, 04 §3-D4) ---
	// region 안의 *키별 record* — Lineage/Variant/OreSpecies 의 데이터 row.
	// `FHktWorldState::FindOrCreateRegionRecord` 가 (RegionIdKey + RecordKey + 태그) 4-조건 SoA 스캔으로 lazy-create.
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_RegionRecord);             // parent
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_RegionRecord_Lineage);     // Oak 가계 등 (LineageId)
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_RegionRecord_Variant);     // Mushroom 변종 등 (VariantId)
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_RegionRecord_OreSpecies);  // Ore 광종 (OreSpeciesId)
}

namespace HktStance
{
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Unarmed);  // Entity.Stance.Unarmed
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Spear);    // Entity.Stance.Spear
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Gun);      // Entity.Stance.Gun
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Sword1H);  // Entity.Stance.Sword1H
}
