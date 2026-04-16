// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktLifecycleProjection — 엔티티 생성/삭제 처리
 *
 * 파이프라인 최선두에서 실행. 후속 Projection이 ViewModel을 읽을 수 있도록
 * AddEntity/RemoveEntity를 먼저 수행.
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachRemoved → State.RemoveEntity + ActorRenderer->DestroyActor
 *  - ProcessDiff: ForEachSpawned → State.AddEntity
 */
class FHktLifecycleProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("Lifecycle"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
