// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "Templates/UnrealTypeTraits.h"

/**
 * FHktWorldView — Diff + WorldState 통합 읽기 뷰
 * OnWorldViewUpdated(FHktWorldView)로 전달되며, Presentation에서 State 갱신에 사용.
 */
struct HKTCORE_API FHktWorldView
{
	FHktWorldView();
	~FHktWorldView();

	// === 원본 데이터 (Zero Copy) ===
	const FHktWorldState* WorldState = nullptr;

	// === 변경점 (Diff로부터, 없으면 nullptr) ===
	const TArray<FHktEntityState>* SpawnedEntities = nullptr;
	const TArray<FHktEntityState>* RemovedEntities = nullptr;
	const TArray<FHktPropertyDelta>* PropertyDeltas = nullptr;
	const TArray<FHktTagDelta>* TagDeltas = nullptr;
	const TArray<FHktOwnerDelta>* OwnerDeltas = nullptr;
	const TArray<FHktVFXEvent>* VFXEvents = nullptr;
	const TArray<FHktAnimEvent>* AnimEvents = nullptr;

	// === 메타 ===
	int64 FrameNumber = 0;
	bool bIsInitialSync = false;

	// === 읽기 API ===

	FORCEINLINE int32 GetProperty(FHktEntityId Entity, uint16 PropId) const
	{
		return WorldState ? WorldState->GetProperty(Entity, PropId) : 0;
	}

	FORCEINLINE bool IsValidEntity(FHktEntityId Entity) const
	{
		return WorldState && WorldState->IsValidEntity(Entity);
	}


	template<typename F>
	void ForEachEntity(F&& Cb) const
	{
		if (WorldState) WorldState->ForEachEntity(Forward<F>(Cb));
	}

	template<typename F>
	void ForEachDelta(F&& Cb) const
	{
		if (PropertyDeltas)
			for (const FHktPropertyDelta& D : *PropertyDeltas)
				Cb(D.EntityId, D.PropertyId, D.NewValue);
	}

	template<typename F>
	void ForEachSpawned(F&& Cb) const
	{
		if (SpawnedEntities)
			for (const FHktEntityState& S : *SpawnedEntities)
				Cb(S);
	}

	template<typename F>
	void ForEachRemoved(F&& Cb) const
	{
		if (RemovedEntities)
			for (const FHktEntityState& S : *RemovedEntities)
				Cb(S.EntityId);
	}

	template<typename F>
	void ForEachTagDelta(F&& Cb) const
	{
		if (TagDeltas)
			for (const FHktTagDelta& TD : *TagDeltas)
				Cb(TD.EntityId, TD.Tags, TD.OldTags);
	}

	template<typename F>
	void ForEachOwnerDelta(F&& Cb) const
	{
		if (OwnerDeltas)
			for (const FHktOwnerDelta& OD : *OwnerDeltas)
				Cb(OD.EntityId, OD.NewOwnerUid);
	}

	template<typename F>
	void ForEachVFXEvent(F&& Cb) const
	{
		if (VFXEvents)
			for (const FHktVFXEvent& E : *VFXEvents)
				Cb(E);
	}

	template<typename F>
	void ForEachAnimEvent(F&& Cb) const
	{
		if (AnimEvents)
			for (const FHktAnimEvent& E : *AnimEvents)
				Cb(E);
	}
};
