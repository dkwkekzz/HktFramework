// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.h"
#include "Builders/HktPaperWorkspaceBuilder.h"  // FHktPaperBuildResult 재사용 — 산출 자산 경로/노트 컨테이너

// ============================================================================
// HktHISMWorkspaceBuilder
//
// Workspace 의 `HISM/{Tag}/...` 트리를 HISM/Niagara 렌더 경로 자산으로 빌드.
// Paper2D 빌더와 동일한 디렉터리 컨벤션(atlas / FrameSequence / StaticVisual)을 따르고,
// 산출은 기존 HktSpriteGenerator 의 두 진입점에 위임한다:
//
//   - Character    : 각 anim 의 방향별 atlas PNG 를 legacy SpriteGenerator 워크스페이스
//                    경로(`{Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_{Dir}.png`) 로
//                    bridging 한 뒤 `UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim` 호출.
//                    → `UHktHISMSpriteVisualAsset` + `UHktHISMSpriteAnimationDataAsset` 생성.
//   - StaticVisual : `EditorBuildHISMStaticVisual` 호출 → `UHktHISMSpriteVisualAsset`.
//
// 결과 컨테이너는 Paper 빌더와 동일한 FHktPaperBuildResult 재사용 — 호출자(Dispatcher)
// 입장에서는 카테고리에 상관없이 동일한 후처리(manifest 갱신) 가능.
// ============================================================================
namespace HktHISMWorkspaceBuilder
{
	FHktPaperBuildResult BuildEntry(
		const FHktWorkspaceTagEntry& Entry,
		float PixelToWorld);
}
