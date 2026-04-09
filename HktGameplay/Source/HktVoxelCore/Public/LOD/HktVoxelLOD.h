// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktVoxelLODPolicy — 복셀 LOD 정책
 *
 * 카메라 거리에 따라 청크의 LOD 레벨을 결정한다.
 *
 * LOD 레벨:
 *   0 — 풀 디테일 (32x32x32 Greedy Mesh)
 *   1 — 2x 다운샘플 (16x16x16)
 *   2 — 4x 다운샘플 (8x8x8)
 *   3 — 8x 다운샘플 (4x4x4) 또는 단색 프록시
 *
 * 거리 임계값은 프로젝트 설정으로 조절 가능.
 */
class HKTVOXELCORE_API FHktVoxelLODPolicy
{
public:
	/** 카메라 거리에 따른 LOD 레벨 반환 (0~MaxLOD) */
	static int32 GetLODLevel(float DistanceSquared);

	/** LOD 레벨별 복셀 해상도 (한 축 기준) */
	static int32 GetResolution(int32 LODLevel);

	/** LOD 거리 임계값 설정 */
	static void SetLODDistance(int32 LODLevel, float Distance);

	static constexpr int32 MaxLOD = 3;

private:
	// 기본값: 3200, 6400, 12800 유닛 (32m, 64m, 128m)
	static float LODDistances[MaxLOD];
};
