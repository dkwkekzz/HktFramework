// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationSubsystem.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktRuntimeTypes.h"
#include "Renderers/HktActorRenderer.h"
#include "Renderers/HktMassEntityRenderer.h"
#include "Renderers/HktVFXRenderer.h"
#if ENABLE_HKT_INSIGHTS
#include "Renderers/HktCollisionDebugRenderer.h"
#include "Renderers/HktTerrainDebugRenderer.h"
#endif
#include "NativeGameplayTags.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "HktRuntimeTags.h"
#include "HktAssetSubsystem.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"


UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_MoveIndicator, "VFX.Niagara.MoveIndicator");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_SelectionSubject, "VFX.Niagara.SelectionSubject");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_SelectionTarget, "VFX.Niagara.SelectionTarget");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_Prefix, "VFX");

UHktPresentationSubsystem* UHktPresentationSubsystem::Get(APlayerController* PC)
{
	if (PC && PC->GetLocalPlayer())
	{
		return PC->GetLocalPlayer()->GetSubsystem<UHktPresentationSubsystem>();
	}
	return nullptr;
}

bool UHktPresentationSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	return true;
}

void UHktPresentationSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	ActorRenderer = MakeShared<FHktActorRenderer>(GetLocalPlayer());
	MassEntityRenderer = MakeShared<FHktMassEntityRenderer>(GetLocalPlayer());
	VFXRenderer = MakeShared<FHktVFXRenderer>(GetLocalPlayer());

	// 내부 렌더러를 Sync 루프에 등록
	Renderers.Add(ActorRenderer.Get());
	Renderers.Add(MassEntityRenderer.Get());
	Renderers.Add(VFXRenderer.Get());

#if ENABLE_HKT_INSIGHTS
	CollisionDebugRenderer = MakeShared<FHktCollisionDebugRenderer>(GetLocalPlayer());
	Renderers.Add(CollisionDebugRenderer.Get());

	TerrainDebugRenderer = MakeShared<FHktTerrainDebugRenderer>(GetLocalPlayer());
	Renderers.Add(TerrainDebugRenderer.Get());
#endif
}

void UHktPresentationSubsystem::Deinitialize()
{
	UnbindInteraction();

	for (IHktPresentationRenderer* R : Renderers)
	{
		if (R) R->Teardown();
	}
	Renderers.Empty();

#if ENABLE_HKT_INSIGHTS
	TerrainDebugRenderer.Reset();
	CollisionDebugRenderer.Reset();
#endif
	VFXRenderer.Reset();
	MassEntityRenderer.Reset();
	ActorRenderer.Reset();
	State.Clear();

	Super::Deinitialize();
}

void UHktPresentationSubsystem::PlayerControllerChanged(APlayerController* NewPlayerController)
{
	Super::PlayerControllerChanged(NewPlayerController);
	
	if (NewPlayerController)
	{
		IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(NewPlayerController);
		if (Interaction)
		{
			BindInteraction(Interaction);
		}
	}
	else
	{
		UnbindInteraction();
	}
}

void UHktPresentationSubsystem::BindInteraction(IHktPlayerInteractionInterface* InInteraction)
{
	UnbindInteraction();
	BoundInteraction = InInteraction;
	if (BoundInteraction)
	{
		WorldViewHandle = BoundInteraction->OnWorldViewUpdated().AddUObject(
			this, &UHktPresentationSubsystem::OnWorldViewUpdated);
		IntentSubmittedHandle = BoundInteraction->OnIntentSubmitted().AddUObject(
			this, &UHktPresentationSubsystem::OnIntentSubmitted);
		SubjectChangedHandle = BoundInteraction->OnSubjectChanged().AddUObject(
			this, &UHktPresentationSubsystem::OnSubjectChanged);
		TargetChangedHandle = BoundInteraction->OnTargetChanged().AddUObject(
			this, &UHktPresentationSubsystem::OnTargetChanged);

		// 렌더러 pending 작업 처리용 틱 등록
		if (!TickHandle.IsValid())
		{
			if (UWorld* World = GetLocalPlayer()->GetWorld())
			{
				TickHandle = World->OnTickDispatch().AddUObject(
					this, &UHktPresentationSubsystem::OnTick);
			}
		}

	}
}

