// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktProximityChunkLoader.h"

void FHktProximityChunkLoader::Update(const FVector& CameraPos, float ChunkWorldSize)
{
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ChunksToRetier.Reset();
	ScratchDesired.Reset();

	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	const FIntVector CameraChunk(
		FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
		FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
		0);

	// 회전 피드백 루프 차단 — 카메라 청크가 동일하면 재계산 없음.
	if (bHasLastCamera && CameraChunk == LastCameraChunk)
	{
		return;
	}

	const float NearRadiusSq = NearRadius * NearRadius;
	const float FarRadiusSq = FarRadius * FarRadius;
	const int32 OuterRadiusInChunks = FMath::CeilToInt(FarRadius / ChunkWorldSize);
	const int32 ZSpan = FMath::Max(0, HeightMaxZ - HeightMinZ + 1);
	const int32 SquareCount = (2 * OuterRadiusInChunks + 1) * (2 * OuterRadiusInChunks + 1);
	ScratchDesired.Reserve(SquareCount * FMath::Max(1, ZSpan));

	// XY 그리드 스캔 — 외곽 반경(FarRadius)까지.
	for (int32 DX = -OuterRadiusInChunks; DX <= OuterRadiusInChunks; ++DX)
	{
		for (int32 DY = -OuterRadiusInChunks; DY <= OuterRadiusInChunks; ++DY)
		{
			const int32 CX = CameraChunk.X + DX;
			const int32 CY = CameraChunk.Y + DY;

			const float ChunkCenterX = (CX + 0.5f) * ChunkWorldSize;
			const float ChunkCenterY = (CY + 0.5f) * ChunkWorldSize;
			const float DistSqXY =
				FMath::Square(ChunkCenterX - static_cast<float>(CameraPos.X)) +
				FMath::Square(ChunkCenterY - static_cast<float>(CameraPos.Y));

			if (DistSqXY > FarRadiusSq)
			{
				continue;
			}

			const EHktVoxelChunkTier Tier = (DistSqXY <= NearRadiusSq)
				? EHktVoxelChunkTier::Near
				: EHktVoxelChunkTier::Far;

			for (int32 Z = HeightMinZ; Z <= HeightMaxZ; ++Z)
			{
				ScratchDesired.Add(FIntVector(CX, CY, Z), Tier);
			}
		}
	}

	// 언로드 — 기존 로드 중 Desired에 없는 것.
	for (const TPair<FIntVector, EHktVoxelChunkTier>& Pair : LoadedChunks)
	{
		if (!ScratchDesired.Contains(Pair.Key))
		{
			ChunksToUnload.Add(Pair.Key);
		}
	}

	// Desired 분류 — 신규 로드 후보 vs Tier 전이.
	TArray<FHktChunkTierRequest> LoadCandidates;
	LoadCandidates.Reserve(ScratchDesired.Num());

	for (const TPair<FIntVector, EHktVoxelChunkTier>& Pair : ScratchDesired)
	{
		const EHktVoxelChunkTier* ExistingTier = LoadedChunks.Find(Pair.Key);
		if (!ExistingTier)
		{
			LoadCandidates.Add({ Pair.Key, Pair.Value });
		}
		else if (*ExistingTier != Pair.Value)
		{
			ChunksToRetier.Add({ Pair.Key, Pair.Value });
		}
	}

	// 카메라 가까운 순 정렬 — Near Tier가 먼저 처리되도록.
	auto DistSq = [&CameraPos, ChunkWorldSize](const FIntVector& Coord)
	{
		const float X = (Coord.X + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
		const float Y = (Coord.Y + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
		const float Z = (Coord.Z + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Z);
		return X * X + Y * Y + Z * Z;
	};
	LoadCandidates.Sort([&DistSq](const FHktChunkTierRequest& A, const FHktChunkTierRequest& B)
	{
		return DistSq(A.Coord) < DistSq(B.Coord);
	});
	ChunksToRetier.Sort([&DistSq](const FHktChunkTierRequest& A, const FHktChunkTierRequest& B)
	{
		return DistSq(A.Coord) < DistSq(B.Coord);
	});

	// 프레임 버짓 + 메모리 버짓.
	const int32 MemRemaining = (MaxLoadedChunks > 0)
		? FMath::Max(0, MaxLoadedChunks - LoadedChunks.Num())
		: LoadCandidates.Num();
	const int32 Allowed = FMath::Min(MaxLoadsPerFrame, MemRemaining);

	for (int32 i = 0; i < Allowed && i < LoadCandidates.Num(); ++i)
	{
		ChunksToLoad.Add(LoadCandidates[i]);
	}

	// Retier도 같은 per-frame 버짓에서 차감 — 메시 재생성이 로드와 동등한 비용.
	const int32 RetierBudget = FMath::Max(0, MaxLoadsPerFrame - ChunksToLoad.Num());
	const int32 RetierCandidatesTotal = ChunksToRetier.Num();
	if (RetierCandidatesTotal > RetierBudget)
	{
		ChunksToRetier.SetNum(RetierBudget, EAllowShrinking::No);
	}

	// 내부 상태 갱신.
	for (const FIntVector& Coord : ChunksToUnload)
	{
		LoadedChunks.Remove(Coord);
	}
	for (const FHktChunkTierRequest& Req : ChunksToLoad)
	{
		LoadedChunks.Add(Req.Coord, Req.Tier);
	}
	for (const FHktChunkTierRequest& Req : ChunksToRetier)
	{
		LoadedChunks.Add(Req.Coord, Req.Tier);
	}

	// 모든 로드/리티어 후보가 이번 틱에 소진되었을 때만 stable 상태로 간주.
	// 버짓에 막혀 남은 작업이 있으면 카메라가 가만히 있어도 다음 틱에 재스캔이 필요.
	const bool bFullyDrained =
		(ChunksToLoad.Num() == LoadCandidates.Num()) &&
		(ChunksToRetier.Num() == RetierCandidatesTotal);

	if (bFullyDrained)
	{
		LastCameraChunk = CameraChunk;
		bHasLastCamera = true;
	}
	else
	{
		bHasLastCamera = false;
	}
}

void FHktProximityChunkLoader::Clear()
{
	LoadedChunks.Empty();
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ChunksToRetier.Reset();
	ScratchDesired.Reset();
	LastCameraChunk = FIntVector(INT32_MAX);
	bHasLastCamera = false;
}

void FHktProximityChunkLoader::GetTierHistogram(int32 OutCounts[2]) const
{
	OutCounts[0] = 0;
	OutCounts[1] = 0;
	for (const TPair<FIntVector, EHktVoxelChunkTier>& Pair : LoadedChunks)
	{
		const int32 Idx = static_cast<int32>(Pair.Value);
		if (Idx >= 0 && Idx < 2)
		{
			++OutCounts[Idx];
		}
	}
}
