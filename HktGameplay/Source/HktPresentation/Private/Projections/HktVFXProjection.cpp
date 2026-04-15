// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVFXProjection.h"

void FHktVFXProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	for (const FHktVFXEvent& Event : Changes.VFXEvents)
	{
		FVector Pos(Event.Position.X, Event.Position.Y, Event.Position.Z);
		Ctx.Effects.AddVFX(EHktEffectType::PlayVFXAtLocation, Event.Tag, Pos);
	}
}
