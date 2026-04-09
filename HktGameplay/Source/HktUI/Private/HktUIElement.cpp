// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktUIElement.h"
#include "IHktUIView.h"
#include "HktUIAnchorStrategy.h"
#include "Subsystems/WorldSubsystem.h"

void UHktUIElement::InitializeElement(TSharedPtr<IHktUIView> InView, UHktUIAnchorStrategy* InAnchorStrategy)
{
	View = MoveTemp(InView);
	AnchorStrategy = InAnchorStrategy;
	CachedScreenPosition = FVector2D::ZeroVector;
}

void UHktUIElement::TickElement(float DeltaTime)
{
	if (!View.IsValid() || !AnchorStrategy) return;

	// WorldContext: Element의 Outer (AHktHUD::UpdateAllElements에서 Element 소유자는 HUD).
	// 호출측(AHktHUD::UpdateAllElements)에서 TickElement를 호출하므로, 여기서는 GetOuter() 사용.
	UObject* WorldContext = GetOuter();
	if (!WorldContext) return;

	FVector2D ScreenPos;
	bIsOnScreen = AnchorStrategy->CalculateScreenPosition(WorldContext, ScreenPos);
	if (bIsOnScreen)
	{
		CachedScreenPosition = ScreenPos;
	}
}

void UHktUIElement::SetParent(UHktUIElement* InParent)
{
	if (Parent == InParent) return;
	if (Parent)
	{
		Parent->Children.Remove(this);
	}
	Parent = InParent;
	if (Parent)
	{
		Parent->Children.AddUnique(this);
	}
}
