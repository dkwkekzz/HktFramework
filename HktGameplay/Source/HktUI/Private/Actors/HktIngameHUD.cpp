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

	// Entity HUD DataAsset 비동기 로드 및 캐싱
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

	// PresentationSubsystem에 UI 렌더러로 등록
	CachedPresentationSubsystem = UHktPresentationSubsystem::Get(PC);
	if (CachedPresentationSubsystem)
	{
		CachedPresentationSubsystem->RegisterRenderer(this);
	}
}

void AHktIngameHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	// PresentationSubsystem에서 해제
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

void AHktIngameHUD::Sync(const FHktPresentationState& State)
{
	SyncEntityElements(State);
	UpdateEntityPositions(State);
	UpdateEntityProperties(State);
	UpdateAllElements();
}

void AHktIngameHUD::OnCameraViewChanged(const FHktPresentationState& State)
{
	// 카메라만 변경된 경우에도 액터의 보간된 위치를 반영하여 HUD 떨림 방지
	UpdateEntityPositions(State);
	UpdateAllElements();
}

void AHktIngameHUD::Teardown()
{
	TrackedEntities.Empty();
	bInitialSyncDone = false;
}

// --- Entity 동기화 ---

void AHktIngameHUD::SyncEntityElements(const FHktPresentationState& State)
{
	if (!bInitialSyncDone)
	{
		// 초기 동기화: PresentationState의 모든 유효 엔티티에 대해 위젯 생성
		// 소유된 아이템(InBag/Active)은 월드에 배치된 것이 아니므로 제외
		State.ForEachEntity([this, &State](const FHktEntityPresentation& Entity)
		{
			if (Entity.EntityId == InvalidEntityId) return;
			if (Entity.IsItemOwned()) return;
			TrackedEntities.Add(Entity.EntityId);
			CreateEntityElement(Entity.EntityId, State);
		});
		bInitialSyncDone = true;

		HKT_EVENT_LOG(HktLogTags::UI, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("HUD: InitialSync via Presentation, Entities=%d"),
			TrackedEntities.Num()));
		return;
	}

	// 신규 엔티티 추가 (소유된 아이템은 제외)
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		if (Id == InvalidEntityId) continue;
		const FHktEntityPresentation* Entity = State.Get(Id);
		if (Entity && Entity->IsItemOwned()) continue;
		if (!TrackedEntities.Contains(Id))
		{
			TrackedEntities.Add(Id);
			CreateEntityElement(Id, State);
		}
	}

	// 제거된 엔티티 정리
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
		const FHktEntityPresentation* Entity = State.Get(Id);
		if (!Entity) continue;

		const bool bTracked = TrackedEntities.Contains(Id);
		const bool bShouldShow = !Entity->IsItemOwned();

		if (bTracked && !bShouldShow)
		{
			// 장착됨 → HUD 제거
			RemoveEntityElement(Id);
			TrackedEntities.Remove(Id);
		}
		else if (!bTracked && bShouldShow && Entity->IsAlive())
		{
			// 장착 해제됨 → HUD 생성
			TrackedEntities.Add(Id);
			CreateEntityElement(Id, State);
		}
	}
}

void AHktIngameHUD::CreateEntityElement(FHktEntityId EntityId, const FHktPresentationState& State)
{
	UHktUIElement* Element = GetOrAddEntityElement(EntityId);
	if (!Element || Element->View.IsValid()) return;

	// DataAsset 팩토리를 통해 뷰 + 앵커 전략 생성 (미로드 시 직접 생성 폴백)
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

	// DataAsset에 HeadClearance가 지정되어 있으면 사용, 아니면 IngameHUD 기본값
	const float EffectiveHeadClearance = (CachedEntityHudAsset && CachedEntityHudAsset->HeadClearance > 0.f)
		? CachedEntityHudAsset->HeadClearance
		: EntityHudHeadClearance;
	Strategy->SetTargetEntity(EntityId, EffectiveHeadClearance);

	// DataAsset의 스크린 오프셋 적용
	if (CachedEntityHudAsset)
	{
		Strategy->SetScreenOffset(CachedEntityHudAsset->ScreenOffset);
	}

	// Actor의 보간된 위치를 우선 사용 (움직임 튀기 방지), 없으면 RenderLocation 폴백
	const FHktEntityPresentation* Entity = State.Get(EntityId);
	if (Entity)
	{
		FVector WorldPos = Entity->RenderLocation.Get();
		if (CachedPresentationSubsystem)
		{
			const FVector ActorLoc = CachedPresentationSubsystem->GetEntityActorLocation(EntityId);
			if (!ActorLoc.IsZero())
			{
				WorldPos = ActorLoc;
			}
		}
		Strategy->SetWorldPosition(WorldPos, Entity->CollisionHalfHeight.Get());
	}

	Element->InitializeElement(View, Strategy);
	AddElementToCanvas(Element);

	// 뷰에서 위젯을 꺼내 초기 프로퍼티 설정
	TSharedPtr<SHktEntityHudWidget> EntityWidget = StaticCastSharedRef<SHktEntityHudWidget>(View->GetSlateWidget());
	if (!EntityWidget.IsValid()) return;

	EntityWidget->SetEntityId(EntityId);

	if (Entity)
	{
		EntityWidget->SetOwnerLabel(Entity->OwnerLabel.Get());
		EntityWidget->SetHealthPercent(Entity->HealthRatio.Get());
		EntityWidget->SetTeamColor(Entity->TeamColor.Get());
	}
}

