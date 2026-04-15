// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktSpawnProjection — 스폰 후속 처리 (에셋 해석 + 렌더 위치 + Actor 생성)
 *
 * 기존에 5개 함수에 분산되었던 스폰 플로우를 단일 Projection으로 통합:
 *  1. ResolveAssetPathsForSpawned() → ResolveAsset effect
 *  2. ComputeRenderLocations()     → ComputeRenderLocation effect
 *  3. SpawnActorsForNewEntities()   → SpawnActor effect
 *
 * LifecycleProjection이 AddEntity를 완료한 후 실행되므로
 * VisualElement, RenderCategory 등을 안전하게 읽을 수 있음.
 */
class FHktSpawnProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("Spawn"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
