// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

/**
 * Actor 렌더러.
 * 역할: Actor 생명주기 관리(스폰/파괴) + ViewModel 변경점을 Actor에 전달.
 * 모든 시각 로직(transform, animation, attachment)은 각 Actor 내부에서 처리.
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
	void SpawnActor(const FHktEntityPresentation& Entity);
	void DestroyActor(FHktEntityId Id);

	/** ViewModel 변경점을 Actor에 전달 */
	void ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll);

	TMap<FHktEntityId, TWeakObjectPtr<AActor>> ActorMap;
	TSet<FHktEntityId> PendingSpawnSet;
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;

	/** Sync마다 갱신 — async callback에서 ViewModel 직접 조회용 */
	const FHktPresentationState* CachedState = nullptr;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
