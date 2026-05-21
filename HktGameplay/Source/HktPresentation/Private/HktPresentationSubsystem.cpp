// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationSubsystem.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktRuntimeTypes.h"
#include "HktAssetSubsystem.h"
#include "Actors/IHktPresentableActor.h"
#include "Processors/HktActorProcessor.h"
#include "Processors/HktMassEntityProcessor.h"
#include "Processors/HktVFXProcessor.h"
#if ENABLE_HKT_INSIGHTS
#include "Processors/HktCollisionDebugProcessor.h"
#include "Processors/HktTerrainDebugProcessor.h"
#include "Processors/HktHitboxDebugProcessor.h"
#endif
#include "NativeGameplayTags.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "HktCoreDataCollector.h"
#include "HktCoreProperties.h"
#include "HktRuntimeTags.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "HAL/IConsoleManager.h"


// hkt.selection.debug.draw 0|1 — Subject/Target/Voxel 선택 상태 디버그 드로우 토글.
// 기본 ON: 시각화 1단계가 DebugDraw 자체이므로 토글로 끄지 않는 한 항상 표시.
static TAutoConsoleVariable<int32> CVarSelectionDebugDraw(
	TEXT("hkt.selection.debug.draw"),
	1,
	TEXT("Draw Subject/Target/Voxel selection markers via DrawDebug (0=off, 1=on)."),
	ECVF_Default);

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

	HitboxDebugProcessor = MakeShared<FHktHitboxDebugProcessor>(GetLocalPlayer());
	Processors.Add(HitboxDebugProcessor.Get());
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
	HitboxDebugProcessor.Reset();
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

	UWorld* World = GetLocalPlayer() ? GetLocalPlayer()->GetWorld() : nullptr;
	const UHktAssetSubsystem* AssetSub = World ? UHktAssetSubsystem::Get(World) : nullptr;

	View.ForEachEntity([this, &View, AssetSub](FHktEntityId Id, int32)
	{
		State.AddEntity(*View.WorldState, Id, AssetSub);
		const FHktVisualizationView* V = State.GetVisualization(Id);
		if (V && V->VisualElement.Get().IsValid())
		{
			State.PendingSpawns.Add({ Id, V->VisualElement.Get() });
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
	UWorld* SpawnWorld = GetLocalPlayer() ? GetLocalPlayer()->GetWorld() : nullptr;
	const UHktAssetSubsystem* SpawnAssetSub = SpawnWorld ? UHktAssetSubsystem::Get(SpawnWorld) : nullptr;
	int32 SpawnedCount = 0;
	View.ForEachSpawned([this, &View, &SpawnedCount, SpawnAssetSub](const FHktEntityState& ES)
	{
		State.AddEntity(*View.WorldState, ES.EntityId, SpawnAssetSub);
		const FHktVisualizationView* V = State.GetVisualization(ES.EntityId);
		if (V && V->VisualElement.Get().IsValid())
		{
			State.PendingSpawns.Add({ ES.EntityId, V->VisualElement.Get() });
		}
		++SpawnedCount;
	});

	if (SpawnedCount > 0 || RemovedCount > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ProcessDiff Frame=%lld Spawned=%d Removed=%d"), View.FrameNumber, SpawnedCount, RemovedCount));
	}

	// --- Property 델타 인라인 적용 ---
	// 주의: 아래 Verbose 로그는 "수신" 트레이스 (EventLog 기본 MinLevel=Info 라 수집 안 됨).
	// 실제 적용 실패(엔터티 미존재/뷰 미할당/PropId 미등록/디스패처 부재)는
	// FHktPresentationState::ApplyDelta 내부에서 Warning "DROP PropertyDelta..." 로 출력.
	// 동일 (Entity, Reason, PropId) 조합은 1회만 로그됨 (틱당 중복 차단).
	// Pos/Rot/Vel 등 매 프레임 갱신되는 Transform 계열은 HktLog.Presentation.Transform 으로 분리.
	// 로그 패널은 HasTagExact() 필터라 Presentation 과 독립 토글되며, 색상은 MatchesTag() 계층 매칭으로 Presentation 색을 상속.
	View.ForEachDelta([this, &View](FHktEntityId Id, uint16 PropId, int32 NewValue, int32 OldValue)
	{
		const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
		const FGameplayTag& LogCategory = HktProperty::IsTransformProperty(PropId)
			? HktLogTags::Presentation_Transform
			: HktLogTags::Presentation;
		HKT_EVENT_LOG_ENTITY(LogCategory, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("RECV PropertyDelta Frame=%lld %s: %d -> %d"),
				View.FrameNumber,
				PropName ? PropName : TEXT("Unknown"),
				OldValue, NewValue), Id);
		State.ApplyDelta(Id, PropId, NewValue);
	});

	// --- Owner 델타 인라인 적용 ---
	// (적용 실패는 ApplyOwnerDelta 내부의 "DROP OwnerDelta..." 로그 참조 — 1회 dedup)
	View.ForEachOwnerDelta([this, &View](FHktEntityId Id, int64 NewOwnerUid)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("RECV OwnerDelta Frame=%lld Owner=%lld"), View.FrameNumber, NewOwnerUid), Id);
		State.ApplyOwnerDelta(Id, NewOwnerUid);
	});

	// --- Tag 델타 인라인 적용 + VFX attach/detach 감지 ---
	// (적용 실패는 ApplyTagDelta 내부의 "DROP/SKIP TagDelta..." 로그 참조 — 1회 dedup)
	View.ForEachTagDelta([this, &View](FHktEntityId Id, const FGameplayTagContainer& Tags, const FGameplayTagContainer& OldTags)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("RECV TagDelta Frame=%lld Tags=%s"), View.FrameNumber, *Tags.ToString()), Id);
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
	View.ForEachVFXEvent([this, &View](const FHktVFXEvent& Event)
	{
		FVector Pos(Event.Position.X, Event.Position.Y, Event.Position.Z);
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("VFXEvent Frame=%lld Tag=%s Pos=(%.1f,%.1f,%.1f)"), View.FrameNumber, *Event.Tag.ToString(), Pos.X, Pos.Y, Pos.Z));
		State.PendingVFXEvents.Add({ Event.Tag, Pos });
	});

	// --- Anim 이벤트 인라인 적용 ---
	View.ForEachAnimEvent([this, &View](const FHktAnimEvent& Event)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("AnimEvent Frame=%lld Tag=%s"), View.FrameNumber, *Event.Tag.ToString()), Event.EntityId);
		State.AddAnimTrigger(Event.EntityId, Event.Tag);
	});
}