void UHktPresentationSubsystem::UnbindInteraction()
{
	if (BoundInteraction)
	{
		if (WorldViewHandle.IsValid())
		{
			BoundInteraction->OnWorldViewUpdated().Remove(WorldViewHandle);
			WorldViewHandle.Reset();
		}
		if (IntentSubmittedHandle.IsValid())
		{
			BoundInteraction->OnIntentSubmitted().Remove(IntentSubmittedHandle);
			IntentSubmittedHandle.Reset();
		}
		if (SubjectChangedHandle.IsValid())
		{
			BoundInteraction->OnSubjectChanged().Remove(SubjectChangedHandle);
			SubjectChangedHandle.Reset();
		}
		if (TargetChangedHandle.IsValid())
		{
			BoundInteraction->OnTargetChanged().Remove(TargetChangedHandle);
			TargetChangedHandle.Reset();
		}
	}
	if (TickHandle.IsValid())
	{
		if (ULocalPlayer* LP = GetLocalPlayer())
		{
			if (UWorld* World = LP->GetWorld())
			{
				World->OnTickDispatch().Remove(TickHandle);
			}
		}
		TickHandle.Reset();
	}
	BoundInteraction = nullptr;
}

void UHktPresentationSubsystem::OnWorldViewUpdated(const FHktWorldView& View)
{
	if (!View.WorldState) return;

	if (View.bIsInitialSync || !bInitialSyncDone)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("InitialSync Frame=%lld Entities=%d"),
				View.FrameNumber, View.WorldState->GetEntityCount()));
		ProcessInitialSync(View);
		bInitialSyncDone = true;
		bStateDirty = true;
	}
	else if (View.SpawnedEntities || View.RemovedEntities || View.PropertyDeltas || View.TagDeltas || View.OwnerDeltas)
	{
		ProcessDiff(View);
		bStateDirty = true;
	}
}

static bool TraceGroundZ(UWorld* World, const FVector& Pos, float& OutZ)
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

void UHktPresentationSubsystem::ProcessInitialSync(const FHktWorldView& View)
{
	State.Clear();
	State.BeginFrame(View.FrameNumber);
	View.ForEachEntity([this, &View](FHktEntityId Id, int32)
	{
		State.AddEntity(*View.WorldState, Id);
	});
	ResolveAssetPathsForSpawned();
	ComputeRenderLocations();
	SpawnActorsForNewEntities();
}

