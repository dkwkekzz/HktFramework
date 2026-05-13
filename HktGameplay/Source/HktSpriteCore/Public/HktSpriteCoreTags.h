// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// HktSpriteCore 모듈 전용 GameplayTag 선언.
//
// 캐릭터 ClassTag(=SpawnEntity classTag, FHktSpriteView::Character) 의 두 번째 세그먼트로
// 렌더링 경로를 분기한다. 각 호스트는 자신의 클레임 태그에 매칭되는 엔터티만 처리한다
// (exclusion 이 아니라 positive claim).
//
//   - `Entity.Character.Paper.{...}`   → AHktSpritePaperActor    (Paper2D, 액터당 1엔터티)
//   - `Entity.Character.Crowd.{...}`   → UHktSpriteCrowdRenderer (HISM 크라우드)
//   - `Entity.Character.Niagara.{...}` → UHktSpriteNiagaraCrowdRenderer (Niagara 크라우드)
//
// 어느 프리픽스에도 속하지 않는 `Entity.Character.{X}` 는 본 sprite 파이프라인이 무시한다
// (메쉬 액터 등 다른 비주얼 경로가 처리).
namespace HktSpriteCoreTags
{
	HKTSPRITECORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character_Paper);
	HKTSPRITECORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character_Crowd);
	HKTSPRITECORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character_Niagara);
}
