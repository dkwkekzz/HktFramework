// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHUD.h"
#include "HktUILog.h"
#include "HktCoreEventLog.h"
#include "HktUIElement.h"
#include "IHktUIViewFactory.h"
#include "HktUIAnchorStrategy.h"
#include "HktWorldViewAnchorStrategy.h"
#include "IHktUIView.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktAssetSubsystem.h"
#include "HktTagDataAsset.h"
#include "Engine/World.h"
#include "Engine/GameViewportClient.h"
#include "GameFramework/PlayerController.h"
#include "Layout/Visibility.h"
#include "Widgets/Layout/SConstraintCanvas.h"
#include "Widgets/SWidget.h"

void AHktHUD::BeginPlay()
{
	Super::BeginPlay();

	RootElement = NewObject<UHktUIElement>(this);
	RootElement->InitializeElement(nullptr, nullptr);

	MainCanvasWidget = SNew(SConstraintCanvas);

	UWorld* World = GetWorld();
	if (World && World->GetGameViewport())
	{
		World->GetGameViewport()->AddViewportWidgetContent(MainCanvasWidget.ToSharedRef(), 0);
	}

	APlayerController* PC = GetOwningPlayerController();
	if (PC)
	{
		BindPlayerInteraction(PC);
	}
}

void AHktHUD::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	UnbindPlayerInteraction();

	UWorld* World = GetWorld();
	if (World && World->GetGameViewport() && MainCanvasWidget.IsValid())
	{
		World->GetGameViewport()->RemoveViewportWidgetContent(MainCanvasWidget.ToSharedRef());
	}
	MainCanvasWidget.Reset();
	RootElement = nullptr;
	EntityUIMap.Empty();

	Super::EndPlay(EndPlayReason);
}

void AHktHUD::BindPlayerInteraction(APlayerController* PC)
{
	if (!PC) return;

	PlayerInteraction = Cast<IHktPlayerInteractionInterface>(PC);
	CachedPlayerController = PC;

	if (!PlayerInteraction)
	{
		HKT_EVENT_LOG(HktLogTags::UI, EHktLogLevel::Verbose, EHktLogSource::Client, TEXT("[HktHUD] PlayerController does not implement IHktPlayerInteractionInterface"));
	}
}

void AHktHUD::UnbindPlayerInteraction()
{
	PlayerInteraction = nullptr;
	CachedPlayerController = nullptr;
}

UHktUIElement* AHktHUD::CreateElement(TSharedPtr<IHktUIView> InView, UHktUIAnchorStrategy* InStrategy, UHktUIElement* Parent)
{
	if (!InView.IsValid()) return nullptr;

	UHktUIElement* ParentElement = Parent ? Parent : RootElement.Get();
	if (!ParentElement) return nullptr;

	UHktUIElement* Element = NewObject<UHktUIElement>(this);
	Element->InitializeElement(InView, InStrategy);
	Element->SetParent(ParentElement);

	AddElementToCanvas(Element);
	return Element;
}

UHktUIElement* AHktHUD::GetOrAddEntityElement(int32 EntityID)
{
	if (UHktUIElement* Existing = FindEntityElement(EntityID))
	{
		return Existing;
	}
	UHktUIElement* Element = NewObject<UHktUIElement>(this);
	Element->OwnerEntityID = EntityID;
	Element->SetParent(RootElement);
	EntityUIMap.Add(EntityID, Element);
	return Element;
}

void AHktHUD::RemoveEntityElement(int32 EntityID)
{
	if (UHktUIElement* Element = FindEntityElement(EntityID))
	{
		RemoveElementFromCanvas(Element);
	}
	EntityUIMap.Remove(EntityID);
}

UHktUIElement* AHktHUD::FindEntityElement(int32 EntityID) const
{
	if (const TObjectPtr<UHktUIElement>* Ptr = EntityUIMap.Find(EntityID))
	{
		return *Ptr;
	}
	return nullptr;
}

