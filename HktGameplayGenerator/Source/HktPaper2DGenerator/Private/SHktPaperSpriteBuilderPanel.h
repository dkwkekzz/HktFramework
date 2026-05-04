// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktPaperSpriteBuilderPanelConfig.h"
#include "UObject/StrongObjectPtr.h"
#include "Widgets/SCompoundWidget.h"

class IDetailsView;
class SMultiLineEditableTextBox;

/**
 * SHktPaperSpriteBuilderPanel
 *
 * `SHktSpriteBuilderPanel` 의 Paper2D 미러 — Workspace 의 atlas_{Dir}.png 들을 임포트해
 * UPaperSprite / UPaperFlipbook / `UHktPaperCharacterTemplate` / `UHktPaperActorVisualDataAsset` 을 빌드한다.
 *
 * 구조:
 *   - 공통(Common): CharacterTag / VisualIdentifierTag / PixelToWorld / bMirrorWestFromEast / OutputDir
 *   - 애니메이션 목록(Animations): TArray<FHktPaperBuilderAnimEntry>
 *       각 엔트리 = AnimTag + (CellW/H, FrameDurationMs, bLooping)
 *   - "Build All" 버튼 — 위에서 아래로 BuildPaperSpriteAnim 반복 호출.
 *     Animations 가 비어있으면 BuildPaperCharacter 로 워크스페이스 자동 발견.
 *
 * UPROPERTY(Config) 직렬화로 다음 세션에 그대로 복원된다.
 */
class SHktPaperSpriteBuilderPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktPaperSpriteBuilderPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktPaperSpriteBuilderPanel() override;

private:
	FReply OnBuildAllClicked();

	void OnAnyPropertyChanged(const struct FPropertyChangedEvent& Event);
	void SaveConfig();

	TStrongObjectPtr<UHktPaperSpriteBuilderPanelConfig> Config;
	TSharedPtr<IDetailsView> DetailsView;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
