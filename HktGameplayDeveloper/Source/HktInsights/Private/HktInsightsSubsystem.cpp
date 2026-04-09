// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktInsightsSubsystem.h"
#include "HktCoreDataCollector.h"
#include "HktInsightsLog.h"

bool UHktInsightsWorldSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
#if ENABLE_HKT_INSIGHTS
    return true;
#else
    return false;
#endif
}

void UHktInsightsWorldSubsystem::Deinitialize()
{
    FHktCoreDataCollector::Get().Clear();
    UE_LOG(LogHktInsights, Log, TEXT("HktInsightsWorldSubsystem deinitialized — data cleared"));
    Super::Deinitialize();
}