void AHktHUD::AddElementToCanvas(UHktUIElement* Element)
{
	if (!MainCanvasWidget.IsValid() || !Element || !Element->View.IsValid()) return;

	TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();

	// 뷰포트 고정 UI(로그인, 인게임 HUD 등)는 슬롯을 캔버스 전체로 채움. 엔티티 HUD는 점 위치 + 오프셋으로 슬롯 크기 부여.
	const bool bFillViewport = (Element->OwnerEntityID == -1);
	if (bFillViewport)
	{
		// 앵커 (0,0)~(1,1) + 오프셋 0 = 캔버스 전체 → 위젯이 화면에 보임
		MainCanvasWidget->AddSlot()
			.Expose(Element->CanvasSlot)
			.Anchors(FAnchors(0.f, 0.f, 1.f, 1.f))
			.Offset(FMargin(0.f, 0.f, 0.f, 0.f))
			.Alignment(FVector2D(0.5f, 0.5f))
			[
				SlateWidget
			];
	}
	else
	{
		// 엔티티 HUD: 정규화 좌표(0~1)를 SConstraintCanvas 앵커로 사용.
		// Alignment(0.5, 1.0)으로 위젯 하단 중앙이 앵커 지점에 정렬됨.
		const float NX = Element->CachedScreenPosition.X;
		const float NY = Element->CachedScreenPosition.Y;
		MainCanvasWidget->AddSlot()
			.Expose(Element->CanvasSlot)
			.Anchors(FAnchors(NX, NY, NX, NY))
			.AutoSize(true)
			.Alignment(FVector2D(0.5f, 1.0f))
			.Offset(FMargin(0.f, 0.f, 0.f, 0.f))
			[
				SlateWidget
			];
	}
}

void AHktHUD::RemoveElementFromCanvas(UHktUIElement* Element)
{
	if (!MainCanvasWidget.IsValid() || !Element || !Element->View.IsValid()) return;

	TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();
	MainCanvasWidget->RemoveSlot(SlateWidget);
	Element->CanvasSlot = nullptr;
}

void AHktHUD::UpdateAllElements()
{
	if (!RootElement) return;

	const bool bHasCanvas = MainCanvasWidget.IsValid();

	for (UHktUIElement* Child : RootElement->GetChildren())
	{
		if (!Child) continue;

		Child->TickElement(0.f);

		if (bHasCanvas && Child->CanvasSlot && Child->View.IsValid())
		{
			if (Child->OwnerEntityID != -1)
			{
				// 엔티티 HUD: 정규화 좌표를 앵커로, Alignment(0.5,1.0)이 하단 중앙 정렬 처리
				const float NX = Child->CachedScreenPosition.X;
				const float NY = Child->CachedScreenPosition.Y;
				Child->CanvasSlot->SetAnchors(FAnchors(NX, NY, NX, NY));

				FVector2D PixelOffset(0.f, 0.f);
				if (const UHktWorldViewAnchorStrategy* Strategy = Cast<UHktWorldViewAnchorStrategy>(Child->AnchorStrategy))
				{
					PixelOffset = Strategy->GetScreenOffset();
				}
				Child->CanvasSlot->SetOffset(FMargin(PixelOffset.X, PixelOffset.Y, 0.f, 0.f));

				// Hidden(Collapsed 아님): 비가시 상태에서도 DesiredSize가 유지되어
				// 다시 화면에 진입할 때 1프레임 위치 튀기가 발생하지 않음
				Child->View->SetVisibility(Child->bIsOnScreen ? EVisibility::SelfHitTestInvisible : EVisibility::Hidden);
			}
			else
			{
				Child->CanvasSlot->SetOffset(FMargin(
					Child->CachedScreenPosition.X,
					Child->CachedScreenPosition.Y,
					0.f, 0.f));
			}
		}
	}
}

void AHktHUD::LoadAndCreateWidget(FGameplayTag WidgetTag, TFunction<void(UHktUIElement*)> OnCreated)
{
	if (!WidgetTag.IsValid()) return;
	if (!RootElement) return;

	UHktAssetSubsystem* AssetSubsystem = UHktAssetSubsystem::Get(GetWorld());
	if (!AssetSubsystem) return;

	AssetSubsystem->LoadAssetAsync(WidgetTag, [this, OnCreated](UHktTagDataAsset* LoadedAsset)
	{
		IHktUIViewFactory* ViewFactory = Cast<IHktUIViewFactory>(LoadedAsset);
		if (!ViewFactory) return;

		TSharedPtr<IHktUIView> View = ViewFactory->CreateView();
		UHktUIAnchorStrategy* Strategy = ViewFactory->CreateStrategy(this);
		if (!View.IsValid() || !Strategy) return;

		UHktUIElement* Element = CreateElement(View, Strategy, nullptr);
		if (OnCreated) OnCreated(Element);
	});
}

void AHktHUD::UpdateEntityUI()
{
	// 서브클래스에서 오버라이드하여 구현.
}
