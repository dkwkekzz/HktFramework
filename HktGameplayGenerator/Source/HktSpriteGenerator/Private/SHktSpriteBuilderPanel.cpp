// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteBuilderPanel.h"

#include "DesktopPlatformModule.h"
#include "Framework/Application/SlateApplication.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "IDesktopPlatform.h"
#include "Misc/Paths.h"
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

namespace HktSpriteBuilderPrivate
{
	static TSharedRef<SWidget> MakeRow(const FText& Label, TSharedRef<SWidget> Field)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(150.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	}

	static const TArray<TSharedPtr<SHktSpriteBuilderPanel::EBuilderMode>>& GetModeOptions()
	{
		using EBuilderMode = SHktSpriteBuilderPanel::EBuilderMode;
		static TArray<TSharedPtr<EBuilderMode>> Options;
		if (Options.Num() == 0)
		{
			Options.Add(MakeShared<EBuilderMode>(EBuilderMode::Auto));
			Options.Add(MakeShared<EBuilderMode>(EBuilderMode::Atlas));
			Options.Add(MakeShared<EBuilderMode>(EBuilderMode::Directory));
			Options.Add(MakeShared<EBuilderMode>(EBuilderMode::Video));
		}
		return Options;
	}

	static FText ModeToText(SHktSpriteBuilderPanel::EBuilderMode M)
	{
		using EBuilderMode = SHktSpriteBuilderPanel::EBuilderMode;
		switch (M)
		{
		case EBuilderMode::Auto:      return LOCTEXT("Mode_Auto",      "Auto (BuildSpriteAnim)");
		case EBuilderMode::Atlas:     return LOCTEXT("Mode_Atlas",     "Atlas (Low-level)");
		case EBuilderMode::Directory: return LOCTEXT("Mode_Dir",       "Directory (Low-level)");
		case EBuilderMode::Video:     return LOCTEXT("Mode_Video",     "Video (Low-level)");
		}
		return FText::GetEmpty();
	}

	static const TArray<TSharedPtr<EHktSpriteSourceType>>& GetSourceTypeOptions()
	{
		static TArray<TSharedPtr<EHktSpriteSourceType>> Options;
		if (Options.Num() == 0)
		{
			Options.Add(MakeShared<EHktSpriteSourceType>(EHktSpriteSourceType::TextureBundle));
			Options.Add(MakeShared<EHktSpriteSourceType>(EHktSpriteSourceType::Atlas));
			Options.Add(MakeShared<EHktSpriteSourceType>(EHktSpriteSourceType::Video));
		}
		return Options;
	}

	static FText SourceTypeToText(EHktSpriteSourceType T)
	{
		switch (T)
		{
		case EHktSpriteSourceType::Video:         return LOCTEXT("ST_Video",  "Video File (ffmpeg)");
		case EHktSpriteSourceType::Atlas:         return LOCTEXT("ST_Atlas",  "Atlas (PNG / UE asset)");
		case EHktSpriteSourceType::TextureBundle: return LOCTEXT("ST_Bundle", "Texture Bundle (folder)");
		}
		return FText::GetEmpty();
	}

	static FText FloatText(float V) { return FText::FromString(FString::SanitizeFloat(V)); }
	static FText IntText(int32 V)   { return FText::AsNumber(V); }
}

