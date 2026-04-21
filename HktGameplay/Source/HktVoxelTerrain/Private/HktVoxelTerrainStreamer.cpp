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

	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	// 카메라 청크 좌표 (XY)
	const FIntVector CameraChunk(
		FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
		FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
		0);

	// 외곽 LOD3 거리 기준으로 bounding-square 열거
	const float OuterDistance = Distances[FHktVoxelLODPolicy::MaxLOD];
	const int32 OuterRadiusInChunks = FMath::CeilToInt(OuterDistance / ChunkWorldSize);
	const float OuterDistSq = OuterDistance * OuterDistance;

	// 첫 패스: desired 집합 + 청크별 목표 LOD 계산
	TMap<FIntVector, int32> Desired;
	Desired.Reserve((2 * OuterRadiusInChunks + 1) * (2 * OuterRadiusInChunks + 1) * (HeightMaxZ - HeightMinZ + 1));

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

			// 이전 LOD 기억 — 칼럼 내 임의 청크 1개로 hysteresis 판정 (모두 같은 XY)
			const FIntVector ProbeCoord(CX, CY, HeightMinZ);
			const int32* PrevLODPtr = LoadedChunkLOD.Find(ProbeCoord);
			const int32 PrevLOD = PrevLODPtr ? *PrevLODPtr : -1;
			const int32 TargetLOD = ComputeLODForChunk(DistSqXY, PrevLOD);

			// Z 범위: LOD 0/1은 전체, LOD ≥ 2는 SurfaceProbe로 잘라내기
			int32 ZTop = HeightMaxZ;
			if (TargetLOD >= 2 && SurfaceHeightProbe)
			{
				const int32 MaxSurfaceChunkZ = SurfaceHeightProbe(CX, CY);
				// +1 마진(나무/오버행)
				ZTop = FMath::Min(MaxSurfaceChunkZ + 1, HeightMaxZ);
			}

			for (int32 Z = HeightMinZ; Z <= ZTop; ++Z)
			{
				Desired.Add(FIntVector(CX, CY, Z), TargetLOD);
			}
		}
	}

	// 언로드: 더 이상 desired에 없음
	for (const TPair<FIntVector, int32>& Pair : LoadedChunkLOD)
	{
		if (!Desired.Contains(Pair.Key))
		{
			ChunksToUnload.Add(Pair.Key);
		}
	}

	// 신규 로드 후보 + Retune 후보 분리
	TArray<FHktChunkLODRequest> LoadCandidates;
	for (const TPair<FIntVector, int32>& Pair : Desired)
	{
		const int32* ExistingLOD = LoadedChunkLOD.Find(Pair.Key);
		if (!ExistingLOD)
		{
			LoadCandidates.Add({Pair.Key, Pair.Value});
		}
		else if (*ExistingLOD != Pair.Value)
		{
			ChunksToRetune.Add({Pair.Key, Pair.Value});
		}
	}

	// HighLOD/LowLOD 카테고리 분리
	auto IsHighLOD = [](int32 LOD) { return LOD <= 1; };

	// 거리 기준 정렬 — 가까운 청크 우선
	auto DistLambda = [&CameraPos, ChunkWorldSize](const FHktChunkLODRequest& A, const FHktChunkLODRequest& B)
	{
		const FVector CenterA(
			(A.Coord.X + 0.5f) * ChunkWorldSize,
			(A.Coord.Y + 0.5f) * ChunkWorldSize,
			(A.Coord.Z + 0.5f) * ChunkWorldSize);
		const FVector CenterB(
			(B.Coord.X + 0.5f) * ChunkWorldSize,
			(B.Coord.Y + 0.5f) * ChunkWorldSize,
			(B.Coord.Z + 0.5f) * ChunkWorldSize);
		return FVector::DistSquared(CenterA, CameraPos) < FVector::DistSquared(CenterB, CameraPos);
	};

	LoadCandidates.Sort(DistLambda);

	// 메모리 예산 잔여
	const int32 RemainingMemBudget = (MaxLoadedChunks > 0)
		? FMath::Max(0, MaxLoadedChunks - LoadedChunkLOD.Num())
		: LoadCandidates.Num();

	// HighLOD/LowLOD 버짓 차감 변수 — Retune도 같은 버짓에서 차감
	int32 BudgetHigh = MaxLoadsPerFrameHighLOD;
	int32 BudgetLow = MaxLoadsPerFrameLowLOD;

	// Retune 먼저 처리 (이미 로드된 청크의 LOD 변경 — 메모리 증가 없음)
	// 가까운 것 우선
	ChunksToRetune.Sort(DistLambda);
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

	// 로드 candidates에 버짓 적용
	int32 MemRemaining = RemainingMemBudget;
	for (int32 i = 0; i < LoadCandidates.Num() && MemRemaining > 0; ++i)
	{
		const FHktChunkLODRequest& Req = LoadCandidates[i];
		int32& Budget = IsHighLOD(Req.LOD) ? BudgetHigh : BudgetLow;
		if (Budget > 0)
		{
			--Budget;
			--MemRemaining;
			ChunksToLoad.Add(Req);
		}
	}

	// 상태 반영
	for (const FIntVector& Coord : ChunksToUnload)
	{
		LoadedChunkLOD.Remove(Coord);
	}
	for (const FHktChunkLODRequest& Req : ChunksToLoad)
	{
		LoadedChunkLOD.Add(Req.Coord, Req.LOD);
	}
	for (const FHktChunkLODRequest& Req : ChunksToRetune)
	{
		LoadedChunkLOD.Add(Req.Coord, Req.LOD);
	}

	LastCameraChunk = CameraChunk;
}

void FHktVoxelTerrainStreamer::Clear()
{
	LoadedChunkLOD.Empty();
	ChunksToLoad.Reset();
	ChunksToUnload.Reset();
	ChunksToRetune.Reset();
	LastCameraChunk = FIntVector(INT32_MAX);
}
