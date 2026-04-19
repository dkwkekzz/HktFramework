// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktIngameHUD.h"
#include "HktUIElement.h"
#include "HktWorldViewAnchorStrategy.h"
#include "HktSlateView.h"
#include "DataAssets/HktWidgetEntityHudDataAsset.h"
#include "Widgets/SHktIngameHudWidget.h"
#include "Widgets/SHktEntityHudWidget.h"
#include "HktUITags.h"
#include "HktUILog.h"
#include "HktCoreEventLog.h"
#include "HktUIHelpers.h"
#include "HktAssetSubsystem.h"
#include "HktPresentationSubsystem.h"
#include "IHktPlayerInteractionInterface.h"
#include "GameFramework/PlayerController.h"

void AHktIngameHUD::BeginPlay()
{
	Super::BeginPlay();

	if (!IngameWidgetTag.IsValid())
		IngameWidgetTag = HktGameplayTags::Widget_IngameHud;
	if (!EntityWidgetTag.IsValid())
		EntityWidgetTag = HktGameplayTags::Widget_EntityHud;

	APlayerController* PC = GetOwningPlayerController();
	if (!PC) return;

	if (UHktAssetSubsystem* AssetSubsystem = UHktAssetSubsystem::Get(GetWorld()))
	{
		AssetSubsystem->LoadAssetAsync(EntityWidgetTag, [this](UHktTagDataAsset* Asset)
		{
			CachedEntityHudAsset = Cast<UHktWidgetEntityHudDataAsset>(Asset);
		});
	}

	LoadAndCreateWidget(IngameWidgetTag, [PC](UHktUIElement* Element)
	{
		if (Element && Element->View.IsValid())
		{
			TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();
			TSharedPtr<SHktIngameHudWidget> IngameWidget = StaticCastSharedRef<SHktIngameHudWidget>(SlateWidget);
			if (IngameWidget.IsValid())
				IngameWidget->SetOwningPlayerController(PC);
		}
	});

	CachedPresentationSubsystem = UHktPresentationSubsystem::Get(PC);
	if (CachedPresentationSubsystem)
	{
		CachedPresentationSubsystem->RegisterRenderer(this);
	}
}

void AHktIngameHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (CachedPresentationSubsystem)
	{
		CachedPresentationSubsystem->UnregisterRenderer(this);
	}

	TrackedEntities.Empty();
	CachedEntityHudAsset = nullptr;
	CachedPresentationSubsystem = nullptr;
	bInitialSyncDone = false;

	Super::EndPlay(EndPlayReason);
}

// --- IHktPresentationProcessor ---

void AHktIngameHUD::Sync(FHktPresentationState& State)
{
	SyncEntityElements(State);
	UpdateEntityPositions(State);
	UpdateEntityProperties(State);
	UpdateAllElements();
}

void AHktIngameHUD::OnCameraViewChanged(FHktPresentationState& State)
{
	UpdateEntityPositions(State);
	UpdateAllElements();
}

void AHktIngameHUD::Teardown()
{
	TrackedEntities.Empty();
	bInitialSyncDone = false;
}

// --- 엔터티 동기화 ---

bool AHktIngameHUD::ShouldDisplayHud(const FHktPresentationState& State, FHktEntityId Id)
{
	if (Id == InvalidEntityId) return false;
	if (!State.IsValid(Id)) return false;
	// 소유된 아이템(InBag/Active)은 월드에 있지 않으므로 HUD 제외
	if (const FHktItemView* Item = State.GetItem(Id))
	{
		if (Item->IsOwned()) return false;
	}
	return true;
}

void AHktIngameHUD::SyncEntityElements(const FHktPresentationState& State)
{
	if (!bInitialSyncDone)
	{
		// 초기 동기화: Meta 뷰를 기준으로 모든 유효 엔터티 순회
		for (auto It = State.Metas.CreateConstIterator(); It; ++It)
		{
			const FHktEntityMeta& Meta = *It;
			if (!Meta.IsAlive()) continue;
			if (!ShouldDisplayHud(State, Meta.EntityId)) continue;
			TrackedEntities.Add(Meta.EntityId);
			CreateEntityElement(Meta.EntityId, State);
		}
		bInitialSyncDone = true;

		HKT_EVENT_LOG(HktLogTags::UI, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("HUD: InitialSync via Presentation, Entities=%d"), TrackedEntities.Num()));
		return;
	}

	// 신규 엔터티 추가
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		if (!ShouldDisplayHud(State, Id)) continue;
		if (!TrackedEntities.Contains(Id))
		{
			TrackedEntities.Add(Id);
			CreateEntityElement(Id, State);
		}
	}

	// 제거된 엔터티 정리
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		if (TrackedEntities.Contains(Id))
		{
			RemoveEntityElement(Id);
			TrackedEntities.Remove(Id);
		}
	}

	// 아이템 상태 변화: 소유되면 HUD 제거, 드랍되면 HUD 생성
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		if (!State.IsValid(Id)) continue;

		const bool bTracked = TrackedEntities.Contains(Id);
		const bool bShouldShow = ShouldDisplayHud(State, Id);

		if (bTracked && !bShouldShow)
		{
			RemoveEntityElement(Id);
			TrackedEntities.Remove(Id);
		}
		else if (!bTracked && bShouldShow)
		{
			TrackedEntities.Add(Id);
			CreateEntityElement(Id, State);
		}
	}
}