void UHktPresentationSubsystem::ProcessDiff(const FHktWorldView& View)
{
	State.BeginFrame(View.FrameNumber);

	// --- Remove: State 갱신 + Actor 즉시 파괴 ---
	int32 RemovedCount = 0;
	View.ForEachRemoved([this, &RemovedCount](FHktEntityId Id)
	{
		State.RemoveEntity(Id);
		if (ActorRenderer) ActorRenderer->DestroyActor(Id);
		++RemovedCount;
	});

	// --- Spawn: State 갱신 ---
	int32 SpawnedCount = 0;
	View.ForEachSpawned([this, &View, &SpawnedCount](const FHktEntityState& ES)
	{
		State.AddEntity(*View.WorldState, ES.EntityId);
		++SpawnedCount;
	});

	if (SpawnedCount > 0 || RemovedCount > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ProcessDiff Frame=%lld Spawned=%d Removed=%d"), View.FrameNumber, SpawnedCount, RemovedCount));
	}
	ResolveAssetPathsForSpawned();

	View.ForEachDelta([this](FHktEntityId Id, uint16 PropId, int32 NewValue)
	{
		State.ApplyDelta(Id, PropId, NewValue);
	});
	View.ForEachOwnerDelta([this](FHktEntityId Id, int64 NewOwnerUid)
	{
		State.ApplyOwnerDelta(Id, NewOwnerUid);
	});

	// 태그 델타 처리
	View.ForEachTagDelta([this, &View](FHktEntityId Id, const FGameplayTagContainer& Tags, const FGameplayTagContainer& OldTags)
	{
		// Entity presentation에 태그 동기화 (AnimInstance 태그 기반 애니메이션용)
		State.ApplyTagDelta(Id, Tags);

		// VFX 태그 감지: 엔터티에 부착된 지속형 VFX 생명주기 관리
		FGameplayTagContainer CurrentVFX = Tags.Filter(FGameplayTagContainer(Tag_VFX_Prefix));
		FGameplayTagContainer OldVFX = OldTags.Filter(FGameplayTagContainer(Tag_VFX_Prefix));

		// 새로 추가된 VFX 태그 → AttachVFXToEntity (엔터티 추적 + 사망 시 자동 정리)
		for (const FGameplayTag& Tag : CurrentVFX)
		{
			if (!OldVFX.HasTag(Tag) && VFXRenderer && View.WorldState)
			{
				FIntVector IntPos = View.WorldState->GetPosition(Id);
				FVector Pos(IntPos.X, IntPos.Y, IntPos.Z);
				VFXRenderer->AttachVFXToEntity(Tag, Id, Pos);
			}
		}

		// 제거된 VFX 태그 → DetachVFXFromEntity
		for (const FGameplayTag& Tag : OldVFX)
		{
			if (!CurrentVFX.HasTag(Tag) && VFXRenderer)
			{
				VFXRenderer->DetachVFXFromEntity(Tag, Id);
			}
		}
	});

	// Op_PlayVFX / Op_PlayVFXAttached 이벤트 처리: 일회성 VFX (자동 파괴)
	View.ForEachVFXEvent([this](const FHktVFXEvent& Event)
	{
		if (VFXRenderer)
		{
			FVector Pos(Event.Position.X, Event.Position.Y, Event.Position.Z);
			VFXRenderer->PlayVFXAtLocation(Event.Tag, Pos);
		}
	});

	// Op_PlayAnim 이벤트 처리: 엔터티 PresentationState에 트리거 적재 → ActorRenderer가 소비
	View.ForEachAnimEvent([this](const FHktAnimEvent& Event)
	{
		FHktEntityPresentation* E = State.GetMutable(Event.EntityId);
		if (E)
		{
			E->PendingAnimTriggers.Add(Event.Tag);
			// DirtyThisFrame에 추가하여 ActorRenderer::Sync에서 ForwardToActor 호출 보장
			State.DirtyThisFrame.AddUnique(Event.EntityId);
		}
	});

	ComputeRenderLocations();

	// --- Actor 스폰: RenderLocation 계산 후 직접 호출 (VFX와 동일한 패턴) ---
	SpawnActorsForNewEntities();
}

void UHktPresentationSubsystem::OnTick(float DeltaSeconds)
{
	if (!bInitialSyncDone) return;

	if (bStateDirty)
	{
		bStateDirty = false;
		SyncRenderers();
	}
	else
	{
		for (IHktPresentationRenderer* R : Renderers)
		{
			if (R && R->NeedsTick())
			{
				R->Sync(State);
			}
		}
	}

	// 렌더러가 소비한 후 프레임 변경 데이터 정리.
	// BeginFrame에서 초기화하면 다음 OnTick 전에 ProcessDiff가 여러 번 호출될 때 데이터 유실.
	State.ClearFrameChanges();
}

void UHktPresentationSubsystem::NotifyCameraViewChanged()
{
	if (!bInitialSyncDone) return;

	for (IHktPresentationRenderer* R : Renderers)
	{
		if (R && R->NeedsCameraSync())
		{
			R->OnCameraViewChanged(State);
		}
	}
}

