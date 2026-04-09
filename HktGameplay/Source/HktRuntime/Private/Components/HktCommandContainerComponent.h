// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktClientRuleInterfaces.h"
#include "HktCommandContainerComponent.generated.h"

/**
 * UHktCommandContainerComponent - IHktCommandContainer 구현
 *
 * 슬롯 기반 스킬 바인딩을 단일 배열(SlotBindings)로 관리.
 * PlayerController가 캐릭터 기본 스킬과 아이템 스킬을 SetSlotBinding()으로 설정하며,
 * 우선순위 로직은 호출자(PlayerController) 책임.
 */

/** 슬롯 바인딩 데이터 */
struct FHktSlotBinding
{
	FGameplayTag EventTag;
	bool bTargetRequired = false;
	bool bBound = false;
};

UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktCommandContainerComponent : public UActorComponent, public IHktCommandContainer
{
	GENERATED_BODY()

public:
	UHktCommandContainerComponent();

	// === IHktCommandContainer 구현 ===

	virtual FGameplayTag GetEventTagAtSlot(int32 SlotIndex) const override;
	virtual bool IsTargetRequiredAtSlot(int32 SlotIndex) const override;
	virtual int32 GetNumSlots() const override;
	virtual void InitializeSlots(int32 NumSlots) override;
	virtual void SetSlotBinding(int32 SlotIndex, FGameplayTag EventTag, bool bTargetRequired) override;
	virtual void ClearSlotBinding(int32 SlotIndex) override;
	virtual FOnSlotBindingChanged& OnSlotBindingChanged() override { return SlotBindingChangedDelegate; }

private:
	TArray<FHktSlotBinding> SlotBindings;

	FOnSlotBindingChanged SlotBindingChangedDelegate;
};
