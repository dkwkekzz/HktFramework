// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCollisionDebugTracer.h"

#if ENABLE_HKT_INSIGHTS

FHktCollisionDebugTracer& FHktCollisionDebugTracer::Get()
{
	static FHktCollisionDebugTracer Instance;
	return Instance;
}

void FHktCollisionDebugTracer::Push(const FHktCollisionPair& Pair)
{
	FScopeLock ScopeLock(&Lock);

	if (Ring.Num() < RingCapacity)
	{
		Ring.SetNum(RingCapacity);
	}

	Ring[Head] = Pair;
	Head = (Head + 1) % RingCapacity;
	if (Count < RingCapacity)
	{
		++Count;
	}
}

void FHktCollisionDebugTracer::Snapshot(uint64 CurrentSimFrame, int32 MaxAgeFrames, TArray<FHktCollisionPair>& OutPairs) const
{
	OutPairs.Reset();

	FScopeLock ScopeLock(&Lock);
	if (Count <= 0)
	{
		return;
	}

	OutPairs.Reserve(Count);
	for (int32 i = 0; i < Count; ++i)
	{
		const int32 Idx = (Head - Count + i + RingCapacity) % RingCapacity;
		const FHktCollisionPair& P = Ring[Idx];

		if (MaxAgeFrames > 0)
		{
			const uint64 Age = (CurrentSimFrame > P.SimFrame) ? (CurrentSimFrame - P.SimFrame) : 0;
			if (Age > static_cast<uint64>(MaxAgeFrames))
			{
				continue;
			}
		}
		OutPairs.Add(P);
	}
}

void FHktCollisionDebugTracer::Clear()
{
	FScopeLock ScopeLock(&Lock);
	Head = 0;
	Count = 0;
}

#endif // ENABLE_HKT_INSIGHTS
