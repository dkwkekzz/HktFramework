// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Data/HktVoxelRenderCache.h"
#include "HktVoxelCoreLog.h"

void FHktVoxelRenderCache::ApplyVoxelDelta(const FIntVector& ChunkCoord, uint16 LocalIndex, FHktVoxel NewValue)
{
	FScopeLock Lock(&ChunkLock);

	FHktVoxelChunkRef* Found = Chunks.Find(ChunkCoord);
	if (!Found)
	{
		UE_LOG(LogHktVoxelCore, Warning, TEXT("ApplyVoxelDelta: Chunk (%d,%d,%d) not loaded"),
			ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z);
		return;
	}

	FHktVoxelChunk* Chunk = Found->Get();
	FIntVector Local = FHktVoxelChunk::IndexToLocal(LocalIndex);
	Chunk->At(Local.X, Local.Y, Local.Z) = NewValue;
	Chunk->MeshGeneration.fetch_add(1, std::memory_order_release);
	Chunk->bMeshReady.store(false, std::memory_order_relaxed);
	Chunk->bMeshDirty.store(true, std::memory_order_release);
}

void FHktVoxelRenderCache::LoadChunk(const FIntVector& ChunkCoord, const FHktVoxel* VoxelData, int32 VoxelCount)
{
	FScopeLock Lock(&ChunkLock);

	FHktVoxelChunkRef NewChunk = MakeShared<FHktVoxelChunk, ESPMode::ThreadSafe>();
	NewChunk->ChunkCoord = ChunkCoord;
	NewChunk->bMeshDirty.store(true, std::memory_order_relaxed);
	NewChunk->bMeshReady.store(false, std::memory_order_relaxed);
	NewChunk->MeshGeneration.store(0, std::memory_order_relaxed);

	const int32 MaxVoxels = FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE;
	const int32 CopyCount = FMath::Min(VoxelCount, MaxVoxels);

	if (VoxelData && CopyCount > 0)
	{
		// VoxelData flat index: X + Y*S + Z*S*S  (Z-major, Generator 레이아웃)
		// Data[X][Y][Z] memory: X*S*S + Y*S + Z  (X-major, C++ 3D 배열)
		constexpr int32 S = FHktVoxelChunk::SIZE;
		for (int32 Z = 0; Z < S; ++Z)
		{
			for (int32 Y = 0; Y < S; ++Y)
			{
				for (int32 X = 0; X < S; ++X)
				{
					NewChunk->Data[X][Y][Z] = VoxelData[X + Y * S + Z * S * S];
				}
			}
		}
	}

	Chunks.Emplace(ChunkCoord, MoveTemp(NewChunk));

	UE_LOG(LogHktVoxelCore, Verbose, TEXT("LoadChunk: (%d,%d,%d) loaded with %d voxels"),
		ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z, CopyCount);
}

void FHktVoxelRenderCache::UnloadChunk(const FIntVector& ChunkCoord)
{
	FScopeLock Lock(&ChunkLock);
	Chunks.Remove(ChunkCoord);
}

void FHktVoxelRenderCache::GetDirtyChunks(TArray<FIntVector>& OutDirtyChunks) const
{
	FScopeLock Lock(&ChunkLock);
	OutDirtyChunks.Reset();

	for (const auto& Pair : Chunks)
	{
		if (Pair.Value->bMeshDirty.load(std::memory_order_acquire))
		{
			OutDirtyChunks.Add(Pair.Key);
		}
	}
}

FHktVoxelChunk* FHktVoxelRenderCache::GetChunk(const FIntVector& ChunkCoord)
{
	FScopeLock Lock(&ChunkLock);
	FHktVoxelChunkRef* Found = Chunks.Find(ChunkCoord);
	return Found ? Found->Get() : nullptr;
}

const FHktVoxelChunk* FHktVoxelRenderCache::GetChunk(const FIntVector& ChunkCoord) const
{
	FScopeLock Lock(&ChunkLock);
	const FHktVoxelChunkRef* Found = Chunks.Find(ChunkCoord);
	return Found ? Found->Get() : nullptr;
}

FHktVoxelChunkRef FHktVoxelRenderCache::GetChunkRef(const FIntVector& ChunkCoord)
{
	FScopeLock Lock(&ChunkLock);
	FHktVoxelChunkRef* Found = Chunks.Find(ChunkCoord);
	return Found ? *Found : nullptr;
}

int32 FHktVoxelRenderCache::GetChunkCount() const
{
	FScopeLock Lock(&ChunkLock);
	return Chunks.Num();
}

void FHktVoxelRenderCache::Clear()
{
	FScopeLock Lock(&ChunkLock);
	Chunks.Empty();
}
