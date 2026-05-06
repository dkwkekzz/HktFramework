// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationSubsystem.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktRuntimeTypes.h"
#include "HktAssetSubsystem.h"
#include "Processors/HktActorProcessor.h"
#include "Processors/HktMassEntityProcessor.h"
#include "Processors/HktVFXProcessor.h"
#if ENABLE_HKT_INSIGHTS
#include "Processors/HktCollisionDebugProcessor.h"
#include "Processors/HktTerrainDebugProcessor.h"
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
	View.ForEachDelta([this, &View](FHktEntityId Id, uint16 PropId, int32 NewValue, int32 OldValue)
	{
		const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("PropertyDelta Frame=%lld %s: %d -> %d"),
				View.FrameNumber,
				PropName ? PropName : TEXT("Unknown"),
				OldValue, NewValue), Id);
		State.ApplyDelta(Id, PropId, NewValue);
	});

	// --- Owner 델타 인라인 적용 ---
	View.ForEachOwnerDelta([this, &View](FHktEntityId Id, int64 NewOwnerUid)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("OwnerDelta Frame=%lld Owner=%lld"), View.FrameNumber, NewOwnerUid), Id);
		State.ApplyOwnerDelta(Id, NewOwnerUid);
	});

	// --- Tag 델타 인라인 적용 + VFX attach/detach 감지 ---
	View.ForEachTagDelta([this, &View](FHktEntityId Id, const FGameplayTagContainer& Tags, const FGameplayTagContainer& OldTags)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("TagDelta Frame=%lld Tags=%s"), View.FrameNumber, *Tags.ToString()), Id);
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
	if (!VFXProcessor) return;

	if (CurrentTargetEntityId != InvalidEntityId)
	{
		VFXProcessor->DetachVFXFromEntity(Tag_VFX_SelectionTarget, CurrentTargetEntityId);
	}

	CurrentTargetEntityId = NewTarget;

	if (NewTarget != InvalidEntityId)
	{
		const FHktTransformView* T = State.GetTransform(NewTarget);
		FVector Pos = T ? T->Location.Get() : FVector::ZeroVector;
		VFXProcessor->AttachVFXToEntity(Tag_VFX_SelectionTarget, NewTarget, Pos);

		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SelectionTarget VFX attached Entity=%d"), NewTarget));
	}
}
