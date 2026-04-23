// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktLegacyChunkLoader.h"

void FHktLegacyChunkLoader::Update(const FVector& CameraPos, float ChunkWorldSize)
{
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ScratchDesired.Reset();

	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	const FIntVector CameraChunk(
		FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
		FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
		0);

	// 카메라 청크가 동일하면 재계산 불필요 — 회전은 완전 무시.
	if (bHasLastCamera && CameraChunk == LastCameraChunk)
	{
		return;
	}

	const float RadiusSq = StreamRadius * StreamRadius;
	const int32 RadiusInChunks = FMath::CeilToInt(StreamRadius / ChunkWorldSize);
	const int32 ZSpan = FMath::Max(0, HeightMaxZ - HeightMinZ + 1);
	const int32 SquareCount = (2 * RadiusInChunks + 1) * (2 * RadiusInChunks + 1);
	ScratchDesired.Reserve(SquareCount * FMath::Max(1, ZSpan));

	for (int32 DX = -RadiusInChunks; DX <= RadiusInChunks; ++DX)
	{
		for (int32 DY = -RadiusInChunks; DY <= RadiusInChunks; ++DY)
		{
			const int32 CX = CameraChunk.X + DX;
			const int32 CY = CameraChunk.Y + DY;

			const float ChunkCenterX = (CX + 0.5f) * ChunkWorldSize;
			const float ChunkCenterY = (CY + 0.5f) * ChunkWorldSize;
			const float DistSqXY =
				FMath::Square(ChunkCenterX - static_cast<float>(CameraPos.X)) +
				FMath::Square(ChunkCenterY - static_cast<float>(CameraPos.Y));

			if (DistSqXY > RadiusSq)
			{
				continue;
			}

			for (int32 Z = HeightMinZ; Z <= HeightMaxZ; ++Z)
			{
				ScratchDesired.Add(FIntVector(CX, CY, Z));
			}
		}
	}

	// 언로드 — 기존 로드 중 ScratchDesired에 없는 것.
	for (const TPair<FIntVector, EHktVoxelChunkTier>& Pair : LoadedChunks)
	{
		if (!ScratchDesired.Contains(Pair.Key))
		{
			ChunksToUnload.Add(Pair.Key);
		}
	}

	// 로드 후보 — ScratchDesired 중 아직 로드되지 않은 것.
	TArray<FIntVector> LoadCandidates;
	LoadCandidates.Reserve(ScratchDesired.Num());
	for (const FIntVector& Coord : ScratchDesired)
	{
		if (!LoadedChunks.Contains(Coord))
		{
			LoadCandidates.Add(Coord);
		}
	}

	// 카메라 가까운 순 정렬 — 근거리가 먼저 보이도록.
	LoadCandidates.Sort([&CameraPos, ChunkWorldSize](const FIntVector& A, const FIntVector& B)
	{
		auto DistSq = [&CameraPos, ChunkWorldSize](const FIntVector& C)
		{
			const float X = (C.X + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
			const float Y = (C.Y + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
			const float Z = (C.Z + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Z);
			return X * X + Y * Y + Z * Z;
		};
		return DistSq(A) < DistSq(B);
	});

	// 프레임 버짓 + 메모리 버짓 적용.
	const int32 MemRemaining = (MaxLoadedChunks > 0)
		? FMath::Max(0, MaxLoadedChunks - LoadedChunks.Num())
		: LoadCandidates.Num();
	const int32 Allowed = FMath::Min(MaxLoadsPerFrame, MemRemaining);

	for (int32 i = 0; i < Allowed && i < LoadCandidates.Num(); ++i)
	{
		ChunksToLoad.Add({ LoadCandidates[i], EHktVoxelChunkTier::Near });
	}

	// 내부 상태 갱신 — 예산 때문에 이번 틱에 못 넣은 청크는 다음 틱에 자동 재시도된다
	// (여기서 LoadedChunks에 즉시 추가하지 않고 외부 호출자가 실제 로드 성공 시 UpdateLoadedChunks 호출).
	// 단순화를 위해 여기서 추정치로 추가.
	for (const FIntVector& Coord : ChunksToUnload)
	{
		LoadedChunks.Remove(Coord);
	}
	for (const FHktChunkTierRequest& Req : ChunksToLoad)
	{
		LoadedChunks.Add(Req.Coord, Req.Tier);
	}

	// 버짓에 막혀 남은 작업이 있으면 다음 틱에 재스캔 필요 — Unload는 항상 즉시 완료되므로
	// ChunksToLoad가 LoadCandidates를 전부 포함했을 때만 stable 상태 진입.
	const bool bFullyDrained = (ChunksToLoad.Num() == LoadCandidates.Num());
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

void FHktLegacyChunkLoader::Clear()
{
	LoadedChunks.Empty();
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ScratchDesired.Reset();
	LastCameraChunk = FIntVector(INT32_MAX);
	bHasLastCamera = false;
}

void FHktLegacyChunkLoader::GetTierHistogram(int32 OutCounts[2]) const
{
	OutCounts[0] = LoadedChunks.Num();  // Legacy는 전부 Near
	OutCounts[1] = 0;
}
