// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Jobs/HktJobQueue.h"
#include "HktPresentationState.h"
#include "HktCoreEventLog.h"

void FHktJobQueue::AddJob(TSharedPtr<IHktPresentationJob> Job)
{
	if (!Job) return;

	const int32 Index = Jobs.Num();
	Jobs.Add(Job);

	const FHktEntityId EntityId = Job->GetTargetEntityId();
	if (EntityId != InvalidEntityId)
	{
		EntityJobIndex.Add(EntityId, Index);
	}

	// Job 생성 로그
	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("Job 생성: %s"), Job->GetJobName()), EntityId);
}

void FHktJobQueue::CancelJobsForEntity(FHktEntityId Id)
{
	TArray<int32> Indices;
	EntityJobIndex.MultiFind(Id, Indices);

	for (int32 Idx : Indices)
	{
		if (Idx < Jobs.Num() && Jobs[Idx])
		{
			EHktJobStatus S = Jobs[Idx]->GetStatus();
			if (S == EHktJobStatus::Pending || S == EHktJobStatus::Preparing || S == EHktJobStatus::Ready)
			{
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
					FString::Printf(TEXT("Job 취소: %s"), Jobs[Idx]->GetJobName()), Id);
				Jobs[Idx]->Cancel();
			}
		}
	}
}

void FHktJobQueue::TickJobs(float DeltaTime)
{
	for (const TSharedPtr<IHktPresentationJob>& Job : Jobs)
	{
		if (!Job) continue;
		EHktJobStatus S = Job->GetStatus();
		if (S == EHktJobStatus::Pending || S == EHktJobStatus::Preparing)
		{
			Job->TickJob(DeltaTime);
		}
	}
}

bool FHktJobQueue::ExecuteReadyJobs(FHktPresentationState& State)
{
	bool bAnyExecuted = false;

	for (const TSharedPtr<IHktPresentationJob>& Job : Jobs)
	{
		if (!Job) continue;
		if (Job->GetStatus() == EHktJobStatus::Ready)
		{
			Job->Execute(State);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("Job 완료: %s"), Job->GetJobName()), Job->GetTargetEntityId());
			bAnyExecuted = true;
		}
	}

	// 완료/취소된 Job 제거
	Compact();

	return bAnyExecuted;
}

void FHktJobQueue::Flush()
{
	const int32 Count = Jobs.Num();
	for (const TSharedPtr<IHktPresentationJob>& Job : Jobs)
	{
		if (!Job) continue;
		EHktJobStatus S = Job->GetStatus();
		if (S != EHktJobStatus::Completed && S != EHktJobStatus::Cancelled)
		{
			Job->Cancel();
		}
	}
	Jobs.Empty();
	EntityJobIndex.Empty();

	if (Count > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("JobQueue Flush: %d개 Job 전체 취소"), Count));
	}
}

void FHktJobQueue::Compact()
{
	// Completed/Cancelled 제거
	Jobs.RemoveAll([](const TSharedPtr<IHktPresentationJob>& Job)
	{
		if (!Job) return true;
		EHktJobStatus S = Job->GetStatus();
		return S == EHktJobStatus::Completed || S == EHktJobStatus::Cancelled;
	});

	// EntityJobIndex 재구축
	EntityJobIndex.Empty();
	for (int32 i = 0; i < Jobs.Num(); ++i)
	{
		if (!Jobs[i]) continue;
		const FHktEntityId EntityId = Jobs[i]->GetTargetEntityId();
		if (EntityId != InvalidEntityId)
		{
			EntityJobIndex.Add(EntityId, i);
		}
	}
}