void AHktIngameHUD::CreateEntityElement(FHktEntityId EntityId, const FHktPresentationState& State)
{
	UHktUIElement* Element = GetOrAddEntityElement(EntityId);
	if (!Element || Element->View.IsValid()) return;

	TSharedPtr<IHktUIView> View;
	UHktWorldViewAnchorStrategy* Strategy = nullptr;
	if (CachedEntityHudAsset)
	{
		View = CachedEntityHudAsset->CreateView();
		Strategy = Cast<UHktWorldViewAnchorStrategy>(CachedEntityHudAsset->CreateStrategy(this));
	}

	if (!View.IsValid())
	{
		View = MakeShared<FHktSlateView>(SNew(SHktEntityHudWidget));
	}
	if (!Strategy)
	{
		Strategy = NewObject<UHktWorldViewAnchorStrategy>(this);
	}

	const float EffectiveHeadClearance = (CachedEntityHudAsset && CachedEntityHudAsset->HeadClearance > 0.f)
		? CachedEntityHudAsset->HeadClearance
		: EntityHudHeadClearance;
	Strategy->SetTargetEntity(EntityId, EffectiveHeadClearance);

	if (CachedEntityHudAsset)
	{
		Strategy->SetScreenOffset(CachedEntityHudAsset->ScreenOffset);
	}

	const FHktTransformView* Tfm = State.GetTransform(EntityId);
	const FHktPhysicsView*   Phys = State.GetPhysics(EntityId);
	if (Tfm)
	{
		FVector WorldPos = Tfm->RenderLocation.Get();
		if (CachedPresentationSubsystem)
		{
			const FVector ActorLoc = CachedPresentationSubsystem->GetEntityActorLocation(EntityId);
			if (!ActorLoc.IsZero())
			{
				WorldPos = ActorLoc;
			}
		}
		const float HalfHeight = Phys ? Phys->CollisionHalfHeight.Get() : 90.f;
		Strategy->SetWorldPosition(WorldPos, HalfHeight);
	}

	Element->InitializeElement(View, Strategy);
	AddElementToCanvas(Element);

	TSharedPtr<SHktEntityHudWidget> EntityWidget = StaticCastSharedRef<SHktEntityHudWidget>(View->GetSlateWidget());
	if (!EntityWidget.IsValid()) return;

	EntityWidget->SetEntityId(EntityId);

	const FHktOwnershipView* Own   = State.GetOwnership(EntityId);
	const FHktVitalsView*    Vital = State.GetVitals(EntityId);
	if (Own)
	{
		EntityWidget->SetOwnerLabel(Own->OwnerLabel.Get());
		EntityWidget->SetTeamColor(Own->TeamColor.Get());
	}
	if (Vital)
	{
		EntityWidget->SetHealthPercent(Vital->HealthRatio.Get());
	}
}

void AHktIngameHUD::UpdateEntityPositions(const FHktPresentationState& State)
{
	for (FHktEntityId EntityId : TrackedEntities)
	{
		const FHktTransformView* Tfm = State.GetTransform(EntityId);
		if (!Tfm) continue;

		UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element) continue;

		UHktWorldViewAnchorStrategy* Strategy = Cast<UHktWorldViewAnchorStrategy>(Element->AnchorStrategy);
		if (!Strategy) continue;

		FVector WorldPos = Tfm->RenderLocation.Get();
		if (CachedPresentationSubsystem)
		{
			const FVector ActorLoc = CachedPresentationSubsystem->GetEntityActorLocation(EntityId);
			if (!ActorLoc.IsZero())
			{
				WorldPos = ActorLoc;
			}
		}

		const FHktPhysicsView* Phys = State.GetPhysics(EntityId);
		const float HalfHeight = Phys ? Phys->CollisionHalfHeight.Get() : 90.f;
		Strategy->SetWorldPosition(WorldPos, HalfHeight);
	}
}