void UHktPresentationSubsystem::OnTick(float DeltaSeconds)
{
	if (!bInitialSyncDone) return;

	// Phase 1: Processor Tick — 비동기 작업 진행 (에셋 로드 등), State 변경 가능
	const int32 DirtyCountBefore = State.DirtyThisFrame.Num();
	for (IHktPresentationProcessor* P : Processors)
	{
		if (P) P->Tick(State, DeltaSeconds);
	}
	const bool bTickModifiedState = (State.DirtyThisFrame.Num() > DirtyCountBefore);

	// Phase 2: Processor Sync — State 읽어서 렌더링
	// Tick에서 비동기 에셋 로드 완료 등으로 State가 변경되면 전체 Sync 수행
	if (bStateDirty || bTickModifiedState)
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

#if ENABLE_HKT_INSIGHTS
	// 디버그 패널용 publish — ClearFrameChanges 전에 (이번 프레임 더티 정보 활용)
	PublishStateToCollector();
#endif

	// Subject/Target/Voxel 선택 표시 (1단계 시각화 — DebugDraw)
	if (CVarSelectionDebugDraw.GetValueOnGameThread() != 0)
	{
		DrawSelectionDebug();
	}

	// Processor가 소비한 후 프레임 변경 데이터 정리
	State.ClearFrameChanges();
}

#if ENABLE_HKT_INSIGHTS

namespace HktPresentationInsights
{
	static FString VecToString(const FVector& V)
	{
		return FString::Printf(TEXT("(%.1f,%.1f,%.1f)"), V.X, V.Y, V.Z);
	}
	static FString RotToString(const FRotator& R)
	{
		return FString::Printf(TEXT("(%.1f,%.1f,%.1f)"), R.Pitch, R.Yaw, R.Roll);
	}
	static FString ColorToString(const FLinearColor& C)
	{
		return FString::Printf(TEXT("(%.2f,%.2f,%.2f,%.2f)"), C.R, C.G, C.B, C.A);
	}
	static const TCHAR* RenderCategoryToString(EHktRenderCategory C)
	{
		switch (C)
		{
		case EHktRenderCategory::Actor:      return TEXT("Actor");
		case EHktRenderCategory::MassEntity: return TEXT("MassEntity");
		case EHktRenderCategory::FX:         return TEXT("FX");
		case EHktRenderCategory::Debris:     return TEXT("Debris");
		default:                             return TEXT("None");
		}
	}

