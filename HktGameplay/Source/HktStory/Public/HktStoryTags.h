// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// ============================================================================
// HktStoryTags — Story 간 공유되는 GameplayTag 선언
//
// 여러 Story에서 사용되는 태그를 한 곳에서 관리한다.
// 각 Story 파일에서 중복 UE_DEFINE_GAMEPLAY_TAG_COMMENT 하는 대신 이 헤더를 include.
//
// Note: Entity 분류 태그(Entity.Character, Entity.NPC, Entity.Item 등)와
//       Story ID 태그(Story.Event.Move.ToLocation 등)는 HktRuntimeTags.h 참조.
// ============================================================================

namespace HktStoryTags
{
	// --- Entity Filter (Story-specific sub-tags) ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Character_Player);      // Entity.Character.Player
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_NPC_Goblin);            // Entity.NPC.Goblin
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_NPC_Skeleton);          // Entity.NPC.Skeleton

	// --- Entity Attr ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tag_NPC_Hostile);              // Entity.Attr.NPC.Hostile
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tag_Item_Material);            // Entity.Attr.Item.Material

	// --- NPC Flow ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_NPC_Lifecycle);            // Story.Flow.NPC.Lifecycle

	// --- Debris Flow ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Debris_Lifecycle);         // Story.Flow.Debris.Lifecycle

	// --- Anim ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tag_Anim_FullBody_Action_Spawn); // Anim.FullBody.Action.Spawn

	// --- Anim: Jump ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tag_Anim_FullBody_Jump);           // Anim.FullBody.Jump
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tag_Anim_Montage_Land);            // Anim.Montage.Land

	// --- VFX (Niagara convention: VFX.Niagara.{Name}) ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(VFX_SpawnEffect);              // VFX.Niagara.SpawnEffect

	// --- Sound ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Sound_Spawn);                  // Sound.Spawn

	// --- Voxel Interaction Stories ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Voxel_Break);            // Story.Voxel.Break
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Voxel_Shatter);          // Story.Voxel.Shatter
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Voxel_Crumble);          // Story.Voxel.Crumble
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story_Voxel_Crack);            // Story.Voxel.Crack

	// --- Debris Entity Sub-Tags ---
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Debris_Glass);          // Entity.Debris.Glass
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Debris_Crumble);        // Entity.Debris.Crumble
	HKTSTORY_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Entity_Debris_Ice);            // Entity.Debris.Ice
}
