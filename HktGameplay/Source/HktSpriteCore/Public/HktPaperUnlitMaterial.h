// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

// ============================================================================
// HktPaperUnlitMaterial — Paper2D 경로 디폴트 Unlit 머티리얼 런타임 로더.
//
// `AHktSpritePaperActor` (PR-2) 가 `UPaperFlipbookComponent::SetMaterial` 또는
// `UPaperSprite::Material` 로 사용한다.
//
// 실물 `UMaterial` 에셋: /HktGameplay/Materials/M_HktPaperUnlit
//   → 디스크: HktGameplay/Content/Materials/M_HktPaperUnlit.uasset
//   → 빌더: HktPaper2DGenerator(Editor) — `HktPaperSprite.BuildUnlitMaterial`.
//   → 모듈 startup 시 자동 체크·생성. 없으면 엔진 기본 머티리얼로 폴백.
//
// 머티리얼 특성:
//   - Shading Model = Unlit, Blend Mode = Masked, OpacityMaskClipValue = 0.5
//   - Two Sided = true
//   - bUsedWithSprite = true (Paper2D 호환 필수 플래그)
//   - BaseColor   = ParticleColor.RGB * SpriteTexture.RGB  (`Texture` 파라미터)
//   - OpacityMask = SpriteTexture.A   * ParticleColor.A
//   → Tint 는 `UPaperFlipbookComponent::SetSpriteColor` 가 ParticleColor 로 자동 바인딩.
// ============================================================================

namespace HktPaperUnlitMaterial
{
	/** Paper2D 텍스처 파라미터 이름 — UE 표준 sprite 머티리얼과 동일. */
	HKTSPRITECORE_API extern const FName TextureParamName;

	/** 기본 머티리얼 에셋 패키지 경로 (롱 패키지 네임). */
	HKTSPRITECORE_API extern const TCHAR* PackagePath;

	/** 기본 머티리얼 에셋 오브젝트 경로 (LoadObject 인자). */
	HKTSPRITECORE_API extern const TCHAR* AssetObjectPath;

	/** 기본 머티리얼 오브젝트 이름. */
	HKTSPRITECORE_API extern const TCHAR* MaterialName;

	/** 디폴트 Paper2D Unlit 머티리얼을 로드해 반환(캐시됨). 실패 시 엔진 기본. */
	HKTSPRITECORE_API UMaterialInterface* GetDefault();
}
