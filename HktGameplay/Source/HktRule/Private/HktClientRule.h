#pragma once

#include "CoreMinimal.h"
#include "HktClientRuleInterfaces.h"
#include "HktServerRuleInterfaces.h"

class HKTRULE_API FHktDefaultClientRule : public IHktClientRule
{
public:
	FHktDefaultClientRule();
	virtual ~FHktDefaultClientRule();

	// 컨텍스트 바인딩
	virtual void BindContext(
		IHktProxySimulator*      InSimulator,
		IHktIntentBuilder*       InBuilder,
		IHktUnitSelectionPolicy* InPolicy,
		IHktCommandContainer*    InContainer,
		IHktWorldPlayer*         InWorldPlayer = nullptr) override;

	virtual void OnUserEvent_LoginButtonClick() override;
	virtual void OnUserEvent_SubjectInputAction() override;
	virtual void OnUserEvent_TargetInputAction() override;
	virtual void OnUserEvent_CommandInputAction(int32 InSlotIndex) override;
	virtual void OnUserEvent_ZoomInputAction(float InDelta) override;
	virtual void OnUserEvent_JumpInputAction() override;
	virtual void OnReceived_InitialState(const FHktWorldState& InState, int32 InGroupIndex) override;
	virtual void OnReceived_FrameBatch(const FHktSimulationEvent& InBatch) override;
	virtual void OnReceived_BagUpdate(const FHktBagDelta& InDelta) override;

private:
	// 바인딩된 컨텍스트
	IHktProxySimulator*      CachedSimulator   = nullptr;
	IHktIntentBuilder*       CachedBuilder     = nullptr;
	IHktUnitSelectionPolicy* CachedPolicy      = nullptr;
	IHktCommandContainer*    CachedContainer   = nullptr;
	IHktWorldPlayer*         CachedWorldPlayer = nullptr;

	TArray<FHktSimulationEvent> PendingBatches;

	/** Subject 엔티티가 내 소유인지 확인 */
	bool IsOwnedByMe(FHktEntityId Entity) const;
};
