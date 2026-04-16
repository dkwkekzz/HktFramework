// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Jobs/HktPresentationJob.h"
#include "GameplayTagContainer.h"
#include "UObject/SoftObjectPath.h"

class ULocalPlayer;
class UHktAssetSubsystem;
class UHktTagDataAsset;

/**
 * 엔티티 스폰 시 비동기 에셋 해석 + RenderLocation 계산 Job.
 *
 * State.AddEntity()는 ProcessDiff에서 즉시 호출되며,
 * 이 Job은 VisualElement 비동기 로드 → ResolvedAssetPath 설정만 담당.
 *
 * 상태 전이: Pending → Preparing (비동기 로드 중) → Ready → Execute → Completed
 */
class FHktEntitySpawnJob final : public IHktPresentationJob
{
public:
	FHktEntitySpawnJob(FHktEntityId InEntityId, FGameplayTag InVisualTag, ULocalPlayer* InLP);

	virtual void TickJob(float DeltaTime) override;
	virtual void Execute(FHktPresentationState& OutState) override;
	virtual EHktJobStatus GetStatus() const override { return Status; }
	virtual FHktEntityId GetTargetEntityId() const override { return EntityId; }
	virtual void Cancel() override;

private:
	FHktEntityId EntityId;
	FGameplayTag VisualTag;
	TWeakObjectPtr<ULocalPlayer> WeakLP;
	EHktJobStatus Status = EHktJobStatus::Pending;

	/** 비동기 콜백에서 this/Job 유효성 확인용 */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);

	/** 비동기 로드 결과 (콜백에서 설정) */
	bool bAssetResolved = false;
	FSoftObjectPath ResolvedAssetPath;
};
