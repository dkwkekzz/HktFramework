// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SEditableTextBox;
class SMultiLineEditableTextBox;

/**
 * SHktSpriteVideoExtractPanel — UHktSpriteGeneratorFunctionLibrary::EditorExtractVideoFrames 전용 UI.
 *
 * 동영상 → ffmpeg → PNG 시퀀스만 추출하고 끝낸다 (DataAsset 빌드 없음).
 * 패킹/캐릭터 생성까지 한 번에 하려면 Sprite Builder 탭의 Video 모드를 사용한다.
 */
class SHktSpriteVideoExtractPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteVideoExtractPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	FReply OnBrowseVideoPath();
	FReply OnBrowseOutputDir();
	FReply OnExtractClicked();

	TSharedPtr<SEditableTextBox> VideoPathBox;
	TSharedPtr<SEditableTextBox> OutputDirBox;
	TSharedPtr<SEditableTextBox> FrameWidthBox;
	TSharedPtr<SEditableTextBox> FrameHeightBox;
	TSharedPtr<SEditableTextBox> FrameRateBox;
	TSharedPtr<SEditableTextBox> MaxFramesBox;
	TSharedPtr<SEditableTextBox> StartTimeBox;
	TSharedPtr<SEditableTextBox> EndTimeBox;

	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
