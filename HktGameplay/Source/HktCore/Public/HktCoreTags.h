// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NativeGameplayTags.h"

// ============================================================================
// HktCoreTags — C01 자연(Natural) 컨텐츠가 사용하는 GameplayTag 카탈로그.
//
// 본 헤더는 "선언" 단일 출처. 정의는 HktCoreTags.cpp.
//
// 책임 분리 (Plan §3 ADR-R1, 05-interactions.md §2):
//   - Event.Natural.<Verbed>     : 클라이언트가 직접 발사하는 시뮬 이벤트.
//                                  검증은 VM precondition + 결정론 모델이 담당
//                                  (별도 Action.* 라우터 없음 — Plan §3 ADR-R1 참조).
//   - Entity.Tool.<Name>         : 도구 분류 태그 (Bag 슬롯 / Stance 검사용).
//   - Material.<Name>            : 재료 분류 태그 (도구 tier 판정용).
// ============================================================================

namespace HktNaturalEventTags
{
    // ── 시뮬 이벤트 ──
    // 나무 베기는 별도 이벤트가 아니라 BasicAttack 누적 → State.Dead → TreeLifecycle 경유로 처리됨.
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

// ── 자연 엔티티 + Region 이벤트 ──
// Birch/Oak 우클릭 → Story.Event.Target.Default → BasicAttack 누적 → State.Dead → TreeLifecycle.
// TreeLifecycle 가 Branch drop + SaplingSeed 디스패치 + DestroyEntity.
namespace HktNaturalEntityTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Birch);         // Entity.Natural.Birch
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Branch);        // Entity.Natural.Branch (사망 시 drop)
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BirchSapling);  // Entity.Natural.BirchSapling

    // ── Oak 가계 spawner ── Oak grove (Elder 1 + ChildCount 자식) lineage 데모.
    // Elder 는 일반 Oak 의 attribute 변형(태그 부착) — 후계 promotion 시 일반 Oak → Elder 전이.
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Oak);           // Entity.Natural.Oak
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OakElder);      // Entity.Natural.OakElder (grove 중심 노목 마커)
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OakSapling);    // Entity.Natural.OakSapling
}

namespace HktRegionEventTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(SaplingSeed);       // Event.Region.SaplingSeed (Birch)
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OakSaplingSeed);    // Event.Region.OakSaplingSeed (Oak — lineage 키 보존)
}

namespace HktNaturalStoryTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(BirchSpawn);    // Story.Flow.Spawner.Natural.Birch
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OakSpawn);      // Story.Flow.Spawner.Natural.Oak
}

// ── Terrain placement (TerrainSpawner.design.md §4-a 갱신, 2026-05-15) ──
// Event.Terrain.ChunkLoaded: 새 청크 로드 시 sim 이 발화. placement 정책 Story
// (Content/Stories/Natural/Placement_*.json) 가 본 태그를 storyTag 로 listen 하여
// biome/surface 컨텍스트 기반으로 spawner Story (BirchSpawn, OakSpawn 등) 를
// DispatchEvent 한다. cpp 하드코딩 매핑 대안 — LLM/디자이너가 정책을 JSON 으로 자유 작성.
namespace HktTerrainEventTags
{
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(ChunkLoaded);   // Event.Terrain.ChunkLoaded
}