	/**
	 * THktVisualField 의 (값, 더티여부) 를 PropSummary 에 append 한다.
	 * 더티이면 prefix '*' 로 표시 — 패널이 하이라이트 가능.
	 */
	template <typename T, typename FmtFn>
	static void AppendField(FString& Out, const TCHAR* Name, const THktVisualField<T>& F,
	                        int64 CurrentFrame, FmtFn&& Fmt)
	{
		const TCHAR* Prefix = F.IsDirty(CurrentFrame) ? TEXT("*") : TEXT("");
		Out += FString::Printf(TEXT(" | %s%s=%s"), Prefix, Name, *Fmt(F.Get()));
	}
}

void UHktPresentationSubsystem::PublishStateToCollector()
{
	using namespace HktPresentationInsights;

	// SourceName: NetMode 기반 — WorldState 와 동일한 명명 규칙 ("Server"/"Client"/"Standalone")
	FString SourceName = TEXT("Standalone");
	if (ULocalPlayer* LP = GetLocalPlayer())
	{
		if (UWorld* W = LP->GetWorld())
		{
			switch (W->GetNetMode())
			{
			case NM_Client:        SourceName = TEXT("Client"); break;
			case NM_ListenServer:
			case NM_DedicatedServer: SourceName = TEXT("Server"); break;
			case NM_Standalone:
			default:               SourceName = TEXT("Standalone"); break;
			}
		}
	}

	const FString Category = FString::Printf(TEXT("Presentation.%s"), *SourceName);
	HKT_INSIGHT_CLEAR_CATEGORY(Category);

	const int64 CF = State.CurrentFrame;
	HKT_INSIGHT_COLLECT(Category, TEXT("_Frame"), FString::Printf(TEXT("%lld"), CF));

	// 살아있는 엔티티 카운트
	int32 AliveCount = 0;
	for (auto It = State.Metas.CreateConstIterator(); It; ++It)
	{
		if (It->IsAlive()) ++AliveCount;
	}
	HKT_INSIGHT_COLLECT(Category, TEXT("_EntityCount"), FString::FromInt(AliveCount));
	HKT_INSIGHT_COLLECT(Category, TEXT("_DirtyThisFrame"), FString::FromInt(State.DirtyThisFrame.Num()));
	HKT_INSIGHT_COLLECT(Category, TEXT("_SpawnedThisFrame"), FString::FromInt(State.SpawnedThisFrame.Num()));
	HKT_INSIGHT_COLLECT(Category, TEXT("_RemovedThisFrame"), FString::FromInt(State.RemovedThisFrame.Num()));

	// 엔티티별 — Meta + 모든 View
	for (auto It = State.Metas.CreateConstIterator(); It; ++It)
	{
		const FHktEntityMeta& Meta = *It;
		if (!Meta.IsAlive()) continue;

		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		FString Sum;

		// Meta 섹션 (prefix 없음 — 메타 정보로 헤더에 표시)
		Sum += FString::Printf(TEXT("RenderCategory=%s"), RenderCategoryToString(Meta.RenderCategory));
		Sum += FString::Printf(TEXT(" | SpawnedFrame=%lld"), Meta.SpawnedFrame);
		Sum += FString::Printf(TEXT(" | LastDirtyFrame=%lld"), Meta.LastDirtyFrame);

		// Transform
		if (const FHktTransformView* V = State.GetTransform(Id))
		{
			AppendField(Sum, TEXT("Transform.Location"),       V->Location,       CF, [](const FVector& X){ return VecToString(X); });
			AppendField(Sum, TEXT("Transform.Rotation"),       V->Rotation,       CF, [](const FRotator& X){ return RotToString(X); });
			AppendField(Sum, TEXT("Transform.RenderLocation"), V->RenderLocation, CF, [](const FVector& X){ return VecToString(X); });
		}

		// Physics
		if (const FHktPhysicsView* V = State.GetPhysics(Id))
		{
			AppendField(Sum, TEXT("Physics.CollisionRadius"),     V->CollisionRadius,     CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Physics.CollisionHalfHeight"), V->CollisionHalfHeight, CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Physics.CollisionLayer"),      V->CollisionLayer,      CF, [](int32 X){ return FString::FromInt(X); });
		}

		// Movement
		if (const FHktMovementView* V = State.GetMovement(Id))
		{
			AppendField(Sum, TEXT("Movement.MoveTarget"), V->MoveTarget, CF, [](const FVector& X){ return VecToString(X); });
			AppendField(Sum, TEXT("Movement.MoveForce"), V->MoveForce, CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Movement.IsMoving"),  V->bIsMoving,  CF, [](bool X){ return FString(X ? TEXT("true") : TEXT("false")); });
			AppendField(Sum, TEXT("Movement.IsJumping"), V->bIsJumping, CF, [](bool X){ return FString(X ? TEXT("true") : TEXT("false")); });
			AppendField(Sum, TEXT("Movement.Velocity"),  V->Velocity,   CF, [](const FVector& X){ return VecToString(X); });
		}

		// Vitals
		if (const FHktVitalsView* V = State.GetVitals(Id))
		{
			AppendField(Sum, TEXT("Vitals.Health"),      V->Health,      CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Vitals.MaxHealth"),   V->MaxHealth,   CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Vitals.HealthRatio"), V->HealthRatio, CF, [](float X){ return FString::Printf(TEXT("%.3f"), X); });
			AppendField(Sum, TEXT("Vitals.Mana"),        V->Mana,        CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Vitals.MaxMana"),     V->MaxMana,     CF, [](float X){ return FString::SanitizeFloat(X); });
			AppendField(Sum, TEXT("Vitals.ManaRatio"),   V->ManaRatio,   CF, [](float X){ return FString::Printf(TEXT("%.3f"), X); });
		}

		// Combat
		if (const FHktCombatView* V = State.GetCombat(Id))
		{
			AppendField(Sum, TEXT("Combat.AttackPower"),    V->AttackPower,    CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Combat.Defense"),        V->Defense,        CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Combat.CP"),             V->CP,             CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Combat.MaxCP"),          V->MaxCP,          CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Combat.CPRatio"),        V->CPRatio,        CF, [](float X){ return FString::Printf(TEXT("%.3f"), X); });
			AppendField(Sum, TEXT("Combat.AttackSpeed"),    V->AttackSpeed,    CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Combat.MotionPlayRate"), V->MotionPlayRate, CF, [](int32 X){ return FString::FromInt(X); });
		}

		// Ownership
		if (const FHktOwnershipView* V = State.GetOwnership(Id))
		{
			AppendField(Sum, TEXT("Ownership.Team"),           V->Team,           CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Ownership.OwnedPlayerUid"), V->OwnedPlayerUid, CF, [](int64 X){ return FString::Printf(TEXT("%lld"), X); });
			AppendField(Sum, TEXT("Ownership.OwnerLabel"),     V->OwnerLabel,     CF, [](const FString& X){ return X; });
			AppendField(Sum, TEXT("Ownership.TeamColor"),      V->TeamColor,      CF, [](const FLinearColor& X){ return ColorToString(X); });
		}

		// Animation
		if (const FHktAnimationView* V = State.GetAnimation(Id))
		{
			AppendField(Sum, TEXT("Animation.AnimState"),      V->AnimState,      CF, [](const FGameplayTag& X){ return X.ToString(); });
			AppendField(Sum, TEXT("Animation.MontageState"),   V->MontageState,   CF, [](const FGameplayTag& X){ return X.ToString(); });
			AppendField(Sum, TEXT("Animation.AnimStateUpper"), V->AnimStateUpper, CF, [](const FGameplayTag& X){ return X.ToString(); });
			AppendField(Sum, TEXT("Animation.Stance"),         V->Stance,         CF, [](const FGameplayTag& X){ return X.ToString(); });

			const TCHAR* TagsPrefix = (V->TagsDirtyFrame == CF) ? TEXT("*") : TEXT("");
			Sum += FString::Printf(TEXT(" | %sAnimation.Tags=%s"), TagsPrefix, *V->Tags.ToStringSimple());
			if (V->PendingAnimTriggers.Num() > 0)
			{
				FString Triggers;
				for (const FGameplayTag& T : V->PendingAnimTriggers)
				{
					if (!Triggers.IsEmpty()) Triggers += TEXT(",");
					Triggers += T.ToString();
				}
				Sum += FString::Printf(TEXT(" | *Animation.PendingTriggers=%s"), *Triggers);
			}
		}

		// Visualization
		if (const FHktVisualizationView* V = State.GetVisualization(Id))
		{
			AppendField(Sum, TEXT("Visualization.VisualElement"),     V->VisualElement,     CF, [](const FGameplayTag& X){ return X.ToString(); });
			AppendField(Sum, TEXT("Visualization.ResolvedAssetPath"), V->ResolvedAssetPath, CF, [](const FSoftObjectPath& X){ return X.ToString(); });
		}

		// Item
		if (const FHktItemView* V = State.GetItem(Id))
		{
			AppendField(Sum, TEXT("Item.OwnerEntity"), V->OwnerEntity, CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Item.EquipIndex"),  V->EquipIndex,  CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Item.ItemState"),   V->ItemState,   CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Item.Equippable"),  V->Equippable,  CF, [](int32 X){ return FString::FromInt(X); });
		}

		// VoxelSkin
		if (const FHktVoxelSkinView* V = State.GetVoxelSkin(Id))
		{
			AppendField(Sum, TEXT("VoxelSkin.SkinSet"), V->VoxelSkinSet, CF, [](int32 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("VoxelSkin.Palette"), V->VoxelPalette, CF, [](int32 X){ return FString::FromInt(X); });
		}

		// Sprite
		if (const FHktSpriteView* V = State.GetSprite(Id))
		{
			AppendField(Sum, TEXT("Sprite.Character"),     V->Character,     CF, [](const FGameplayTag& X){ return X.ToString(); });
			AppendField(Sum, TEXT("Sprite.Facing"),        V->Facing,        CF, [](uint8 X){ return FString::FromInt(X); });
			AppendField(Sum, TEXT("Sprite.AnimStartTick"), V->AnimStartTick, CF, [](int32 X){ return FString::FromInt(X); });
		}

		// TerrainDebris
		if (const FHktTerrainDebrisView* V = State.GetTerrainDebris(Id))
		{
			AppendField(Sum, TEXT("TerrainDebris.TypeId"), V->TerrainTypeId, CF, [](int32 X){ return FString::FromInt(X); });
		}

		const FString Key = FString::Printf(TEXT("E_%d"), Id);
		HKT_INSIGHT_COLLECT(Category, Key, Sum);
	}
}

#endif // ENABLE_HKT_INSIGHTS

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
	const FHktTransformView* T = State.GetTransform(Id);
	if (!T) return FVector::ZeroVector;
	return T->RenderLocation.Get().IsZero() ? T->Location.Get() : T->RenderLocation.Get();
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

FVector UHktPresentationSubsystem::GetEntityFocusLocation(FHktEntityId Id) const
{
	if (ActorProcessor)
	{
		if (AActor* Actor = ActorProcessor->GetActor(Id))
		{
			if (IHktPresentableActor* P = Cast<IHktPresentableActor>(Actor))
			{
				return P->GetFocusWorldLocation();
			}
			return Actor->GetActorLocation();
		}
	}
	return GetEntityLocation(Id);
}

FVector UHktPresentationSubsystem::GetEntityHudAnchorLocation(FHktEntityId Id) const
{
	// 1) 액터 기반 경로 (HktUnitActor, HktSpritePaperActor 등): 액터가 자기 좌표 컨벤션에 맞춰 보고.
	if (ActorProcessor)
	{
		if (AActor* Actor = ActorProcessor->GetActor(Id))
		{
			if (IHktPresentableActor* P = Cast<IHktPresentableActor>(Actor))
			{
				return P->GetHudAnchorWorldLocation();
			}
			return Actor->GetActorLocation();
		}
	}

	// 2) 인스턴스 기반 경로 (HISM CrowdRenderer / Niagara CrowdRenderer): 액터 없음.
	//    HktCore 의 entity 좌표는 발(=Location) 기준. 캡슐 상단 = foot + 2*HalfHeight.
	const FVector Foot = GetEntityLocation(Id);
	const FHktPhysicsView* Phys = State.GetPhysics(Id);
	const float HalfHeight = Phys ? Phys->CollisionHalfHeight.Get() : 90.f;
	return Foot + FVector(0.f, 0.f, 2.f * HalfHeight);
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
		const FHktTransformView* T = State.GetTransform(NewSubject);
		FVector Pos = T ? T->Location.Get() : FVector::ZeroVector;
		VFXProcessor->AttachVFXToEntity(Tag_VFX_SelectionSubject, NewSubject, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionSubject VFX attached Entity=%d"), NewSubject));
	}
}

void UHktPresentationSubsystem::OnTargetChanged(FHktEntityId NewTarget)
{
	// 이전 VFX 해제 (real entity 였을 때만 — sentinel/Invalid 은 attach 한 적 없음)
	if (VFXProcessor && IsRealEntityId(CurrentTargetEntityId))
	{
		VFXProcessor->DetachVFXFromEntity(Tag_VFX_SelectionTarget, CurrentTargetEntityId);
	}

	CurrentTargetEntityId = NewTarget;

	// 신규 VFX attach 도 real entity 에만 (voxel sentinel 은 DrawDebug 로 표시).
	if (VFXProcessor && IsRealEntityId(NewTarget))
	{
		const FHktTransformView* T = State.GetTransform(NewTarget);
		FVector Pos = T ? T->Location.Get() : FVector::ZeroVector;
		VFXProcessor->AttachVFXToEntity(Tag_VFX_SelectionTarget, NewTarget, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionTarget VFX attached Entity=%d"), NewTarget));
	}
	else if (NewTarget == VoxelTargetEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			TEXT("Target = Voxel (sentinel) — see GetCurrentVoxelTarget for details"));
	}
}

void UHktPresentationSubsystem::DrawSelectionDebug() const
{
	const ULocalPlayer* LP = GetLocalPlayer();
	UWorld* World = LP ? LP->GetWorld() : nullptr;
	if (!World) return;

	// Sphere(위치 footprint) + Capsule(크기) 를 엔티티 속성 그대로 반영해 그린다.
	// - Sphere: 엔티티 origin(PosX/Y/Z) 에 R=CollisionRadius — XY 충돌 footprint.
	// - Capsule: Physics 뷰 1:1. center = Z + HalfHeight (origin = 발끝).
	//   HalfHeight < Radius 면 시뮬레이션이 R 로 클램프 (HktSimulationSystems.cpp:1048)
	//   하므로 동일 규약으로 시각화.
	// Physics 뷰 부재 또는 R<=0 이면 둘 다 생략 — 충돌 속성 없는 엔티티는 표현할 게 없다.
	auto DrawEntityMarkers = [&](FHktEntityId Id, const FColor& Color)
	{
		const FHktTransformView* T = State.GetTransform(Id);
		if (!T) return;
		const FHktPhysicsView* Phys = State.GetPhysics(Id);
		if (!Phys) return;
		const float Radius = Phys->CollisionRadius.Get();
		if (Radius <= 0.f) return;

		const FVector Pos = T->Location.Get();

		// 1) 위치 sphere — origin 에 CollisionRadius (XY footprint).
		DrawDebugSphere(World, Pos, Radius, 16,
			Color, /*bPersistent*/false, /*LifeTime*/-1.f, /*DepthPriority*/0, /*Thickness*/1.5f);

		// 2) 크기 capsule — 전체 충돌 볼륨.
		const float HalfHeight = FMath::Max(Phys->CollisionHalfHeight.Get(), Radius);
		const FVector CapsuleCenter(Pos.X, Pos.Y, Pos.Z + HalfHeight);
		DrawDebugCapsule(World, CapsuleCenter, HalfHeight, Radius,
			FQuat::Identity, Color, /*bPersistent*/false,
			/*LifeTime*/-1.f, /*DepthPriority*/0, /*Thickness*/2.f);
	};

	// Subject — 녹색
	if (IsRealEntityId(CurrentSubjectEntityId))
	{
		DrawEntityMarkers(CurrentSubjectEntityId, FColor::Green);
	}

	// Target — Entity(real) 는 빨간 sphere+capsule, Voxel(sentinel) 은 AABB 박스, Invalid 은 그리지 않음.
	if (IsRealEntityId(CurrentTargetEntityId))
	{
		DrawEntityMarkers(CurrentTargetEntityId, FColor::Red);
	}
	else if (CurrentTargetEntityId == VoxelTargetEntityId && BoundInteraction)
	{
		const FHktVoxelSelection& Vox = BoundInteraction->GetCurrentVoxelTarget();
		if (Vox.bValid)
		{
			const float HalfExtent = (Vox.VoxelSize > 0.f) ? Vox.VoxelSize * 0.5f : 7.5f;
			DrawDebugBox(World, Vox.WorldCenter, FVector(HalfExtent),
				FColor::Red, false, -1.f, 0, 1.5f);
		}
	}
}
