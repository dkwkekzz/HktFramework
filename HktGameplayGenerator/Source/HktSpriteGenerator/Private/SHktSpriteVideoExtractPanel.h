// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/StrongObjectPtr.h"
#include "Widgets/SCompoundWidget.h"

class IDetailsView;
class SMultiLineEditableTextBox;
class UHktSpriteVideoExtractPanelConfig;

/**
 * SHktSpriteVideoExtractPanel
 *
 * 동영상 → 프레임 추출 + Atlas 패킹 전용 UI.
 *
 * 산출물:
 *   - TextureBundle 폴더: {OutputDir}/{AnimTag}/frame_*.png
 *   - Atlas PNG:        {OutputDir}/{AnimTag}_atlas.png
 *
 * OutputDir 가 비어있으면 기본값은 {ProjectSavedDir}/SpriteGenerator/{CharacterTag}.
 * SpriteBuilder 의 BuildSpriteAnim 도 동일 규칙으로 SourcePath 를 자동 해석하므로,
 * 사용자는 같은 CharacterTag 만 입력하면 별도 경로 입력 없이 SpriteBuilder 에서
 * DataAsset 을 즉시 빌드할 수 있다.
 *
 * UI 는 IDetailsView 한 장 + Extract 버튼 + 결과 박스로 단순화. FGameplayTag 피커,
 * FFilePath / FDirectoryPath Browse, 숫자 입력은 모두 UE 표준이 자동 제공.
 */
class SHktSpriteVideoExtractPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteVideoExtractPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktSpriteVideoExtractPanel() override;

private:
	FReply OnExtractClicked();
	FReply OnOpenOutputDirClicked();

	void OnAnyPropertyChanged(const struct FPropertyChangedEvent& Event);
	void SaveConfig();

	// 현재 Config 기반의 산출물 루트 경로 미리보기 — UI 에 표시.
	FText GetResolvedOutputDirText() const;

	TStrongObjectPtr<UHktSpriteVideoExtractPanelConfig> Config;
	TSharedPtr<IDetailsView> DetailsView;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
