// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

/**
 * Actor 렌더러.
 * 생명주기(Spawn/Destroy)와 ViewModel 전달(ForwardToActor)은 EffectExecutor가 호출.
 * Sync에서는 매 프레임 Transform 적용만 담당.
 */
class FHktActorRenderer : public IHktPresentationRenderer
{
public:
	explicit FHktActorRenderer(ULocalPlayer* InLP);
	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return !ActorMap.IsEmpty(); }

	AActor* GetActor(FHktEntityId Id) const;
	bool HasActorOrPending(FHktEntityId Id) const { return ActorMap.Contains(Id) || PendingSpawnSet.Contains(Id); }

	/** EffectExecutor에서 호출 — 엔티티 생명주기 직접 관리 */
	void SpawnActor(const FHktEntityPresentation& Entity);
	void DestroyActor(FHktEntityId Id);

	/** ViewModel 변경점을 Actor에 전달 (EffectExecutor에서 호출) */
	void ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll);

	/** 비동기 콜백이 CachedState를 참조하므로, Sync 전에도 State를 설정 */
	void EnsureState(const FHktPresentationState& State) { CachedState = &State; }

private:

	TMap<FHktEntityId, TWeakObjectPtr<AActor>> ActorMap;
	TSet<FHktEntityId> PendingSpawnSet;
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;

	/** Sync마다 갱신 — async callback에서 ViewModel 직접 조회용 */
	const FHktPresentationState* CachedState = nullptr;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
