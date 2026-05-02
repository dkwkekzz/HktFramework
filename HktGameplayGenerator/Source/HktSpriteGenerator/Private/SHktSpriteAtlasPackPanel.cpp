// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteAtlasPackPanel.h"

#include "HktSpriteAtlasPackPanelConfig.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "IDetailsView.h"
#include "Modules/ModuleManager.h"
#include "PropertyEditorModule.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteAtlasPack"

void SHktSpriteAtlasPackPanel::Construct(const FArguments& /*InArgs*/)
{
	UHktSpriteAtlasPackPanelConfig* Cfg = GetMutableDefault<UHktSpriteAtlasPackPanelConfig>();
	Cfg->LoadConfig();
	Config = TStrongObjectPtr<UHktSpriteAtlasPackPanelConfig>(Cfg);

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
		this, &SHktSpriteAtlasPackPanel::OnAnyPropertyChanged);

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 14);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock).Font(HeaderFont)
				.Text(LOCTEXT("Title", "Stage 2 — Pack Directional Atlases"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Hint",
					"Stage 1 이 만든 {Char}/{Anim}/{Dir}/frame_*.png 들을 스캔해 방향별 strip atlas PNG 를 Workspace 안에 생성합니다. "
					"AnimTagFilter 를 비우면 캐릭터 하위 전체를 일괄 처리. "
					"UE 임포트는 하지 않고 atlas_{Dir}.png + atlas_meta.json 만 만든다 — Stage 3 (Sprite Builder) 가 빌드 시점에 임포트."))
				.AutoWrapText(true)
				.ColorAndOpacity(FSlateColor::UseSubduedForeground())
			]

			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,4)
			[
				DetailsView.ToSharedRef()
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
			[
				SNew(SButton)
				.HAlign(HAlign_Center)
				.ContentPadding(FMargin(24, 8))
				.Text(LOCTEXT("Pack", "Pack Directional Atlases"))
				.OnClicked(this, &SHktSpriteAtlasPackPanel::OnPackClicked)
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0)
			[
				SNew(SBox).MaxDesiredHeight(280.f)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
						.IsReadOnly(true)
						.AllowMultiLine(true)
						.HintText(LOCTEXT("ResHint", "패킹 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];
}

SHktSpriteAtlasPackPanel::~SHktSpriteAtlasPackPanel()
{
	SaveConfig();
}

void SHktSpriteAtlasPackPanel::OnAnyPropertyChanged(const FPropertyChangedEvent& /*Event*/)
{
	SaveConfig();
}

void SHktSpriteAtlasPackPanel::SaveConfig()
{
	if (Config.IsValid()) Config->SaveConfig();
}

FReply SHktSpriteAtlasPackPanel::OnPackClicked()
{
	if (!Config.IsValid()) return FReply::Handled();

	const FString CharStr   = Config->CharacterTag.IsValid() ? Config->CharacterTag.ToString() : FString();
	const FString FilterStr = Config->AnimTagFilter.IsValid() ? Config->AnimTagFilter.ToString() : FString();

	if (CharStr.IsEmpty())
	{
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(LOCTEXT("MissingChar",
				"{\"success\":false,\"error\":\"CharacterTag 필수\"}"));
		}
		return FReply::Handled();
	}

	const FString Result = UHktSpriteGeneratorFunctionLibrary::EditorPackDirectionalAtlases(
		CharStr, FilterStr);

	if (ResultBox.IsValid()) ResultBox->SetText(FText::FromString(Result));
	SaveConfig();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
