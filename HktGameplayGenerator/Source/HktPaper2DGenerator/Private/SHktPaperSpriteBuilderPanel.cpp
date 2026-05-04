// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktPaperSpriteBuilderPanel.h"

#include "HAL/FileManager.h"
#include "HktPaperSpriteBuilderFunctionLibrary.h"
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
	// Workspace 의 anim 디렉터리들을 스캔 — 각 anim 폴더 안에 atlas_{Dir}.png 가 하나라도 있으면
	// 빌드 후보로 본다. 폴더명은 SafeName 컨벤션이라 '_' 를 '.' 로 복원해 GameplayTag 추정.
	static TArray<FHktPaperBuilderAnimEntry> DiscoverConventionEntries(const FString& CharacterTagStr)
	{
		TArray<FHktPaperBuilderAnimEntry> Out;
		const FString Root = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharacterTagStr);
		if (Root.IsEmpty()) return Out;

		IFileManager& FM = IFileManager::Get();
		if (!FM.DirectoryExists(*Root)) return Out;

		TArray<FString> Dirs;
		FM.FindFiles(Dirs, *(Root / TEXT("*")), /*Files*/ false, /*Dirs*/ true);
		for (const FString& D : Dirs)
		{
			if (D.IsEmpty() || D == TEXT(".") || D == TEXT("..")) continue;

			TArray<FString> Atlases;
			FM.FindFiles(Atlases, *(Root / D / TEXT("atlas_*.png")), /*Files*/ true, /*Dirs*/ false);
			if (Atlases.IsEmpty()) continue;

			FHktPaperBuilderAnimEntry E;
			// SafeAnim ('_' 구분) → GameplayTag ('.' 구분) 복원 추정.
			E.AnimTag = FGameplayTag::RequestGameplayTag(
				FName(*D.Replace(TEXT("_"), TEXT("."))), /*ErrorIfNotFound*/ false);
			if (E.AnimTag.IsValid())
			{
				Out.Add(MoveTemp(E));
			}
		}

		return Out;
	}
}

#define LOCTEXT_NAMESPACE "HktPaperSpriteBuilder"

void SHktPaperSpriteBuilderPanel::Construct(const FArguments& InArgs)
{
	UHktPaperSpriteBuilderPanelConfig* Cfg = GetMutableDefault<UHktPaperSpriteBuilderPanelConfig>();
	Cfg->LoadConfig();
	Config = TStrongObjectPtr<UHktPaperSpriteBuilderPanelConfig>(Cfg);

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
		this, &SHktPaperSpriteBuilderPanel::OnAnyPropertyChanged);

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 14);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock).Font(HeaderFont)
				.Text(LOCTEXT("Title", "HKT Paper2D Sprite Builder"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Hint",
					"Workspace ({Saved}/SpriteGenerator/{Char}) 의 anim 폴더들을 자동 발견해 atlas PNG 를 임포트하고, "
					"UPaperSprite / UPaperFlipbook / DA_PaperCharacter_{Char} / DA_PaperVisual_{Char} 를 일괄 빌드합니다. "
					"Animations 가 비어있으면 BuildPaperCharacter 로 워크스페이스 전체를 자동 빌드합니다."))
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
				.OnClicked(this, &SHktPaperSpriteBuilderPanel::OnBuildAllClicked)
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

SHktPaperSpriteBuilderPanel::~SHktPaperSpriteBuilderPanel()
{
	SaveConfig();
}

void SHktPaperSpriteBuilderPanel::OnAnyPropertyChanged(const FPropertyChangedEvent& /*Event*/)
{
	SaveConfig();
}

void SHktPaperSpriteBuilderPanel::SaveConfig()
{
	if (Config.IsValid())
	{
		Config->SaveConfig();
	}
}

FReply SHktPaperSpriteBuilderPanel::OnBuildAllClicked()
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

	const FString VisualIdentTagStr = Config->VisualIdentifierTag.IsValid()
		? Config->VisualIdentifierTag.ToString() : FString();
	const FString OutputDir = Config->OutputDir; // 비어있으면 builder 가 기본 루트 채움
	const float P2W = (Config->PixelToWorld > 0.0f) ? Config->PixelToWorld : 2.0f;
	const bool  bMirror = Config->bMirrorWestFromEast;

	// Animations 비어있으면 BuildPaperCharacter 한 번에 — 워크스페이스 자동 스캔이 빌더 내부에서 수행된다.
	if (Config->Animations.Num() == 0)
	{
		const FString Result = UHktPaperSpriteBuilderFunctionLibrary::BuildPaperCharacter(
			CharacterTagStr, VisualIdentTagStr, P2W, OutputDir);
		if (ResultBox.IsValid())
		{
			ResultBox->SetText(FText::FromString(
				FString::Printf(TEXT("BuildPaperCharacter %s [auto-discovered]\n\n%s"),
					*CharacterTagStr, *Result)));
		}
		SaveConfig();
		return FReply::Handled();
	}

	// 명시 anim 항목들을 순차로 BuildPaperSpriteAnim 호출.
	FString Aggregate;
	int32 OkCount = 0;
	for (int32 Idx = 0; Idx < Config->Animations.Num(); ++Idx)
	{
		const FHktPaperBuilderAnimEntry& E = Config->Animations[Idx];

		const FString AnimTagStr = E.AnimTag.IsValid() ? E.AnimTag.ToString() : FString();
		if (AnimTagStr.IsEmpty())
		{
			Aggregate += FString::Printf(TEXT("[%d] SKIP: AnimTag 비어있음\n"), Idx);
			continue;
		}

		const FString OneResult = UHktPaperSpriteBuilderFunctionLibrary::BuildPaperSpriteAnim(
			CharacterTagStr,
			AnimTagStr,
			FMath::Max(0, E.CellWidth),
			FMath::Max(0, E.CellHeight),
			P2W,
			(E.FrameDurationMs > 0.f) ? E.FrameDurationMs : 100.f,
			E.bLooping,
			bMirror,
			VisualIdentTagStr,
			OutputDir);

		Aggregate += FString::Printf(TEXT("[%d] %s → %s\n"), Idx, *AnimTagStr, *OneResult);
		if (OneResult.Contains(TEXT("\"success\":true"))) ++OkCount;
	}

	const FString Header = FString::Printf(
		TEXT("Built %d / %d animations for %s\n\n"),
		OkCount, Config->Animations.Num(), *CharacterTagStr);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Header + Aggregate));
	}

	SaveConfig();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
