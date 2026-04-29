// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktSpriteMcpJsonPanel.h"

#include "HktSpriteGeneratorFunctionLibrary.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktSpriteMcpJson"

namespace HktSpriteMcpJsonPrivate
{
	static const TCHAR* SampleJson =
		TEXT("{\n")
		TEXT("  \"characterTag\": \"Sprite.Character.Knight\",\n")
		TEXT("  \"atlasPngPath\": \"D:/path/to/packed_atlas.png\",\n")
		TEXT("  \"cellW\": 64,\n")
		TEXT("  \"cellH\": 64,\n")
		TEXT("  \"pixelToWorld\": 2.0,\n")
		TEXT("  \"outputDir\": \"/Game/Generated/Sprites\",\n")
		TEXT("  \"defaultAnimTag\": \"Anim.FullBody.Locomotion.Idle\",\n")
		TEXT("  \"animations\": [\n")
		TEXT("    {\n")
		TEXT("      \"animTag\": \"Anim.FullBody.Locomotion.Idle\",\n")
		TEXT("      \"numDirections\": 8,\n")
		TEXT("      \"framesPerDirection\": 4,\n")
		TEXT("      \"pivotX\": 32, \"pivotY\": 64,\n")
		TEXT("      \"frameDurationMs\": 100,\n")
		TEXT("      \"looping\": true,\n")
		TEXT("      \"mirrorWestFromEast\": true\n")
		TEXT("    }\n")
		TEXT("  ]\n")
		TEXT("}\n");
}

void SHktSpriteMcpJsonPanel::Construct(const FArguments& InArgs)
{
	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Title", "MCP JSON Spec → Build"))
				.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Hint",
					"McpBuildSpriteCharacter 와 동일한 JSON 사양을 직접 입력. "
					"디버깅/스크립트 디스패치용 — 일반 사용자는 Sprite Builder 탭 사용."))
				.AutoWrapText(true)
				.ColorAndOpacity(FSlateColor::UseSubduedForeground())
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,8,0)
				[
					SNew(SButton)
					.Text(LOCTEXT("Sample", "Insert Sample"))
					.OnClicked(this, &SHktSpriteMcpJsonPanel::OnInsertSampleClicked)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(SButton)
					.Text(LOCTEXT("Build", "Build"))
					.ContentPadding(FMargin(20,4))
					.OnClicked(this, &SHktSpriteMcpJsonPanel::OnBuildClicked)
				]
			]

			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,4)
			[
				SAssignNew(JsonBox, SMultiLineEditableTextBox)
				.AllowMultiLine(true)
				.HintText(LOCTEXT("JsonHint",
					"{ \"characterTag\": \"Sprite.Character.Knight\", \"atlasPngPath\": ..., \"animations\": [...] }"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(0,4,0,2)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("ResultLbl", "Result"))
				.Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
			]

			+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,0,0,0)
			[
				SAssignNew(ResultBox, SMultiLineEditableTextBox)
				.IsReadOnly(true)
				.AllowMultiLine(true)
				.HintText(LOCTEXT("ResHint", "빌드 결과 JSON 이 여기 표시됩니다"))
			]
		]
	];
}

FReply SHktSpriteMcpJsonPanel::OnInsertSampleClicked()
{
	if (JsonBox.IsValid())
	{
		JsonBox->SetText(FText::FromString(HktSpriteMcpJsonPrivate::SampleJson));
	}
	return FReply::Handled();
}

FReply SHktSpriteMcpJsonPanel::OnBuildClicked()
{
	const FString JsonStr = JsonBox.IsValid() ? JsonBox->GetText().ToString() : FString();
	const FString Result = UHktSpriteGeneratorFunctionLibrary::McpBuildSpriteCharacter(JsonStr);

	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
