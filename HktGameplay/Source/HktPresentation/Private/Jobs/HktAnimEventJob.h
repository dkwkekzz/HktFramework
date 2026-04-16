// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Jobs/HktPresentationJob.h"
#include "HktPresentationState.h"
#include "HktCoreEvents.h"

/** 애니메이션 트리거 Job (즉시 Ready) */
class FHktAnimEventJob final : public IHktPresentationJob
{
public:
	explicit FHktAnimEventJob(const FHktAnimEvent& InEvent)
		: Tag(InEvent.Tag)
		, EntityId(InEvent.EntityId)
	{
	}

	virtual void TickJob(float) override {}

	virtual void Execute(FHktPresentationState& OutState) override
	{
		FHktEntityPresentation* E = OutState.GetMutable(EntityId);
		if (E)
		{
			E->PendingAnimTriggers.Add(Tag);
			// DirtyThisFrame에 추가하여 ActorRenderer::Sync에서 ForwardToActor 호출 보장
			OutState.DirtyThisFrame.AddUnique(EntityId);
		}
		Status = EHktJobStatus::Completed;
	}

	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return EntityId; }
	virtual void Cancel() override { Status = EHktJobStatus::Cancelled; }
	virtual const TCHAR* GetJobName() const override { return TEXT("AnimEvent"); }

private:
	FGameplayTag Tag;
	FHktEntityId EntityId;
	EHktJobStatus Status = EHktJobStatus::Ready;
};
