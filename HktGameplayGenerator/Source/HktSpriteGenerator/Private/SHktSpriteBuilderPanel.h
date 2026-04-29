// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "Widgets/SCompoundWidget.h"

class SEditableTextBox;
class SMultiLineEditableTextBox;
class STextBlock;

template <typename T> class SComboBox;

/**
 * SHktSpriteBuilderPanel — UHktSpriteGeneratorFunctionLibrary 의 빌더 API 통합 UI.
 *
 * 모드:
 *   - **Auto (BuildSpriteAnim)** — 단일 진입점. SourceType 만 골라 CharacterTag/AnimTag/SourcePath 로 빌드.
 *   - **Atlas (Low-level)**     — EditorBuildSpriteCharacterFromAtlas. UE 텍스처 자산 경로 + 셀 크기.
 *   - **Directory (Low-level)** — EditorBuildSpriteCharacterFromDirectory. 이미지 폴더 패킹.
 *   - **Video (Low-level)**     — EditorBuildSpriteCharacterFromVideo. ffmpeg 추출 → 패킹 → DataAsset.
 *
 * 모드별로 유효한 입력만 동적으로 활성화된다.
 */
class SHktSpriteBuilderPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteBuilderPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	enum class EBuilderMode : uint8
	{
		Auto = 0,           // BuildSpriteAnim
		Atlas,              // EditorBuildSpriteCharacterFromAtlas
		Directory,          // EditorBuildSpriteCharacterFromDirectory
		Video,              // EditorBuildSpriteCharacterFromVideo
	};

private:
	// 모드별 입력 가시성 토글.
	bool IsModeAuto()      const { return CurrentMode == EBuilderMode::Auto; }
	bool IsModeAtlas()     const { return CurrentMode == EBuilderMode::Atlas; }
	bool IsModeDirectory() const { return CurrentMode == EBuilderMode::Directory; }
	bool IsModeVideo()     const { return CurrentMode == EBuilderMode::Video; }

	// === 입력 가시성 헬퍼 ===
	// AnimTag: Auto / Atlas 모드에서 노출 (Atlas API 가 AnimTagStr 파라미터를 받음).
	EVisibility GetAnimTagVisibility() const;
	// CellSize: Auto / Atlas 모드. Auto+Bundle/Video 는 0=auto, Atlas 는 필수.
	EVisibility GetCellSizeVisibility() const;
	// Looping/Mirror/FrameDuration: Low-level 전용 (Auto 는 BuildSpriteAnim 이 자동 추론).
	EVisibility GetLowLevelOnlyVisibility() const;
	// Video Low-level 전용 (FrameRate / MaxFrames / Start/End / ActionId).
	EVisibility GetVideoLowLevelVisibility() const;

	// 액션.
	FReply OnBrowseSourcePath();
	FReply OnBuildClicked();

	// 헬퍼.
	FString GetSourceHintText() const;
	FString RunBuild() const;

	// 모드 전환.
	void OnModeChanged(TSharedPtr<EBuilderMode> NewMode, ESelectInfo::Type Info);
	FText GetCurrentModeText() const;
	void OnSourceTypeChanged(TSharedPtr<EHktSpriteSourceType> NewType, ESelectInfo::Type Info);
	FText GetCurrentSourceTypeText() const;

	// 위젯 ===============================================================
	TSharedPtr<SComboBox<TSharedPtr<EBuilderMode>>>          ModeCombo;
	TSharedPtr<SComboBox<TSharedPtr<EHktSpriteSourceType>>>  SourceTypeCombo;

	TSharedPtr<SEditableTextBox> CharTagBox;
	TSharedPtr<SEditableTextBox> AnimTagBox;
	TSharedPtr<SEditableTextBox> SourcePathBox;
	TSharedPtr<SEditableTextBox> OutputDirBox;
	TSharedPtr<SEditableTextBox> CellWidthBox;
	TSharedPtr<SEditableTextBox> CellHeightBox;
	TSharedPtr<SEditableTextBox> PixelToWorldBox;
	TSharedPtr<SEditableTextBox> FrameDurationBox;

	// Video low-level 전용.
	TSharedPtr<SEditableTextBox> ActionIdBox;
	TSharedPtr<SEditableTextBox> FrameRateBox;
	TSharedPtr<SEditableTextBox> MaxFramesBox;
	TSharedPtr<SEditableTextBox> StartTimeBox;
	TSharedPtr<SEditableTextBox> EndTimeBox;

	TSharedPtr<SMultiLineEditableTextBox> ResultBox;

	// 상태 ===============================================================
	EBuilderMode             CurrentMode       = EBuilderMode::Auto;
	EHktSpriteSourceType     CurrentSourceType = EHktSpriteSourceType::TextureBundle;

	bool bLooping             = true;
	bool bMirrorWestFromEast  = true;
};
