// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktActorRenderer.h"
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

FHktActorRenderer::FHktActorRenderer(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktActorRenderer::Sync(const FHktPresentationState& State)
{
	const int64 Frame = State.GetCurrentFrame();

	// --- 1. 삭제: RemovedThisFrame 처리 ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		if (TWeakObjectPtr<AActor>* P = ActorMap.Find(Id))
		{
			if (AActor* A = P->Get())
				A->Destroy();
			ActorMap.Remove(Id);
		}
	}

	// --- 2. 스폰: ResolvedAssetPath가 설정된 엔티티 (SpawnedThisFrame + DirtyThisFrame) ---
	auto TrySpawn = [this, &State](FHktEntityId Id)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E || E->RenderCategory != EHktRenderCategory::Actor) return;
		if (ActorMap.Contains(Id)) return;
		if (E->ResolvedAssetPath.Get().IsNull()) return;

		SpawnActorFromResolvedAsset(*E);
	};

	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		TrySpawn(Id);
	}

	// DirtyThisFrame: SpawnJob 완료 후 ResolvedAssetPath가 설정되었을 수 있음
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (!ActorMap.Contains(Id))
		{
			TrySpawn(Id);
		}
	}

	// --- 3. Dirty → Actor에 전달 (animation, attachment 등 delta 처리) ---
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E || E->RenderCategory != EHktRenderCategory::Actor) continue;
		if (ActorMap.Contains(Id))
		{
			ForwardToActor(Id, *E, Frame, false);
		}
	}

	// --- 4. 매 프레임 Transform 적용 (Core와 렌더 주기 차이로 인한 끊김 방지) ---
	for (auto& [Id, WeakActor] : ActorMap)
	{
		if (!WeakActor.IsValid()) continue;
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E) continue;

		if (IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakActor.Get()))
			P->ApplyTransform(*E);
	}
}

void FHktActorRenderer::SpawnActorFromResolvedAsset(const FHktEntityPresentation& Entity)
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

	// 에셋이 이미 SpawnJob에서 로드되어 캐시에 있으므로 동기 로드 (캐시 히트)
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

		// Owner 스폰 시 → ViewModel 기반으로 대기 아이템 부착 시도
		for (auto& [ExistingId, WeakActor] : ActorMap)
		{
			if (ExistingId == EntityId) continue;
			if (!WeakActor.IsValid()) continue;
			// 아이템 부착 여부는 ViewModel에서 확인 — State 접근 필요
			// ForwardToActor에서 bForceAll=true로 처리
		}
	});
}

void FHktActorRenderer::ForwardToActor(FHktEntityId Id, const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll)
{
	TWeakObjectPtr<AActor>* WeakPtr = ActorMap.Find(Id);
	if (!WeakPtr || !WeakPtr->IsValid()) return;

	IHktPresentableActor* P = Cast<IHktPresentableActor>(WeakPtr->Get());
	if (!P) return;

	P->ApplyPresentation(Entity, Frame, bForceAll,
		[this](FHktEntityId OwnerId) -> AActor* { return GetActor(OwnerId); });
}

void FHktActorRenderer::Teardown()
{
	AliveGuard.Reset();
	ActorMap.Empty();
}

AActor* FHktActorRenderer::GetActor(FHktEntityId Id) const
{
	if (TWeakObjectPtr<AActor> const* P = ActorMap.Find(Id))
		return P->Get();
	return nullptr;
}
