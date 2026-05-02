// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktSpriteAtlasPackPanelConfig.h"
#include "UObject/StrongObjectPtr.h"
#include "Widgets/SCompoundWidget.h"

class IDetailsView;
class SMultiLineEditableTextBox;

/**
 * SHktSpriteAtlasPackPanel
 *
 * Stage 2 — 방향별 TextureBundle 들을 스캔해 방향별 Atlas PNG + UE Texture2D 를 일괄 생성.
 *
 * 입력: CharacterTag (필수) + AnimTagFilter(옵션) + 셀 크기 강제(옵션) + OutputDir.
 * 산출: {OutputDir}/T_SpriteAtlas_{SafeChar}_{SafeAnim}_{Dir}  (Stage 3 가 자동 수집)
 *
 * 사용 흐름: Stage 1 (Video Extract) 로 8 방향의 frame bundle 을 만든 뒤 본 패널에서 한 번에 패킹.
 */
class SHktSpriteAtlasPackPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteAtlasPackPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktSpriteAtlasPackPanel() override;

private:
	FReply OnPackClicked();

	void OnAnyPropertyChanged(const struct FPropertyChangedEvent& Event);
	void SaveConfig();

	TStrongObjectPtr<UHktSpriteAtlasPackPanelConfig> Config;
	TSharedPtr<IDetailsView> DetailsView;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
