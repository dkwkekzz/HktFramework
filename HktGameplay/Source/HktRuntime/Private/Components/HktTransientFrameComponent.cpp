// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTransientFrameComponent.h"

UHktTransientFrameComponent::UHktTransientFrameComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UHktTransientFrameComponent::BeginPlay()
{
    Super::BeginPlay();
}

bool UHktTransientFrameComponent::IsInitialized() const
{
    return true;
}

int64 UHktTransientFrameComponent::GetFrameNumber() const
{
    return CurrentFrame;
}

void UHktTransientFrameComponent::AdvanceFrame()
{
    CurrentFrame++;
}
