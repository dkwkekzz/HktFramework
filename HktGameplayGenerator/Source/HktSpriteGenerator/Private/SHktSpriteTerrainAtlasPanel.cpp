// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteTerrainAtlasPanel.h"

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
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteTerrainAtlas"

namespace HktSpriteTerrainAtlasPrivate
{
	static TSharedRef<SWidget> MakeRow(const FText& Label, TSharedRef<SWidget> Field)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(180.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	}
}

void SHktSpriteTerrainAtlasPanel::Construct(const FArguments& InArgs)
{
	using namespace HktSpriteTerrainAtlasPrivate;

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
					.Text(LOCTEXT("Title", "Terrain Atlas Builder"))
					.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("Hint",
						"33-frame 1D 가로 strip 테레인 아틀라스(T_HktSpriteTerrainAtlas) 빌드. "
						"파일명 stem 이 HktTerrainType 의 이름과 일치해야 함 (예: Grass.png → idx 1, OreVoidstone.png → idx 32). "
						"누락 프레임과 Air(idx 0)는 투명 처리. SubUV 는 (1/33, 1)."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("InLbl", "Input Directory"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(InputDirBox, SEditableTextBox)
						.HintText(LOCTEXT("InHint", "D:/Bundles/Terrain/Iso")) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton)
						.Text(LOCTEXT("Browse", "Browse..."))
						.OnClicked(this, &SHktSpriteTerrainAtlasPanel::OnBrowseInputDir) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("OutLbl", "Output Asset Path"),
					SAssignNew(OutputAssetBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("/Game/Generated/Terrain/T_HktSpriteTerrainAtlas")))
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("FSLbl", "Forced Frame Size (0=auto)"),
					SAssignNew(ForcedFrameSizeBox, SEditableTextBox)
						.Text(FText::FromString(TEXT("128")))
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.ContentPadding(FMargin(24,6))
					.Text(LOCTEXT("Build", "Build Terrain Atlas"))
					.OnClicked(this, &SHktSpriteTerrainAtlasPanel::OnBuildClicked)
				]

				+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResHint", "빌드 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];
}

FReply SHktSpriteTerrainAtlasPanel::OnBrowseInputDir()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = InputDirBox.IsValid() ? InputDirBox->GetText().ToString() : FString();
	FString OutPath;
	const bool bOK = DP->OpenDirectoryDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Terrain Bundle Directory"),
		Current.IsEmpty() ? FPaths::ProjectDir() : Current,
		OutPath);
	if (bOK && InputDirBox.IsValid())
	{
		InputDirBox->SetText(FText::FromString(OutPath));
	}
	return FReply::Handled();
}

FReply SHktSpriteTerrainAtlasPanel::OnBuildClicked()
{
	auto Str = [](const TSharedPtr<SEditableTextBox>& B) -> FString
		{ return B.IsValid() ? B->GetText().ToString() : FString(); };
	auto Int = [&](const TSharedPtr<SEditableTextBox>& B, int32 Def) -> int32
		{ const FString S = Str(B); return S.IsEmpty() ? Def : FCString::Atoi(*S); };

	const FString InputDir = Str(InputDirBox);
	const FString OutAsset = Str(OutputAssetBox).IsEmpty()
		? FString(TEXT("/Game/Generated/Terrain/T_HktSpriteTerrainAtlas"))
		: Str(OutputAssetBox);
	const int32   ForcedFrameSize = Int(ForcedFrameSizeBox, 128);

	const FString Result = UHktSpriteGeneratorFunctionLibrary::EditorBuildTerrainAtlasFromBundle(
		InputDir, OutAsset, ForcedFrameSize);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