void UHktPresentationSubsystem::ComputeRenderLocations()
{
	UWorld* World = GetLocalPlayer() ? GetLocalPlayer()->GetWorld() : nullptr;
	const int64 Frame = State.GetCurrentFrame();

	auto ComputeForEntity = [World, Frame](FHktEntityPresentation& E)
	{
		if (!E.Location.IsDirty(Frame) && !E.IsSpawnedAt(Frame)) return;

		FVector Loc = E.Location.Get();

		// 시뮬레이션의 Z를 그대로 사용 (MovementSystem/PhysicsSystem이 지형 스냅 담당)
		// 시뮬레이션에 지형이 없는 경우에만 UE5 ground trace로 폴백
		if (Loc.Z == 0.0f)
		{
			float GroundZ;
			if (World && TraceGroundZ(World, Loc, GroundZ))
			{
				Loc.Z = GroundZ;
			}
		}
		Loc.Z += E.CapsuleHalfHeight;
		E.RenderLocation.Set(Loc, Frame);
	};

	// 신규 스폰 엔티티
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		if (FHktEntityPresentation* E = State.GetMutable(Id))
			ComputeForEntity(*E);
	}

	// 위치 변경된 엔티티
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (FHktEntityPresentation* E = State.GetMutable(Id))
			ComputeForEntity(*E);
	}
}

void UHktPresentationSubsystem::ResolveAssetPathsForSpawned()
{
	UWorld* World = GetLocalPlayer() ? GetLocalPlayer()->GetWorld() : nullptr;
	UHktAssetSubsystem* AssetSubsystem = World ? UHktAssetSubsystem::Get(World) : nullptr;
	if (!AssetSubsystem) return;

	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		FHktEntityPresentation* E = State.GetMutable(Id);
		if (!E) continue;
		FGameplayTag VisualTag = E->VisualElement.Get();
		if (!VisualTag.IsValid()) continue;

		// 비동기 로드 → 완료 시 ViewModel에 ResolvedAssetPath + CapsuleHalfHeight 설정
		TWeakObjectPtr<UHktPresentationSubsystem> WeakThis(this);
		AssetSubsystem->LoadAssetAsync(VisualTag, [WeakThis, this, Id](UHktTagDataAsset* Asset)
		{
			if (!Asset || !WeakThis.IsValid()) return;
			FHktEntityPresentation* E = State.GetMutable(Id);
			if (!E || !E->IsAlive()) return;
			E->ResolvedAssetPath.Set(FSoftObjectPath(Asset), State.GetCurrentFrame());

			// ActorVisualDataAsset인 경우 CDO에서 캡슐 반높이 추출
			if (UHktActorVisualDataAsset* VisualAsset = Cast<UHktActorVisualDataAsset>(Asset))
			{
				if (VisualAsset->ActorClass)
				{
					if (AActor* CDO = VisualAsset->ActorClass->GetDefaultObject<AActor>())
					{
						if (UCapsuleComponent* Capsule = CDO->FindComponentByClass<UCapsuleComponent>())
						{
							E->CapsuleHalfHeight = Capsule->GetScaledCapsuleHalfHeight();
						}
					}
				}
			}

			// CapsuleHalfHeight 변경 후 RenderLocation 재계산
			UWorld* World = GetLocalPlayer() ? GetLocalPlayer()->GetWorld() : nullptr;
			FVector Loc = E->Location.Get();
			float GroundZ;
			if (World && TraceGroundZ(World, Loc, GroundZ))
			{
				Loc.Z = GroundZ;
			}
			Loc.Z += E->CapsuleHalfHeight;
			E->RenderLocation.Set(Loc, State.GetCurrentFrame());
		});
	}
}

void UHktPresentationSubsystem::SpawnActorsForNewEntities()
{
	if (!ActorRenderer) return;
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (!E || E->RenderCategory != EHktRenderCategory::Actor) continue;
		if (ActorRenderer->HasActorOrPending(Id)) continue;
		ActorRenderer->SpawnActor(*E);
	}
}

void UHktPresentationSubsystem::SyncRenderers()
{
	for (IHktPresentationRenderer* R : Renderers)
	{
		if (R) R->Sync(State);
	}
}

