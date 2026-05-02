// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SMultiLineEditableTextBox;

/**
 * SHktSpriteMcpJsonPanel — UHktSpriteGeneratorFunctionLibrary::McpBuildSpriteCharacter 전용 UI.
 *
 * MCP Python 호환 JSON 사양을 직접 입력하여 McpBuildSpriteCharacter 호출.
 * 디버깅/스크립트 디스패치용 — 일반 사용자는 Sprite Builder 탭 사용.
 */
class SHktSpriteMcpJsonPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteMcpJsonPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	FReply OnInsertSampleClicked();
	FReply OnBuildClicked();

	TSharedPtr<SMultiLineEditableTextBox> JsonBox;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
