// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktMassEntityRenderer.h"

FHktMassEntityProcessor::FHktMassEntityProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktMassEntityProcessor::Sync(const FHktPresentationState& State)
{
	// TODO: UMassEntitySubsystem 연동, SpawnedThisFrame/RemovedThisFrame/DirtyThisFrame 처리
	(void)State;
}

void FHktMassEntityProcessor::Teardown()
{
}
