// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktAnimCaptureScene.h"
#include "HktAnimCaptureTypes.h"
#include "Styling/SlateBrush.h"
#include "Widgets/SCompoundWidget.h"

class SEditableTextBox;
class SImage;
class SMultiLineEditableTextBox;

/**
 * SHktAnimCapturePanel — 에디터 단독 애니메이션 캡처 UI.
 *
 *  - SkeletalMesh / AnimSequence Asset Picker
 *  - 카메라 프리셋(RtsView/ShoulderView/IsometricOrtho/IsometricGame/Custom)
 *  - 출력 해상도, 방향 수(1·4·8), 프레임 수, FPS, 시작/끝 시간
 *  - 디스크 출력 폴더 / UE Content 출력 경로 / PixelToWorld / 프레임 duration
 *  - 자동 크롭, 패딩, 투명 배경
 *  - "Capture" 버튼 → UHktAnimCaptureFunctionLibrary::CaptureAnimation 호출
 *  - 결과 JSON 을 로그 패널에 출력
 *
 * 콘솔 커맨드 `HktSprite.AnimCapture` 로 탭 오픈.
 */
class SHktAnimCapturePanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktAnimCapturePanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktAnimCapturePanel() override;

private:
	FReply OnBrowseDiskOutputDir();
	FReply OnCaptureClicked();
	FReply OnRefreshPreviewClicked();
	FReply OnPrevDirectionClicked();
	FReply OnNextDirectionClicked();

	void OnPlayPauseChanged(ECheckBoxState NewState);
	EActiveTimerReturnType TickPreview(double InCurrentTime, float InDeltaTime);

	void RebuildPreviewScene();
	void DestroyPreviewScene();

	void OnSkeletalMeshChanged(const FAssetData& Asset);
	void OnAnimSequenceChanged(const FAssetData& Asset);
	void OnCameraModeClassChanged(const UClass* NewClass);

	FString GetSkeletalMeshPath() const;
	FString GetAnimSequencePath() const;
	const UClass* GetCameraModeClass() const;

	void RebuildSettingsFromUI();
	void ApplyPresetToCustomFields(EHktAnimCaptureCameraPreset Preset);

	// 위젯 핸들 ===========================================================
	TSharedPtr<SEditableTextBox> CharacterTagBox;
	TSharedPtr<SEditableTextBox> ActionIdBox;
	TSharedPtr<SEditableTextBox> DiskOutDirBox;
	TSharedPtr<SEditableTextBox> AssetOutDirBox;

	TSharedPtr<SEditableTextBox> WidthBox;
	TSharedPtr<SEditableTextBox> HeightBox;
	TSharedPtr<SEditableTextBox> NumDirBox;
	TSharedPtr<SEditableTextBox> FrameCountBox;
	TSharedPtr<SEditableTextBox> FpsBox;
	TSharedPtr<SEditableTextBox> StartTimeBox;
	TSharedPtr<SEditableTextBox> EndTimeBox;

	TSharedPtr<SEditableTextBox> PitchBox;
	TSharedPtr<SEditableTextBox> FovBox;
	TSharedPtr<SEditableTextBox> OrthoWidthBox;
	TSharedPtr<SEditableTextBox> ArmLengthBox;
	TSharedPtr<SEditableTextBox> YawOffsetBox;

	TSharedPtr<SEditableTextBox> PixelToWorldBox;
	TSharedPtr<SEditableTextBox> FrameDurationBox;
	TSharedPtr<SEditableTextBox> CropPaddingBox;

	TSharedPtr<SMultiLineEditableTextBox> ResultBox;

	// === Preview =========================================================
	TSharedPtr<SImage> PreviewImage;
	TSharedPtr<FSlateBrush> PreviewBrush;
	TSharedPtr<class STextBlock> PreviewStatusText;
	TSharedPtr<class FActiveTimerHandle> PreviewTimerHandle;

	// 캡처 씬을 그대로 프리뷰에도 사용 — 카메라/프레이밍 = 캡처 결과와 1:1.
	TUniquePtr<FHktAnimCaptureScene> PreviewScene;

	bool bPreviewPlaying = true;
	float PreviewTimeSec = 0.0f;
	int32 PreviewDirectionIdx = 0;

	// 상태 ===============================================================
	FHktAnimCaptureSettings Settings;
};
