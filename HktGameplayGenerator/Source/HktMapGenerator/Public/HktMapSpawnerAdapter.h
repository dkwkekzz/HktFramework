// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// HktMapSpawnerAdapter — 레거시 `FHktMapSpawner` 를 신규 `FHktTerrainSpawnerSpec`
// 으로 변환하는 어댑터 헤더 (TerrainSpawner.design.md §8 M5).
//
// 본 헤더는 HktTerrain 의존을 HktMapData.h 전체로 전파하지 않기 위해 분리되어 있다.
// HktMapGenerator 의 마이그레이션 코드 (HktMapGeneratorSubsystem 등) 에서만 include.

#pragma once

#include "CoreMinimal.h"
#include "HktMapData.h"
#include "HktTerrainBakedAsset.h"
#include "Terrain/HktFixed32.h"

namespace HktMapSpawnerAdapter
{
	/**
	 * `FHktMapSpawner` 로부터 `FHktTerrainSpawnerSpec` 을 합성한다.
	 *
	 * 매핑 (TerrainSpawner.design.md §3-a · §5 ADR):
	 *   - Position (cm float)        → PosXRaw/PosYRaw/PosZRaw (Q16.16 cm)
	 *   - StoryTag                   → 호출자 인자 (spawner-design skill 산출물). 레거시 SpawnRule 은 의미 손실.
	 *   - EntityTag NetIndex         → Param2 (archetype 별 의미 — SpawnerParams::SpawnerSlot0 컨벤션)
	 *   - Count                      → Param3 (SpawnerParams::SpawnerSlot1 컨벤션)
	 *   - ChunkCoord / SlotHash      → 호출자가 베이크 시점에 계산 (PosXRaw + SlotIndex)
	 *
	 * RespawnSeconds / Rotation 은 손실 — Story 본문이 시간/회전 로직을 직접 표현해야 한다.
	 */
	HKTMAPGENERATOR_API FHktTerrainSpawnerSpec MapSpawnerToTerrainSpec(
		const FHktMapSpawner& In,
		const FGameplayTag& StoryTag,
		const FIntVector& ChunkCoord,
		uint32 SlotHash,
		int32 BiomeId);
}
