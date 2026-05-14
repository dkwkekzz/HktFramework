// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreTags.h"

namespace HktNaturalActionTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Fell,    "Action.Natural.Fell",    "Player intent: fell a tree (axe + frontal arc + reach).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Harvest, "Action.Natural.Harvest", "Player intent: harvest a cluster (berry/herb) at close range.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Pluck,   "Action.Natural.Pluck",   "Player intent: pluck a water-adjacent plant (reed/lily).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Eat,     "Action.Natural.Eat",     "Player intent: eat an inventory item (mushroom).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Ignite,  "Action.Natural.Ignite",  "Player intent: ignite a flammable cell/line (grass/pine slope).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Mine,    "Action.Natural.Mine",    "Player intent: mine a boulder or ore outcrop (pickaxe + reach).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Cross,   "Action.Natural.Cross",   "Implicit positional intent: cross a ford cell (auto-fired on feet straddle).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Drink,   "Action.Natural.Drink",   "Player intent: drink from a spring (container or direct).");
}

namespace HktNaturalEventTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(TreeFelled,           "Event.Natural.TreeFelled",           "Tree-felling sequence completed (router output of Action.Natural.Fell).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BerryHarvested,       "Event.Natural.BerryHarvested",       "Berry cluster harvested (router output of Action.Natural.Harvest).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(HerbCollected,        "Event.Natural.HerbCollected",        "Herb consumed by player (autonomous variant of Harvest — spawner story dispatches by target).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(AquaticPlucked,       "Event.Natural.AquaticPlucked",       "Reed / waterlily plucked (router output of Action.Natural.Pluck).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(MushroomEaten,        "Event.Natural.MushroomEaten",        "Mushroom variant consumed (router output of Action.Natural.Eat).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(FireIgnited,          "Event.Natural.FireIgnited",          "Flammable cell ignited (router output of Action.Natural.Ignite).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BoulderBroken,        "Event.Natural.BoulderBroken",        "Boulder shattered (autonomous variant of Mine — spawner story dispatches by target).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(OreMined,             "Event.Natural.OreMined",             "Ore outcrop unit mined (router output of Action.Natural.Mine).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(SpringDrank,          "Event.Natural.SpringDrank",          "Spring water consumed (router output of Action.Natural.Drink).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(FordCrossed,          "Event.Natural.FordCrossed",          "Ford cell crossed (router output of Action.Natural.Cross).");
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
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Birch,        "Entity.Natural.Birch",        "Birch tree — Implementation-Plan §6.1 demo. Spawned by chunk-load spawner; felled by Action.Natural.Fell.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Branch,       "Entity.Natural.Branch",       "Branch — TreeFelled 시 drop 되는 재료 엔티티.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BirchSapling, "Entity.Natural.BirchSapling", "BirchSapling — SaplingSeed 시드로 spawn 되는 묘목.");
}

namespace HktRegionEventTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(SaplingSeed, "Event.Region.SaplingSeed", "TreeFelled 리스너가 자기-전파로 디스패치하는 묘목 시드 이벤트.");
}

namespace HktNaturalStoryTags
{
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(BirchSpawn, "Story.Flow.Spawner.Natural.Birch", "Birch chunk-load spawner story. TerrainSpawnerView.StoryTag 매칭.");
}
