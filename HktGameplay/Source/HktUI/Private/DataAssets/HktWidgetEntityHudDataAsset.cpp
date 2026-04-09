// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWidgetEntityHudDataAsset.h"
#include "HktSlateView.h"
#include "HktUIAnchorStrategy.h"
#include "IHktUIView.h"
#include "Widgets/SHktEntityHudWidget.h"

UHktUIAnchorStrategy* UHktWidgetEntityHudDataAsset::CreateStrategy(UObject* Outer) const
{
	if (!DefaultAnchorStrategyClass || !Outer) return nullptr;
	return NewObject<UHktUIAnchorStrategy>(Outer, DefaultAnchorStrategyClass);
}

TSharedPtr<IHktUIView> UHktWidgetEntityHudDataAsset::CreateView() const
{
	TSharedRef<SHktEntityHudWidget> Widget = SNew(SHktEntityHudWidget);
	return MakeShared<FHktSlateView>(Widget);
}
