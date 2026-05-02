// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteVideoExtractPanel.h"

#include "HAL/FileManager.h"
#include "HAL/PlatformProcess.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "HktSpriteVideoExtractPanelConfig.h"
#include "IDetailsView.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "PropertyEditorModule.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteVideoExtract"

void SHktSpriteVideoExtractPanel::Construct(const FArguments& InArgs)
{
	// CDO 를 직접 사용 — 엔진이 root 로 잡고 있어 GC 안전. SHktSpriteBuilderPanel 과 동일 패턴.
	UHktSpriteVideoExtractPanelConfig* Cfg = GetMutableDefault<UHktSpriteVideoExtractPanelConfig>();
	Cfg->LoadConfig();
	Config = TStrongObjectPtr<UHktSpriteVideoExtractPanelConfig>(Cfg);

	FPropertyEditorModule& PEM = FModuleManager::LoadModuleChecked<FPropertyEditorModule>(TEXT("PropertyEditor"));
	FDetailsViewArgs Args;
	Args.NameAreaSettings = FDetailsViewArgs::HideNameArea;
	Args.bAllowSearch = false;
	Args.bShowOptions = false;
	Args.bHideSelectionTip = true;
	Args.bLockable = false;
	Args.bUpdatesFromSelection = false;
	Args.bShowScrollBar = true;
	DetailsView = PEM.CreateDetailView(Args);
	DetailsView->SetObject(Config.Get());
	DetailsView->OnFinishedChangingProperties().AddSP(
		this, &SHktSpriteVideoExtractPanel::OnAnyPropertyChanged);

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 14);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock).Font(HeaderFont)
				.Text(LOCTEXT("Title", "Stage 1 — Video → Directional Texture Bundle"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Hint",
					"동영상 1개에서 단일 방향의 프레임 시퀀스(TextureBundle)를 추출합니다. Atlas 는 만들지 않습니다 — Stage 2 (Atlas Pack) 에서 별도 처리. "
					"산출 경로: {Root}/{AnimTag}/{Direction}/frame_*.png. 8 방향이 필요하면 Direction 만 바꿔 8 회 실행. "
					"ffmpeg 경로는 Project Settings > Plugins > HKT Sprite Generator > FFmpeg Directory."))
				.AutoWrapText(true)
				.ColorAndOpacity(FSlateColor::UseSubduedForeground())
			]

			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,4)
			[
				DetailsView.ToSharedRef()
			]

			// 해석된 출력 루트 미리보기 — 사용자가 OutputDir 를 비워둔 채로
			// 어디에 산출물이 떨어지는지 즉시 확인할 수 있도록.
			+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
				[
					SNew(STextBlock).Text(LOCTEXT("ResolvedLbl", "Resolved Output Root:"))
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
				[
					SNew(STextBlock)
					.Text(this, &SHktSpriteVideoExtractPanel::GetResolvedOutputDirText)
				]
				+ SHorizontalBox::Slot().AutoWidth().Padding(8,0,0,0)
				[
					SNew(SButton)
					.Text(LOCTEXT("OpenDir", "Open"))
					.ToolTipText(LOCTEXT("OpenDirTip", "산출물 루트를 OS 파일 탐색기로 열기"))
					.OnClicked(this, &SHktSpriteVideoExtractPanel::OnOpenOutputDirClicked)
				]
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
			[
				SNew(SButton)
				.HAlign(HAlign_Center)
				.ContentPadding(FMargin(24, 8))
				.Text(LOCTEXT("Extract", "Extract TextureBundle (single direction)"))
				.OnClicked(this, &SHktSpriteVideoExtractPanel::OnExtractClicked)
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0)
			[
				SNew(SBox).MaxDesiredHeight(220.f)
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

SHktSpriteVideoExtractPanel::~SHktSpriteVideoExtractPanel()
{
	SaveConfig();
}

void SHktSpriteVideoExtractPanel::OnAnyPropertyChanged(const FPropertyChangedEvent& /*Event*/)
{
	SaveConfig();
}

void SHktSpriteVideoExtractPanel::SaveConfig()
{
	if (Config.IsValid())
	{
		Config->SaveConfig();
	}
}

FText SHktSpriteVideoExtractPanel::GetResolvedOutputDirText() const
{
	if (!Config.IsValid()) return FText::GetEmpty();
	const FString CharStr = Config->CharacterTag.IsValid() ? Config->CharacterTag.ToString() : FString();
	if (CharStr.IsEmpty())
	{
		return LOCTEXT("ResolvedNeedsTag", "<CharacterTag 를 먼저 지정하세요>");
	}
	return FText::FromString(UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharStr));
}

FReply SHktSpriteVideoExtractPanel::OnOpenOutputDirClicked()
{
	if (!Config.IsValid()) return FReply::Handled();
	const FString CharStr = Config->CharacterTag.IsValid() ? Config->CharacterTag.ToString() : FString();
	if (CharStr.IsEmpty()) return FReply::Handled();
	const FString Root = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharStr);
	if (Root.IsEmpty()) return FReply::Handled();

	IFileManager& FM = IFileManager::Get();
	FM.MakeDirectory(*Root, /*Tree*/ true);
	FPlatformProcess::ExploreFolder(*Root);
	return FReply::Handled();
}

FReply SHktSpriteVideoExtractPanel::OnExtractClicked()
{
	if (!Config.IsValid()) return FReply::Handled();

	const FString CharStr = Config->CharacterTag.IsValid() ? Config->CharacterTag.ToString() : FString();
	const FString AnimStr = Config->AnimTag.IsValid()      ? Config->AnimTag.ToString()      : FString();

	if (CharStr.IsEmpty() || AnimStr.IsEmpty() || Config->VideoPath.FilePath.IsEmpty())
	{
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(LOCTEXT("MissingInput",
				"{\"success\":false,\"error\":\"CharacterTag / AnimTag / VideoPath 필수\"}"));
		}
		return FReply::Handled();
	}

	const int32 DirIdx = static_cast<int32>(Config->Direction);
	const FString Result = UHktSpriteGeneratorFunctionLibrary::EditorExtractVideoBundle(
		CharStr, AnimStr, DirIdx,
		Config->VideoPath.FilePath,
		Config->FrameWidth, Config->FrameHeight, Config->FrameRate,
		Config->MaxFrames, Config->StartTimeSec, Config->EndTimeSec);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}

	SaveConfig();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
