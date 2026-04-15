// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktWorldView.h"
#include "Containers/ArrayView.h"

/**
 * FHktPresentationChangeSet — Projection 파이프라인의 입력 단위
 *
 * FHktWorldView의 포인터/ForEach 패턴을 TConstArrayView로 래핑하여
 * 초기 동기화(InitialSync)와 증분 업데이트(Diff)를 동일한 인터페이스로 처리.
 *
 * 모든 ArrayView는 원본 데이터를 참조 (zero-copy).
 * ChangeSet의 수명은 원본 FHktWorldView/FHktSimulationDiff의 수명 이내여야 함.
 */
struct HKTPRESENTATION_API FHktPresentationChangeSet
{
	const FHktWorldState* WorldState = nullptr;
	int64 FrameNumber = 0;
	bool bIsInitialSync = false;

	TConstArrayView<FHktEntityState> SpawnedEntities;
	TConstArrayView<FHktEntityId> RemovedEntities;
	TConstArrayView<FHktPropertyDelta> PropertyDeltas;
	TConstArrayView<FHktTagDelta> TagDeltas;
	TConstArrayView<FHktOwnerDelta> OwnerDeltas;
	TConstArrayView<FHktVFXEvent> VFXEvents;
	TConstArrayView<FHktAnimEvent> AnimEvents;

	/** FHktWorldView에서 zero-copy 변환. nullptr 포인터는 빈 ArrayView로 변환. */
	static FHktPresentationChangeSet FromWorldView(const FHktWorldView& View);

	/**
	 * 초기 동기화용: WorldState의 전체 엔티티를 SpawnedEntities로 직렬화.
	 * Projection이 초기 동기화를 Spawn과 동일한 경로로 처리 가능.
	 * OutSpawnBuffer는 호출자가 수명을 관리 (ChangeSet보다 오래 살아야 함).
	 */
	static FHktPresentationChangeSet ForInitialSync(
		const FHktWorldState& WS, int64 Frame,
		TArray<FHktEntityState>& OutSpawnBuffer);
};
