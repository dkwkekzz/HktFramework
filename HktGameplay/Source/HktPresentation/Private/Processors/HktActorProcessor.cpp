// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktActorProcessor.h"
#include "HktPresentationLog.h"
#include "HktAssetSubsystem.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "DataAssets/HktItemVisualDataAsset.h"
#include "Actors/HktItemActor.h"
#include "Actors/IHktPresentableActor.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "HktCoreEventLog.h"

/** 모든 PrimitiveComponent를 QueryOnly + Visibility만 Block으로 설정 */
static void ConfigureCollisionForSelection(AActor* Actor)
{
	TInlineComponentArray<UPrimitiveComponent*> Primitives;
	Actor->GetComponents(Primitives);
	for (UPrimitiveComponent* Prim : Primitives)
	{
		Prim->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
		Prim->SetCollisionResponseToAllChannels(ECR_Ignore);
		Prim->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	}
}

FHktActorProcessor::FHktActorProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

// --------------------------------------------------------------------------- Tick: 비동기 에셋 로드

void FHktActorProcessor::Tick(FHktPresentationState& State, float DeltaTime)
{
	ULocalPlayer* LP = LocalPlayer.Get();
	if (!LP) return;
	UWorld* World = LP->GetWorld();
	UHktAssetSubsystem* AssetSub = World ? UHktAssetSubsystem::Get(World) : nullptr;

	// 1. PendingSpawns 소비 → 비동기 로드 시작
	if (AssetSub)
	{
		for (const FHktPendingSpawn& Spawn : State.PendingSpawns)
		{
			// 이미 로드 대기 중이면 스킵
			if (PendingLoads.Contains(Spawn.EntityId)) continue;

			FPendingAssetLoad& Load = PendingLoads.Add(Spawn.EntityId);
			Load.VisualTag = Spawn.VisualTag;

			TWeakPtr<bool> WeakGuard = AliveGuard;
			FHktEntityId CapturedId = Spawn.EntityId;
			AssetSub->LoadAssetAsync(Spawn.VisualTag, [this, WeakGuard, CapturedId](UHktTagDataAsset* Asset)
			{
				if (!WeakGuard.IsValid()) return;
				if (FPendingAssetLoad* L = PendingLoads.Find(CapturedId))
				{
					if (Asset)
						L->ResolvedPath = FSoftObjectPath(Asset);
					L->bResolved = true;
				}
			});

			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("에셋 로드 시작: %s"), *Spawn.VisualTag.ToString()), Spawn.EntityId);
		}
	}

	// 2. 로드 완료된 항목 → State 반영
	for (auto It = PendingLoads.CreateIterator(); It; ++It)
	{
		if (!It.Value().bResolved) continue;

		const FHktEntityId EntityId = It.Key();
		FHktEntityPresentation* E = State.GetMutable(EntityId);
		if (E && E->IsAlive())
		{
			const int64 Frame = State.GetCurrentFrame();
			if (!It.Value().ResolvedPath.IsNull())
				E->ResolvedAssetPath.Set(It.Value().ResolvedPath, Frame);
			E->RenderLocation.Set(E->Location.Get(), Frame);
			State.DirtyThisFrame.AddUnique(EntityId);

			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("에셋 로드 완료: %s"), *It.Value().VisualTag.ToString()), EntityId);
		}

		It.RemoveCurrent();
	}
}

// --------------------------------------------------------------------------- Sync: Actor 생명주기 + 렌더링

void FHktActorProcessor::Sync(const FHktPresentationState& State)
{
	const int64 Frame = State.GetCurrentFrame();

	// --- 1. 삭제: RemovedThisFrame 처리 ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		PendingLoads.Remove(Id);
		PendingInitialForward.Remove(Id);
		if (TWeakObjectPtr<AActor>* P = ActorMap.Find(Id))
		{
			if (AActor* A = P->Get())
				A->Destroy();
			ActorMap.Remove(Id);
		}
	}

	// --- 2. 스폰: ResolvedAssetPath가 설정된 엔티티 ---
	auto TrySpawn = [this, &State](FHktEntityId Id)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E || E->RenderCategory != EHktRenderCategory::Actor) return;
		if (ActorMap.Contains(Id)) return;
		if (E->ResolvedAssetPath.Get().IsNull()) return;
		SpawnActorFromResolvedAsset(*E);
	};

	for (FHktEntityId Id : State.SpawnedThisFrame)
		TrySpawn(Id);

	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (!ActorMap.Contains(Id))
			TrySpawn(Id);
	}

	// --- 3. Dirty → Actor에 전달 + 최초 스폰 시 ForceAll ---
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E || E->RenderCategory != EHktRenderCategory::Actor) continue;
		if (ActorMap.Contains(Id))
		{
			const bool bForce = PendingInitialForward.Remove(Id) > 0;
			ForwardToActor(Id, *E, Frame, bForce);

			// 새 Owner 스폰 시: 기존 아이템 부착 시도
			if (bForce)
			{
				for (auto& [ExistingId, WeakActor] : ActorMap)
				{
					if (ExistingId == Id || !WeakActor.IsValid()) continue;
					const FHktEntityPresentation* ItemE = State.Get(ExistingId);
					if (ItemE && ItemE->IsItemAttached()
						&& static_cast<FHktEntityId>(ItemE->OwnerEntity.Get()) == Id)
					{
						ForwardToActor(ExistingId, *ItemE, Frame, true);
					}
				}
			}
		}
	}

	// --- 3.5 비동기 콜백으로 늦게 스폰된 Actor의 최초 ViewModel 적용 ---
	for (auto It = PendingInitialForward.CreateIterator(); It; ++It)
	{
		const FHktEntityId Id = *It;
		if (!ActorMap.Contains(Id)) continue;
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E) { It.RemoveCurrent(); continue; }

		ForwardToActor(Id, *E, Frame, true);
		for (auto& [ExistingId, WeakActor] : ActorMap)
		{
			if (ExistingId == Id || !WeakActor.IsValid()) continue;
			const FHktEntityPresentation* ItemE = State.Get(ExistingId);
			if (ItemE && ItemE->IsItemAttached()
				&& static_cast<FHktEntityId>(ItemE->OwnerEntity.Get()) == Id)
			{
				ForwardToActor(ExistingId, *ItemE, Frame, true);
			}
		}
		It.RemoveCurrent();
	}

	// --- 4. 매 프레임 Transform 적용 ---
	for (auto& [Id, WeakActor] : ActorMap)
	{
		if (!WeakActor.IsValid()) continue;
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E) continue;
		if (IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakActor.Get()))
			P->ApplyTransform(*E);
	}
}

