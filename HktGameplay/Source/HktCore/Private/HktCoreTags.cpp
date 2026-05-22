// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreTags.h"

namespace HktNaturalEventTags
{
    // 시뮬 이벤트 (나무 베기는 별도 이벤트 0 — BasicAttack 누적 → State.Dead → TreeLifecycle).
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BerryHarvested,       "Event.Natural.BerryHarvested",       "Berry cluster harvested (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(HerbCollected,        "Event.Natural.HerbCollected",        "Herb consumed by player (autonomous variant of Harvest — spawner story dispatches by target).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(AquaticPlucked,       "Event.Natural.AquaticPlucked",       "Reed / waterlily plucked (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(MushroomEaten,        "Event.Natural.MushroomEaten",        "Mushroom variant consumed (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(FireIgnited,          "Event.Natural.FireIgnited",          "Flammable cell ignited (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BoulderBroken,        "Event.Natural.BoulderBroken",        "Boulder shattered (autonomous variant of Mine — spawner story dispatches by target).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OreMined,             "Event.Natural.OreMined",             "Ore outcrop unit mined (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(SpringDrank,          "Event.Natural.SpringDrank",          "Spring water consumed (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(FordCrossed,          "Event.Natural.FordCrossed",          "Ford cell crossed (client-emitted; VM precondition validates).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(TrailEndpointReached, "Event.Natural.TrailEndpointReached", "Animal trail endpoint reached (autonomous — fired by positional system).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(PeakReached,          "Event.Natural.PeakReached",          "Peak summit reached (autonomous — fired by positional system).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(GrainObserved,        "Event.Natural.GrainObserved",        "Wind-grain pattern observed at grass endpoint (autonomous — side effect of harvest/herb events).");
}

namespace HktToolTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Axe,       "Entity.Tool.Axe",       "Felling tool (required by Fell).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Pickaxe,   "Entity.Tool.Pickaxe",   "Mining tool (required by Mine).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tinder,    "Entity.Tool.Tinder",    "Flint-and-steel-like ignition source (required by Ignite).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Container, "Entity.Tool.Container", "Liquid container (optional for Drink — buff scaling).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Torch,     "Entity.Tool.Torch",     "Open-flame ignition source (alternate trigger for Ignite).");
}

namespace HktMaterialTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Wood,      "Material.Wood",      "Wooden tool tier.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Stone,     "Material.Stone",     "Stone tool tier.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sharpened, "Material.Sharpened", "Sharpened-edge tool tier (above stone, below bronze).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Bronze,    "Material.Bronze",    "Bronze tool tier.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Flint,     "Material.Flint",     "Flint material (used with Tinder for spark).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Cup,       "Material.Cup",       "Cup material (Container subset for Drink).");
}

namespace HktNaturalEntityTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Birch,        "Entity.Natural.Birch",        "Birch tree — Natural archetype (Hittable). 우클릭 → BasicAttack 누적 → State.Dead → TreeLifecycle.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Branch,       "Entity.Natural.Branch",       "Branch — TreeLifecycle 가 사망 시 drop 하는 재료 엔티티.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BirchSapling, "Entity.Natural.BirchSapling", "BirchSapling — SaplingSeed 시드로 spawn 되는 묘목.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Oak,          "Entity.Natural.Oak",          "Oak tree — Implementation-Plan §6.2 / S02 lineage demo. Grove 중심 + 자식 N 본 배치.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OakElder,     "Entity.Natural.OakElder",     "Oak Elder — grove 중심 노목. 베이면 출신 spawner 의 SpawnerDeathCount +1.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OakSapling,   "Entity.Natural.OakSapling",   "OakSapling — OakSaplingSeed 시드로 spawn. 향후 Elder 로 promotion 후보.");
}

namespace HktSaplingSeedEventTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(SaplingSeed,    "Event.Natural.SaplingSeed",    "Birch Lifecycle 가 사망 시 디스패치하는 묘목 시드 이벤트.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OakSaplingSeed, "Event.Natural.OakSaplingSeed", "Oak Lifecycle 가 사망 시 디스패치하는 Oak 묘목 시드 이벤트 (Param2=SpawnerSlotKey 보존).");
}

namespace HktSpawnerTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Root, "Story.Flow.Spawner", "모든 spawner story 의 공통 root. VMBuildSystem 백프레셔가 본 root 로 계층 매칭하여 풀 포화 시 spawner 류를 우선 drop.");
}

namespace HktNaturalStoryTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BirchSpawn, "Story.Flow.Spawner.Natural.Birch", "Birch voxel-attribution spawner — voxel-slot dedupe + 사망 후 쿨다운 (Entity.Spawner).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OakSpawn,   "Story.Flow.Spawner.Natural.Oak",   "Oak grove spawner — Elder + 3 child, spawner DeathCount 누적. Voxel-slot dedupe 미적용 (후속 PR).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(SlimeSpawn, "Story.Flow.Spawner.Natural.Slime", "Slime voxel-attribution spawner — voxel-slot dedupe + 사망 후 쿨다운 (Entity.Spawner).");
}

