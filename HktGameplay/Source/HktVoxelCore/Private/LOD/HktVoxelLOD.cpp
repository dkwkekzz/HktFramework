// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "LOD/HktVoxelLOD.h"
#include "Data/HktVoxelTypes.h"

// 기본 LOD 거리 (유닛 = cm)
// LOD 0→1: 3200cm (32m), LOD 1→2: 6400cm (64m), LOD 2→3: 12800cm (128m)
float FHktVoxelLODPolicy::LODDistances[MaxLOD] = { 3200.0f, 6400.0f, 12800.0f };

int32 FHktVoxelLODPolicy::GetLODLevel(float DistanceSquared)
{
	for (int32 i = 0; i < MaxLOD; i++)
	{
		if (DistanceSquared < LODDistances[i] * LODDistances[i])
		{
			return i;
		}
	}
	return MaxLOD;
}

int32 FHktVoxelLODPolicy::GetResolution(int32 LODLevel)
{
	// LOD 0: 32, LOD 1: 16, LOD 2: 8, LOD 3: 4
	return FHktVoxelChunk::SIZE >> FMath::Clamp(LODLevel, 0, MaxLOD);
}

void FHktVoxelLODPolicy::SetLODDistance(int32 LODLevel, float Distance)
{
	if (LODLevel >= 0 && LODLevel < MaxLOD)
	{
		LODDistances[LODLevel] = Distance;
	}
}

int32 FHktVoxelLODPolicy::GetLODForDistance(float DistSq, int32 PrevLOD, const float (&Distances)[4])
{
	// Distances[i] = LOD i 외곽 경계. DistSq < Distances[i]^2 이면 LOD i 후보.
	int32 Target = MaxLOD;
	for (int32 i = 0; i <= MaxLOD; i++)
	{
		const float D = Distances[i];
		if (DistSq < D * D)
		{
			Target = i;
			break;
		}
	}

	// Hysteresis: 다운그레이드(LOD 숫자 증가) 시 5% 오버슈트 요구.
	// 즉, PrevLOD에 머무르려면 PrevLOD의 외곽 경계 * 1.05 까지 허용.
	if (Target > PrevLOD && PrevLOD >= 0 && PrevLOD <= MaxLOD)
	{
		const float HysteresisFactor = 1.05f;
		const float PrevBoundary = Distances[PrevLOD] * HysteresisFactor;
		if (DistSq < PrevBoundary * PrevBoundary)
		{
			return PrevLOD;
		}
	}

	return Target;
}