void AHktIngameHUD::UpdateEntityPositions(const FHktPresentationState& State)
{
	for (FHktEntityId EntityId : TrackedEntities)
	{
		const FHktEntityPresentation* Entity = State.Get(EntityId);
		if (!Entity) continue;

		UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element) continue;

		UHktWorldViewAnchorStrategy* Strategy = Cast<UHktWorldViewAnchorStrategy>(Element->AnchorStrategy);
		if (!Strategy) continue;

		// Actor의 보간된 위치를 우선 사용 (움직임 떨림 방지), 없으면 RenderLocation 폴백
		FVector WorldPos = Entity->RenderLocation.Get();
		if (CachedPresentationSubsystem)
		{
			const FVector ActorLoc = CachedPresentationSubsystem->GetEntityActorLocation(EntityId);
			if (!ActorLoc.IsZero())
			{
				WorldPos = ActorLoc;
			}
		}
		Strategy->SetWorldPosition(WorldPos, Entity->CollisionHalfHeight.Get());
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

	// 스크린 픽셀 좌표 → 정규화 좌표
	const float NormalizedX = ScreenPos.X / static_cast<float>(ViewportX);
	const float NormalizedY = ScreenPos.Y / static_cast<float>(ViewportY);

	for (FHktEntityId EntityId : TrackedEntities)
	{
		const UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element || !Element->bIsOnScreen || !Element->View.IsValid()) continue;

		// ScreenOffset(픽셀) 반영: 앵커 위치에 오프셋 추가
		FVector2D PixelOffset(0.f, 0.f);
		if (const UHktWorldViewAnchorStrategy* Strategy = Cast<UHktWorldViewAnchorStrategy>(Element->AnchorStrategy))
		{
			PixelOffset = Strategy->GetScreenOffset();
		}
		const float AnchorX = Element->CachedScreenPosition.X + PixelOffset.X / static_cast<float>(ViewportX);
		const float AnchorY = Element->CachedScreenPosition.Y + PixelOffset.Y / static_cast<float>(ViewportY);

		// 위젯 실제 DesiredSize 사용
		const FVector2D WidgetSize = Element->View->GetSlateWidget()->GetDesiredSize();
		const float HalfW = (WidgetSize.X * 0.5f) / static_cast<float>(ViewportX);
		const float FullH = WidgetSize.Y / static_cast<float>(ViewportY);

		// Alignment(0.5, 1.0): 앵커가 위젯 하단 중앙
		// 위젯 영역: X=[AnchorX - HalfW, AnchorX + HalfW], Y=[AnchorY - FullH, AnchorY]
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

	// 장착 아이템 네임플레이트: OwnerEntity별로 장착된 아이템의 VisualElement 태그 수집
	TMap<FHktEntityId, FString> ItemLabelMap;
	State.ForEachEntity([&ItemLabelMap](const FHktEntityPresentation& ItemEntity)
	{
		if (!ItemEntity.IsItemAttached()) return;
		const FHktEntityId OwnerId = ItemEntity.OwnerEntity.Get();
		const FGameplayTag& VisTag = ItemEntity.VisualElement.Get();
		if (!VisTag.IsValid()) return;

		const FString TagStr = VisTag.ToString();
		FString DisplayName;
		TagStr.Split(TEXT("."), nullptr, &DisplayName, ESearchCase::IgnoreCase, ESearchDir::FromEnd);
		if (DisplayName.IsEmpty()) DisplayName = TagStr;

		FString& Existing = ItemLabelMap.FindOrAdd(OwnerId);
		if (!Existing.IsEmpty()) Existing += TEXT(", ");
		Existing += DisplayName;
	});

	for (FHktEntityId EntityId : TrackedEntities)
	{
		const FHktEntityPresentation* Entity = State.Get(EntityId);
		if (!Entity) continue;

		UHktUIElement* Element = FindEntityElement(EntityId);
		if (!Element || !Element->View.IsValid()) continue;

		TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();
		TSharedPtr<SHktEntityHudWidget> EntityWidget = StaticCastSharedRef<SHktEntityHudWidget>(SlateWidget);
		if (!EntityWidget.IsValid()) continue;

		if (Entity->HealthRatio.IsDirty(Frame))
			EntityWidget->SetHealthPercent(Entity->HealthRatio.Get());
		if (Entity->OwnerLabel.IsDirty(Frame))
			EntityWidget->SetOwnerLabel(Entity->OwnerLabel.Get());
		if (Entity->TeamColor.IsDirty(Frame))
			EntityWidget->SetTeamColor(Entity->TeamColor.Get());

		const FString* ItemLabel = ItemLabelMap.Find(EntityId);
		EntityWidget->SetItemLabel(ItemLabel ? *ItemLabel : FString());
	}
}
