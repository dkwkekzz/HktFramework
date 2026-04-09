// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWidgetLoginHudDataAsset.h"
#include "HktSlateView.h"
#include "HktUIAnchorStrategy.h"
#include "IHktUIView.h"
#include "Widgets/SHktLoginHudWidget.h"
#include "Engine/Texture2D.h"

UHktUIAnchorStrategy* UHktWidgetLoginHudDataAsset::CreateStrategy(UObject* Outer) const
{
	if (!DefaultAnchorStrategyClass || !Outer) return nullptr;
	return NewObject<UHktUIAnchorStrategy>(Outer, DefaultAnchorStrategyClass);
}

TSharedPtr<IHktUIView> UHktWidgetLoginHudDataAsset::CreateView() const
{
	TSharedRef<SHktLoginHudWidget> Widget = SNew(SHktLoginHudWidget)
		.LoginWidgetDataAsset(this);

	return MakeShared<FHktSlateView>(Widget);
}
