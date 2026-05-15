// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.h"

// ============================================================================
// HktPaperWorkspaceBuilder
//
// 1) Tag entry 의 입력 anim 들을 legacy `{Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}`
//    워크스페이스로 normalize (Atlas/FrameSequence/Video 모두 atlas_{Dir}.png 까지 만들어 둠).
// 2) UHktPaperSpriteBuilderFunctionLibrary::BuildPaperCharacter 또는
//    BuildPaperStaticVisual 을 호출해 실제 자산 생성.
//
// 카테고리 빌더 인터페이스 IHkt... 패턴은 따로 두지 않음 — 1차 범위가 Paper2D 단일이고
// HISM 은 미구현(인터페이스 폭만 잡아둠). 추후 추가 시 공통 부모 추출 검토.
// ============================================================================
struct FHktPaperBuildResult
{
	bool bSuccess = false;
	FString Error;

	/** 산출 UE 자산 패키지 경로들 (Template/Visual/Sprite/Flipbook/Atlas). */
	TArray<FString> OutputAssetPaths;

	/** anim 별 normalize 노트 (디버깅용). */
	TArray<FString> Notes;
};

namespace HktPaperWorkspaceBuilder
{
	/**
	 * Tag entry 를 통째로 빌드. Character/StaticVisual 두 모드 모두 처리.
	 *  - StaticVisual: BuildPaperStaticVisual 1회.
	 *  - Character   : 모든 anim 을 legacy workspace 로 정규화 후 BuildPaperCharacter 호출.
	 *
	 * frameDuration / looping / mirror 는 워크스페이스 폴더의 `character_meta.json`
	 * 사이드카에서 읽어 BuildPaperCharacter 가 적용한다.
	 */
	FHktPaperBuildResult BuildEntry(
		const FHktWorkspaceTagEntry& Entry,
		float PixelToWorld);
}
