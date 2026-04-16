// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationSubsystem.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktRuntimeTypes.h"
#include "HktProjectionPipeline.h"
#include "HktEffectExecutor.h"
#include "Projections/HktLifecycleProjection.h"
#include "Projections/HktSpawnProjection.h"
#include "Projections/HktPropertyProjection.h"
#include "Projections/HktTagProjection.h"
#include "Projections/HktOwnerProjection.h"
#include "Projections/HktAnimEventProjection.h"
#include "Projections/HktVFXProjection.h"
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

	// --- Projection 파이프라인 + Effect 실행기 초기화 ---
	// 등록 순서 = 실행 순서 (의존성 반영)
	Pipeline = MakeUnique<FHktProjectionPipeline>();
	Pipeline->Register(MakeUnique<FHktLifecycleProjection>());   // ViewModel 생성/삭제 (최선두)
	Pipeline->Register(MakeUnique<FHktSpawnProjection>());       // 에셋 해석 + Actor 스폰 effect
	Pipeline->Register(MakeUnique<FHktPropertyProjection>());    // PropertyDelta → ViewModel 갱신
	Pipeline->Register(MakeUnique<FHktTagProjection>());         // 태그 동기화 + VFX 생명주기
	Pipeline->Register(MakeUnique<FHktOwnerProjection>());       // 소유권 동기화
	Pipeline->Register(MakeUnique<FHktAnimEventProjection>());   // 일회성 애니메이션 이벤트
	Pipeline->Register(MakeUnique<FHktVFXProjection>());         // 일회성 VFX 이벤트

	Executor = MakeUnique<FHktEffectExecutor>(
		GetLocalPlayer(), ActorRenderer.Get(), VFXRenderer.Get());
}

void UHktPresentationSubsystem::Deinitialize()
{
	UnbindInteraction();

	for (IHktPresentationRenderer* R : Renderers)
	{
		if (R) R->Teardown();
	}
	Renderers.Empty();

	Executor.Reset();
	Pipeline.Reset();

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
	if (!View.WorldState || !Pipeline || !Executor) return;

	const FHktEffectsPlan* Plan = nullptr;

	if (View.bIsInitialSync || !bInitialSyncDone)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("InitialSync Frame=%lld Entities=%d"),
				View.FrameNumber, View.WorldState->GetEntityCount()));

		Plan = &Pipeline->ProcessInitialSync(*View.WorldState, View.FrameNumber, State);
		bInitialSyncDone = true;
	}
	else if (View.SpawnedEntities || View.RemovedEntities || View.PropertyDeltas
		|| View.TagDeltas || View.OwnerDeltas || View.VFXEvents || View.AnimEvents)
	{
		Plan = &Pipeline->ProcessFrame(View, State);
	}

	if (Plan && Plan->Num() > 0)
	{
		Executor->Execute(*Plan, State);
	}

	bStateDirty = true;
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
