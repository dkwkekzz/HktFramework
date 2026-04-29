// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SEditableTextBox;
class SMultiLineEditableTextBox;

/**
 * SHktSpriteTerrainAtlasPanel — UHktSpriteGeneratorFunctionLibrary::EditorBuildTerrainAtlasFromBundle 전용 UI.
 *
 * 33-frame 1D 가로 strip 테레인 아틀라스를 폴더에서 빌드.
 * 파일명 stem 이 HktTerrainType 와 일치해야 함 — 예: "Grass.png" → idx 1.
 */
class SHktSpriteTerrainAtlasPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteTerrainAtlasPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	FReply OnBrowseInputDir();
	FReply OnBuildClicked();

	TSharedPtr<SEditableTextBox> InputDirBox;
	TSharedPtr<SEditableTextBox> OutputAssetBox;
	TSharedPtr<SEditableTextBox> ForcedFrameSizeBox;

	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
