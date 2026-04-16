// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Jobs/HktPresentationJob.h"
#include "HktCoreEvents.h"
#include "HktPresentationState.h"

/** Property 델타 배치 적용 Job (즉시 Ready) */
class FHktPropertyDeltaJob final : public IHktPresentationJob
{
public:
	explicit FHktPropertyDeltaJob(const TArray<FHktPropertyDelta>& InDeltas)
		: Deltas(InDeltas)
	{
	}

	virtual void TickJob(float) override {}

	virtual void Execute(FHktPresentationState& OutState) override
	{
		for (const FHktPropertyDelta& D : Deltas)
		{
			OutState.ApplyDelta(D.EntityId, D.PropertyId, D.NewValue);
		}
		Status = EHktJobStatus::Completed;
	}

	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return InvalidEntityId; }
	virtual void Cancel() override { Status = EHktJobStatus::Cancelled; }
	virtual const TCHAR* GetJobName() const override { return TEXT("PropertyDelta"); }

private:
	TArray<FHktPropertyDelta> Deltas;
	EHktJobStatus Status = EHktJobStatus::Ready;
};

/** Owner 델타 배치 적용 Job (즉시 Ready) */
class FHktOwnerDeltaJob final : public IHktPresentationJob
{
public:
	explicit FHktOwnerDeltaJob(const TArray<FHktOwnerDelta>& InDeltas)
		: Deltas(InDeltas)
	{
	}

	virtual void TickJob(float) override {}

	virtual void Execute(FHktPresentationState& OutState) override
	{
		for (const FHktOwnerDelta& D : Deltas)
		{
			OutState.ApplyOwnerDelta(D.EntityId, D.NewOwnerUid);
		}
		Status = EHktJobStatus::Completed;
	}

	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return InvalidEntityId; }
	virtual void Cancel() override { Status = EHktJobStatus::Cancelled; }
	virtual const TCHAR* GetJobName() const override { return TEXT("OwnerDelta"); }

private:
	TArray<FHktOwnerDelta> Deltas;
	EHktJobStatus Status = EHktJobStatus::Ready;
};
