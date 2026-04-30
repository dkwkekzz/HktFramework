// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "UObject/StrongObjectPtr.h"
#include "Widgets/SCompoundWidget.h"

class IDetailsView;
class SMultiLineEditableTextBox;
class UHktSpriteBuilderPanelConfig;

/**
 * SHktSpriteBuilderPanel
 *
 * 캐릭터 1명 단위로 여러 애니메이션을 한 번에 등록하는 빌더 UI.
 *
 * 구조:
 *   - 공통(Common): CharacterTag / OutputDir / PixelToWorld — 모든 애니가 공유
 *   - 애니메이션 목록(Animations): TArray<FHktSpriteBuilderAnimEntry>
 *       각 엔트리 = AnimTag + SourceType + SourcePath + CellW/H
 *   - "Build All" 버튼 — 위에서 아래로 BuildSpriteAnim 반복 호출
 *
 * 모든 입력은 UE 표준 IDetailsView 로 그려진다 — FGameplayTag 피커, enum 콤보,
 * 파일 경로, 배열 ± 버튼이 자동 제공되며 UPROPERTY(Config) 직렬화로 다음 세션에
 * 그대로 복원된다(= 사용자의 마지막 입력 보존).
 */
class SHktSpriteBuilderPanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteBuilderPanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktSpriteBuilderPanel() override;

private:
	FReply OnBuildAllClicked();

	// Config 가 직접 SaveConfig 를 가지고 있어 영구 저장은 호출 한 줄.
	void SaveConfig();

	TStrongObjectPtr<UHktSpriteBuilderPanelConfig> Config;
	TSharedPtr<IDetailsView> DetailsView;
	TSharedPtr<SMultiLineEditableTextBox> ResultBox;
};
