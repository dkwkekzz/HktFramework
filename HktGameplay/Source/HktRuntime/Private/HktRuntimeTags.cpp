#include "HktRuntimeTags.h"

namespace HktGameplayTags
{
    // --- Story IDs used by Runtime ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Event_Item_Drop, "Story.Event.Item.Drop", "Item drop intent event.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_PlayerInWorld, "Story.State.Player.InWorld", "Player in world state flow.");

    // --- Database Defaults ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Visual_Character_Default, "Visual.Character.Default", "Default character visual.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Flow_Character_Default, "Flow.Character.Default", "Default character flow.");

    // --- Animation Layer Parent Tags ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim, "Anim", "Animation root tag.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_FullBody, "Anim.FullBody", "Full body animation layer root (locomotion, idle, death).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_Montage, "Anim.Montage", "Montage animation layer root.");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_UpperBody, "Anim.UpperBody", "Upper body animation layer root (attack, cast override).");

    // --- Locomotion Fallback Tags ---
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_FullBody_Locomotion_Idle, "Anim.FullBody.Locomotion.Idle", "Idle locomotion (bIsMoving=false, grounded).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_FullBody_Locomotion_Walk, "Anim.FullBody.Locomotion.Walk", "Walk locomotion (bIsMoving=true, MoveSpeed < RunSpeedThreshold).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_FullBody_Locomotion_Run,  "Anim.FullBody.Locomotion.Run",  "Run locomotion (bIsMoving=true, MoveSpeed >= RunSpeedThreshold).");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_FullBody_Locomotion_Fall, "Anim.FullBody.Locomotion.Fall", "Fall locomotion (bIsFalling=true / airborne).");
}
