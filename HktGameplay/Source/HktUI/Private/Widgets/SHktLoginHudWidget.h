// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DataAssets/HktWidgetLoginHudDataAsset.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Images/SImage.h"
#include "Styling/SlateBrush.h"

class APlayerController;

/**
 * 로그인 화면 Slate 위젯.
 * ID/PW 입력 → 로그인 버튼 → LoginComponent를 통해 서버로 요청.
 */
class HKTUI_API SHktLoginHudWidget : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktLoginHudWidget) {}
		SLATE_ARGUMENT(const UHktWidgetLoginHudDataAsset*, LoginWidgetDataAsset)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	void SetOwningPlayerController(APlayerController* InPC)
	{
		CachedPC = InPC;
	}

private:
	FReply OnLoginClicked();

	FSlateBrush BackgroundBrush;

	TSharedPtr<SEditableTextBox> IDInputBox;
	TSharedPtr<SEditableTextBox> PWInputBox;
	TSharedPtr<STextBlock> StatusText;

	TStrongObjectPtr<const UHktWidgetLoginHudDataAsset> DataAsset;
	TWeakObjectPtr<APlayerController> CachedPC;
};
