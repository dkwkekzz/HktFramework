// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Jobs/HktEntitySpawnJob.h"
#include "HktPresentationState.h"
#include "HktAssetSubsystem.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"

FHktEntitySpawnJob::FHktEntitySpawnJob(FHktEntityId InEntityId, FGameplayTag InVisualTag, ULocalPlayer* InLP)
	: EntityId(InEntityId)
	, VisualTag(InVisualTag)
	, WeakLP(InLP)
{
}

void FHktEntitySpawnJob::TickJob(float DeltaTime)
{
	if (Status == EHktJobStatus::Pending)
	{
		ULocalPlayer* LP = WeakLP.Get();
		if (!LP)
		{
			Status = EHktJobStatus::Cancelled;
			return;
		}

		UWorld* World = LP->GetWorld();
		UHktAssetSubsystem* AssetSubsystem = World ? UHktAssetSubsystem::Get(World) : nullptr;
		if (!AssetSubsystem)
		{
			Status = EHktJobStatus::Cancelled;
			return;
		}

		Status = EHktJobStatus::Preparing;

		TWeakPtr<bool> WeakGuard = AliveGuard;
		AssetSubsystem->LoadAssetAsync(VisualTag, [WeakGuard, this](UHktTagDataAsset* Asset)
		{
			if (!WeakGuard.IsValid()) return;

			if (Asset)
			{
				ResolvedAssetPath = FSoftObjectPath(Asset);
			}

			bAssetResolved = true;
		});
	}
	else if (Status == EHktJobStatus::Preparing)
	{
		if (bAssetResolved)
		{
			Status = EHktJobStatus::Ready;
		}
	}
}

void FHktEntitySpawnJob::Execute(FHktPresentationState& OutState)
{
	FHktEntityPresentation* E = OutState.GetMutable(EntityId);
	if (!E || !E->IsAlive())
	{
		Status = EHktJobStatus::Completed;
		return;
	}

	const int64 Frame = OutState.GetCurrentFrame();

	// ResolvedAssetPath 설정
	if (!ResolvedAssetPath.IsNull())
	{
		E->ResolvedAssetPath.Set(ResolvedAssetPath, Frame);
	}

	// RenderLocation = Location (보정 없이 시뮬레이션 위치 그대로 사용)
	E->RenderLocation.Set(E->Location.Get(), Frame);

	// DirtyThisFrame에 추가하여 렌더러 Sync에서 처리 보장
	OutState.DirtyThisFrame.AddUnique(EntityId);

	Status = EHktJobStatus::Completed;
}

void FHktEntitySpawnJob::Cancel()
{
	Status = EHktJobStatus::Cancelled;
	AliveGuard.Reset();
}
