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
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Natural, "Entity.Natural", "자연 entity 부모 태그 — 자식: Birch/Oak/... ClassTag 매칭으로 Natural archetype 자동 할당. Hittable + Spatial 보유 → BasicAttack 으로 베기 가능.");

    // --- Spawner ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Spawner, "Entity.Spawner", "Spawner entity — voxel-attribution 의 slot-key 단위로 lazy create. SpawnerSlotKey 컬럼이 lookup 키.");
}

namespace HktStance
{
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Unarmed, "Entity.Stance.Unarmed", "비무장 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Spear,   "Entity.Stance.Spear",   "창 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Gun,     "Entity.Stance.Gun",     "총 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sword1H, "Entity.Stance.Sword1H", "한손검 스탠스");
}
