// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "IHktUIView.h"
#include "Widgets/SWidget.h"

/**
 * Slate 위젯을 IHktUIView로 감싸는 구현체.
 * DataAsset CreateView() 등에서 TSharedRef<SWidget>을 래핑할 때 사용합니다.
 */
class HKTUI_API FHktSlateView : public IHktUIView
{
public:
	explicit FHktSlateView(TSharedRef<SWidget> InWidget)
		: SlateWidget(MoveTemp(InWidget))
	{}

	virtual TSharedRef<SWidget> GetSlateWidget() const override { return SlateWidget; }

	virtual void SetVisibility(EVisibility InVisibility) override
	{
		SlateWidget->SetVisibility(InVisibility);
	}

	virtual void SetRenderOpacity(float InOpacity) override
	{
		SlateWidget->SetRenderOpacity(InOpacity);
	}

private:
	TSharedRef<SWidget> SlateWidget;
};
