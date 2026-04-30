// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteBuilderPanel.h"

#include "HktSpriteBuilderPanelConfig.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "IDetailsView.h"
#include "Modules/ModuleManager.h"
#include "PropertyEditorModule.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteBuilder"

void SHktSpriteBuilderPanel::Construct(const FArguments& InArgs)
{
	// CDO 를 직접 사용 — Config UObject 라이프타임을 길게 가져가도 안전.
	UHktSpriteBuilderPanelConfig* Cfg = GetMutableDefault<UHktSpriteBuilderPanelConfig>();
	Cfg->LoadConfig();
	Config = TStrongObjectPtr<UHktSpriteBuilderPanelConfig>(Cfg);

	// IDetailsView — UE 표준 디테일 패널. UPROPERTY(EditAnywhere) 모든 필드를 자동으로
	// 그리며, FGameplayTag 는 GameplayTagsEditor 가 등록한 PropertyTypeCustomization
	// 으로 표준 태그 피커가 자동 적용된다. Animations 배열은 ± 버튼으로 추가/제거.
	FPropertyEditorModule& PEM = FModuleManager::LoadModuleChecked<FPropertyEditorModule>(TEXT("PropertyEditor"));
	FDetailsViewArgs Args;
	Args.NameAreaSettings = FDetailsViewArgs::HideNameArea;
	Args.bAllowSearch = false;
	Args.bShowOptions = false;
	Args.bShowScrollBar = false;
	Args.bHideSelectionTip = true;
	Args.bLockable = false;
	Args.bUpdatesFromSelection = false;
	DetailsView = PEM.CreateDetailView(Args);
	DetailsView->SetObject(Config.Get());
	// 어떤 필드가 변경되더라도 즉시 INI 에 저장 — 사용자의 마지막 입력이 항상 보존되게.
	DetailsView->OnFinishedChangingProperties().AddLambda(
		[this](const FPropertyChangedEvent&) { SaveConfig(); });

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 14);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock).Font(HeaderFont)
				.Text(LOCTEXT("Title", "HKT Sprite Builder"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Hint",
					"한 캐릭터(CharacterTag)에 여러 애니메이션을 한 번에 누적 빌드합니다. "
					"Common 영역에서 공통 설정을, Animations 배열에서 각 애니의 태그/재료/셀 크기를 지정. "
					"Build All 클릭 시 위에서 아래로 BuildSpriteAnim 을 반복 호출합니다."))
				.AutoWrapText(true)
				.ColorAndOpacity(FSlateColor::UseSubduedForeground())
			]

			// 디테일 뷰 — 스크롤 가능한 영역에 넣어 항목이 많아도 안전.
			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,4)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					DetailsView.ToSharedRef()
				]
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,12,0,4)
			[
				SNew(SButton)
				.HAlign(HAlign_Center)
				.ContentPadding(FMargin(24, 8))
				.Text(LOCTEXT("BuildAll", "Build All"))
				.OnClicked(this, &SHktSpriteBuilderPanel::OnBuildAllClicked)
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0).MaxHeight(220.f)
			[
				SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResultHint", "빌드 결과 JSON 이 여기 표시됩니다"))
			]
		]
	];
}

SHktSpriteBuilderPanel::~SHktSpriteBuilderPanel()
{
	// 패널이 닫힐 때도 한 번 더 저장 — IDetailsView 콜백을 놓친 마지막 변경 방지.
	SaveConfig();
}

void SHktSpriteBuilderPanel::SaveConfig()
{
	if (Config.IsValid())
	{
		Config->SaveConfig();
	}
}

FReply SHktSpriteBuilderPanel::OnBuildAllClicked()
{
	if (!Config.IsValid())
	{
		return FReply::Handled();
	}

	const FString CharacterTagStr = Config->CharacterTag.IsValid() ? Config->CharacterTag.ToString() : FString();
	if (CharacterTagStr.IsEmpty())
	{
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(LOCTEXT("NoCharTag", "{\"success\":false,\"error\":\"CharacterTag 가 비어있습니다\"}"));
		}
		return FReply::Handled();
	}

	if (Config->Animations.Num() == 0)
	{
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(LOCTEXT("NoAnims", "{\"success\":false,\"error\":\"Animations 가 비어있습니다 — 한 개 이상 추가하세요\"}"));
		}
		return FReply::Handled();
	}

	const FString OutputDir = Config->OutputDir.IsEmpty() ? TEXT("/Game/Generated/Sprites") : Config->OutputDir;
	const float   P2W       = (Config->PixelToWorld > 0.0f) ? Config->PixelToWorld : 2.0f;

	// 각 애니메이션을 순차로 BuildSpriteAnim 호출. 각 결과 JSON 을 한 줄씩 모아 표시.
	FString Aggregate;
	int32 OkCount = 0;
	for (int32 Idx = 0; Idx < Config->Animations.Num(); ++Idx)
	{
		const FHktSpriteBuilderAnimEntry& E = Config->Animations[Idx];

		const FString AnimTagStr = E.AnimTag.IsValid() ? E.AnimTag.ToString() : FString();
		if (AnimTagStr.IsEmpty() || E.SourcePath.IsEmpty())
		{
			Aggregate += FString::Printf(TEXT("[%d] SKIP: AnimTag/SourcePath 비어있음\n"), Idx);
			continue;
		}

		const FString OneResult = UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
			CharacterTagStr,
			AnimTagStr,
			E.SourcePath,
			E.SourceType,
			E.CellWidth,
			E.CellHeight,
			P2W,
			OutputDir);

		Aggregate += FString::Printf(TEXT("[%d] %s → %s\n"), Idx, *AnimTagStr, *OneResult);
		// 결과 JSON 에 "success":true 가 있으면 ok 로 카운트.
		if (OneResult.Contains(TEXT("\"success\":true"))) ++OkCount;
	}

	const FString Header = FString::Printf(
		TEXT("Built %d / %d animations for %s\n\n"),
		OkCount, Config->Animations.Num(), *CharacterTagStr);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Header + Aggregate));
	}

	// 빌드 후에도 마지막 상태 저장 — 사용자가 다시 열었을 때 동일한 입력을 만난다.
	SaveConfig();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
