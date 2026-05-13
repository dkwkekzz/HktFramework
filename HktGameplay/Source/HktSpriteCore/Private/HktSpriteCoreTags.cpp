// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCoreTags.h"

namespace HktSpriteCoreTags
{
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character_Paper,
		"Entity.Character.Paper",
		"Paper2D 경로 캐릭터 루트 — AHktSpritePaperActor 가 엔터티당 1액터로 처리.");

	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character_Crowd,
		"Entity.Character.Crowd",
		"HISM 크라우드 캐릭터 루트 — UHktSpriteCrowdRenderer 가 처리.");

	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character_Niagara,
		"Entity.Character.Niagara",
		"Niagara 크라우드 캐릭터 루트 — UHktSpriteNiagaraCrowdRenderer 가 처리.");
}
