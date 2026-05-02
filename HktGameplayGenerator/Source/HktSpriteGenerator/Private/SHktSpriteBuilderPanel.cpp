// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteBuilderPanel.h"

#include "HAL/FileManager.h"
#include "HktSpriteBuilderPanelConfig.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "IDetailsView.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "PropertyEditorModule.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
	// Workspace 의 anim 디렉터리들을 스캔해 자동 채움.
	// 각 anim 폴더 안에 atlas_{Dir}.png (Stage 2 산출) 가 하나라도 있으면 빌드 대상으로 본다.
	static TArray<FHktSpriteBuilderAnimEntry> DiscoverConventionEntries(const FString& CharacterTagStr)
	{
		TArray<FHktSpriteBuilderAnimEntry> Out;
		const FString Root = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharacterTagStr);
		if (Root.IsEmpty()) return Out;

		IFileManager& FM = IFileManager::Get();
		if (!FM.DirectoryExists(*Root)) return Out;

		TArray<FString> Dirs;
		FM.FindFiles(Dirs, *(Root / TEXT("*")), /*Files*/ false, /*Dirs*/ true);
		for (const FString& D : Dirs)
		{
			if (D.IsEmpty() || D == TEXT(".") || D == TEXT("..")) continue;

			// atlas_*.png 가 하나라도 있어야 빌드 후보 — Stage 2 산출 검증.
			TArray<FString> Atlases;
			FM.FindFiles(Atlases, *(Root / D / TEXT("atlas_*.png")), /*Files*/ true, /*Dirs*/ false);
			if (Atlases.IsEmpty()) continue;

			FHktSpriteBuilderAnimEntry E;
			E.AnimTag = FGameplayTag::RequestGameplayTag(FName(*D.Replace(TEXT("_"), TEXT("."))), /*ErrorIfNotFound*/ false);
			if (E.AnimTag.IsValid())
			{
				Out.Add(MoveTemp(E));
			}
		}

		return Out;
	}
}

#define LOCTEXT_NAMESPACE "HktSpriteBuilder"

