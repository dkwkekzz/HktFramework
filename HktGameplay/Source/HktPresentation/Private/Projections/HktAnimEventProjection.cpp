// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimEventProjection.h"

void FHktAnimEventProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	for (const FHktAnimEvent& Event : Changes.AnimEvents)
	{
		FHktEntityPresentation* E = Ctx.GetEntity(Event.EntityId);
		if (!E) continue;

		E->PendingAnimTriggers.Add(Event.Tag);

		// DirtyThisFrame에 추가하여 ActorRenderer::Sync에서 ForwardToActor 호출 보장
		Ctx.State.DirtyThisFrame.AddUnique(Event.EntityId);
	}
}
