// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Notifications/SProgressBar.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Styling/CoreStyle.h"

/**
 * 엔티티 월드 HUD 위젯.
 * 엔티티 ID, 플레이어 소유자, 체력바를 간결하게 표시합니다.
 */
class HKTUI_API SHktEntityHudWidget : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktEntityHudWidget) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	void SetEntityId(int32 InEntityId);
	void SetOwnerLabel(const FString& InOwnerLabel);
	void SetHealthPercent(float InPercent);
	void SetTeamColor(FLinearColor InColor);
	void SetItemLabel(const FString& InItemLabel);

private:
	TSharedPtr<STextBlock> EntityIdText;
	TSharedPtr<STextBlock> OwnerText;
	TSharedPtr<SProgressBar> HealthBar;
	TSharedPtr<STextBlock> ItemText;
};

// ============================================================================
// Inline Implementation
// ============================================================================

inline void SHktEntityHudWidget::Construct(const FArguments& InArgs)
{
	ChildSlot
	[
		SNew(SBox)
		.WidthOverride(100.f)
		[
			SNew(SBorder)
			.Padding(FMargin(4.f, 2.f))
			.BorderBackgroundColor(FLinearColor(0.0f, 0.0f, 0.0f, 0.6f))
			[
				SNew(SVerticalBox)

				// Entity ID
				+ SVerticalBox::Slot()
				.AutoHeight()
				.HAlign(HAlign_Center)
				[
					SAssignNew(EntityIdText, STextBlock)
					.Text(FText::FromString(TEXT("E:-")))
					.Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
					.ColorAndOpacity(FLinearColor::White)
				]

				// Owner
				+ SVerticalBox::Slot()
				.AutoHeight()
				.HAlign(HAlign_Center)
				[
					SAssignNew(OwnerText, STextBlock)
					.Text(FText::FromString(TEXT("-")))
					.Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
					.ColorAndOpacity(FLinearColor(0.7f, 0.7f, 0.7f))
				]

				// Health Bar
				+ SVerticalBox::Slot()
				.AutoHeight()
				.Padding(0.f, 2.f, 0.f, 0.f)
				[
					SNew(SBox)
					.HeightOverride(6.f)
					[
						SAssignNew(HealthBar, SProgressBar)
						.Percent(1.f)
						.FillColorAndOpacity(FLinearColor::Green)
						.BackgroundImage(FCoreStyle::Get().GetBrush("GenericWhiteBox"))
					]
				]

				// Equipped Item Label
				+ SVerticalBox::Slot()
				.AutoHeight()
				.Padding(0.f, 2.f, 0.f, 0.f)
				.HAlign(HAlign_Center)
				[
					SAssignNew(ItemText, STextBlock)
					.Text(FText::GetEmpty())
					.Font(FCoreStyle::GetDefaultFontStyle("Regular", 7))
					.ColorAndOpacity(FLinearColor(0.9f, 0.8f, 0.5f))
					.Visibility(EVisibility::Collapsed)
				]
			]
		]
	];
}

inline void SHktEntityHudWidget::SetEntityId(int32 InEntityId)
{
	if (EntityIdText.IsValid())
	{
		EntityIdText->SetText(FText::FromString(FString::Printf(TEXT("E:%d"), InEntityId)));
	}
}

inline void SHktEntityHudWidget::SetOwnerLabel(const FString& InOwnerLabel)
{
	if (OwnerText.IsValid())
	{
		OwnerText->SetText(FText::FromString(InOwnerLabel));
	}
}

inline void SHktEntityHudWidget::SetHealthPercent(float InPercent)
{
	if (HealthBar.IsValid())
	{
		HealthBar->SetPercent(FMath::Clamp(InPercent, 0.f, 1.f));

		// 체력에 따라 색상 변경
		if (InPercent > 0.6f)
		{
			HealthBar->SetFillColorAndOpacity(FLinearColor::Green);
		}
		else if (InPercent > 0.3f)
		{
			HealthBar->SetFillColorAndOpacity(FLinearColor::Yellow);
		}
		else
		{
			HealthBar->SetFillColorAndOpacity(FLinearColor::Red);
		}
	}
}

inline void SHktEntityHudWidget::SetTeamColor(FLinearColor InColor)
{
	if (EntityIdText.IsValid())
	{
		EntityIdText->SetColorAndOpacity(InColor);
	}
}

inline void SHktEntityHudWidget::SetItemLabel(const FString& InItemLabel)
{
	if (ItemText.IsValid())
	{
		if (InItemLabel.IsEmpty())
		{
			ItemText->SetVisibility(EVisibility::Collapsed);
		}
		else
		{
			ItemText->SetText(FText::FromString(InItemLabel));
			ItemText->SetVisibility(EVisibility::SelfHitTestInvisible);
		}
	}
}
