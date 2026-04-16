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
#include "Jobs/HktEntitySpawnJob.h"
#include "Jobs/HktPropertyDeltaJob.h"
#include "Jobs/HktTagDeltaJob.h"
#include "Jobs/HktVFXPlayJob.h"
#include "Jobs/HktAnimEventJob.h"
#include "NativeGameplayTags.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "HktRuntimeTags.h"
// HktAssetSubsystem, DataAssets — 비동기 에셋 해석은 FHktEntitySpawnJob으로 이동
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"


UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_MoveIndicator, "VFX.Niagara.MoveIndicator");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_SelectionSubject, "VFX.Niagara.SelectionSubject");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_VFX_SelectionTarget, "VFX.Niagara.SelectionTarget");

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
	JobQueue.Flush();

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

void UHktPresentationSubsystem::ProcessInitialSync(const FHktWorldView& View)
{
	JobQueue.Flush();
	State.Clear();
	State.BeginFrame(View.FrameNumber);
	View.ForEachEntity([this, &View](FHktEntityId Id, int32)
	{
		State.AddEntity(*View.WorldState, Id);
		// 비동기 에셋 해석 + RenderLocation 계산을 SpawnJob에 위임
		FHktEntityPresentation* E = State.GetMutable(Id);
		if (E && E->VisualElement.Get().IsValid())
		{
			JobQueue.AddJob(MakeShared<FHktEntitySpawnJob>(Id, E->VisualElement.Get(), GetLocalPlayer()));
		}
	});
	// RenderLocation 계산은 SpawnJob::Execute에서 수행
	// Actor 스폰은 ActorRenderer::Sync에서 ResolvedAssetPath 기반으로 처리
}

void UHktPresentationSubsystem::ProcessDiff(const FHktWorldView& View)
{
	State.BeginFrame(View.FrameNumber);

	// --- Remove: State 갱신 + 관련 Job 취소 (Actor 파괴는 Sync에서 처리) ---
	int32 RemovedCount = 0;
	View.ForEachRemoved([this, &RemovedCount](FHktEntityId Id)
	{
		JobQueue.CancelJobsForEntity(Id);
		State.RemoveEntity(Id);
		++RemovedCount;
	});

	// --- Spawn: State 즉시 갱신 + SpawnJob 생성 (비동기 에셋 해석) ---
	int32 SpawnedCount = 0;
	View.ForEachSpawned([this, &View, &SpawnedCount](const FHktEntityState& ES)
	{
		State.AddEntity(*View.WorldState, ES.EntityId);
		// 비동기 에셋 해석 + RenderLocation 계산을 SpawnJob에 위임
		FHktEntityPresentation* E = State.GetMutable(ES.EntityId);
		if (E && E->VisualElement.Get().IsValid())
		{
			JobQueue.AddJob(MakeShared<FHktEntitySpawnJob>(ES.EntityId, E->VisualElement.Get(), GetLocalPlayer()));
		}
		++SpawnedCount;
	});

	if (SpawnedCount > 0 || RemovedCount > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ProcessDiff Frame=%lld Spawned=%d Removed=%d"), View.FrameNumber, SpawnedCount, RemovedCount));
	}

	// --- Property 델타 배치 Job ---
	if (View.PropertyDeltas && View.PropertyDeltas->Num() > 0)
	{
		JobQueue.AddJob(MakeShared<FHktPropertyDeltaJob>(*View.PropertyDeltas));
	}

	// --- Owner 델타 배치 Job ---
	if (View.OwnerDeltas && View.OwnerDeltas->Num() > 0)
	{
		JobQueue.AddJob(MakeShared<FHktOwnerDeltaJob>(*View.OwnerDeltas));
	}

	// --- Tag 델타 Job (엔티티별 — VFX attach/detach 로직 때문) ---
	View.ForEachTagDelta([this, &View](FHktEntityId Id, const FGameplayTagContainer& Tags, const FGameplayTagContainer& OldTags)
	{
		FVector EntityPos = FVector::ZeroVector;
		if (View.WorldState)
		{
			FIntVector IntPos = View.WorldState->GetPosition(Id);
			EntityPos = FVector(IntPos.X, IntPos.Y, IntPos.Z);
		}
		JobQueue.AddJob(MakeShared<FHktTagDeltaJob>(Id, Tags, OldTags, EntityPos));
	});

	// --- VFX 이벤트 Job (일회성) ---
	View.ForEachVFXEvent([this](const FHktVFXEvent& Event)
	{
		JobQueue.AddJob(MakeShared<FHktVFXPlayJob>(Event));
	});

	// --- Anim 이벤트 Job ---
	View.ForEachAnimEvent([this](const FHktAnimEvent& Event)
	{
		JobQueue.AddJob(MakeShared<FHktAnimEventJob>(Event));
	});

}

void UHktPresentationSubsystem::OnTick(float DeltaSeconds)
{
	if (!bInitialSyncDone) return;

	// Phase 2: 비동기 작업 진행 (Pending/Preparing Job의 TickJob 호출)
	JobQueue.TickJobs(DeltaSeconds);

	// Phase 3: Ready Job 실행 → State 변경
	bool bJobsExecuted = JobQueue.ExecuteReadyJobs(State);

	if (bStateDirty || bJobsExecuted)
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
