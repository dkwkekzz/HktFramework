// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "UObject/SoftObjectPath.h"

class ULocalPlayer;
class IHktPresentableActor;

/**
 * Actor Processor.
 * Tick: PendingSpawns 소비 → 비동기 에셋 로드 → ResolvedAssetPath/RenderLocation 설정.
 * Sync: Actor 생명주기(스폰/파괴) + SOA 뷰별 Apply 패스 + Transform 적용.
 */
class FHktActorProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktActorProcessor(ULocalPlayer* InLP);

	virtual void Tick(FHktPresentationState& State, float DeltaTime) override;
	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return !ActorMap.IsEmpty() || !PendingLoads.IsEmpty() || !PendingInitialForward.IsEmpty(); }

	AActor* GetActor(FHktEntityId Id) const;

private:
	struct FPendingAssetLoad
	{
		FGameplayTag VisualTag;
		bool bResolved = false;
		FSoftObjectPath ResolvedPath;
	};

	/** ResolvedAssetPath가 설정된 엔티티를 액터로 스폰 */
	void SpawnActorFromResolvedAsset(FHktEntityId EntityId, const FHktPresentationState& State);

	/** Id → ActorMap에 등록된 IHktPresentableActor 반환 (nullptr 가능) */
	IHktPresentableActor* FindActorInterface(FHktEntityId Id) const;

	TMap<FHktEntityId, TWeakObjectPtr<AActor>> ActorMap;
	TMap<FHktEntityId, FPendingAssetLoad> PendingLoads;
	TWeakObjectPtr<ULocalPlayer> LocalPlayer;

	/** 스폰 콜백 완료 후 최초 Apply* (bForce=true) 대기 */
	TSet<FHktEntityId> PendingInitialForward;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
