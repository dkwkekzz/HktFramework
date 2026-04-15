// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPropertyProjection.h"

void FHktPropertyProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	// --- PropertyDelta → ViewModel 갱신 (dispatch table 경유) ---
	for (const FHktPropertyDelta& D : Changes.PropertyDeltas)
	{
		Ctx.State.ApplyDelta(D.EntityId, D.PropertyId, D.NewValue);
	}

	// --- Location이 변경된 엔티티 → RenderLocation 재계산 effect ---
	for (FHktEntityId Id : Ctx.State.DirtyThisFrame)
	{
		const FHktEntityPresentation* E = Ctx.State.Get(Id);
		if (E && E->Location.IsDirty(Ctx.Frame))
		{
			Ctx.Effects.Add(EHktEffectType::ComputeRenderLocation, Id);
		}
	}
}
