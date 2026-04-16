// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

/**
 * Actor 렌더러.
 * Sync에서 엔티티 생명주기(스폰/파괴) + ViewModel 변경점 전달 + Transform 적용을 모두 담당.
 * State의 SpawnedThisFrame/RemovedThisFrame/DirtyThisFrame를 소비하여 동작.
 */
class FHktActorRenderer : public IHktPresentationRenderer
{
public:
	explicit FHktActorRenderer(ULocalPlayer* InLP);
	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return !ActorMap.IsEmpty(); }

	AActor* GetActor(FHktEntityId Id) const;

private:
	/** ResolvedAssetPath가 설정된 엔티티를 동기 스폰 */
	void SpawnActorFromResolvedAsset(const FHktEntityPresentation& Entity);

	/** ViewModel 변경점을 Actor에 전달 */
	void ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll);

	TMap<FHktEntityId, TWeakObjectPtr<AActor>> ActorMap;
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;

	/** 스폰 콜백 완료 후 최초 ForwardToActor(bForceAll=true) 대기 엔티티 */
	TSet<FHktEntityId> PendingInitialForward;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
