// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelChunkLoader.h"
#include "HktLegacyChunkLoader.h"
#include "HktProximityChunkLoader.h"

TUniquePtr<IHktVoxelChunkLoader> CreateVoxelChunkLoader(EHktVoxelLoaderType Type)
{
	switch (Type)
	{
		case EHktVoxelLoaderType::Legacy:
			return MakeUnique<FHktLegacyChunkLoader>();
		case EHktVoxelLoaderType::Proximity:
		default:
			return MakeUnique<FHktProximityChunkLoader>();
	}
}
