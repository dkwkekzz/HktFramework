// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktMapSpawnerAdapter.h"
#include "GameplayTagsManager.h"

namespace HktMapSpawnerAdapter
{
	FHktTerrainSpawnerSpec MapSpawnerToTerrainSpec(
		const FHktMapSpawner& In,
		const FGameplayTag& StoryTag,
		const FIntVector& ChunkCoord,
		uint32 SlotHash,
		int32 BiomeId)
	{
		FHktTerrainSpawnerSpec Out;

		// Position (cm float) → Q16.16 cm raw.
		// double → FromDouble 은 설정 초기화 전용이지만, 베이크 시점 1회성 변환이라 허용.
		Out.PosXRaw = FHktFixed32::FromDouble(In.Position.X).Raw;
		Out.PosYRaw = FHktFixed32::FromDouble(In.Position.Y).Raw;
		Out.PosZRaw = FHktFixed32::FromDouble(In.Position.Z).Raw;

		Out.StoryTag = StoryTag;

		// EntityTag NetIndex 를 Param2 에 인라인 (SpawnerParams::SpawnerSlot0 컨벤션).
		// NetIndex 가 0 이면 미해석 — 호출자가 별도 검증.
		const FGameplayTagNetIndex NetIdx = In.EntityTag.IsValid()
			? UGameplayTagsManager::Get().GetNetIndexFromTag(In.EntityTag)
			: 0;
		Out.Param2 = static_cast<int32>(NetIdx);
		Out.Param3 = In.Count;

		Out.ChunkCoord = ChunkCoord;
		Out.SlotHash   = SlotHash;
		Out.BiomeId    = BiomeId;

		return Out;
	}
}
