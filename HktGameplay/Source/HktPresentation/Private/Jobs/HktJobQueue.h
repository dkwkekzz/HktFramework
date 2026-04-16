// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "Jobs/HktPresentationJob.h"

struct FHktPresentationState;

/**
 * Presentation Job 큐.
 * ProcessDiff에서 Job을 추가하고, OnTick에서 Tick → Execute를 수행한다.
 */
class FHktJobQueue
{
public:
	/** Job 추가. EntityJobIndex를 함께 갱신한다. */
	void AddJob(TSharedPtr<IHktPresentationJob> Job);

	/** 해당 엔티티의 모든 Pending/Preparing Job을 취소한다. */
	void CancelJobsForEntity(FHktEntityId Id);

	/** Pending/Preparing 상태 Job의 TickJob()을 호출한다. */
	void TickJobs(float DeltaTime);

	/** Ready 상태 Job을 순차 Execute하고 Completed/Cancelled를 정리한다. */
	bool ExecuteReadyJobs(FHktPresentationState& State);

	/** 모든 Job을 취소하고 큐를 비운다 (teardown용). */
	void Flush();

	int32 Num() const { return Jobs.Num(); }

private:
	/** Completed/Cancelled Job 제거 + EntityJobIndex 재구축 */
	void Compact();

	TArray<TSharedPtr<IHktPresentationJob>> Jobs;
	TMultiMap<FHktEntityId, int32> EntityJobIndex;
};
