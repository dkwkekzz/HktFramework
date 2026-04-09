// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktMassEntityRenderer.h"

FHktMassEntityRenderer::FHktMassEntityRenderer(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktMassEntityRenderer::Sync(const FHktPresentationState& State)
{
	// TODO: UMassEntitySubsystem 연동, SpawnedThisFrame/RemovedThisFrame/DirtyThisFrame 처리
	(void)State;
}

void FHktMassEntityRenderer::Teardown()
{
}