void SHktSpriteBuilderPanel::Construct(const FArguments& InArgs)
{
	using namespace HktSpriteBuilderPrivate;

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 13);

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
					.Text(LOCTEXT("Title", "HKT Sprite Builder"))
					.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("Hint",
						"Auto 모드는 BuildSpriteAnim 단일 진입점으로 SourceType 만 골라 빌드. "
						"Low-level 모드는 각 EditorBuild* 함수에 1:1 매핑되어 동영상/Atlas/폴더 별 파라미터를 직접 노출."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				// === 모드 / Source Type ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("ModeLbl", "Builder Mode"),
					SAssignNew(ModeCombo, SComboBox<TSharedPtr<EBuilderMode>>)
						.OptionsSource(&GetModeOptions())
						.OnGenerateWidget_Lambda([](TSharedPtr<EBuilderMode> M)
						{
							return SNew(STextBlock).Text(ModeToText(*M));
						})
						.OnSelectionChanged(this, &SHktSpriteBuilderPanel::OnModeChanged)
						.InitiallySelectedItem(GetModeOptions()[0])
						[ SNew(STextBlock).Text(this, &SHktSpriteBuilderPanel::GetCurrentModeText) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility_Lambda([this]() {
						return IsModeAuto() ? EVisibility::Visible : EVisibility::Collapsed; })
					+ SVerticalBox::Slot().AutoHeight()
					[ MakeRow(LOCTEXT("STLbl", "Source Type"),
						SAssignNew(SourceTypeCombo, SComboBox<TSharedPtr<EHktSpriteSourceType>>)
							.OptionsSource(&GetSourceTypeOptions())
							.OnGenerateWidget_Lambda([](TSharedPtr<EHktSpriteSourceType> T)
							{
								return SNew(STextBlock).Text(SourceTypeToText(*T));
							})
							.OnSelectionChanged(this, &SHktSpriteBuilderPanel::OnSourceTypeChanged)
							.InitiallySelectedItem(GetSourceTypeOptions()[0])
							[ SNew(STextBlock).Text(this, &SHktSpriteBuilderPanel::GetCurrentSourceTypeText) ]
					) ]
				]

				// === 공통 ID ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[ SNew(STextBlock).Font(HeaderFont).Text(LOCTEXT("IdSec", "Identity")) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("CharLbl", "Character Tag"),
					SAssignNew(CharTagBox, SEditableTextBox)
						.HintText(LOCTEXT("CharHint", "Sprite.Character.Knight"))
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility(this, &SHktSpriteBuilderPanel::GetAnimTagVisibility)
					+ SVerticalBox::Slot().AutoHeight()
					[ MakeRow(LOCTEXT("AnimLbl", "Anim Tag"),
						SAssignNew(AnimTagBox, SEditableTextBox)
							.HintText(LOCTEXT("AnimHint", "Anim.FullBody.Locomotion.Idle"))
					) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility(this, &SHktSpriteBuilderPanel::GetVideoLowLevelVisibility)
					+ SVerticalBox::Slot().AutoHeight()
					[ MakeRow(LOCTEXT("ActLbl", "Action Id"),
						SAssignNew(ActionIdBox, SEditableTextBox)
							.Text(FText::FromString(TEXT("idle")))
							.HintText(LOCTEXT("ActHint", "idle / walk / attack"))
					) ]
				]

				// === Source ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[ SNew(STextBlock).Font(HeaderFont).Text(LOCTEXT("SrcSec", "Source")) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("SrcLbl", "Source Path"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(SourcePathBox, SEditableTextBox)
						.HintText_Lambda([this]() { return FText::FromString(GetSourceHintText()); }) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton)
						.Text(LOCTEXT("Browse", "Browse..."))
						.OnClicked(this, &SHktSpriteBuilderPanel::OnBrowseSourcePath) ]
				) ]

				// === Cell Size (Atlas 류만 — Auto Atlas / Atlas 모드) ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility(this, &SHktSpriteBuilderPanel::GetCellSizeVisibility)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(SUniformGridPanel).SlotPadding(FMargin(4))
						+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("CWLbl", "Cell Width (px)"),
							SAssignNew(CellWidthBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("0"))) ) ]
						+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("CHLbl", "Cell Height (px)"),
							SAssignNew(CellHeightBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("0"))) ) ]
					]
				]

				// === Video low-level 전용 옵션 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility(this, &SHktSpriteBuilderPanel::GetVideoLowLevelVisibility)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(SUniformGridPanel).SlotPadding(FMargin(4))
						+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("FRLbl", "Frame Rate"),
							SAssignNew(FrameRateBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("10.0"))) ) ]
						+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("MFLbl", "Max Frames (0=unlimited)"),
							SAssignNew(MaxFramesBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("0"))) ) ]
						+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("StLbl", "Start Time (sec)"),
							SAssignNew(StartTimeBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("0.0"))) ) ]
						+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("EnLbl", "End Time (0=full)"),
							SAssignNew(EndTimeBox, SEditableTextBox)
								.Text(FText::FromString(TEXT("0.0"))) ) ]
					]
				]

				// === Output ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[ SNew(STextBlock).Font(HeaderFont).Text(LOCTEXT("OutSec", "Output")) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("OutDirLbl", "Output Content Dir"),
					SAssignNew(OutputDirBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("/Game/Generated/Sprites")))
				) ]

				// PixelToWorld 는 모든 모드에서 사용.
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("P2WLbl", "PixelToWorld"),
					SAssignNew(PixelToWorldBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("2.0")))
				) ]

				// FrameDuration / Looping / Mirror — Low-level 전용 (Auto 는 자동 추론).
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SVerticalBox)
					.Visibility(this, &SHktSpriteBuilderPanel::GetLowLevelOnlyVisibility)

					+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,4)
					[ MakeRow(LOCTEXT("FDLbl", "FrameDuration (ms)"),
						SAssignNew(FrameDurationBox, SEditableTextBox)
							.Text(FText::FromString(TEXT("100")))
					) ]

					+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
					[
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
						[
							SNew(SCheckBox)
							.IsChecked_Lambda([this]() {
								return bLooping ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
							.OnCheckStateChanged_Lambda([this](ECheckBoxState S){
								bLooping = (S == ECheckBoxState::Checked); })
							[ SNew(STextBlock).Text(LOCTEXT("Looping", "Looping")) ]
						]
						+ SHorizontalBox::Slot().AutoWidth()
						[
							SNew(SCheckBox)
							.IsChecked_Lambda([this]() {
								return bMirrorWestFromEast ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
							.OnCheckStateChanged_Lambda([this](ECheckBoxState S){
								bMirrorWestFromEast = (S == ECheckBoxState::Checked); })
							[ SNew(STextBlock).Text(LOCTEXT("Mirror", "Mirror W/SW/NW from E/SE/NE")) ]
						]
					]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.ContentPadding(FMargin(24,6))
					.Text(LOCTEXT("Build", "Build"))
					.OnClicked(this, &SHktSpriteBuilderPanel::OnBuildClicked)
				]

				+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResultHint", "빌드 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];
}

// ============================================================================
// 모드 / Source Type 핸들러
// ============================================================================

void SHktSpriteBuilderPanel::OnModeChanged(TSharedPtr<EBuilderMode> NewMode, ESelectInfo::Type)
{
	if (NewMode.IsValid())
	{
		CurrentMode = *NewMode;
	}
}

FText SHktSpriteBuilderPanel::GetCurrentModeText() const
{
	return HktSpriteBuilderPrivate::ModeToText(CurrentMode);
}

void SHktSpriteBuilderPanel::OnSourceTypeChanged(TSharedPtr<EHktSpriteSourceType> NewType, ESelectInfo::Type)
{
	if (NewType.IsValid())
	{
		CurrentSourceType = *NewType;
	}
}

FText SHktSpriteBuilderPanel::GetCurrentSourceTypeText() const
{
	return HktSpriteBuilderPrivate::SourceTypeToText(CurrentSourceType);
}

// ============================================================================
// Visibility 헬퍼 — 각 빌더 함수의 실제 시그니처에 맞춰 입력 필드 노출
// ============================================================================

EVisibility SHktSpriteBuilderPanel::GetAnimTagVisibility() const
{
	// BuildSpriteAnim 와 EditorBuildSpriteCharacterFromAtlas 가 AnimTag 를 받음.
	// Directory/Video 는 파일명/ActionId 에서 anim 을 파생 — AnimTag 직접 입력 없음.
	if (IsModeAuto() || IsModeAtlas()) return EVisibility::Visible;
	return EVisibility::Collapsed;
}

EVisibility SHktSpriteBuilderPanel::GetCellSizeVisibility() const
{
	// Auto 모드: Atlas 소스는 필수, 그 외는 0=auto-detect (선택). Atlas low-level 도 필수.
	// Directory low-level 은 폴더 패킹이 자동 결정. Video low-level 은 ffmpeg 옵션과 분리.
	if (IsModeAtlas()) return EVisibility::Visible;
	if (IsModeAuto() && CurrentSourceType == EHktSpriteSourceType::Atlas) return EVisibility::Visible;
	if (IsModeVideo()) return EVisibility::Visible;  // FrameW/H 가 ffmpeg scale 필터로 사용됨
	return EVisibility::Collapsed;
}

EVisibility SHktSpriteBuilderPanel::GetLowLevelOnlyVisibility() const
{
	// FrameDuration / Looping / Mirror — Low-level 전용.
	// Auto(BuildSpriteAnim) 는 AnimTag 에서 looping 추론, FrameDuration=100 고정.
	return IsModeAuto() ? EVisibility::Collapsed : EVisibility::Visible;
}

EVisibility SHktSpriteBuilderPanel::GetVideoLowLevelVisibility() const
{
	// ActionId / FrameRate / MaxFrames / StartTime / EndTime — EditorBuildSpriteCharacterFromVideo 전용.
	// Auto+Video(BuildSpriteAnim) 는 ffmpeg 옵션 없이 동영상 → 자동 처리.
	return IsModeVideo() ? EVisibility::Visible : EVisibility::Collapsed;
}

// ============================================================================
// Browse / Build
// ============================================================================

FString SHktSpriteBuilderPanel::GetSourceHintText() const
{
	if (IsModeAtlas())
	{
		return TEXT("/Game/Path/T_Atlas  또는  D:/Art/atlas.png");
	}
	if (IsModeDirectory())
	{
		return TEXT("D:/Art/MySpriteFolder");
	}
	if (IsModeVideo())
	{
		return TEXT("D:/Captures/walk.mp4");
	}
	// Auto 모드 — Source Type 별.
	switch (CurrentSourceType)
	{
	case EHktSpriteSourceType::Video:         return TEXT("D:/Captures/walk.mp4");
	case EHktSpriteSourceType::Atlas:         return TEXT("/Game/Path/T_Atlas  또는  D:/Art/atlas.png");
	case EHktSpriteSourceType::TextureBundle: return TEXT("D:/Art/MySpriteFolder");
	}
	return TEXT("");
}

FReply SHktSpriteBuilderPanel::OnBrowseSourcePath()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = SourcePathBox.IsValid() ? SourcePathBox->GetText().ToString() : FString();

	// 동영상/Atlas 모드는 파일 선택, 그 외는 디렉터리 선택.
	const bool bWantsFile =
		IsModeVideo() ||
		IsModeAtlas() ||
		(IsModeAuto() &&
			(CurrentSourceType == EHktSpriteSourceType::Video ||
			 CurrentSourceType == EHktSpriteSourceType::Atlas));

	bool bOK = false;
	FString Picked;
	const void* ParentHandle = FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared());
	const FString DefaultDir = Current.IsEmpty() ? FPaths::ProjectDir() : Current;

	if (bWantsFile)
	{
		TArray<FString> OutFiles;
		const FString Filter =
			(IsModeVideo() || (IsModeAuto() && CurrentSourceType == EHktSpriteSourceType::Video))
				? TEXT("Video Files (*.mp4;*.mov;*.avi;*.webm;*.mkv)|*.mp4;*.mov;*.avi;*.webm;*.mkv|All Files|*.*")
				: TEXT("Image Files (*.png;*.tga;*.jpg)|*.png;*.tga;*.jpg|All Files|*.*");

		bOK = DP->OpenFileDialog(
			ParentHandle,
			TEXT("Select Source File"),
			DefaultDir,
			TEXT(""),
			Filter,
			EFileDialogFlags::None,
			OutFiles);
		if (bOK && OutFiles.Num() > 0)
		{
			Picked = OutFiles[0];
		}
	}
	else
	{
		bOK = DP->OpenDirectoryDialog(
			ParentHandle,
			TEXT("Select Source Directory"),
			DefaultDir,
			Picked);
	}

	if (bOK && SourcePathBox.IsValid())
	{
		SourcePathBox->SetText(FText::FromString(Picked));
	}
	return FReply::Handled();
}

