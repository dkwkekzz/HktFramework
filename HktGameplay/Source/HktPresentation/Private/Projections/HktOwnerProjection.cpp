// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktOwnerProjection.h"

void FHktOwnerProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	for (const FHktOwnerDelta& OD : Changes.OwnerDeltas)
	{
		Ctx.State.ApplyOwnerDelta(OD.EntityId, OD.NewOwnerUid);
	}
}
