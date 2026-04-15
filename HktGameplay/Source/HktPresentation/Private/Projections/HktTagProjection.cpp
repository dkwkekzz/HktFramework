// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTagProjection.h"
#include "NativeGameplayTags.h"

UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Projection_VFX_Prefix, "VFX");

void FHktTagProjection::Project(
	const FHktPresentationChangeSet& Changes,
	FHktProjectionContext& Ctx)
{
	const FGameplayTagContainer VFXPrefixContainer(Tag_Projection_VFX_Prefix);

	for (const FHktTagDelta& TD : Changes.TagDeltas)
	{
		// ViewModel 태그 동기화 (AnimInstance 태그 기반 애니메이션용)
		Ctx.State.ApplyTagDelta(TD.EntityId, TD.Tags);

		// --- VFX 태그 감지: 엔티티에 부착된 지속형 VFX 생명주기 관리 ---
		FGameplayTagContainer CurrentVFX = TD.Tags.Filter(VFXPrefixContainer);
		FGameplayTagContainer OldVFX = TD.OldTags.Filter(VFXPrefixContainer);

		// 새로 추가된 VFX 태그 → AttachVFXToEntity
		for (const FGameplayTag& Tag : CurrentVFX)
		{
			if (!OldVFX.HasTag(Tag))
			{
				FVector Pos = FVector::ZeroVector;
				if (Changes.WorldState)
				{
					FIntVector IntPos = Changes.WorldState->GetPosition(TD.EntityId);
					Pos = FVector(IntPos.X, IntPos.Y, IntPos.Z);
				}
				Ctx.Effects.AddVFXEntity(EHktEffectType::AttachVFXToEntity, Tag, TD.EntityId, Pos);
			}
		}

		// 제거된 VFX 태그 → DetachVFXFromEntity
		for (const FGameplayTag& Tag : OldVFX)
		{
			if (!CurrentVFX.HasTag(Tag))
			{
				Ctx.Effects.AddVFXEntity(EHktEffectType::DetachVFXFromEntity, Tag, TD.EntityId, FVector::ZeroVector);
			}
		}
	}
}