FString SHktSpriteBuilderPanel::RunBuild() const
{
	auto Str = [](const TSharedPtr<SEditableTextBox>& B) -> FString
		{ return B.IsValid() ? B->GetText().ToString() : FString(); };
	auto Flt = [&](const TSharedPtr<SEditableTextBox>& B, float Def) -> float
		{ const FString S = Str(B); return S.IsEmpty() ? Def : FCString::Atof(*S); };
	auto Int = [&](const TSharedPtr<SEditableTextBox>& B, int32 Def) -> int32
		{ const FString S = Str(B); return S.IsEmpty() ? Def : FCString::Atoi(*S); };

	const FString CharTag      = Str(CharTagBox);
	const FString AnimTag      = Str(AnimTagBox);
	const FString SourcePath   = Str(SourcePathBox);
	const FString OutputDir    = Str(OutputDirBox).IsEmpty()
		? TEXT("/Game/Generated/Sprites") : Str(OutputDirBox);
	const float   PixelToWorld = Flt(PixelToWorldBox, 2.0f);
	const float   FrameDur     = Flt(FrameDurationBox, 100.0f);
	const int32   CellW        = Int(CellWidthBox, 0);
	const int32   CellH        = Int(CellHeightBox, 0);

	switch (CurrentMode)
	{
	case EBuilderMode::Auto:
		return UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
			CharTag, AnimTag, SourcePath, CurrentSourceType,
			CellW, CellH, PixelToWorld, OutputDir);

	case EBuilderMode::Atlas:
	{
		const FString UseAnimTag = AnimTag.IsEmpty()
			? FString(TEXT("Anim.FullBody.Locomotion.Idle")) : AnimTag;
		return UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromAtlas(
			CharTag, SourcePath, CellW, CellH,
			UseAnimTag, OutputDir, PixelToWorld, FrameDur,
			bLooping, bMirrorWestFromEast);
	}

	case EBuilderMode::Directory:
		return UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromDirectory(
			CharTag, SourcePath, OutputDir, PixelToWorld, FrameDur,
			bLooping, bMirrorWestFromEast);

	case EBuilderMode::Video:
	{
		const FString ActionId   = Str(ActionIdBox).IsEmpty() ? FString(TEXT("idle")) : Str(ActionIdBox);
		const float   FrameRate  = Flt(FrameRateBox, 10.0f);
		const int32   MaxFrames  = Int(MaxFramesBox, 0);
		const float   StartTime  = Flt(StartTimeBox, 0.0f);
		const float   EndTime    = Flt(EndTimeBox, 0.0f);
		return UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromVideo(
			CharTag, SourcePath, ActionId,
			CellW, CellH, FrameRate, MaxFrames, StartTime, EndTime,
			OutputDir, PixelToWorld, FrameDur, bLooping, bMirrorWestFromEast);
	}
	}
	return TEXT("{\"success\":false,\"error\":\"unknown builder mode\"}");
}

FReply SHktSpriteBuilderPanel::OnBuildClicked()
{
	const FString Result = RunBuild();
	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
