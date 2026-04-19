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

IHktPresentableActor* FHktActorProcessor::FindActorInterface(FHktEntityId Id) const
{
	const TWeakObjectPtr<AActor>* P = ActorMap.Find(Id);
	if (!P || !P->IsValid()) return nullptr;
	return Cast<IHktPresentableActor>(P->Get());
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
		const FHktEntityMeta* Meta = State.GetMeta(EntityId);
		FHktVisualizationView* Vis = State.GetMutableVisualization(EntityId);
		if (Meta && Meta->IsAlive() && Vis)
		{
			const int64 Frame = State.GetCurrentFrame();
			if (!It.Value().ResolvedPath.IsNull())
			{
				Vis->ResolvedAssetPath.Set(It.Value().ResolvedPath, Frame);
			}
			// RenderLocation을 Location으로 동기화
			if (FHktTransformView* T = State.GetMutableTransform(EntityId))
			{
				T->RenderLocation.Set(T->Location.Get(), Frame);
			}
			State.DirtyThisFrame.AddUnique(EntityId);

			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("에셋 로드 완료: %s"), *It.Value().VisualTag.ToString()), EntityId);
		}

		It.RemoveCurrent();
	}
}

// --------------------------------------------------------------------------- Sync: Actor 생명주기 + SOA 뷰별 패스

void FHktActorProcessor::Sync(FHktPresentationState& State)
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
		const FHktEntityMeta* M = State.GetMeta(Id);
		if (!M || !M->IsAlive() || M->RenderCategory != EHktRenderCategory::Actor) return;
		if (ActorMap.Contains(Id)) return;
		const FHktVisualizationView* V = State.GetVisualization(Id);
		if (!V || V->ResolvedAssetPath.Get().IsNull()) return;
		SpawnActorFromResolvedAsset(Id, State);
	};

	for (FHktEntityId Id : State.SpawnedThisFrame)
		TrySpawn(Id);

	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (!ActorMap.Contains(Id))
			TrySpawn(Id);
	}

	// --- 3. Actor가 방금 스폰된 엔터티 목록 (bForce=true 강제 적용) ---
	TArray<FHktEntityId, TInlineAllocator<16>> ForceEntities;
	ForceEntities.Reserve(PendingInitialForward.Num());
	for (FHktEntityId Id : PendingInitialForward)
	{
		if (ActorMap.Contains(Id))
			ForceEntities.Add(Id);
	}

	auto IsForced = [&ForceEntities](FHktEntityId Id)
	{
		return ForceEntities.Contains(Id);
	};

	// --- 4. SOA 뷰별 독립 순회 패스 ---

	// Physics 패스 — 더티 or Force인 엔터티만 Actor로 전달
	for (auto It = State.Physics.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyPhysics(*It, Frame, bForce);
	}

	// Movement 패스
	for (auto It = State.Movement.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyMovement(*It, Frame, bForce);
	}

	// Vitals 패스
	for (auto It = State.Vitals.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyVitals(*It, Frame, bForce);
	}

	// Combat 패스
	for (auto It = State.Combat.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyCombat(*It, Frame, bForce);
	}

	// Ownership 패스
	for (auto It = State.Ownership.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyOwnership(*It, Frame, bForce);
	}

	// Animation 패스 — mutable (PendingAnimTriggers 소비)
	for (auto It = State.Animation.CreateIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyAnimation(*It, Frame, bForce);
	}

	// Visualization 패스
	for (auto It = State.Visualization.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyVisualization(*It, Frame, bForce);
	}

	// Item 패스 — OwnerEntity 룩업 콜백
	auto GetActorFn = [this](FHktEntityId OwnerId) -> AActor* { return GetActor(OwnerId); };
	for (auto It = State.Items.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyItem(*It, Frame, bForce, GetActorFn);
	}

	// VoxelSkin 패스
	for (auto It = State.VoxelSkins.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyVoxelSkin(*It, Frame, bForce);
	}

	// TerrainDebris 패스
	for (auto It = State.TerrainDebris.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const bool bForce = IsForced(Id);
		if (!bForce && !It->AnyDirty(Frame)) continue;
		if (IHktPresentableActor* P = FindActorInterface(Id))
			P->ApplyTerrainDebris(*It, Frame, bForce);
	}

	// --- 5. 새 Owner 스폰 시: 기존 아이템 부착 재시도 ---
	if (ForceEntities.Num() > 0)
	{
		for (FHktEntityId OwnerId : ForceEntities)
		{
			for (auto& [ExistingId, WeakActor] : ActorMap)
			{
				if (ExistingId == OwnerId || !WeakActor.IsValid()) continue;
				const FHktItemView* Item = State.GetItem(ExistingId);
				if (!Item || !Item->IsAttached()) continue;
				if (static_cast<FHktEntityId>(Item->OwnerEntity.Get()) != OwnerId) continue;
				if (IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakActor.Get()))
				{
					P->ApplyItem(*Item, Frame, /*bForce=*/true, GetActorFn);
				}
			}
		}
	}
	// 처리된 엔터티만 제거. 비동기 스폰이 아직 완료되지 않은 항목은 다음 Sync까지 대기.
	for (FHktEntityId Id : ForceEntities)
	{
		PendingInitialForward.Remove(Id);
	}

	// --- 6. 매 프레임 Transform 적용 (모든 Actor) ---
	for (auto& [Id, WeakActor] : ActorMap)
	{
		if (!WeakActor.IsValid()) continue;
		const FHktTransformView* T = State.GetTransform(Id);
		if (!T) continue;
		if (IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakActor.Get()))
			P->ApplyTransform(*T);
	}
}

// --------------------------------------------------------------------------- SpawnActorFromResolvedAsset

void FHktActorProcessor::SpawnActorFromResolvedAsset(FHktEntityId EntityId, const FHktPresentationState& State)
{
	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	UHktAssetSubsystem* AssetSubsystem = UHktAssetSubsystem::Get(World);
	if (!AssetSubsystem) return;

	const FHktVisualizationView* Vis = State.GetVisualization(EntityId);
	const FHktTransformView* Tfm = State.GetTransform(EntityId);
	if (!Vis || !Tfm) return;

	const FGameplayTag VisualTag = Vis->VisualElement.Get();
	if (!VisualTag.IsValid()) return;

	const FVector SpawnLocation = Tfm->RenderLocation.Get();
	const FRotator SpawnRotation = Tfm->Rotation.Get();

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

// --------------------------------------------------------------------------- Teardown / GetActor

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
