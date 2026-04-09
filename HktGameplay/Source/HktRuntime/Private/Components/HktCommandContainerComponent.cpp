// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCommandContainerComponent.h"

UHktCommandContainerComponent::UHktCommandContainerComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

// ============================================================================
// IHktCommandContainer 구현
// ============================================================================

void UHktCommandContainerComponent::InitializeSlots(int32 NumSlots)
{
	SlotBindings.SetNum(NumSlots);
	for (FHktSlotBinding& Binding : SlotBindings)
	{
		Binding = FHktSlotBinding();
	}
}

void UHktCommandContainerComponent::SetSlotBinding(int32 SlotIndex, FGameplayTag EventTag, bool bTargetRequired)
{
	if (SlotIndex < 0) return;

	if (SlotIndex >= SlotBindings.Num())
	{
		SlotBindings.SetNum(SlotIndex + 1);
	}

	FHktSlotBinding& Binding = SlotBindings[SlotIndex];
	Binding.EventTag = EventTag;
	Binding.bTargetRequired = bTargetRequired;
	Binding.bBound = EventTag.IsValid();
}

void UHktCommandContainerComponent::ClearSlotBinding(int32 SlotIndex)
{
	if (SlotBindings.IsValidIndex(SlotIndex))
	{
		SlotBindings[SlotIndex] = FHktSlotBinding();
	}
}

FGameplayTag UHktCommandContainerComponent::GetEventTagAtSlot(int32 SlotIndex) const
{
	if (SlotBindings.IsValidIndex(SlotIndex) && SlotBindings[SlotIndex].bBound)
	{
		return SlotBindings[SlotIndex].EventTag;
	}
	return FGameplayTag();
}

bool UHktCommandContainerComponent::IsTargetRequiredAtSlot(int32 SlotIndex) const
{
	if (SlotBindings.IsValidIndex(SlotIndex) && SlotBindings[SlotIndex].bBound)
	{
		return SlotBindings[SlotIndex].bTargetRequired;
	}
	return false;
}

int32 UHktCommandContainerComponent::GetNumSlots() const
{
	return SlotBindings.Num();
}
