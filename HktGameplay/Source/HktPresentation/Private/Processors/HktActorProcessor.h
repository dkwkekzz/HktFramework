// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "UObject/SoftObjectPath.h"

class ULocalPlayer;

/**
 * Actor Processor.
 * Tick: PendingSpawns 소비 → 비동기 에셋 로드 → ResolvedAssetPath/RenderLocation 설정.
 * Sync: Actor 생명주기(스폰/파괴) + ViewModel 전달 + Transform 적용.
 */
class FHktActorProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktActorProcessor(ULocalPlayer* InLP);

	virtual void Tick(FHktPresentationState& State, float DeltaTime) override;
	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return !ActorMap.IsEmpty() || !PendingLoads.IsEmpty() || !PendingInitialForward.IsEmpty(); }

	AActor* GetActor(FHktEntityId Id) const;

private:
	/** 비동기 에셋 로드 추적 (힙 할당 없이 TMap 인라인) */
	struct FPendingAssetLoad
	{
		FGameplayTag VisualTag;
		bool bResolved = false;
		FSoftObjectPath ResolvedPath;
	};

	/** ResolvedAssetPath가 설정된 엔티티를 액터로 스폰 */
	void SpawnActorFromResolvedAsset(const FHktEntityPresentation& Entity);

	/** ViewModel 변경점을 Actor에 전달 */
	void ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll);

	TMap<FHktEntityId, TWeakObjectPtr<AActor>> ActorMap;
	TMap<FHktEntityId, FPendingAssetLoad> PendingLoads;
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;

	/** 스폰 콜백 완료 후 최초 ForwardToActor(bForceAll=true) 대기 */
	TSet<FHktEntityId> PendingInitialForward;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
