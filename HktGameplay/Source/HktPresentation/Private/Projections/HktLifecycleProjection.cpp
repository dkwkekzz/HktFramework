// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktLifecycleProjection.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"

void FHktLifecycleProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	// --- 삭제: ViewModel 정리 + Actor 파괴 effect ---
	for (FHktEntityId Id : Changes.RemovedEntities)
	{
		Ctx.State.RemoveEntity(Id);
		Ctx.Effects.Add(EHktEffectType::DestroyActor, Id);
	}

	// --- 생성: ViewModel 초기화 (InitFromWorldState) ---
	for (const FHktEntityState& ES : Changes.SpawnedEntities)
	{
		Ctx.State.AddEntity(Ctx.WorldState, ES.EntityId);
	}

#if ENABLE_HKT_INSIGHTS
	if (Changes.RemovedEntities.Num() > 0 || Changes.SpawnedEntities.Num() > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("[Lifecycle] Frame=%lld Spawned=%d Removed=%d"),
				Ctx.Frame, Changes.SpawnedEntities.Num(), Changes.RemovedEntities.Num()));
	}
#endif
}
