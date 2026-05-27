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
	// DeferredSpawns 가 비어있지 않으면 — 카메라 이동만으로도 반경 재진입 스폰을 평가해야 하므로 — 매 프레임 Sync 필요.
	virtual bool NeedsTick() const override { return !ActorMap.IsEmpty() || !PendingLoads.IsEmpty() || !PendingInitialForward.IsEmpty() || !DeferredSpawns.IsEmpty(); }

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

	/**
	 * 카메라 컬링 반경 밖이라 Actor 스폰을 보류한 엔터티.
	 * 에셋은 해석되었으나(ResolvedAssetPath 유효) 반경 밖이라 SpawnActor 를 생략한 항목,
	 * 또는 반경 이탈로 Actor 를 파괴한 항목이 적재된다. 매 Sync 마다 반경 재진입을 평가하여
	 * 진입 시 스폰한다. 엔터티 상태(SOA)는 서버 권위로 계속 유지되며 여기엔 영향 없음.
	 */
	TSet<FHktEntityId> DeferredSpawns;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);
};
