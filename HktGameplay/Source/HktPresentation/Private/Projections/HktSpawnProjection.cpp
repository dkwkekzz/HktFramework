// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpawnProjection.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"

void FHktSpawnProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	for (const FHktEntityState& ES : Changes.SpawnedEntities)
	{
		const FHktEntityPresentation* E = Ctx.GetEntity(ES.EntityId);
		if (!E) continue;

		// Actor 렌더 카테고리만 스폰 처리 (MassEntity, FX 등은 별도 렌더러)
		if (E->RenderCategory != EHktRenderCategory::Actor) continue;

		FGameplayTag VisualTag = E->VisualElement.Get();
		if (!VisualTag.IsValid()) continue;

		// 1) 에셋 비동기 로드 → CapsuleHalfHeight + ResolvedAssetPath 갱신
		FHktEffect& ResolveEffect = Ctx.Effects.Add(EHktEffectType::ResolveAsset, ES.EntityId);
		ResolveEffect.Tag = VisualTag;

		// 2) Actor 스폰 (비동기, 에셋 로드 후 콜백에서 실제 생성)
		// ComputeRenderLocation은 PropertyProjection에서 SpawnedThisFrame 일괄 처리
		Ctx.Effects.Add(EHktEffectType::SpawnActor, ES.EntityId);

#if ENABLE_HKT_INSIGHTS
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("[Spawn] Entity=%d VisualTag=%s → ResolveAsset+SpawnActor"),
				ES.EntityId, *VisualTag.ToString()));
#endif
	}
}