// --- IHktEntityHudHitTestProvider ---

bool AHktIngameHUD::GetEntityUnderScreenPosition(const FVector2D& ScreenPos, FHktEntityId& OutEntityId) const
{
	APlayerController* PC = GetOwningPlayerController();
	if (!PC) return false;

	int32 ViewportX, ViewportY;
	PC->GetViewportSize(ViewportX, ViewportY);
	if (ViewportX <= 0 || ViewportY <= 0) return false;

	const float NormalizedX = ScreenPos.X / static_cast<float>(ViewportX);
	const float NormalizedY = ScreenPos.Y / static_cast<float>(ViewportY);

	for (FHktEntityId EntityId : TrackedEntities)
	{
		const UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element || !Element->bIsOnScreen || !Element->View.IsValid()) continue;

		FVector2D PixelOffset(0.f, 0.f);
		if (const UHktWorldViewAnchorStrategy* Strategy = Cast<UHktWorldViewAnchorStrategy>(Element->AnchorStrategy))
		{
			PixelOffset = Strategy->GetScreenOffset();
		}
		const float AnchorX = Element->CachedScreenPosition.X + PixelOffset.X / static_cast<float>(ViewportX);
		const float AnchorY = Element->CachedScreenPosition.Y + PixelOffset.Y / static_cast<float>(ViewportY);

		const FVector2D WidgetSize = Element->View->GetSlateWidget()->GetDesiredSize();
		const float HalfW = (WidgetSize.X * 0.5f) / static_cast<float>(ViewportX);
		const float FullH = WidgetSize.Y / static_cast<float>(ViewportY);

		if (NormalizedX >= AnchorX - HalfW && NormalizedX <= AnchorX + HalfW &&
			NormalizedY >= AnchorY - FullH && NormalizedY <= AnchorY)
		{
			OutEntityId = EntityId;
			return true;
		}
	}

	return false;
}

void AHktIngameHUD::UpdateEntityProperties(const FHktPresentationState& State)
{
	const int64 Frame = State.GetCurrentFrame();

	// 장착 아이템 네임플레이트: Items 뷰만 순회하여 OwnerEntity별 라벨 수집
	TMap<FHktEntityId, FString> ItemLabelMap;
	for (auto It = State.Items.CreateConstIterator(); It; ++It)
	{
		const FHktItemView& ItemView = *It;
		if (!ItemView.IsAttached()) continue;

		const FHktEntityId ItemId = static_cast<FHktEntityId>(It.GetIndex());
		const FHktEntityId OwnerId = static_cast<FHktEntityId>(ItemView.OwnerEntity.Get());

		const FHktVisualizationView* Vis = State.GetVisualization(ItemId);
		if (!Vis) continue;
		const FGameplayTag& VisTag = Vis->VisualElement.Get();
		if (!VisTag.IsValid()) continue;

		const FString TagStr = VisTag.ToString();
		FString DisplayName;
		TagStr.Split(TEXT("."), nullptr, &DisplayName, ESearchCase::IgnoreCase, ESearchDir::FromEnd);
		if (DisplayName.IsEmpty()) DisplayName = TagStr;

		FString& Existing = ItemLabelMap.FindOrAdd(OwnerId);
		if (!Existing.IsEmpty()) Existing += TEXT(", ");
		Existing += DisplayName;
	}

	for (FHktEntityId EntityId : TrackedEntities)
	{
		UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element || !Element->View.IsValid()) continue;

		TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();
		TSharedPtr<SHktEntityHudWidget> EntityWidget = StaticCastSharedRef<SHktEntityHudWidget>(SlateWidget);
		if (!EntityWidget.IsValid()) continue;

		if (const FHktVitalsView* Vital = State.GetVitals(EntityId))
		{
			if (Vital->HealthRatio.IsDirty(Frame))
				EntityWidget->SetHealthPercent(Vital->HealthRatio.Get());
		}
		if (const FHktOwnershipView* Own = State.GetOwnership(EntityId))
		{
			if (Own->OwnerLabel.IsDirty(Frame))
				EntityWidget->SetOwnerLabel(Own->OwnerLabel.Get());
			if (Own->TeamColor.IsDirty(Frame))
				EntityWidget->SetTeamColor(Own->TeamColor.Get());
		}

		const FString* ItemLabel = ItemLabelMap.Find(EntityId);
		EntityWidget->SetItemLabel(ItemLabel ? *ItemLabel : FString());
	}
}
