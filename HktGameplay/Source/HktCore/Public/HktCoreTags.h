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
    // ── Event 13종 (시뮬 이벤트) ──
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

    // ── PR-5 — 트리별 분기 이벤트 (FHktVMProgramRegistry 가 tag→program 1:1 매핑이므로
    //    Birch / Oak 리스너가 동일 storyTag(Event.Natural.TreeFelled) 로 동시 등록할 수 없음.
    //    클라이언트(또는 향후 추가될 라우터 story) 가 target 의 종 태그에 따라
    //    트리별 이벤트를 직접 발사한다. PR-6+ 에서 multi-handler 레지스트리 또는 router
    //    story 도입 시 통합 가능). ──
    HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(OakFelled);             // Event.Natural.OakFelled
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

    // ── PR-5 (Implementation-Plan §6.2 / 03-natural-spawners S02) — Oak 가계 spawner ──
    // Oak / OakElder / OakSapling: Oak grove (Elder 1 + ChildCount 자식) lineage 데모.
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
