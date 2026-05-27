// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktActorProcessor.h"
#include "HktPresentationLog.h"
#include "HktPresentationStats.h"
#include "HktAssetSubsystem.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "DataAssets/HktItemVisualDataAsset.h"
#include "Actors/HktItemActor.h"
#include "Actors/IHktPresentableActor.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "HktCoreEventLog.h"

DECLARE_CYCLE_STAT(TEXT("ActorProcessor.Tick"),         STAT_HktPres_ActorTick,         STATGROUP_HktPresentation);
DECLARE_CYCLE_STAT(TEXT("ActorProcessor.Sync"),         STAT_HktPres_ActorSync,         STATGROUP_HktPresentation);
DECLARE_CYCLE_STAT(TEXT("ActorProcessor.SyncViews"),    STAT_HktPres_ActorSyncViews,    STATGROUP_HktPresentation);
DECLARE_CYCLE_STAT(TEXT("ActorProcessor.ApplyTransform"), STAT_HktPres_ActorApplyTransform, STATGROUP_HktPresentation);

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
	SCOPE_CYCLE_COUNTER(STAT_HktPres_ActorTick);

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
	SCOPE_CYCLE_COUNTER(STAT_HktPres_ActorSync);

	const int64 Frame = State.GetCurrentFrame();

	// --- 1. 삭제: RemovedThisFrame 처리 ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		PendingLoads.Remove(Id);
		PendingInitialForward.Remove(Id);
		DeferredSpawns.Remove(Id);
		if (TWeakObjectPtr<AActor>* P = ActorMap.Find(Id))
		{
			if (AActor* A = P->Get())
				A->Destroy();
			ActorMap.Remove(Id);
		}
	}

	// --- 2. 스폰: ResolvedAssetPath가 설정된 엔티티 ---
	//     카메라 컬링 반경 밖이면 SpawnActor 자체를 생략하고 DeferredSpawns 에 보류한다.
	//     (반경 밖 Actor 를 만들어두고 숨기는 대신, 아예 생성하지 않음 → 반경 재진입 시 스폰.)
	auto TrySpawn = [this, &State](FHktEntityId Id)
	{
		const FHktEntityMeta* M = State.GetMeta(Id);
		if (!M || !M->IsAlive() || M->RenderCategory != EHktRenderCategory::Actor) return;
		if (ActorMap.Contains(Id)) return;
		const FHktVisualizationView* V = State.GetVisualization(Id);
		if (!V || V->ResolvedAssetPath.Get().IsNull()) return;
		if (!State.IsEntityWithinRenderCull(Id))
		{
			DeferredSpawns.Add(Id);
			return;
		}
		DeferredSpawns.Remove(Id);
		SpawnActorFromResolvedAsset(Id, State);
	};

	for (FHktEntityId Id : State.SpawnedThisFrame)
		TrySpawn(Id);

	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (!ActorMap.Contains(Id))
			TrySpawn(Id);
	}

	// 보류 엔터티 재평가 — 정지한 엔터티는 더티가 아니므로 위 루프에 잡히지 않는다.
	// 카메라 이동으로 반경에 재진입한 항목을 매 프레임 여기서 스폰한다.
	for (auto It = DeferredSpawns.CreateIterator(); It; ++It)
	{
		const FHktEntityId Id = *It;
		const FHktEntityMeta* M = State.GetMeta(Id);
		if (!M || !M->IsAlive() || M->RenderCategory != EHktRenderCategory::Actor)
		{
			It.RemoveCurrent();
			continue;
		}
		if (ActorMap.Contains(Id))
		{
			It.RemoveCurrent();
			continue;
		}
		if (!State.IsEntityWithinRenderCull(Id))
			continue; // 아직 반경 밖 — 보류 유지
		const FHktVisualizationView* V = State.GetVisualization(Id);
		if (!V || V->ResolvedAssetPath.Get().IsNull())
			continue;
		It.RemoveCurrent();
		SpawnActorFromResolvedAsset(Id, State);
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

	auto GetActorFn = [this](FHktEntityId OwnerEntityId) -> AActor* { return GetActor(OwnerEntityId); };

	// --- 4. SOA 뷰별 독립 순회 패스 ---
	{
		SCOPE_CYCLE_COUNTER(STAT_HktPres_ActorSyncViews);

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

		// Sprite 패스 — Paper2D 액터 등 sprite 캐릭터 전용 권위 상태(Facing/AnimStartTick).
		for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
		{
			const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
			const bool bForce = IsForced(Id);
			if (!bForce && !It->AnyDirty(Frame)) continue;
			if (IHktPresentableActor* P = FindActorInterface(Id))
				P->ApplySprite(*It, Frame, bForce);
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

	// --- 6. 매 프레임 Transform 적용 + 카메라 거리 컬링 (모든 Actor) ---
	SCOPE_CYCLE_COUNTER(STAT_HktPres_ActorApplyTransform);
	for (auto It = ActorMap.CreateIterator(); It; ++It)
	{
		const FHktEntityId Id = It->Key;
		AActor* A = It->Value.Get();
		if (!A)
		{
			It.RemoveCurrent();
			continue;
		}

		// 카메라 거리 컬링 — 반경 밖 Actor 는 파괴하고 DeferredSpawns 에 재적재한다.
		// (숨기는 대신 제거 → 메모리/틱/콜리전 비용 제거. 시뮬은 서버 권위로 그대로 진행됨.)
		// CullRadiusSqCm<=0 면 IsEntityWithinRenderCull 가 true 반환 → 컬링 비활성과 동일.
		if (!State.IsEntityWithinRenderCull(Id))
		{
			A->Destroy();
			PendingInitialForward.Remove(Id);
			DeferredSpawns.Add(Id); // 반경 재진입 시 재스폰
			It.RemoveCurrent();
			continue;
		}

		const FHktTransformView* T = State.GetTransform(Id);
		if (!T) continue;
		if (IHktPresentableActor* P = Cast<IHktPresentableActor>(A))
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
				ItemActor->SetupMesh(ItemAsset->Mesh, ItemAsset->DroppedMesh, ItemAsset->OverrideMaterial, ItemAsset->MeshScale, ItemAsset->AttachRotationOffset, ItemAsset->AttachSocketName);
			}
			SpawnedActor = ItemActor;
		}
		else if (UHktActorVisualDataAsset* VisualAsset = Cast<UHktActorVisualDataAsset>(LoadedAsset))
		{
			// Actor 기반 비주얼 에셋만 여기서 스폰. HISMSpriteVisualAsset 등 다른 타입은
			// 별도 Processor(AHktSpriteCrowdHost 등)가 처리하므로 이 경로에서 무시.
			if (!VisualAsset->ActorClass)
			{
				HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
					FString::Printf(TEXT("SpawnActor: No ActorClass for tag %s entity=%d"), *VisualTag.ToString(), EntityId));
				return;
			}

			FActorSpawnParameters SpawnParams;
			SpawnedActor = CallbackWorld->SpawnActor<AActor>(VisualAsset->ActorClass, SpawnLocation, SpawnRotation, SpawnParams);
		}
		else
		{
			// 스프라이트 캐릭터 템플릿 등 Actor 스폰이 필요 없는 에셋 — Sprite Crowd 파이프라인이 처리.
			return;
		}

		if (!SpawnedActor) return;

		if (ActorMap.Contains(EntityId))
		{
			SpawnedActor->Destroy();
			return;
		}

		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SpawnActor Tag=%s Location=(%.1f, %.1f, %.1f)"),
			*VisualTag.ToString(), SpawnedActor->GetActorLocation().X, SpawnedActor->GetActorLocation().Y, SpawnedActor->GetActorLocation().Z), EntityId);

		UE_LOG(LogHktPresentation, Log,
			TEXT("[FloatRepro] ActorProcessor.SpawnActor: entity=%d tag=%s Location=(%.1f, %.1f, %.1f)"),
			EntityId, *VisualTag.ToString(),
			SpawnedActor->GetActorLocation().X,
			SpawnedActor->GetActorLocation().Y,
			SpawnedActor->GetActorLocation().Z);

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
	DeferredSpawns.Empty();
}

AActor* FHktActorProcessor::GetActor(FHktEntityId Id) const
{
	if (TWeakObjectPtr<AActor> const* P = ActorMap.Find(Id))
		return P->Get();
	return nullptr;
}
