// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainStreamer.h"
#include "HktVoxelTerrainLog.h"
#include "LOD/HktVoxelLOD.h"

FHktVoxelTerrainStreamer::FHktVoxelTerrainStreamer()
{
}

void FHktVoxelTerrainStreamer::SetLODDistances(float D0, float D1, float D2, float D3)
{
	Distances[0] = D0;
	Distances[1] = D1;
	Distances[2] = D2;
	Distances[3] = D3;
}

void FHktVoxelTerrainStreamer::SetMaxLoadsPerFrame(int32 HighLOD, int32 LowLOD)
{
	MaxLoadsPerFrameHighLOD = FMath::Max(1, HighLOD);
	MaxLoadsPerFrameLowLOD = FMath::Max(1, LowLOD);
}

int32 FHktVoxelTerrainStreamer::ComputeLODForChunk(float DistSqXY, int32 PrevLOD) const
{
	if (ForcedLOD >= 0 && ForcedLOD <= FHktVoxelLODPolicy::MaxLOD)
	{
		return ForcedLOD;
	}
	return FHktVoxelLODPolicy::GetLODForDistance(DistSqXY, PrevLOD, Distances);
}

void FHktVoxelTerrainStreamer::UpdateStreaming(const FVector& CameraPos, float ChunkWorldSize)
{
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ChunksToRetune.Reset();
	ScratchDesired.Reset();
	ScratchLoadCandidates.Reset();

	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	const FIntVector CameraChunk(
		FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
		FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
		0);

	const float OuterDistance = Distances[FHktVoxelLODPolicy::MaxLOD];
	const int32 OuterRadiusInChunks = FMath::CeilToInt(OuterDistance / ChunkWorldSize);
	const float OuterDistSq = OuterDistance * OuterDistance;
	const int32 ZSpan = FMath::Max(0, HeightMaxZ - HeightMinZ + 1);
	const int32 SquareCount = (2 * OuterRadiusInChunks + 1) * (2 * OuterRadiusInChunks + 1);
	ScratchDesired.Reserve((SquareCount * 3 / 4) * FMath::Max(1, ZSpan));

	for (int32 DX = -OuterRadiusInChunks; DX <= OuterRadiusInChunks; ++DX)
	{
		for (int32 DY = -OuterRadiusInChunks; DY <= OuterRadiusInChunks; ++DY)
		{
			const int32 CX = CameraChunk.X + DX;
			const int32 CY = CameraChunk.Y + DY;

			const float ChunkCenterX = (CX + 0.5f) * ChunkWorldSize;
			const float ChunkCenterY = (CY + 0.5f) * ChunkWorldSize;
			const float DistSqXY =
				FMath::Square(ChunkCenterX - CameraPos.X) +
				FMath::Square(ChunkCenterY - CameraPos.Y);

			if (DistSqXY > OuterDistSq)
			{
				continue;
			}

			const FIntPoint Column(CX, CY);
			const int32* PrevColumnLOD = LastColumnLOD.Find(Column);
			const int32 PrevLOD = PrevColumnLOD ? *PrevColumnLOD : -1;
			const int32 TargetLOD = ComputeLODForChunk(DistSqXY, PrevLOD);

			int32 ZTop = HeightMaxZ;
			if (TargetLOD >= 2 && SurfaceHeightProbe)
			{
				int32 MaxSurfaceChunkZ = 0;
				if (const int32* Cached = SurfaceHeightCache.Find(Column))
				{
					MaxSurfaceChunkZ = *Cached;
				}
				else
				{
					MaxSurfaceChunkZ = SurfaceHeightProbe(CX, CY);
					SurfaceHeightCache.Add(Column, MaxSurfaceChunkZ);
				}
				ZTop = FMath::Min(MaxSurfaceChunkZ + 1, HeightMaxZ);
			}

			for (int32 Z = HeightMinZ; Z <= ZTop; ++Z)
			{
				ScratchDesired.Add(FIntVector(CX, CY, Z), TargetLOD);
			}
		}
	}

	for (const TPair<FIntVector, int32>& Pair : LoadedChunkLOD)
	{
		if (!ScratchDesired.Contains(Pair.Key))
		{
			ChunksToUnload.Add(Pair.Key);
		}
	}

	for (const TPair<FIntVector, int32>& Pair : ScratchDesired)
	{
		const int32* ExistingLOD = LoadedChunkLOD.Find(Pair.Key);
		if (!ExistingLOD)
		{
			ScratchLoadCandidates.Add({Pair.Key, Pair.Value});
		}
		else if (*ExistingLOD != Pair.Value)
		{
			ChunksToRetune.Add({Pair.Key, Pair.Value});
		}
	}

	auto IsHighLOD = [](int32 LOD) { return LOD <= 1; };

	auto DistSqForRequest = [&CameraPos, ChunkWorldSize](const FHktChunkLODRequest& Req)
	{
		const float CX = (Req.Coord.X + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
		const float CY = (Req.Coord.Y + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
		const float CZ = (Req.Coord.Z + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Z);
		return CX * CX + CY * CY + CZ * CZ;
	};

	auto SortByDistance = [&DistSqForRequest](TArray<FHktChunkLODRequest>& Arr)
	{
		const int32 N = Arr.Num();
		TArray<float, TInlineAllocator<256>> Keys;
		Keys.SetNumUninitialized(N);
		for (int32 i = 0; i < N; ++i)
		{
			Keys[i] = DistSqForRequest(Arr[i]);
		}
		TArray<int32, TInlineAllocator<256>> Order;
		Order.SetNumUninitialized(N);
		for (int32 i = 0; i < N; ++i) { Order[i] = i; }
		Order.Sort([&Keys](int32 A, int32 B) { return Keys[A] < Keys[B]; });

		TArray<FHktChunkLODRequest> Sorted;
		Sorted.SetNumUninitialized(N);
		for (int32 i = 0; i < N; ++i)
		{
			Sorted[i] = Arr[Order[i]];
		}
		Arr = MoveTemp(Sorted);
	};

	SortByDistance(ScratchLoadCandidates);
	SortByDistance(ChunksToRetune);

	const int32 RemainingMemBudget = (MaxLoadedChunks > 0)
		? FMath::Max(0, MaxLoadedChunks - LoadedChunkLOD.Num())
		: ScratchLoadCandidates.Num();

	int32 BudgetHigh = MaxLoadsPerFrameHighLOD;
	int32 BudgetLow = MaxLoadsPerFrameLowLOD;

	int32 RetuneKept = 0;
	for (int32 i = 0; i < ChunksToRetune.Num(); ++i)
	{
		const FHktChunkLODRequest& Req = ChunksToRetune[i];
		int32& Budget = IsHighLOD(Req.LOD) ? BudgetHigh : BudgetLow;
		if (Budget > 0)
		{
			--Budget;
			ChunksToRetune[RetuneKept++] = Req;
		}
	}
	ChunksToRetune.SetNum(RetuneKept, EAllowShrinking::No);

	int32 MemRemaining = RemainingMemBudget;
	for (int32 i = 0; i < ScratchLoadCandidates.Num() && MemRemaining > 0; ++i)
	{
		const FHktChunkLODRequest& Req = ScratchLoadCandidates[i];
		int32& Budget = IsHighLOD(Req.LOD) ? BudgetHigh : BudgetLow;
		if (Budget > 0)
		{
			--Budget;
			--MemRemaining;
			ChunksToLoad.Add(Req);
		}
	}

	for (const FIntVector& Coord : ChunksToUnload)
	{
		LoadedChunkLOD.Remove(Coord);
	}
	for (const FHktChunkLODRequest& Req : ChunksToLoad)
	{
		LoadedChunkLOD.Add(Req.Coord, Req.LOD);
		LastColumnLOD.Add(FIntPoint(Req.Coord.X, Req.Coord.Y), Req.LOD);
	}
	for (const FHktChunkLODRequest& Req : ChunksToRetune)
	{
		LoadedChunkLOD.Add(Req.Coord, Req.LOD);
		LastColumnLOD.Add(FIntPoint(Req.Coord.X, Req.Coord.Y), Req.LOD);
	}

	LastCameraChunk = CameraChunk;
}

void FHktVoxelTerrainStreamer::GetLODHistogram(int32 OutCounts[4]) const
{
	OutCounts[0] = OutCounts[1] = OutCounts[2] = OutCounts[3] = 0;
	for (const TPair<FIntVector, int32>& Pair : LoadedChunkLOD)
	{
		const int32 LOD = FMath::Clamp(Pair.Value, 0, 3);
		++OutCounts[LOD];
	}
}

void FHktVoxelTerrainStreamer::Clear()
{
	LoadedChunkLOD.Empty();
	LastColumnLOD.Empty();
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ChunksToRetune.Reset();
	ScratchDesired.Reset();
	ScratchLoadCandidates.Reset();
	LastCameraChunk = FIntVector(INT32_MAX);
}
