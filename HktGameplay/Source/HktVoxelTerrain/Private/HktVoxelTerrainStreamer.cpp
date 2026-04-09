// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainStreamer.h"
#include "HktVoxelTerrainLog.h"

FHktVoxelTerrainStreamer::FHktVoxelTerrainStreamer()
{
}

void FHktVoxelTerrainStreamer::UpdateStreaming(const FVector& CameraPos, float ViewDistance, float ChunkWorldSize)
{
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();

	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	// 카메라의 현재 청크 좌표 (XY 평면)
	const FIntVector CameraChunk(
		FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
		FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
		0);

	// 뷰 디스턴스를 청크 단위로 변환
	const int32 ViewRadiusInChunks = FMath::CeilToInt(ViewDistance / ChunkWorldSize);

	// 현재 프레임에 원하는 청크 집합 계산 (XY 평면 원형 + Z 전체)
	TSet<FIntVector> DesiredChunks;
	const float ViewDistSq = ViewDistance * ViewDistance;

	for (int32 DX = -ViewRadiusInChunks; DX <= ViewRadiusInChunks; ++DX)
	{
		for (int32 DY = -ViewRadiusInChunks; DY <= ViewRadiusInChunks; ++DY)
		{
			// XY 평면 거리 체크 (청크 중심 기준)
			const float ChunkCenterX = (CameraChunk.X + DX + 0.5f) * ChunkWorldSize;
			const float ChunkCenterY = (CameraChunk.Y + DY + 0.5f) * ChunkWorldSize;
			const float DistSqXY =
				FMath::Square(ChunkCenterX - CameraPos.X) +
				FMath::Square(ChunkCenterY - CameraPos.Y);

			if (DistSqXY > ViewDistSq)
			{
				continue;
			}

			// Z축 전체 높이 로드
			for (int32 Z = HeightMinZ; Z <= HeightMaxZ; ++Z)
			{
				DesiredChunks.Add(FIntVector(CameraChunk.X + DX, CameraChunk.Y + DY, Z));
			}
		}
	}

	// 언로드 대상: 현재 로드되어 있지만 더 이상 필요 없는 청크
	for (const FIntVector& Coord : LoadedChunkSet)
	{
		if (!DesiredChunks.Contains(Coord))
		{
			ChunksToUnload.Add(Coord);
		}
	}

	// 로드 대상: 필요하지만 아직 로드되지 않은 청크
	// TSet → TSet 조회 = O(1), 전체 O(n) — 기존 AddUnique O(n²) 제거
	TArray<FIntVector> Candidates;
	for (const FIntVector& Coord : DesiredChunks)
	{
		if (!LoadedChunkSet.Contains(Coord))
		{
			Candidates.Add(Coord);
		}
	}

	// 프레임 예산 + 메모리 예산 적용
	const int32 RemainingBudget = (MaxLoadedChunks > 0)
		? FMath::Max(0, MaxLoadedChunks - LoadedChunkSet.Num())
		: Candidates.Num();
	const int32 LoadCount = FMath::Min3(Candidates.Num(), MaxLoadsPerFrame, RemainingBudget);

	if (LoadCount > 0 && Candidates.Num() > LoadCount)
	{
		// 카메라 거리 기준 partial sort — 필요한 LoadCount개만 정렬
		auto DistLambda = [&CameraPos, ChunkWorldSize](const FIntVector& A, const FIntVector& B)
		{
			const FVector CenterA(
				(A.X + 0.5f) * ChunkWorldSize,
				(A.Y + 0.5f) * ChunkWorldSize,
				(A.Z + 0.5f) * ChunkWorldSize);
			const FVector CenterB(
				(B.X + 0.5f) * ChunkWorldSize,
				(B.Y + 0.5f) * ChunkWorldSize,
				(B.Z + 0.5f) * ChunkWorldSize);
			return FVector::DistSquared(CenterA, CameraPos) < FVector::DistSquared(CenterB, CameraPos);
		};

		// std::partial_sort: O(n * log(k)) — 전체 정렬 O(n*log(n)) 대비 효율적
		std::partial_sort(
			Candidates.GetData(),
			Candidates.GetData() + LoadCount,
			Candidates.GetData() + Candidates.Num(),
			DistLambda);
	}

	for (int32 i = 0; i < LoadCount; ++i)
	{
		ChunksToLoad.Add(Candidates[i]);
	}

	// 로드/언로드 반영
	for (const FIntVector& Coord : ChunksToUnload)
	{
		LoadedChunkSet.Remove(Coord);
	}
	for (const FIntVector& Coord : ChunksToLoad)
	{
		LoadedChunkSet.Add(Coord);
	}

	LastCameraChunk = CameraChunk;
}

void FHktVoxelTerrainStreamer::Clear()
{
	LoadedChunkSet.Empty();
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	LastCameraChunk = FIntVector(INT32_MAX);
}
