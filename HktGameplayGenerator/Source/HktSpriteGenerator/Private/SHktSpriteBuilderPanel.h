// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SEditableTextBox;
class SMultiLineEditableTextBox;
class STextBlock;

/**
 * SHktSpriteBuilderPanel — 에디터 단독 Sprite Part 빌더 UI.
 *
 *  - Tag / Slot / Input Directory / Output Dir / PixelToWorld / FrameDurationMs /
 *    Looping / MirrorWestFromEast 필드 제공
 *  - "Build" 버튼 → UHktSpriteGeneratorFunctionLibrary::EditorBuildSpritePartFromDirectory 호출
 *  - 결과 JSON을 로그 영역에 출력
 *
 * 콘솔 커맨드 `HktSprite.Builder` 로 탭 오픈.
 */
class SHktSpriteBuilderPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteBuilderPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	FReply OnBrowseInputDir();
	FReply OnBuildClicked();

	TSharedPtr<SEditableTextBox> TagBox;
	TSharedPtr<SEditableTextBox> InputDirBox;
	TSharedPtr<SEditableTextBox> OutputDirBox;
	TSharedPtr<SEditableTextBox> PixelToWorldBox;
	TSharedPtr<SEditableTextBox> FrameDurationBox;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;

	TSharedPtr<FString> CurrentSlot;
	TArray<TSharedPtr<FString>> SlotOptions;

	bool bLooping = true;
	bool bMirrorWestFromEast = true;
};
