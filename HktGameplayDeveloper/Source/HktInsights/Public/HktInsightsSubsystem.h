// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HktInsightsSubsystem.generated.h"

/**
 * UHktInsightsWorldSubsystem
 *
 * 월드 종료 시 FHktCoreDataCollector 클리어 담당.
 * Slate 패널은 ActiveTimer로 직접 폴링하므로 델리게이트 불필요.
 */
UCLASS()
class HKTINSIGHTS_API UHktInsightsWorldSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

protected:
    virtual void Deinitialize() override;
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
};
