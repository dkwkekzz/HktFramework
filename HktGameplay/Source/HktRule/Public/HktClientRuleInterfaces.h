// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktWorldState.h"
#include "HktBagTypes.h"
#include "HktClientRuleInterfaces.generated.h"

class IHktWorldPlayer;

// ============================================================================
// IHktProxySimulator
// ============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktProxySimulator : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktProxySimulator
{
	GENERATED_BODY()
public:
	virtual void RestoreState(const FHktWorldState& InState, int32 InGroupIndex) = 0;
	virtual const FHktWorldState& GetWorldState() const = 0;
	virtual bool IsInitialized() const = 0;
	virtual void AdvanceLocalFrame(float DeltaSeconds) = 0;

	/** 서버 Batch를 큐에 적재 — 다음 틱에서 롤백/빨리감기 처리 */
	virtual void EnqueueServerBatch(const FHktSimulationEvent& InBatch) = 0;

	/** 마지막 조정으로 생성된 Diff를 소비 (없으면 false) */
	virtual bool ConsumePendingDiff(FHktSimulationDiff& OutDiff) = 0;
};

// ============================================================================
// IHktIntentBuilder
// ============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktIntentBuilder : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktIntentBuilder
{
	GENERATED_BODY()
public:
	virtual void SetSubject(FHktEntityId InSubject) = 0;
	virtual void SetCommand(FGameplayTag InEventTag, bool bInTargetRequired) = 0;
	virtual void SetCommandSlot(int32 InSlotIndex) = 0;
	virtual void SetTarget(FHktEntityId InTarget, FVector InLocation) = 0;
	virtual void ResetCommand() = 0;
	virtual bool IsReadyToSubmit() const = 0;
	virtual bool Submit() = 0;
	virtual FHktEntityId GetSubjectEntityId() const = 0;
	virtual FHktEntityId GetTargetEntityId() const = 0;
	virtual FVector GetTargetLocation() const = 0;
	virtual FGameplayTag GetEventTag() const = 0;
	virtual int32 GetCommandSlotIndex() const = 0;
	virtual bool HasPendingSubmit() const = 0;
	virtual FHktEvent ConsumePendingSubmit() = 0;

	/** RuntimeEvent: Rule이 설정, PlayerController가 소비하여 RPC 전송 */
	virtual void SetPendingRuntimeEvent(const FHktEvent& InEvent) = 0;
	virtual bool HasPendingRuntimeEvent() const = 0;
	virtual FHktEvent ConsumePendingRuntimeEvent() = 0;
};

// ============================================================================
// IHktUnitSelectionPolicy
// ============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktUnitSelectionPolicy : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktUnitSelectionPolicy
{
	GENERATED_BODY()
public:
	virtual FHktEntityId ResolveSubject() const = 0;
	virtual void ResolveTarget(FHktEntityId& OutEntity, FVector& OutLocation) const = 0;
};

// ============================================================================
// IHktCommandContainer
// ============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktCommandContainer : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktCommandContainer
{
	GENERATED_BODY()
public:
	virtual FGameplayTag GetEventTagAtSlot(int32 SlotIndex) const = 0;
	virtual bool IsTargetRequiredAtSlot(int32 SlotIndex) const = 0;
	virtual int32 GetNumSlots() const = 0;

	/** 슬롯 개수 초기화 */
	virtual void InitializeSlots(int32 NumSlots) = 0;

	/** 슬롯에 스킬 바인딩 (캐릭터 기본 스킬 또는 아이템 스킬) */
	virtual void SetSlotBinding(int32 SlotIndex, FGameplayTag EventTag, bool bTargetRequired) = 0;

	/** 슬롯 바인딩 해제 */
	virtual void ClearSlotBinding(int32 SlotIndex) = 0;

	/** 슬롯 바인딩이 변경되었을 때 브로드캐스트 (SlotIndex) */
	DECLARE_MULTICAST_DELEGATE_OneParam(FOnSlotBindingChanged, int32);
	virtual FOnSlotBindingChanged& OnSlotBindingChanged() { static FOnSlotBindingChanged Dummy; return Dummy; }
};

// ============================================================================
// IHktClientRule
// ============================================================================
class HKTRULE_API IHktClientRule
{
public:
	virtual ~IHktClientRule() = default;

	/** 컨텍스트 바인딩 — 서버 룰과 동일한 패턴 (ServerRule::BindContext와 일관성 유지) */
	virtual void BindContext(
		IHktProxySimulator*       InSimulator,
		IHktIntentBuilder*        InBuilder,
		IHktUnitSelectionPolicy*  InPolicy,
		IHktCommandContainer*     InContainer,
		IHktWorldPlayer*          InWorldPlayer = nullptr) {}

	virtual void OnUserEvent_LoginButtonClick() {}

	/** 내부 캐싱된 Policy/Builder 사용 */
	virtual void OnUserEvent_SubjectInputAction() {}
	virtual void OnUserEvent_TargetInputAction() {}
	virtual void OnUserEvent_CommandInputAction(int32 InSlotIndex) {}
	virtual void OnUserEvent_ZoomInputAction(float InDelta) {}
	virtual void OnUserEvent_JumpInputAction() {}

	/** ShoulderView 방향 이동 — Direction은 카메라 기준 월드 방향 (정규화) */
	virtual void OnUserEvent_MoveInputAction(const FVector& InDirection) {}

	/** ShoulderView 이동 정지 — WASD 릴리즈 시 */
	virtual void OnUserEvent_MoveStopAction() {}

	/** 내부 캐싱된 Simulator 사용 */
	virtual void OnReceived_InitialState(const FHktWorldState& InState, int32 InGroupIndex) {}
	virtual void OnReceived_FrameBatch(const FHktSimulationEvent& InBatch) {}

	/** 가방 변경 수신 (소유자 전용) */
	virtual void OnReceived_BagUpdate(const FHktBagDelta& InDelta) {}
};

// ============================================================================
// System Message
// ============================================================================
DECLARE_MULTICAST_DELEGATE_OneParam(FHktOnSystemMessage, const FString& /*Message*/);

namespace HktRule
{
	HKTRULE_API IHktClientRule* GetClientRule(UWorld* World);

	/** 시스템 메시지 delegate 직접 접근 (구독용) */
	HKTRULE_API FHktOnSystemMessage& GetSystemMessageDelegate(UWorld* World);

	/** 시스템 메시지 표시 — 어느 모듈에서나 호출 가능 */
	HKTRULE_API void ShowSystemMessage(UWorld* World, const FString& Message);
}
