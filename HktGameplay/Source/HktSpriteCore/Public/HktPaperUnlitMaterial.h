// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

// ============================================================================
// HktPaperUnlitMaterial — Paper2D 경로 디폴트 머티리얼 런타임 로더.
//
// `AHktSpritePaperActor` (PR-2) 가 `UPaperFlipbookComponent::SetMaterial` 로 사용한다.
//
// 엔진 기본 Paper2D 머티리얼(`/Paper2D/MaskedUnlitSpriteMaterial`) 을 그대로
// 사용한다 — Unlit / Masked / TwoSided / bUsedWithSprite + ParticleColor × Texture
// 가 정확히 본 경로 요구사항과 일치하므로 커스텀 빌드 불필요.
//
// 미래에 PaletteIndex 등 커스텀 파라미터가 필요해지면 본 헤더의 경로 상수만
// 교체하고 별도 빌더 모듈을 추가한다 (PR-3).
// ============================================================================

namespace HktPaperUnlitMaterial
{
	/** Paper2D 텍스처 파라미터 이름 — UE 표준 sprite 머티리얼과 동일. */
	HKTSPRITECORE_API extern const FName TextureParamName;

	/** 디폴트 Paper2D 머티리얼 — 엔진 Paper2D 플러그인 기본 자산. */
	HKTSPRITECORE_API extern const TCHAR* AssetObjectPath;

	/** 디폴트 Paper2D 머티리얼을 로드해 반환(캐시됨). 실패 시 엔진 기본 Surface 머티리얼. */
	HKTSPRITECORE_API UMaterialInterface* GetDefault();
}
