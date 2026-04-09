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
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktTargetChanged, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktCommandChanged, FGameplayTag);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktIntentSubmitted, const FHktRuntimeEvent&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktWheelInput, float);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktEntityCreated, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktEntityDestroyed, FHktEntityId);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktWorldViewUpdated, const FHktWorldView&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktSlotBindingChanged, int32 /*SlotIndex*/);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnHktBagChanged, const struct FHktBagDelta&);
