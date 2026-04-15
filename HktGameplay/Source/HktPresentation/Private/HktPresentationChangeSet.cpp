// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationChangeSet.h"

FHktPresentationChangeSet FHktPresentationChangeSet::FromWorldView(const FHktWorldView& View)
{
	FHktPresentationChangeSet CS;
	CS.WorldState = View.WorldState;
	CS.FrameNumber = View.FrameNumber;
	CS.bIsInitialSync = View.bIsInitialSync;

	// nullptr → 빈 ArrayView (안전한 이터레이션)
	if (View.SpawnedEntities)  CS.SpawnedEntities  = MakeArrayView(*View.SpawnedEntities);
	if (View.RemovedEntities)  CS.RemovedEntities  = MakeArrayView(*View.RemovedEntities);
	if (View.PropertyDeltas)   CS.PropertyDeltas   = MakeArrayView(*View.PropertyDeltas);
	if (View.TagDeltas)        CS.TagDeltas        = MakeArrayView(*View.TagDeltas);
	if (View.OwnerDeltas)      CS.OwnerDeltas      = MakeArrayView(*View.OwnerDeltas);
	if (View.VFXEvents)        CS.VFXEvents        = MakeArrayView(*View.VFXEvents);
	if (View.AnimEvents)       CS.AnimEvents        = MakeArrayView(*View.AnimEvents);

	return CS;
}

FHktPresentationChangeSet FHktPresentationChangeSet::ForInitialSync(
	const FHktWorldState& WS, int64 Frame,
	TArray<FHktEntityState>& OutSpawnBuffer)
{
	// 전체 엔티티를 SpawnedEntities 배열로 변환
	OutSpawnBuffer.Reset();
	WS.ForEachEntity([&WS, &OutSpawnBuffer](FHktEntityId Id, int32)
	{
		FHktEntityState ES;
		ES.EntityId = Id;
		// Data/Tags는 InitFromWorldState에서 WorldState를 직접 읽으므로 여기서는 최소 정보만 설정
		OutSpawnBuffer.Add(MoveTemp(ES));
	});

	FHktPresentationChangeSet CS;
	CS.WorldState = &WS;
	CS.FrameNumber = Frame;
	CS.bIsInitialSync = true;
	CS.SpawnedEntities = MakeArrayView(OutSpawnBuffer);

	return CS;
}
