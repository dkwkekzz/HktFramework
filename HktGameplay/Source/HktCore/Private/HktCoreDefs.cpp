// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreDefs.h"

namespace HktArchetypeTags
{
    // --- Entity Classification ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character, "Entity.Character", "Player character entity root tag.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_NPC, "Entity.NPC", "Generic NPC tag.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Building, "Entity.Building", "Building entity.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Projectile, "Entity.Projectile", "Projectile entity.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item, "Entity.Item", "Item entity parent tag.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Debris, "Entity.Debris", "Terrain debris entity.");
}

namespace HktStance
{
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Unarmed, "Entity.Stance.Unarmed", "비무장 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Spear,   "Entity.Stance.Spear",   "창 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Gun,     "Entity.Stance.Gun",     "총 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sword1H, "Entity.Stance.Sword1H", "한손검 스탠스");
}
