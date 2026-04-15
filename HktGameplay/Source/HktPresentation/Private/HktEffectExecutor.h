// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktEffectsPlan.h"
#include "HktPresentationState.h"

class ULocalPlayer;
class FHktActorRenderer;
class FHktVFXRenderer;
class UHktAssetSubsystem;

/**
 * FHktEffectExecutor — UE5 side effect 일괄 실행기
 *
 * Projection 파이프라인이 생성한 FHktEffectsPlan을 순서대로 실행.
 * 모든 UE5 월드 상호작용(Actor spawn/destroy, 에셋 로드, VFX, ground trace)이
 * 이 클래스를 통해서만 수행됨.
 *
 * 기존 코드 매핑:
 *  ResolveAsset          ← ResolveAssetPathsForSpawned()
 *  SpawnActor            ← SpawnActorsForNewEntities() → ActorRenderer->SpawnActor()
 *  DestroyActor          ← ProcessDiff() → ActorRenderer->DestroyActor()
 *  ComputeRenderLocation ← ComputeRenderLocations()
 *  SyncPresentation      ← ActorRenderer->ForwardToActor(bForceAll=true)
 *  SyncPresentationDelta ← ActorRenderer->Sync() → ForwardToActor(bForceAll=false)
 *  PlayVFXAtLocation     ← VFXRenderer->PlayVFXAtLocation()
 *  AttachVFXToEntity     ← VFXRenderer->AttachVFXToEntity()
 *  DetachVFXFromEntity   ← VFXRenderer->DetachVFXFromEntity()
 */
class FHktEffectExecutor
{
public:
	FHktEffectExecutor(
		ULocalPlayer* InLP,
		FHktActorRenderer* InActorRenderer,
		FHktVFXRenderer* InVFXRenderer);

	/** Effects Plan의 모든 Effect를 순서대로 실행 */
	void Execute(const FHktEffectsPlan& Plan, FHktPresentationState& State);

private:
	void ExecuteResolveAsset(const FHktEffect& Effect, FHktPresentationState& State);
	void ExecuteSpawnActor(const FHktEffect& Effect, const FHktPresentationState& State);
	void ExecuteDestroyActor(const FHktEffect& Effect);
	void ExecuteComputeRenderLocation(const FHktEffect& Effect, FHktPresentationState& State);
	void ExecuteSyncPresentation(const FHktEffect& Effect, const FHktPresentationState& State);
	void ExecuteSyncPresentationDelta(const FHktEffect& Effect, const FHktPresentationState& State);
	void ExecutePlayVFX(const FHktEffect& Effect);
	void ExecuteAttachVFX(const FHktEffect& Effect);
	void ExecuteDetachVFX(const FHktEffect& Effect);

	/** Ground trace 유틸리티 (ComputeRenderLocation에서 사용) */
	bool TraceGroundZ(const FVector& Pos, float& OutZ) const;

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
	FHktActorRenderer* ActorRenderer;
	FHktVFXRenderer* VFXRenderer;
};
