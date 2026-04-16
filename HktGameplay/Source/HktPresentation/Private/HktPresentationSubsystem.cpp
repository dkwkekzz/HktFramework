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

	ActorProcessor = MakeShared<FHktActorProcessor>(GetLocalPlayer());
	MassEntityProcessor = MakeShared<FHktMassEntityProcessor>(GetLocalPlayer());
	VFXProcessor = MakeShared<FHktVFXProcessor>(GetLocalPlayer());

	Processors.Add(ActorProcessor.Get());
	Processors.Add(MassEntityProcessor.Get());
	Processors.Add(VFXProcessor.Get());

#if ENABLE_HKT_INSIGHTS
	CollisionDebugProcessor = MakeShared<FHktCollisionDebugProcessor>(GetLocalPlayer());
	Processors.Add(CollisionDebugProcessor.Get());

	TerrainDebugProcessor = MakeShared<FHktTerrainDebugProcessor>(GetLocalPlayer());
	Processors.Add(TerrainDebugProcessor.Get());
#endif
}

void UHktPresentationSubsystem::Deinitialize()
{
	UnbindInteraction();

	for (IHktPresentationProcessor* P : Processors)
	{
		if (P) P->Teardown();
	}
	Processors.Empty();

#if ENABLE_HKT_INSIGHTS
	TerrainDebugProcessor.Reset();
	CollisionDebugProcessor.Reset();
#endif
	VFXProcessor.Reset();
	MassEntityProcessor.Reset();
	ActorProcessor.Reset();
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

void UHktPresentationSubsystem::ProcessInitialSync(const FHktWorldView& View)
{
	State.Clear();
	State.BeginFrame(View.FrameNumber);
	View.ForEachEntity([this, &View](FHktEntityId Id, int32)
	{
		State.AddEntity(*View.WorldState, Id);
		FHktEntityPresentation* E = State.GetMutable(Id);
		if (E && E->VisualElement.Get().IsValid())
		{
			State.PendingSpawns.Add({ Id, E->VisualElement.Get() });
		}
	});
}

void UHktPresentationSubsystem::ProcessDiff(const FHktWorldView& View)
{
	State.BeginFrame(View.FrameNumber);

	// --- Remove: State 갱신 (Actor 파괴는 Processor::Sync에서 처리) ---
	int32 RemovedCount = 0;
	View.ForEachRemoved([this, &RemovedCount](FHktEntityId Id)
	{
		State.RemoveEntity(Id);
		++RemovedCount;
	});

	// --- Spawn: State 즉시 갱신 + PendingSpawns에 비동기 에셋 해석 요청 적재 ---
	int32 SpawnedCount = 0;
	View.ForEachSpawned([this, &View, &SpawnedCount](const FHktEntityState& ES)
	{
		State.AddEntity(*View.WorldState, ES.EntityId);
		FHktEntityPresentation* E = State.GetMutable(ES.EntityId);
		if (E && E->VisualElement.Get().IsValid())
		{
			State.PendingSpawns.Add({ ES.EntityId, E->VisualElement.Get() });
		}
		++SpawnedCount;
	});

	if (SpawnedCount > 0 || RemovedCount > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ProcessDiff Frame=%lld Spawned=%d Removed=%d"), View.FrameNumber, SpawnedCount, RemovedCount));
	}

	// --- Property 델타 인라인 적용 ---
	View.ForEachDelta([this](FHktEntityId Id, uint16 PropId, int32 NewValue)
	{
		State.ApplyDelta(Id, PropId, NewValue);
	});

	// --- Owner 델타 인라인 적용 ---
	View.ForEachOwnerDelta([this](FHktEntityId Id, int64 NewOwnerUid)
	{
		State.ApplyOwnerDelta(Id, NewOwnerUid);
	});

	// --- Tag 델타 인라인 적용 + VFX attach/detach 감지 ---
	View.ForEachTagDelta([this, &View](FHktEntityId Id, const FGameplayTagContainer& Tags, const FGameplayTagContainer& OldTags)
	{
		State.ApplyTagDelta(Id, Tags);

		// VFX 태그 변경 감지
		FGameplayTagContainer VFXFilter;
		VFXFilter.AddTag(Tag_VFX_Prefix);
		FGameplayTagContainer CurrentVFX = Tags.Filter(VFXFilter);
		FGameplayTagContainer OldVFX = OldTags.Filter(VFXFilter);

		FVector EntityPos = FVector::ZeroVector;
		if (View.WorldState)
		{
			FIntVector IntPos = View.WorldState->GetPosition(Id);
			EntityPos = FVector(IntPos.X, IntPos.Y, IntPos.Z);
		}

		for (const FGameplayTag& Tag : CurrentVFX)
		{
			if (!OldVFX.HasTag(Tag))
				State.PendingVFXAttachments.Add({ Tag, Id, EntityPos });
		}
		for (const FGameplayTag& Tag : OldVFX)
		{
			if (!CurrentVFX.HasTag(Tag))
				State.PendingVFXDetachments.Add({ Tag, Id });
		}
	});

	// --- VFX 이벤트 → State 적재 ---
	View.ForEachVFXEvent([this](const FHktVFXEvent& Event)
	{
		FVector Pos(Event.Position.X, Event.Position.Y, Event.Position.Z);
		State.PendingVFXEvents.Add({ Event.Tag, Pos });
	});

	// --- Anim 이벤트 인라인 적용 ---
	View.ForEachAnimEvent([this](const FHktAnimEvent& Event)
	{
		FHktEntityPresentation* E = State.GetMutable(Event.EntityId);
		if (E)
		{
			E->PendingAnimTriggers.Add(Event.Tag);
			State.DirtyThisFrame.AddUnique(Event.EntityId);
		}
	});
}

void UHktPresentationSubsystem::OnTick(float DeltaSeconds)
{
	if (!bInitialSyncDone) return;

	// Phase 1: Processor Tick — 비동기 작업 진행 (에셋 로드 등), State 변경 가능
	for (IHktPresentationProcessor* P : Processors)
	{
		if (P) P->Tick(State, DeltaSeconds);
	}

	// Phase 2: Processor Sync — State 읽어서 렌더링
	if (bStateDirty)
	{
		bStateDirty = false;
		SyncProcessors();
	}
	else
	{
		for (IHktPresentationProcessor* P : Processors)
		{
			if (P && P->NeedsTick())
			{
				P->Sync(State);
			}
		}
	}

	// Processor가 소비한 후 프레임 변경 데이터 정리
	State.ClearFrameChanges();
}

void UHktPresentationSubsystem::NotifyCameraViewChanged()
{
	if (!bInitialSyncDone) return;

	for (IHktPresentationProcessor* P : Processors)
	{
		if (P && P->NeedsCameraSync())
		{
			P->OnCameraViewChanged(State);
		}
	}
}

void UHktPresentationSubsystem::SyncProcessors()
{
	for (IHktPresentationProcessor* P : Processors)
	{
		if (P) P->Sync(State);
	}
}

FVector UHktPresentationSubsystem::GetEntityLocation(FHktEntityId Id) const
{
	const FHktEntityPresentation* E = State.Get(Id);
	if (!E) return FVector::ZeroVector;
	return E->RenderLocation.Get().IsZero() ? E->Location.Get() : E->RenderLocation.Get();
}

FVector UHktPresentationSubsystem::GetEntityActorLocation(FHktEntityId Id) const
{
	if (ActorProcessor)
	{
		AActor* Actor = ActorProcessor->GetActor(Id);
		if (Actor)
		{
			return Actor->GetActorLocation();
		}
	}
	return GetEntityLocation(Id);
}

void UHktPresentationSubsystem::RegisterRenderer(IHktPresentationProcessor* InProcessor)
{
	if (!InProcessor || Processors.Contains(InProcessor)) return;

	Processors.Add(InProcessor);

	if (bInitialSyncDone)
	{
		InProcessor->OnRegistered(State);
	}
}

void UHktPresentationSubsystem::UnregisterRenderer(IHktPresentationProcessor* InProcessor)
{
	Processors.Remove(InProcessor);
}

void UHktPresentationSubsystem::OnIntentSubmitted(const FHktRuntimeEvent& Event)
{
	const FHktEvent& CoreEvent = Event.Value;
	PlayVFXAtLocation(Tag_VFX_MoveIndicator, CoreEvent.Location);
}

void UHktPresentationSubsystem::PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location)
{
	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXAtLocation Tag=%s Location=(%.1f, %.1f, %.1f)"), *VFXTag.ToString(), Location.X, Location.Y, Location.Z));

	if (VFXProcessor)
	{
		VFXProcessor->PlayVFXAtLocation(VFXTag, Location);
	}
}

