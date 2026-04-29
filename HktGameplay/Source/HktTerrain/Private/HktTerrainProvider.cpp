// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainProvider.h"
#include "HktTerrainSubsystem.h"
#include "HktTerrainLog.h"
#include "Terrain/HktTerrainVoxel.h"

namespace
{
	constexpr int32 VoxelsPerChunk =
		FHktTerrainGeneratorConfig::ChunkSize *
		FHktTerrainGeneratorConfig::ChunkSize *
		FHktTerrainGeneratorConfig::ChunkSize;
}

FHktTerrainProvider::FHktTerrainProvider(UHktTerrainSubsystem* InSubsystem,
                                         const FHktTerrainGeneratorConfig& InConfig)
	: Subsystem(InSubsystem)
	, Config(InConfig)
{
}

void FHktTerrainProvider::GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                        FHktTerrainVoxel* OutVoxels) const
{
	if (!OutVoxels) return;

	UHktTerrainSubsystem* Sub = Subsystem.Get();
	if (!Sub)
	{
		// 시뮬레이션 측 안전 디폴트 — 모두 빈 공간. 호출자(FHktTerrainState::LoadChunk)가
		// 데이터를 그대로 받아 처리하므로 여기서 zero-init 만 보장한다.
		FMemory::Memzero(OutVoxels, sizeof(FHktTerrainVoxel) * VoxelsPerChunk);
		UE_LOG(LogHktTerrain, Warning,
			TEXT("FHktTerrainProvider::GenerateChunk — Subsystem 무효, 빈 청크 반환 (%d,%d,%d)"),
			ChunkX, ChunkY, ChunkZ);
		return;
	}

	const FHktTerrainVoxel* Cached = Sub->AcquireChunk(FIntVector(ChunkX, ChunkY, ChunkZ));
	if (!Cached)
	{
		FMemory::Memzero(OutVoxels, sizeof(FHktTerrainVoxel) * VoxelsPerChunk);
		return;
	}
	FMemory::Memcpy(OutVoxels, Cached, sizeof(FHktTerrainVoxel) * VoxelsPerChunk);
}
