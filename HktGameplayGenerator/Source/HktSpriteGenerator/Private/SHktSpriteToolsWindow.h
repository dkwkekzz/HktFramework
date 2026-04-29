// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SWidgetSwitcher;

/**
 * SHktSpriteToolsWindow — HktSprite 관련 모든 에디터 기능을 하나의 창에 통합한 탭 패널.
 *
 * 탭 구성:
 *   1) Builder       — UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim 단일 진입점.
 *                       Source Type(Video/Atlas/TextureBundle) 별로 입력을 동적으로 노출.
 *   2) Anim Capture  — SkeletalMesh/AnimSequence 8-방향 캡처 패널 (기존 SHktAnimCapturePanel).
 *   3) Video Tools   — EditorExtractVideoFrames (ffmpeg 동영상 → PNG 시퀀스).
 *   4) Terrain Atlas — EditorBuildTerrainAtlasFromBundle (33-frame 1D strip).
 *   5) MCP JSON      — McpBuildSpriteCharacter (raw JSON 사양 직접 빌드).
 *
 * 콘솔 커맨드 `HktSprite.Tools` 로 탭 오픈. 기존 `HktSprite.Builder` /
 * `HktSprite.AnimCapture` 명령은 호환성을 위해 같은 창의 해당 탭으로 점프한다.
 */
class SHktSpriteToolsWindow : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktSpriteToolsWindow)
		: _InitialTabIndex(0)
	{}
		SLATE_ARGUMENT(int32, InitialTabIndex)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	// 외부(콘솔 명령 등)에서 활성 탭 전환.
	void SelectTab(int32 Index);

	// 탭 인덱스 — 콘솔 커맨드와 매핑. 변경 시 BuildTabBar / Construct 도 함께 업데이트.
	enum class ETabId : int32
	{
		Builder = 0,
		AnimCapture = 1,
		VideoExtract = 2,
		TerrainAtlas = 3,
		McpJson = 4,
		Count
	};

private:
	TSharedRef<SWidget> BuildTabBar();
	void OnTabSelected(int32 Index);

	TSharedPtr<SWidgetSwitcher> TabSwitcher;
	int32 ActiveTabIndex = 0;
};
