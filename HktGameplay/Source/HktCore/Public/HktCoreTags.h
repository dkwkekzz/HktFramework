// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// ============================================================================
// HktCoreTags — C01 자연(Natural) 컨텐츠가 사용하는 GameplayTag 카탈로그.
//
// PR-1 (Docs/Concepts/C01_TranquilWilds/Implementation-Plan.md §3) 의 산출물.
// 본 헤더는 "선언" 단일 출처. 정의는 HktCoreTags.cpp.
//
// 책임 분리 (05-interactions.md §2):
//   - Action.Natural.<Verb>      : 플레이어 인텐트 라벨. 클라 → 서버.
//   - Event.Natural.<Verbed>     : 서버 라우터 통과 후 발화되는 시뮬 이벤트.
//   - Entity.Tool.<Name>         : 도구 분류 태그 (Bag 슬롯 / Stance 검사용).
//   - Material.<Name>            : 재료 분류 태그 (도구 tier 판정용).
// ============================================================================

namespace HktNaturalActionTags
{
    // ── Action 8종 (플레이어 인텐트) ──
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Fell);     // Action.Natural.Fell
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Harvest);  // Action.Natural.Harvest
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Pluck);    // Action.Natural.Pluck
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Eat);      // Action.Natural.Eat
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Ignite);   // Action.Natural.Ignite
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Mine);     // Action.Natural.Mine
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Cross);    // Action.Natural.Cross
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Drink);    // Action.Natural.Drink
}

namespace HktNaturalEventTags
{
    // ── Event 13종 (시뮬 이벤트) ──
    // 라우터가 매핑하는 8종 + 자율 발화 5종 (HerbCollected/BoulderBroken/TrailEndpointReached/PeakReached/GrainObserved).
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(TreeFelled);            // Event.Natural.TreeFelled
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BerryHarvested);        // Event.Natural.BerryHarvested
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(HerbCollected);         // Event.Natural.HerbCollected
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(AquaticPlucked);        // Event.Natural.AquaticPlucked
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(MushroomEaten);         // Event.Natural.MushroomEaten
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(FireIgnited);           // Event.Natural.FireIgnited
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BoulderBroken);         // Event.Natural.BoulderBroken
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OreMined);              // Event.Natural.OreMined
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(SpringDrank);           // Event.Natural.SpringDrank
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(FordCrossed);           // Event.Natural.FordCrossed
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(TrailEndpointReached);  // Event.Natural.TrailEndpointReached
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(PeakReached);           // Event.Natural.PeakReached
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(GrainObserved);         // Event.Natural.GrainObserved
}

namespace HktToolTags
{
    // ── Tool 5종 (Entity.Tool.*) ──
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Axe);        // Entity.Tool.Axe
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Pickaxe);    // Entity.Tool.Pickaxe
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Tinder);     // Entity.Tool.Tinder
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Container);  // Entity.Tool.Container
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Torch);      // Entity.Tool.Torch
}

namespace HktMaterialTags
{
    // ── Material 6종 (Material.*) ──
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Wood);       // Material.Wood
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Stone);      // Material.Stone
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Sharpened);  // Material.Sharpened
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Bronze);     // Material.Bronze
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Flint);      // Material.Flint
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Cup);        // Material.Cup
}

// ── PR-4 (Implementation-Plan §6.1) — Birch 데모용 자연 엔티티 + Region 이벤트 ──
// Birch / Branch / BirchSapling: spawner story 본문 (Content/Stories/Natural/Birch/*.json) 의 SpawnEntity 인자.
// Event.Region.SaplingSeed: TreeFelled 리스너 → SaplingSeed 분리 디스패치 (자기-전파 회로).
namespace HktNaturalEntityTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Birch);         // Entity.Natural.Birch
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Branch);        // Entity.Natural.Branch (베기 시 drop)
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BirchSapling);  // Entity.Natural.BirchSapling
}

namespace HktRegionEventTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(SaplingSeed);   // Event.Region.SaplingSeed
}

namespace HktNaturalStoryTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BirchSpawn);    // Story.Flow.Spawner.Natural.Birch
}
