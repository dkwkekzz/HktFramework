// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktWorldState.h"
#include "HktRuntimeTypes.h"
#include "HktClientRuleInterfaces.h"
#include "HktIntentBuilderComponent.generated.h"

/**
 * UHktIntentBuilderComponent
 *
 * 아키텍처:
 *   - 컴포넌트는 인터페이스 구현에 집중
 *   - IHktIntentBuilder 인터페이스 구현:
 *     - Subject/Command/Target 설정 + Submit
 *
 * Rule에서의 사용:
 *   Rule->OnUserEvent_SubjectInputAction(*SelectionPolicy, *this);  // Policy + Builder
 *   Rule->OnUserEvent_TargetInputAction(*SelectionPolicy, *this);   // Policy + Builder
 *
 * Submit 흐름:
 *   Rule이 IHktIntentBuilder::Submit() 호출
 *   → 내부에서 IntentEvent 생성, PendingSubmit에 저장
 *   → Actor(PlayerController)가 FHktRuntimeEvent 직접 전송
 *   → Server_ReceiveRuntimeEvent RPC 발행
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktIntentBuilderComponent
    : public UActorComponent
    , public IHktIntentBuilder
{
    GENERATED_BODY()

public:
    UHktIntentBuilderComponent();

    // === IHktIntentBuilder 구현 ===

    virtual void SetSubject(FHktEntityId InSubject) override;
    virtual void SetCommand(FGameplayTag InEventTag, bool bInTargetRequired) override;
    virtual void SetCommandSlot(int32 InSlotIndex) override;
    virtual void SetTarget(FHktEntityId InTarget, FVector InLocation) override;
    virtual void ResetCommand() override;
    virtual bool IsReadyToSubmit() const override;
    virtual bool Submit() override;
    virtual FHktEntityId GetSubjectEntityId() const override;
    virtual FHktEntityId GetTargetEntityId() const override;
    virtual FGameplayTag GetEventTag() const override;
    virtual int32 GetCommandSlotIndex() const override { return CommandSlotIndex; }
    virtual bool HasPendingSubmit() const override;
    virtual FHktEvent ConsumePendingSubmit() override;

    virtual void SetPendingRuntimeEvent(const FHktEvent& InEvent) override;
    virtual bool HasPendingRuntimeEvent() const override;
    virtual FHktEvent ConsumePendingRuntimeEvent() override;

    // === 추가 API ===

    virtual FVector GetTargetLocation() const override { return TargetLocation; }

private:
    FHktEntityId SubjectEntityId = InvalidEntityId;
    FGameplayTag EventTag;
    FHktEntityId TargetEntityId = InvalidEntityId;
    FVector TargetLocation = FVector::ZeroVector;
    bool bTargetRequired = true;
    int32 CommandSlotIndex = -1;

    // Submit 결과 (Actor가 소비)
    bool bHasPendingSubmit = false;
    FHktRuntimeEvent PendingSubmitEvent;

    // RuntimeEvent (Rule이 설정, Actor가 소비하여 RPC 전송)
    bool bHasPendingRuntimeEvent = false;
    FHktEvent PendingRuntimeEvent;
};