FVector UHktPresentationSubsystem::GetEntityLocation(FHktEntityId Id) const
{
	const FHktEntityPresentation* E = State.Get(Id);
	if (!E) return FVector::ZeroVector;
	// RenderLocation이 설정되어 있으면 (지면+캡슐 오프셋 적용) 사용, 아니면 raw Location
	return E->RenderLocation.Get().IsZero() ? E->Location.Get() : E->RenderLocation.Get();
}

FVector UHktPresentationSubsystem::GetEntityActorLocation(FHktEntityId Id) const
{
	if (ActorRenderer)
	{
		AActor* Actor = ActorRenderer->GetActor(Id);
		if (Actor)
		{
			return Actor->GetActorLocation();
		}
	}
	return GetEntityLocation(Id);
}

void UHktPresentationSubsystem::RegisterRenderer(IHktPresentationRenderer* InRenderer)
{
	if (!InRenderer || Renderers.Contains(InRenderer)) return;

	Renderers.Add(InRenderer);

	// 이미 InitialSync가 완료된 경우 즉시 OnRegistered 호출하여 기존 엔티티 전달
	if (bInitialSyncDone)
	{
		InRenderer->OnRegistered(State);
	}
}

void UHktPresentationSubsystem::UnregisterRenderer(IHktPresentationRenderer* InRenderer)
{
	Renderers.Remove(InRenderer);
}

void UHktPresentationSubsystem::OnIntentSubmitted(const FHktRuntimeEvent& Event)
{
	const FHktEvent& CoreEvent = Event.Value;

	// MoveTo intent → 목표 위치에 이동 인디케이터 VFX 재생
	PlayVFXAtLocation(Tag_VFX_MoveIndicator, CoreEvent.Location);
}

void UHktPresentationSubsystem::PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location)
{
	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXAtLocation Tag=%s Location=(%.1f, %.1f, %.1f)"), *VFXTag.ToString(), Location.X, Location.Y, Location.Z));

	if (VFXRenderer)
	{
		VFXRenderer->PlayVFXAtLocation(VFXTag, Location);
	}
}

void UHktPresentationSubsystem::PlayVFXWithIntent(const FHktVFXIntent& Intent)
{
	if (VFXRenderer)
	{
		VFXRenderer->PlayVFXWithIntent(Intent);
	}
}

void UHktPresentationSubsystem::OnSubjectChanged(FHktEntityId NewSubject)
{
	if (!VFXRenderer) return;

	// 이전 Subject VFX 제거
	if (CurrentSubjectEntityId != InvalidEntityId)
	{
		VFXRenderer->DetachVFXFromEntity(Tag_VFX_SelectionSubject, CurrentSubjectEntityId);
	}

	CurrentSubjectEntityId = NewSubject;

	// 새 Subject VFX 부착
	if (NewSubject != InvalidEntityId)
	{
		const FHktEntityPresentation* Entity = State.Get(NewSubject);
		FVector Pos = Entity ? Entity->Location.Get() : FVector::ZeroVector;
		VFXRenderer->AttachVFXToEntity(Tag_VFX_SelectionSubject, NewSubject, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionSubject VFX attached Entity=%d"), NewSubject));
	}
}

void UHktPresentationSubsystem::OnTargetChanged(FHktEntityId NewTarget)
{
	if (!VFXRenderer) return;

	// 이전 Target VFX 제거
	if (CurrentTargetEntityId != InvalidEntityId)
	{
		VFXRenderer->DetachVFXFromEntity(Tag_VFX_SelectionTarget, CurrentTargetEntityId);
	}

	CurrentTargetEntityId = NewTarget;

	// 새 Target VFX 부착
	if (NewTarget != InvalidEntityId)
	{
		const FHktEntityPresentation* Entity = State.Get(NewTarget);
		FVector Pos = Entity ? Entity->Location.Get() : FVector::ZeroVector;
		VFXRenderer->AttachVFXToEntity(Tag_VFX_SelectionTarget, NewTarget, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionTarget VFX attached Entity=%d"), NewTarget));
	}
}
