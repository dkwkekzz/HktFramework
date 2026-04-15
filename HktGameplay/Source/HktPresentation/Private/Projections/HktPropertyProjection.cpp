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

	// --- RenderLocation 재계산: 스폰 엔티티 + 위치 변경 엔티티 ---
	// 기존 ComputeRenderLocations()와 동일: SpawnedThisFrame + DirtyThisFrame 모두 처리.
	// 모든 카테고리(Actor, MassEntity, FX)에 대해 실행.
	for (FHktEntityId Id : Ctx.State.SpawnedThisFrame)
	{
		Ctx.Effects.Add(EHktEffectType::ComputeRenderLocation, Id);
	}

	for (FHktEntityId Id : Ctx.State.DirtyThisFrame)
	{
		const FHktEntityPresentation* E = Ctx.State.Get(Id);
		if (E && E->Location.IsDirty(Ctx.Frame))
		{
			Ctx.Effects.Add(EHktEffectType::ComputeRenderLocation, Id);
		}
	}
}
