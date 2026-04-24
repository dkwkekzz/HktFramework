#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

namespace HktGameplayTags
{
    // --- Story IDs used by Runtime ---
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Event_Item_Drop);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_PlayerInWorld);

    // --- Database Defaults ---
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Visual_Character_Default);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Flow_Character_Default);

    // --- Animation Parent Tags ---
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_FullBody);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_Montage);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_UpperBody);

    // --- Locomotion Fallback Tags (sprite Processor가 tag 없을 때 합성) ---
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_FullBody_Locomotion_Idle);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_FullBody_Locomotion_Walk);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_FullBody_Locomotion_Run);
    HKTRUNTIME_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Anim_FullBody_Locomotion_Fall);
}