// --------------------------------------------------------------------------- SpawnActorFromResolvedAsset

void FHktActorProcessor::SpawnActorFromResolvedAsset(const FHktEntityPresentation& Entity)
{
	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	UHktAssetSubsystem* AssetSubsystem = UHktAssetSubsystem::Get(World);
	if (!AssetSubsystem) return;

	FGameplayTag VisualTag = Entity.VisualElement.Get();
	if (!VisualTag.IsValid()) return;

	FHktEntityId EntityId = Entity.EntityId;
	FVector SpawnLocation = Entity.RenderLocation.Get();
	FRotator SpawnRotation = Entity.Rotation.Get();

	// 에셋이 이미 Tick에서 로드되어 캐시에 있으므로 동기 로드 (캐시 히트)
	TWeakObjectPtr<ULocalPlayer> WeakLP = LocalPlayer;
	TWeakPtr<bool> WeakGuard = AliveGuard;
	AssetSubsystem->LoadAssetAsync(VisualTag, [WeakGuard, this, VisualTag, EntityId, SpawnLocation, SpawnRotation, WeakLP](UHktTagDataAsset* LoadedAsset)
	{
		if (!WeakGuard.IsValid()) return;

		ULocalPlayer* LP = WeakLP.Get();
		if (!LP) return;

		UWorld* CallbackWorld = LP->GetWorld();
		if (!CallbackWorld) return;

		AActor* SpawnedActor = nullptr;

		if (UHktItemVisualDataAsset* ItemAsset = Cast<UHktItemVisualDataAsset>(LoadedAsset))
		{
			FActorSpawnParameters SpawnParams;
			AHktItemActor* ItemActor = CallbackWorld->SpawnActor<AHktItemActor>(AHktItemActor::StaticClass(), SpawnLocation, SpawnRotation, SpawnParams);
			if (ItemActor)
			{
				ItemActor->SetupMesh(ItemAsset->Mesh, ItemAsset->DroppedMesh, ItemAsset->MeshScale, ItemAsset->AttachRotationOffset, ItemAsset->AttachSocketName);
			}
			SpawnedActor = ItemActor;
		}
		else
		{
			TSubclassOf<AActor> ActorClass;
			UHktActorVisualDataAsset* VisualAsset = Cast<UHktActorVisualDataAsset>(LoadedAsset);
			if (VisualAsset && VisualAsset->ActorClass)
				ActorClass = VisualAsset->ActorClass;

			if (!ActorClass)
			{
				HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
					FString::Printf(TEXT("SpawnActor: No ActorClass for tag %s entity=%d"), *VisualTag.ToString(), EntityId));
				return;
			}

			FActorSpawnParameters SpawnParams;
			SpawnedActor = CallbackWorld->SpawnActor<AActor>(ActorClass, SpawnLocation, SpawnRotation, SpawnParams);
		}

		if (!SpawnedActor) return;

		if (ActorMap.Contains(EntityId))
		{
			SpawnedActor->Destroy();
			return;
		}

		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SpawnActor Tag=%s Location=(%.1f, %.1f, %.1f)"),
			*VisualTag.ToString(), SpawnedActor->GetActorLocation().X, SpawnedActor->GetActorLocation().Y, SpawnedActor->GetActorLocation().Z), EntityId);

		ConfigureCollisionForSelection(SpawnedActor);

		if (IHktPresentableActor* P = Cast<IHktPresentableActor>(SpawnedActor))
		{
			P->SetEntityId(EntityId);
			P->OnVisualAssetLoaded(LoadedAsset);
		}

		ActorMap.Add(EntityId, SpawnedActor);
		PendingInitialForward.Add(EntityId);
	});
}

// --------------------------------------------------------------------------- ForwardToActor / Teardown / GetActor

void FHktActorProcessor::ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll)
{
	TWeakObjectPtr<AActor>* WeakPtr = ActorMap.Find(Id);
	if (!WeakPtr || !WeakPtr->IsValid()) return;

	IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakPtr->Get());
	if (!P) return;

	P->ApplyPresentation(Entity, Frame, bForceAll,
		[this](FHktEntityId OwnerId) -> AActor* { return GetActor(OwnerId); });
}

void FHktActorProcessor::Teardown()
{
	AliveGuard.Reset();
	ActorMap.Empty();
	PendingLoads.Empty();
	PendingInitialForward.Empty();
}

AActor* FHktActorProcessor::GetActor(FHktEntityId Id) const
{
	if (TWeakObjectPtr<AActor> const* P = ActorMap.Find(Id))
		return P->Get();
	return nullptr;
}
