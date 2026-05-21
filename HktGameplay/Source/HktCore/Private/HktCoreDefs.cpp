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
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Region, "Entity.Region", "Virtual region entity — region 카운터 (PR-2) 의 SoA row 보유.");

    // --- Region Record (PR-3, 04 §3-D4) ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_RegionRecord,            "Entity.RegionRecord",            "Region 안의 키별 record entity 의 부모 태그.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_RegionRecord_Lineage,    "Entity.RegionRecord.Lineage",    "Oak/Birch 가계 record — LineageId 별 누적 (felled / promoted / Elder pos).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_RegionRecord_Variant,    "Entity.RegionRecord.Variant",    "Mushroom/Herb 등의 변종 record — VariantId 별 (potency, first found frame).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_RegionRecord_OreSpecies, "Entity.RegionRecord.OreSpecies", "Ore 광종 record — OreSpeciesId 별 depletion / 현재 종.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_RegionRecord_VoxelSlot,  "Entity.RegionRecord.VoxelSlot",  "Voxel-slot 단위 spawner dedupe record — RecordKey = SlotHash31 (Param2). 한 voxel 위치당 alive 여부 + 마지막 사망 frame 을 기록.");
}

namespace HktStance
{
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Unarmed, "Entity.Stance.Unarmed", "비무장 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Spear,   "Entity.Stance.Spear",   "창 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Gun,     "Entity.Stance.Gun",     "총 스탠스");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sword1H, "Entity.Stance.Sword1H", "한손검 스탠스");
}
