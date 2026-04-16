// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Jobs/HktPresentationJob.h"
#include "HktPresentationState.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"

/** Tag 델타 적용 + VFX attach/detach 요청 Job (즉시 Ready) */
class FHktTagDeltaJob final : public IHktPresentationJob
{
public:
	FHktTagDeltaJob(FHktEntityId InEntityId, const FGameplayTagContainer& InTags, const FGameplayTagContainer& InOldTags, const FVector& InPosition)
		: EntityId(InEntityId)
		, Tags(InTags)
		, OldTags(InOldTags)
		, EntityPosition(InPosition)
	{
	}

	virtual void TickJob(float) override {}

	virtual void Execute(FHktPresentationState& OutState) override
	{
		OutState.ApplyTagDelta(EntityId, Tags);

		// VFX 태그 변경 감지: VFX. 프리픽스 필터
		static const FGameplayTag VFXPrefix = FGameplayTag::RequestGameplayTag(FName("VFX"));
		FGameplayTagContainer VFXFilter;
		VFXFilter.AddTag(VFXPrefix);

		FGameplayTagContainer CurrentVFX = Tags.Filter(VFXFilter);
		FGameplayTagContainer OldVFX = OldTags.Filter(VFXFilter);

		// 새로 추가된 VFX 태그 → Attach 요청
		for (const FGameplayTag& Tag : CurrentVFX)
		{
			if (!OldVFX.HasTag(Tag))
			{
				OutState.PendingVFXAttachments.Add({ Tag, EntityId, EntityPosition });
			}
		}

		// 제거된 VFX 태그 → Detach 요청
		for (const FGameplayTag& Tag : OldVFX)
		{
			if (!CurrentVFX.HasTag(Tag))
			{
				OutState.PendingVFXDetachments.Add({ Tag, EntityId });
			}
		}

		Status = EHktJobStatus::Completed;
	}

	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return EntityId; }
	virtual void Cancel() override { Status = EHktJobStatus::Cancelled; }

private:
	FHktEntityId EntityId;
	FGameplayTagContainer Tags;
	FGameplayTagContainer OldTags;
	FVector EntityPosition;
	EHktJobStatus Status = EHktJobStatus::Ready;
};
