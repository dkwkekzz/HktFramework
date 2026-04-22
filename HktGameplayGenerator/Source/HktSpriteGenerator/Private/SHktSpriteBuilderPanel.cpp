// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteBuilderPanel.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "DesktopPlatformModule.h"
#include "IDesktopPlatform.h"
#include "Framework/Application/SlateApplication.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteBuilder"

void SHktSpriteBuilderPanel::Construct(const FArguments& InArgs)
{
	SlotOptions = {
		MakeShared<FString>(TEXT("Body")),
		MakeShared<FString>(TEXT("Head")),
		MakeShared<FString>(TEXT("Weapon")),
		MakeShared<FString>(TEXT("Shield")),
		MakeShared<FString>(TEXT("HeadgearTop")),
		MakeShared<FString>(TEXT("HeadgearMid")),
		MakeShared<FString>(TEXT("HeadgearLow")),
	};
	CurrentSlot = SlotOptions[0];

	auto Row = [](const FText& Label, TSharedRef<SWidget> Field) -> TSharedRef<SWidget>
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(140.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	};

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Title", "HKT Sprite Part Builder"))
				.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[ Row(LOCTEXT("TagLbl", "Tag"),
				SAssignNew(TagBox, SEditableTextBox)
					.HintText(LOCTEXT("TagHint", "Sprite.Part.Body.Knight"))
			) ]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[ Row(LOCTEXT("SlotLbl", "Slot"),
				SNew(SComboBox<TSharedPtr<FString>>)
					.OptionsSource(&SlotOptions)
					.InitiallySelectedItem(CurrentSlot)
					.OnSelectionChanged_Lambda([this](TSharedPtr<FString> S, ESelectInfo::Type){ if (S) CurrentSlot = S; })
					.OnGenerateWidget_Lambda([](TSharedPtr<FString> S){ return SNew(STextBlock).Text(FText::FromString(*S)); })
					[
						SNew(STextBlock).Text_Lambda([this]()
						{ return CurrentSlot.IsValid() ? FText::FromString(*CurrentSlot) : FText::GetEmpty(); })
					]
			) ]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[ Row(LOCTEXT("InDirLbl", "Input Directory"),
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().FillWidth(1.f)
				[ SAssignNew(InputDirBox, SEditableTextBox)
					.HintText(LOCTEXT("InDirHint", "D:/Art/MySpriteFolder")) ]
				+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
				[ SNew(SButton)
					.Text(LOCTEXT("Browse", "Browse..."))
					.OnClicked(this, &SHktSpriteBuilderPanel::OnBrowseInputDir) ]
			) ]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[ Row(LOCTEXT("OutDirLbl", "Output Content Dir"),
				SAssignNew(OutputDirBox, SEditableTextBox)
					.Text(FText::FromString(TEXT("/Game/Generated/Sprites")))
			) ]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[
				SNew(SUniformGridPanel)
				.SlotPadding(FMargin(4))
				+ SUniformGridPanel::Slot(0,0)
				[ Row(LOCTEXT("P2WLbl", "PixelToWorld"),
					SAssignNew(PixelToWorldBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("2.0"))) ) ]
				+ SUniformGridPanel::Slot(1,0)
				[ Row(LOCTEXT("FDLbl", "FrameDuration (ms)"),
					SAssignNew(FrameDurationBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("100"))) ) ]
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
				[
					SNew(SCheckBox)
					.IsChecked(bLooping ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
					.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ bLooping = (S == ECheckBoxState::Checked); })
					[ SNew(STextBlock).Text(LOCTEXT("Looping", "Looping")) ]
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(SCheckBox)
					.IsChecked(bMirrorWestFromEast ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
					.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ bMirrorWestFromEast = (S == ECheckBoxState::Checked); })
					[ SNew(STextBlock).Text(LOCTEXT("Mirror", "Mirror W/SW/NW from E/SE/NE")) ]
				]
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
			[
				SNew(SButton)
				.HAlign(HAlign_Center)
				.ContentPadding(FMargin(24,6))
				.Text(LOCTEXT("Build", "Build Sprite Part"))
				.OnClicked(this, &SHktSpriteBuilderPanel::OnBuildClicked)
			]

			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
			[
				SAssignNew(ResultBox, SMultiLineEditableTextBox)
				.IsReadOnly(true)
				.AllowMultiLine(true)
				.HintText(LOCTEXT("ResultHint", "빌드 결과가 여기 표시됩니다"))
			]
		]
	];
}

FReply SHktSpriteBuilderPanel::OnBrowseInputDir()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = InputDirBox->GetText().ToString();
	FString OutPath;
	const bool bOK = DP->OpenDirectoryDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Input Texture Directory"),
		Current.IsEmpty() ? FPaths::ProjectDir() : Current,
		OutPath);
	if (bOK)
	{
		InputDirBox->SetText(FText::FromString(OutPath));
	}
	return FReply::Handled();
}

FReply SHktSpriteBuilderPanel::OnBuildClicked()
{
	const FString Tag      = TagBox      ? TagBox->GetText().ToString() : TEXT("");
	const FString Slot     = CurrentSlot ? *CurrentSlot : TEXT("Body");
	const FString InputDir = InputDirBox ? InputDirBox->GetText().ToString() : TEXT("");
	const FString OutputDir= OutputDirBox? OutputDirBox->GetText().ToString(): TEXT("/Game/Generated/Sprites");
	const float P2W        = PixelToWorldBox  ? FCString::Atof(*PixelToWorldBox->GetText().ToString())  : 2.0f;
	const float FrameDur   = FrameDurationBox ? FCString::Atof(*FrameDurationBox->GetText().ToString()) : 100.f;

	const FString Result = UHktSpriteGeneratorFunctionLibrary::EditorBuildSpritePartFromDirectory(
		Tag, Slot, InputDir, OutputDir, P2W, FrameDur, bLooping, bMirrorWestFromEast);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
