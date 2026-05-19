// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHitboxDebugTracer.h"

#if ENABLE_HKT_INSIGHTS

FHktHitboxDebugTracer& FHktHitboxDebugTracer::Get()
{
	static FHktHitboxDebugTracer Instance;
	return Instance;
}

void FHktHitboxDebugTracer::Push(const FHktHitboxTrace& Trace)
{
	FScopeLock ScopeLock(&Lock);

	if (Ring.Num() < RingCapacity)
	{
		Ring.SetNum(RingCapacity);
	}

	Ring[Head] = Trace;
	Head = (Head + 1) % RingCapacity;
	if (Count < RingCapacity)
	{
		++Count;
	}
}

void FHktHitboxDebugTracer::Snapshot(uint64 CurrentSimFrame, int32 MaxAgeFrames, TArray<FHktHitboxTrace>& OutTraces) const
{
	OutTraces.Reset();

	FScopeLock ScopeLock(&Lock);
	if (Count <= 0)
	{
		return;
	}

	OutTraces.Reserve(Count);
	for (int32 i = 0; i < Count; ++i)
	{
		// Head 는 다음 쓸 슬롯 → 가장 오래된 항목 = Head - Count (mod RingCapacity)
		const int32 Idx = (Head - Count + i + RingCapacity) % RingCapacity;
		const FHktHitboxTrace& T = Ring[Idx];

		if (MaxAgeFrames > 0)
		{
			// CurrentSimFrame 이 T.SimFrame 보다 작으면 (롤백 등) age 0 으로 간주.
			const uint64 Age = (CurrentSimFrame > T.SimFrame) ? (CurrentSimFrame - T.SimFrame) : 0;
			if (Age > static_cast<uint64>(MaxAgeFrames))
			{
				continue;
			}
		}
		OutTraces.Add(T);
	}
}

void FHktHitboxDebugTracer::Clear()
{
	FScopeLock ScopeLock(&Lock);
	Head = 0;
	Count = 0;
}

#endif // ENABLE_HKT_INSIGHTS
