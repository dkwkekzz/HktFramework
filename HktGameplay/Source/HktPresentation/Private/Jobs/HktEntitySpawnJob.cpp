// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Jobs/HktEntitySpawnJob.h"
#include "HktPresentationState.h"
#include "HktAssetSubsystem.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "Components/CapsuleComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"

/** 동기 지면 트레이스 (Z==0 폴백용) */
static bool TraceGroundZForJob(UWorld* World, const FVector& Pos, float& OutZ)
{
	if (!World) return false;
	constexpr float TraceHalfHeight = 500.0f;
	const FVector Start(Pos.X, Pos.Y, Pos.Z + TraceHalfHeight);
	const FVector End(Pos.X, Pos.Y, Pos.Z - TraceHalfHeight);
	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.bTraceComplex = false;
	if (World->LineTraceSingleByChannel(Hit, Start, End, ECC_WorldStatic, Params))
	{
		OutZ = Hit.ImpactPoint.Z;
		return true;
	}
	return false;
}

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
		FHktEntityId CapturedEntityId = EntityId;
		AssetSubsystem->LoadAssetAsync(VisualTag, [WeakGuard, this, CapturedEntityId](UHktTagDataAsset* Asset)
		{
			if (!WeakGuard.IsValid()) return;

			if (Asset)
			{
				ResolvedAssetPath = FSoftObjectPath(Asset);

				// ActorVisualDataAsset인 경우 CDO에서 캡슐 반높이 추출
				if (UHktActorVisualDataAsset* VisualAsset = Cast<UHktActorVisualDataAsset>(Asset))
				{
					if (VisualAsset->ActorClass)
					{
						if (AActor* CDO = VisualAsset->ActorClass->GetDefaultObject<AActor>())
						{
							if (UCapsuleComponent* Capsule = CDO->FindComponentByClass<UCapsuleComponent>())
							{
								CapsuleHalfHeight = Capsule->GetScaledCapsuleHalfHeight();
							}
						}
					}
				}
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
	E->CapsuleHalfHeight = CapsuleHalfHeight;

	// RenderLocation 계산 (Location + 지면 트레이스 + 캡슐 오프셋)
	FVector Loc = E->Location.Get();
	if (Loc.Z == 0.0f)
	{
		ULocalPlayer* LP = WeakLP.Get();
		UWorld* World = LP ? LP->GetWorld() : nullptr;
		float GroundZ;
		if (World && TraceGroundZForJob(World, Loc, GroundZ))
		{
			Loc.Z = GroundZ;
		}
	}
	Loc.Z += CapsuleHalfHeight;
	E->RenderLocation.Set(Loc, Frame);

	// DirtyThisFrame에 추가하여 렌더러 Sync에서 처리 보장
	OutState.DirtyThisFrame.AddUnique(EntityId);

	Status = EHktJobStatus::Completed;
}

void FHktEntitySpawnJob::Cancel()
{
	Status = EHktJobStatus::Cancelled;
	AliveGuard.Reset();
}
