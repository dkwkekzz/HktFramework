// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktTransientFrameComponent.generated.h"

/**
 * UHktTransientFrameComponent - IHktTransientFrame 구현
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktTransientFrameComponent : public UActorComponent, public IHktFrameManager
{
    GENERATED_BODY()

public:
    UHktTransientFrameComponent();

    // === IHktFrameManager 구현 ===

    virtual bool IsInitialized() const override;
    virtual int64 GetFrameNumber() const override;
    virtual void AdvanceFrame() override;

protected:
    virtual void BeginPlay() override;

private:
    int64 CurrentFrame = 0;
};
