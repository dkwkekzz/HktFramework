// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

// ============================================================================
// HktSpriteBillboardMaterialBuilder — Editor 전용 머티리얼 에셋 빌더
//
// `HktSpriteCore`가 런타임에 로드하는 기본 Y-axis 빌보드 머티리얼(`UMaterial`)을
// 실제 `.uasset`으로 구성·저장한다. 저장 위치는 `HktSpriteBillboardMaterial`의
// 상수(`PackagePath`)를 그대로 따른다 — 디스크: `HktGameplay/Content/Materials/
// M_HktSpriteYBillboard.uasset`.
//
// 호출 경로:
//  1. `HktSpriteGeneratorModule::StartupModule()`에서 `OnPostEngineInit`에 훅을
//     걸어 최초 1회 체크·생성(에셋 없을 때만).
//  2. 콘솔 명령 `HktSprite.BuildBillboardMaterial`로 강제 재생성 가능.
//
// Shipping 빌드에는 포함되지 않는다 — 이 TU 전체가 Editor 전용.
// ============================================================================

namespace HktSpriteBillboardMaterialBuilder
{
	/**
	 * 에셋을 빌드해 디스크에 저장한다.
	 * @param bForceOverwrite  true면 기존 에셋이 있어도 덮어쓴다.
	 * @return 생성/기존 머티리얼 포인터 (실패 시 nullptr).
	 */
	UMaterialInterface* BuildAndSave(bool bForceOverwrite = false);

	/** 저장된 에셋이 디스크에 존재하는지 여부. */
	bool Exists();
}
