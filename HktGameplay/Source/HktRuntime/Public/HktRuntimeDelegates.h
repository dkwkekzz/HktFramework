// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktRuntimeTypes.h"
#include "HktWorldView.h"

// ============================================================================
// HktRuntime 델리게이트 선언
// ============================================================================

DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktSubjectChanged, FHktEntityId);
// FOnHktTargetChanged 는 entity 또는 voxel 모두 표현 — voxel 일 때 EntityId == VoxelTargetEntityId.
// 상세 voxel 정보는 IHktPlayerInteractionInterface::GetCurrentVoxelTarget() 으로 조회.
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktTargetChanged, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktCommandChanged, FGameplayTag);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktIntentSubmitted, const FHktRuntimeEvent&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktWheelInput, float);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktEntityCreated, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktEntityDestroyed, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktWorldViewUpdated, const FHktWorldView&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktSlotBindingChanged, int32 /*SlotIndex*/);
// FOnHktInventoryChanged (= FOnHktInventoryChanged) — Player Inventory 변경 알림. I-0041 참조.
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktInventoryChanged, const struct FHktInventoryDelta&);
