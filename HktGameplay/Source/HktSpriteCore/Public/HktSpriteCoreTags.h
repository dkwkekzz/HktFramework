// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// HktSpriteCore 모듈 전용 GameplayTag 선언.
//
// 캐릭터 ClassTag(=SpawnEntity classTag, FHktSpriteView::Character) 의 네이밍
// 컨벤션으로 렌더링 경로를 분기한다.
//   - `Entity.Character.Paper.{Name}.{Variant}` → Paper2D 경로 (AHktSpritePaperActor)
//   - 그 외 `Entity.Character.*`               → HISM/Niagara 크라우드 경로
namespace HktSpriteCoreTags
{
	// Paper2D 경로 캐릭터 루트. 본 태그 하위 엔터티는 AHktSpritePaperActor 가 처리하며,
	// HISM/Niagara 크라우드 렌더러는 dispatch 단계에서 무시한다.
	HKTSPRITECORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character_Paper);
}
