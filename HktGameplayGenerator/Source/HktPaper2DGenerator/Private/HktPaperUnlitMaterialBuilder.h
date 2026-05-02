// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

namespace HktPaperUnlitMaterialBuilder
{
	/** 기본 Paper2D Unlit 머티리얼 자산이 디스크에 존재하는지 확인. */
	bool Exists();

	/**
	 * `M_HktPaperUnlit` 자산을 빌드해 `/HktGameplay/Materials/` 에 저장한다.
	 *  - bForceOverwrite=false 이면 자산이 이미 존재할 때 스킵하고 로드만.
	 *  - bForceOverwrite=true 이면 항상 새로 만든다.
	 */
	UMaterialInterface* BuildAndSave(bool bForceOverwrite);
}
