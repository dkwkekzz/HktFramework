// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Widgets/SHktLoginHudWidget.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktRuntimeCommands.h"
#include "Styling/SlateTypes.h"
#include "Styling/CoreStyle.h"
#include "Engine/Texture2D.h"

void SHktLoginHudWidget::Construct(const FArguments& InArgs)
{
	if (InArgs._LoginWidgetDataAsset)
	{
		DataAsset = TStrongObjectPtr<const UHktWidgetLoginHudDataAsset>(
			const_cast<UHktWidgetLoginHudDataAsset*>(InArgs._LoginWidgetDataAsset));
	}

	// DataAsset에 설정한 배경 텍스처를 Brush에 연결
	if (DataAsset.IsValid() && DataAsset->LoginBackgroundTexture)
	{
		UTexture2D* Tex = const_cast<UTexture2D*>(DataAsset->LoginBackgroundTexture.Get());
		BackgroundBrush.SetResourceObject(Tex);
		int32 SizeX = Tex->GetSizeX();
		int32 SizeY = Tex->GetSizeY();
		if (SizeX <= 0 || SizeY <= 0)
		{
			SizeX = 1920;
			SizeY = 1080;
		}
		BackgroundBrush.SetImageSize(FVector2D(static_cast<float>(SizeX), static_cast<float>(SizeY)));
		BackgroundBrush.DrawAs = ESlateBrushDrawType::Image;
		BackgroundBrush.Tiling = ESlateBrushTileType::NoTile;
	}

	TSharedRef<SWidget> FormContent = SNew(SBox)
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Center)
		[
			SNew(SBorder)
			.Padding(40.f)
			.BorderBackgroundColor(FLinearColor(0.05f, 0.05f, 0.1f, 0.9f))
			[
				SNew(SBox)
				.WidthOverride(350.f)
				[
					SNew(SVerticalBox)

					// 타이틀
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 20.f)
					.HAlign(HAlign_Center)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("HKT Login")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 24))
						.ColorAndOpacity(FLinearColor::White)
					]

					// ID
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 4.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("User ID")))
						.ColorAndOpacity(FLinearColor(0.8f, 0.8f, 0.8f))
					]

					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 12.f)
					[
						SAssignNew(IDInputBox, SEditableTextBox)
						.HintText(FText::FromString(TEXT("Enter ID...")))
					]

					// PW
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 4.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Password")))
						.ColorAndOpacity(FLinearColor(0.8f, 0.8f, 0.8f))
					]

					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 20.f)
					[
						SAssignNew(PWInputBox, SEditableTextBox)
						.HintText(FText::FromString(TEXT("Enter Password...")))
						.IsPassword(true)
					]

					// 로그인 버튼
					+ SVerticalBox::Slot()
					.AutoHeight()
					.HAlign(HAlign_Center)
					.Padding(0.f, 0.f, 0.f, 12.f)
					[
						SNew(SBox)
						.WidthOverride(200.f)
						.HeightOverride(40.f)
						[
							SNew(SButton)
							.HAlign(HAlign_Center)
							.VAlign(VAlign_Center)
							.OnClicked(this, &SHktLoginHudWidget::OnLoginClicked)
							[
								SNew(STextBlock)
								.Text(FText::FromString(TEXT("Login")))
								.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
							]
						]
					]

					// 상태 텍스트
					+ SVerticalBox::Slot()
					.AutoHeight()
					.HAlign(HAlign_Center)
					[
						SAssignNew(StatusText, STextBlock)
						.Text(FText::GetEmpty())
						.ColorAndOpacity(FLinearColor(1.f, 0.4f, 0.4f))
					]
				]
			]
		];

	// 배경 이미지(있을 때) 위에 로그인 폼을 올림
	if (DataAsset.IsValid() && DataAsset->LoginBackgroundTexture)
	{
		ChildSlot
		[
			SNew(SOverlay)
			+ SOverlay::Slot()
			.HAlign(HAlign_Fill)
			.VAlign(VAlign_Fill)
			[
				SNew(SImage)
				.Image(&BackgroundBrush)
			]
			+ SOverlay::Slot()
			.HAlign(HAlign_Fill)
			.VAlign(VAlign_Fill)
			[
				FormContent
			]
		];
	}
	else
	{
		ChildSlot[FormContent];
	}
}

FReply SHktLoginHudWidget::OnLoginClicked()
{
	const FString ID = IDInputBox.IsValid() ? IDInputBox->GetText().ToString() : FString();
	const FString PW = PWInputBox.IsValid() ? PWInputBox->GetText().ToString() : FString();

	if (ID.IsEmpty() || PW.IsEmpty())
	{
		if (StatusText.IsValid())
		{
			StatusText->SetText(FText::FromString(TEXT("ID and Password cannot be empty.")));
		}
		return FReply::Handled();
	}

	APlayerController* PC = CachedPC.Get();
	if (!PC)
	{
		if (StatusText.IsValid())
		{
			StatusText->SetText(FText::FromString(TEXT("PlayerController not found.")));
		}
		return FReply::Handled();
	}

	// IHktPlayerInteractionInterface를 통한 로그인 요청
	if (IHktPlayerInteractionInterface* InteractionInterface = Cast<IHktPlayerInteractionInterface>(PC))
	{
		// 로그인 요청 데이터 생성
		UHktLoginRequest* LoginRequest = NewObject<UHktLoginRequest>();
		LoginRequest->UserID = ID;
		LoginRequest->Password = PW;

		// ExecuteCommand를 통해 전달
		InteractionInterface->ExecuteCommand(LoginRequest);
		
		if (StatusText.IsValid())
		{
			StatusText->SetText(FText::FromString(TEXT("Logging in...")));
		}
	}
	else
	{
		if (StatusText.IsValid())
		{
			StatusText->SetText(FText::FromString(TEXT("PlayerController does not support UI commands.")));
		}
	}

	return FReply::Handled();
}
