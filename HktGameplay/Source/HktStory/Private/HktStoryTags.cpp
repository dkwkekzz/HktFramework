// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryTags.h"

namespace HktStoryTags
{
	// --- Entity Filter (Story-specific sub-tags) ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character_Player,      "Entity.Character.Player",  "Player character entity.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_NPC_Goblin,            "Entity.NPC.Goblin",        "Goblin NPC entity.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_NPC_Skeleton,          "Entity.NPC.Skeleton",      "Skeleton NPC entity.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_NPC_Slime,             "Entity.NPC.Slime",         "Slime NPC entity — I-0014 voxel attribution 검증용. NPC.Lifecycle 공유.");

	// --- Entity Attr ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_NPC_Hostile,              "Entity.Attr.NPC.Hostile",   "Hostile NPC tag.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Item_Material,            "Entity.Attr.Item.Material", "Material item category.");

	// --- NPC Flow ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_NPC_Lifecycle,             "Story.Flow.NPC.Lifecycle",   "NPC lifecycle: 매-프레임 Brain 루프 + 죽음 처리 (I-0016).");

	// --- Player Flow (I-0016) ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Player_Lifecycle,          "Story.Flow.Player.Lifecycle", "Player lifecycle: 매-프레임 Brain 루프 + 죽음 처리. PlayerInit 끝에서 dispatch.");

	// --- Debris Flow ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Debris_Lifecycle,          "Story.Flow.Debris.Lifecycle", "Terrain debris lifecycle (death/despawn).");

	// --- Natural (Tree) Lifecycle (I-0012) ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Birch_Lifecycle,           "Story.Flow.Natural.Birch.Lifecycle", "Birch tree lifecycle — State.Dead 구독 → Branch drop / SaplingSeed / DestroyEntity.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Oak_Lifecycle,             "Story.Flow.Natural.Oak.Lifecycle",   "Oak tree lifecycle — State.Dead 구독 → Branch drop / LineageFelledCount++ / OakSaplingSeed / DestroyEntity.");

	// --- Target Action (I-0012) — JSON 단일 출처 진입점 ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Target_Action,             "Story.Event.Target.Action", "우클릭 단일 진입점 — Hittable / Item / Move 분기. JSON: Story_TargetAction.json.");

	// --- Anim ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_FullBody_Action_Spawn, "Anim.FullBody.Action.Spawn", "Spawn intro state tag.");

	// --- Anim: Jump ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_FullBody_Jump,           "Anim.FullBody.Jump",   "Jump in-air animation state.");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_Anim_Montage_Land,            "Anim.Montage.Land",    "Landing one-shot montage.");

	// --- VFX (Niagara convention: VFX.Niagara.{Name}) ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_SpawnEffect,              "VFX.Niagara.SpawnEffect",  "Character spawn VFX.");

	// --- Sound ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_Spawn,                  "Sound.Spawn",              "Character spawn sound.");

	// --- Voxel Interaction Stories ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Voxel_Break,            "Story.Voxel.Break",        "Voxel break interaction (Grass/Dirt/Stone/Snow/Clay).");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Voxel_Shatter,          "Story.Voxel.Shatter",      "Voxel shatter interaction (Glass — multiple fragments).");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Voxel_Crumble,          "Story.Voxel.Crumble",      "Voxel crumble interaction (Sand/Gravel — gravity).");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Voxel_Crack,            "Story.Voxel.Crack",        "Voxel crack interaction (Ice — pop-up chunk).");

	// --- Debris Entity Sub-Tags ---
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Debris_Glass,          "Entity.Debris.Glass",      "Glass debris entity (shatter fragments).");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Debris_Crumble,        "Entity.Debris.Crumble",    "Crumble debris entity (gravity-based).");
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Debris_Ice,            "Entity.Debris.Ice",        "Ice debris entity (crack chunk).");
}
