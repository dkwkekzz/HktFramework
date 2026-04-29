// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteVideoExtractPanel.h"

#include "DesktopPlatformModule.h"
#include "Framework/Application/SlateApplication.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "IDesktopPlatform.h"
#include "Misc/Paths.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteVideoExtract"

namespace HktSpriteVideoExtractPrivate
{
	static TSharedRef<SWidget> MakeRow(const FText& Label, TSharedRef<SWidget> Field)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(150.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	}
}

void SHktSpriteVideoExtractPanel::Construct(const FArguments& InArgs)
{
	using namespace HktSpriteVideoExtractPrivate;

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SScrollBox)

			+ SScrollBox::Slot()
			[
				SNew(SVerticalBox)

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("Title", "Video Frame Extraction (ffmpeg)"))
					.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("Hint",
						"동영상 파일에서 ffmpeg 으로 PNG 프레임만 추출. ffmpeg 경로는 Project Settings > "
						"Plugins > HKT Sprite Generator > FFmpeg Directory 또는 환경변수 HKT_FFMPEG_PATH."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("VidLbl", "Video Path"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(VideoPathBox, SEditableTextBox)
						.HintText(LOCTEXT("VidHint", "D:/Captures/walk.mp4")) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton)
						.Text(LOCTEXT("Browse", "Browse..."))
						.OnClicked(this, &SHktSpriteVideoExtractPanel::OnBrowseVideoPath) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("OutLbl", "Output Directory"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(OutputDirBox, SEditableTextBox)
						.HintText(LOCTEXT("OutHint", "D:/Captures/walk_frames")) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton)
						.Text(LOCTEXT("Browse2", "Browse..."))
						.OnClicked(this, &SHktSpriteVideoExtractPanel::OnBrowseOutputDir) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("FWLbl", "Frame Width (0=원본)"),
						SAssignNew(FrameWidthBox, SEditableTextBox).Text(FText::FromString(TEXT("0")))) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("FHLbl", "Frame Height (0=원본)"),
						SAssignNew(FrameHeightBox, SEditableTextBox).Text(FText::FromString(TEXT("0")))) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("FRLbl", "Frame Rate"),
						SAssignNew(FrameRateBox, SEditableTextBox).Text(FText::FromString(TEXT("10.0")))) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("MFLbl", "Max Frames (0=무제한)"),
						SAssignNew(MaxFramesBox, SEditableTextBox).Text(FText::FromString(TEXT("0")))) ]
					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("StLbl", "Start Time (sec)"),
						SAssignNew(StartTimeBox, SEditableTextBox).Text(FText::FromString(TEXT("0.0")))) ]
					+ SUniformGridPanel::Slot(1,2)[ MakeRow(LOCTEXT("EnLbl", "End Time (0=full)"),
						SAssignNew(EndTimeBox, SEditableTextBox).Text(FText::FromString(TEXT("0.0")))) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.ContentPadding(FMargin(24,6))
					.Text(LOCTEXT("Extract", "Extract Frames"))
					.OnClicked(this, &SHktSpriteVideoExtractPanel::OnExtractClicked)
				]

				+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResHint", "추출 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];
}

FReply SHktSpriteVideoExtractPanel::OnBrowseVideoPath()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = VideoPathBox.IsValid() ? VideoPathBox->GetText().ToString() : FString();
	TArray<FString> OutFiles;
	const bool bOK = DP->OpenFileDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Video File"),
		Current.IsEmpty() ? FPaths::ProjectDir() : Current,
		TEXT(""),
		TEXT("Video Files (*.mp4;*.mov;*.avi;*.webm;*.mkv)|*.mp4;*.mov;*.avi;*.webm;*.mkv|All Files|*.*"),
		EFileDialogFlags::None,
		OutFiles);

	if (bOK && OutFiles.Num() > 0 && VideoPathBox.IsValid())
	{
		VideoPathBox->SetText(FText::FromString(OutFiles[0]));
	}
	return FReply::Handled();
}

FReply SHktSpriteVideoExtractPanel::OnBrowseOutputDir()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = OutputDirBox.IsValid() ? OutputDirBox->GetText().ToString() : FString();
	FString OutPath;
	const bool bOK = DP->OpenDirectoryDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Output Directory"),
		Current.IsEmpty() ? FPaths::ProjectDir() : Current,
		OutPath);
	if (bOK && OutputDirBox.IsValid())
	{
		OutputDirBox->SetText(FText::FromString(OutPath));
	}
	return FReply::Handled();
}

FReply SHktSpriteVideoExtractPanel::OnExtractClicked()
{
	auto Str = [](const TSharedPtr<SEditableTextBox>& B) -> FString
		{ return B.IsValid() ? B->GetText().ToString() : FString(); };
	auto Flt = [&](const TSharedPtr<SEditableTextBox>& B, float Def) -> float
		{ const FString S = Str(B); return S.IsEmpty() ? Def : FCString::Atof(*S); };
	auto Int = [&](const TSharedPtr<SEditableTextBox>& B, int32 Def) -> int32
		{ const FString S = Str(B); return S.IsEmpty() ? Def : FCString::Atoi(*S); };

	const FString VideoPath = Str(VideoPathBox);
	const FString OutDir    = Str(OutputDirBox);
	const int32   FW        = Int(FrameWidthBox, 0);
	const int32   FH        = Int(FrameHeightBox, 0);
	const float   FR        = Flt(FrameRateBox, 10.0f);
	const int32   MF        = Int(MaxFramesBox, 0);
	const float   St        = Flt(StartTimeBox, 0.0f);
	const float   En        = Flt(EndTimeBox, 0.0f);

	const FString Result = UHktSpriteGeneratorFunctionLibrary::EditorExtractVideoFrames(
		VideoPath, OutDir, FW, FH, FR, MF, St, En);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