void UHktPresentationSubsystem::PlayVFXWithIntent(const FHktVFXIntent& Intent)
{
	if (VFXProcessor)
	{
		VFXProcessor->PlayVFXWithIntent(Intent);
	}
}

void UHktPresentationSubsystem::OnSubjectChanged(FHktEntityId NewSubject)
{
	if (!VFXProcessor) return;

	if (CurrentSubjectEntityId != InvalidEntityId)
	{
		VFXProcessor->DetachVFXFromEntity(Tag_VFX_SelectionSubject, CurrentSubjectEntityId);
	}

	CurrentSubjectEntityId = NewSubject;

	if (NewSubject != InvalidEntityId)
	{
		const FHktEntityPresentation* Entity = State.Get(NewSubject);
		FVector Pos = Entity ? Entity->Location.Get() : FVector::ZeroVector;
		VFXProcessor->AttachVFXToEntity(Tag_VFX_SelectionSubject, NewSubject, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionSubject VFX attached Entity=%d"), NewSubject));
	}
}

void UHktPresentationSubsystem::OnTargetChanged(FHktEntityId NewTarget)
{
	if (!VFXProcessor) return;

	if (CurrentTargetEntityId != InvalidEntityId)
	{
		VFXProcessor->DetachVFXFromEntity(Tag_VFX_SelectionTarget, CurrentTargetEntityId);
	}

	CurrentTargetEntityId = NewTarget;

	if (NewTarget != InvalidEntityId)
	{
		const FHktEntityPresentation* Entity = State.Get(NewTarget);
		FVector Pos = Entity ? Entity->Location.Get() : FVector::ZeroVector;
		VFXProcessor->AttachVFXToEntity(Tag_VFX_SelectionTarget, NewTarget, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionTarget VFX attached Entity=%d"), NewTarget));
	}
}
