// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWidgetIngameHudDataAsset.h"
#include "HktSlateView.h"
#include "HktUIAnchorStrategy.h"
#include "IHktUIView.h"
#include "Widgets/SHktIngameHudWidget.h"

UHktUIAnchorStrategy* UHktWidgetIngameHudDataAsset::CreateStrategy(UObject* Outer) const
{
	if (!DefaultAnchorStrategyClass || !Outer) return nullptr;
	return NewObject<UHktUIAnchorStrategy>(Outer, DefaultAnchorStrategyClass);
}

TSharedPtr<IHktUIView> UHktWidgetIngameHudDataAsset::CreateView() const
{
	TSharedRef<SHktIngameHudWidget> Widget = SNew(SHktIngameHudWidget);
	return MakeShared<FHktSlateView>(Widget);
}
