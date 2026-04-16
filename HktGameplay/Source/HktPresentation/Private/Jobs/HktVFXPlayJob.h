// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Jobs/HktPresentationJob.h"
#include "HktPresentationState.h"
#include "HktCoreEvents.h"

/** 일회성 VFX 이벤트 Job (즉시 Ready) */
class FHktVFXPlayJob final : public IHktPresentationJob
{
public:
	explicit FHktVFXPlayJob(const FHktVFXEvent& InEvent)
		: Tag(InEvent.Tag)
		, Location(FVector(InEvent.Position.X, InEvent.Position.Y, InEvent.Position.Z))
	{
	}

	virtual void TickJob(float) override {}

	virtual void Execute(FHktPresentationState& OutState) override
	{
		OutState.PendingVFXEvents.Add({ Tag, Location });
		Status = EHktJobStatus::Completed;
	}

	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return InvalidEntityId; }
	virtual void Cancel() override { Status = EHktJobStatus::Cancelled; }

private:
	FGameplayTag Tag;
	FVector Location;
	EHktJobStatus Status = EHktJobStatus::Ready;
};
