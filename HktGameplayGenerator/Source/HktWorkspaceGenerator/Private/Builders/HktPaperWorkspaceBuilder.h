// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.h"

// ============================================================================
// HktPaperWorkspaceBuilder
//
// 1) Tag entry 의 입력 anim 들을 워크스페이스 폴더에서 직접 atlas 입력으로 normalize.
//    (FrameSequence 는 워크스페이스 안 `.cache/` 폴더에 패킹된 atlas PNG 를 둔다.)
// 2) HktPaperAssetBuilder::BuildAnim 을 직접 호출해 Texture/Sprite/Flipbook/Animation 자산 생성.
// 3) StaticVisual 모드는 UHktPaperSpriteBuilderFunctionLibrary::BuildPaperStaticVisual 호출.
//
// 카테고리 빌더 인터페이스 IHkt... 패턴은 따로 두지 않음 — Paper2D / HISM 두 빌더가
// 동일 시그니처(`BuildEntry(Entry, PixelToWorld) → FHktPaperBuildResult`) 로 구성된다.
// 디스패치는 HktWorkspaceFunctionLibrary::DispatchBuild 가 카테고리 enum 으로 분기.
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
	 *  - Character   : anim 별로 워크스페이스 입력 → FAnimAtlasInput 정규화 후 BuildAnim 직접 호출.
	 *
	 * frameDuration / looping / mirror 는 워크스페이스 폴더의 `entity_meta.json`
	 * 사이드카에서 읽어 BuildAnim 인자로 적용된다.
	 */
	FHktPaperBuildResult BuildEntry(
		const FHktWorkspaceTagEntry& Entry,
		float PixelToWorld);
}