void SHktSpriteBuilderPanel::Construct(const FArguments& InArgs)
{
	// CDO 를 직접 사용 — 엔진이 root 로 잡고 있어 GC 안전.
	UHktSpriteBuilderPanelConfig* Cfg = GetMutableDefault<UHktSpriteBuilderPanelConfig>();
	Cfg->LoadConfig();
	Config = TStrongObjectPtr<UHktSpriteBuilderPanelConfig>(Cfg);

	// IDetailsView — UPROPERTY(EditAnywhere) 모든 필드를 자동 그림. FGameplayTag 는
	// GameplayTagsEditor 의 PropertyTypeCustomization 으로 표준 태그 피커가 적용.
	// Animations 배열은 ± 버튼으로 추가/제거.
	FPropertyEditorModule& PEM = FModuleManager::LoadModuleChecked<FPropertyEditorModule>(TEXT("PropertyEditor"));
	FDetailsViewArgs Args;
	Args.NameAreaSettings = FDetailsViewArgs::HideNameArea;
	Args.bAllowSearch = false;
	Args.bShowOptions = false;
	Args.bHideSelectionTip = true;
	Args.bLockable = false;
	Args.bUpdatesFromSelection = false;
	// IDetailsView 자체 스크롤바를 그대로 사용 — SScrollBox 로 한 번 더 감싸지 않음.
	Args.bShowScrollBar = true;
	DetailsView = PEM.CreateDetailView(Args);
	DetailsView->SetObject(Config.Get());
	// 어떤 필드가 변경되더라도 즉시 INI 에 저장 — 사용자의 마지막 입력이 항상 보존.
	// AddSP 는 SCompoundWidget 의 SharedFromThis 를 weak 로 잡아 라이프타임 안전.
	DetailsView->OnFinishedChangingProperties().AddSP(
		this, &SHktSpriteBuilderPanel::OnAnyPropertyChanged);

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
					"Workspace ({Saved}/SpriteGenerator/{Char}) 의 anim 폴더들을 자동 발견해 atlas PNG 를 즉석 임포트 후 "
					"DA_SpriteCharacter_{Char} 에 누적합니다. Animations 가 비어있으면 모든 anim 자동, "
					"채워두면 그 항목들의 셀 크기로 빌드 (CellWidth/Height=0 → meta.json/aspect 자동 추론)."))
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
				.Text(LOCTEXT("BuildAll", "Build All"))
				.OnClicked(this, &SHktSpriteBuilderPanel::OnBuildAllClicked)
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,0)
			[
				SNew(SBox).MaxDesiredHeight(220.f)
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

SHktSpriteBuilderPanel::~SHktSpriteBuilderPanel()
{
	// 패널이 닫힐 때도 한 번 더 저장 — IDetailsView 콜백을 놓친 마지막 변경 방지.
	SaveConfig();
}

void SHktSpriteBuilderPanel::OnAnyPropertyChanged(const FPropertyChangedEvent& /*Event*/)
{
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

	// Animations 가 비어있으면 VideoExtract 가 만든 규약 경로
	// ({Saved}/SpriteGenerator/{CharacterTag}) 를 스캔해 자동 채움.
	// 사용자가 같은 CharacterTag 만 맞추면 추가 입력 없이 바로 Build All 이 동작.
	TArray<FHktSpriteBuilderAnimEntry> Discovered;
	const TArray<FHktSpriteBuilderAnimEntry>* AnimSource = &Config->Animations;
	if (Config->Animations.Num() == 0)
	{
		Discovered = DiscoverConventionEntries(CharacterTagStr);
		AnimSource = &Discovered;
	}

	if (AnimSource->Num() == 0)
	{
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(LOCTEXT("NoAnims",
				"{\"success\":false,\"error\":\"Animations 가 비어있고, 규약 경로({Saved}/SpriteGenerator/{CharacterTag}) 산출물도 없습니다 — VideoExtract 를 먼저 실행하거나 Animations 를 추가하세요\"}"));
		}
		return FReply::Handled();
	}

	const float P2W = (Config->PixelToWorld > 0.0f) ? Config->PixelToWorld : 2.0f;

	// 각 애니메이션을 순차로 BuildSpriteAnim 호출. 각 결과 JSON 을 한 줄씩 모아 표시.
	FString Aggregate;
	int32 OkCount = 0;
	for (int32 Idx = 0; Idx < AnimSource->Num(); ++Idx)
	{
		const FHktSpriteBuilderAnimEntry& E = (*AnimSource)[Idx];

		const FString AnimTagStr = E.AnimTag.IsValid() ? E.AnimTag.ToString() : FString();
		if (AnimTagStr.IsEmpty())
		{
			Aggregate += FString::Printf(TEXT("[%d] SKIP: AnimTag 비어있음\n"), Idx);
			continue;
		}

		const FString OneResult = UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
			CharacterTagStr,
			AnimTagStr,
			FMath::Max(0, E.CellWidth),
			FMath::Max(0, E.CellHeight),
			P2W);

		Aggregate += FString::Printf(TEXT("[%d] %s → %s\n"), Idx, *AnimTagStr, *OneResult);
		if (OneResult.Contains(TEXT("\"success\":true"))) ++OkCount;
	}

	const TCHAR* SourceLabel = (AnimSource == &Discovered) ? TEXT(" [auto-discovered]") : TEXT("");
	const FString Header = FString::Printf(
		TEXT("Built %d / %d animations for %s%s\n\n"),
		OkCount, AnimSource->Num(), *CharacterTagStr, SourceLabel);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Header + Aggregate));
	}

	// 빌드 후에도 마지막 상태 저장 — 사용자가 다시 열었을 때 동일한 입력을 만난다.
	SaveConfig();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
