// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteToolsWindow.h"

#include "SHktAnimCapturePanel.h"
#include "SHktSpriteAtlasPackPanel.h"
#include "SHktSpriteBuilderPanel.h"
#include "SHktSpriteMcpJsonPanel.h"
#include "SHktSpriteTerrainAtlasPanel.h"
#include "SHktSpriteVideoExtractPanel.h"

#include "Widgets/Input/SButton.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SSeparator.h"
#include "Widgets/Layout/SWidgetSwitcher.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteTools"

namespace HktSpriteToolsPrivate
{
	struct FTabDef
	{
		FText Label;
		FText Tooltip;
	};

	static const TArray<FTabDef>& GetTabDefs()
	{
		static const TArray<FTabDef> Defs = {
			{ LOCTEXT("Tab_Builder",      "Sprite Builder"),
			  LOCTEXT("TabTip_Builder",   "Stage 3 — BuildSpriteAnim 단일 진입점 (Video/Atlas/TextureBundle/DirectionalAtlas)") },
			{ LOCTEXT("Tab_AnimCap",      "Anim Capture"),
			  LOCTEXT("TabTip_AnimCap",   "SkeletalMesh + AnimSequence → 8방향 캡처") },
			{ LOCTEXT("Tab_VideoExtract", "Video Extract"),
			  LOCTEXT("TabTip_VideoExtract", "Stage 1 — 동영상 → 단일 방향 TextureBundle (atlas 미생성)") },
			{ LOCTEXT("Tab_AtlasPack",    "Atlas Pack"),
			  LOCTEXT("TabTip_AtlasPack", "Stage 2 — 방향별 TextureBundle → 방향별 Atlas PNG/Texture2D") },
			{ LOCTEXT("Tab_TerrainAtlas", "Terrain Atlas"),
			  LOCTEXT("TabTip_TerrainAtlas", "33-frame 1D strip 테레인 아틀라스 빌드") },
			{ LOCTEXT("Tab_McpJson",      "MCP JSON"),
			  LOCTEXT("TabTip_McpJson",   "McpBuildSpriteCharacter — 직접 JSON 사양 입력") },
		};
		return Defs;
	}
}

void SHktSpriteToolsWindow::Construct(const FArguments& InArgs)
{
	using namespace HktSpriteToolsPrivate;

	TabSwitcher = SNew(SWidgetSwitcher);

	// 탭 순서는 ETabId 와 GetTabDefs() 순서를 일치시킨다.
	TabSwitcher->AddSlot()[ SNew(SHktSpriteBuilderPanel) ];
	TabSwitcher->AddSlot()[ SNew(SHktAnimCapturePanel) ];
	TabSwitcher->AddSlot()[ SNew(SHktSpriteVideoExtractPanel) ];
	TabSwitcher->AddSlot()[ SNew(SHktSpriteAtlasPackPanel) ];
	TabSwitcher->AddSlot()[ SNew(SHktSpriteTerrainAtlasPanel) ];
	TabSwitcher->AddSlot()[ SNew(SHktSpriteMcpJsonPanel) ];

	ChildSlot
	[
		SNew(SVerticalBox)

		+ SVerticalBox::Slot().AutoHeight().Padding(8, 8, 8, 4)
		[
			SNew(STextBlock)
			.Text(LOCTEXT("WindowTitle", "HKT Sprite Tools"))
			.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
		]

		+ SVerticalBox::Slot().AutoHeight().Padding(8, 0, 8, 4)
		[
			SNew(STextBlock)
			.Text(LOCTEXT("WindowSubtitle",
				"Sprite 관련 모든 에디터 도구를 하나의 창에 통합. 좌측 탭으로 기능 전환."))
			.AutoWrapText(true)
			.ColorAndOpacity(FSlateColor::UseSubduedForeground())
		]

		+ SVerticalBox::Slot().AutoHeight().Padding(8, 0)
		[ SNew(SSeparator) ]

		+ SVerticalBox::Slot().AutoHeight().Padding(8, 6)
		[ BuildTabBar() ]

		+ SVerticalBox::Slot().AutoHeight().Padding(8, 0)
		[ SNew(SSeparator) ]

		+ SVerticalBox::Slot().FillHeight(1.f).Padding(0)
		[ TabSwitcher.ToSharedRef() ]
	];

	const int32 InitIdx = FMath::Clamp(
		InArgs._InitialTabIndex, 0, static_cast<int32>(ETabId::Count) - 1);
	OnTabSelected(InitIdx);
}

void SHktSpriteToolsWindow::SelectTab(int32 Index)
{
	OnTabSelected(Index);
}

TSharedRef<SWidget> SHktSpriteToolsWindow::BuildTabBar()
{
	using namespace HktSpriteToolsPrivate;

	TSharedRef<SHorizontalBox> Bar = SNew(SHorizontalBox);
	const TArray<FTabDef>& Defs = GetTabDefs();
	for (int32 i = 0; i < Defs.Num(); ++i)
	{
		const int32 Index = i;
		Bar->AddSlot().AutoWidth().Padding(0, 0, 4, 0)
		[
			SNew(SButton)
			.Text(Defs[i].Label)
			.ToolTipText(Defs[i].Tooltip)
			.ContentPadding(FMargin(12, 4))
			.OnClicked_Lambda([this, Index]() {
				OnTabSelected(Index);
				return FReply::Handled();
			})
			.ButtonColorAndOpacity_Lambda([this, Index]() -> FLinearColor {
				return (Index == ActiveTabIndex)
					? FLinearColor(0.2f, 0.4f, 0.8f, 1.0f)
					: FLinearColor(0.15f, 0.15f, 0.15f, 1.0f);
			})
		];
	}
	return Bar;
}

void SHktSpriteToolsWindow::OnTabSelected(int32 Index)
{
	ActiveTabIndex = FMath::Clamp(Index, 0, static_cast<int32>(ETabId::Count) - 1);
	if (TabSwitcher.IsValid())
	{
		TabSwitcher->SetActiveWidgetIndex(ActiveTabIndex);
	}
}

#undef LOCTEXT_NAMESPACE
