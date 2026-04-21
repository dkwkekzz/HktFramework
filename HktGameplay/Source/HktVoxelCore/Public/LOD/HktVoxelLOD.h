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
	/** 카메라 거리에 따른 LOD 레벨 반환 (0~MaxLOD) — 전역 LODDistances 테이블 사용 */
	static int32 GetLODLevel(float DistanceSquared);

	/** LOD 레벨별 복셀 해상도 (한 축 기준) */
	static int32 GetResolution(int32 LODLevel);

	/** LOD 거리 임계값 설정 (전역 폴백 테이블) */
	static void SetLODDistance(int32 LODLevel, float Distance);

	/** LOD 다운샘플 배수 (LOD0=1, LOD1=2, LOD2=4, LOD3=8) */
	static constexpr int32 GetDownsampleFactor(int32 LODLevel) { return 1 << FMath::Clamp(LODLevel, 0, MaxLOD); }

	/**
	 * Per-instance 거리 임계값 + hysteresis 기반 LOD 결정.
	 *
	 * Distances[i] = LOD i의 외곽 거리 (예: D0=80m, D1=200m, D2=500m, D3=1280m).
	 * DistSq < Distances[i]^2 → LOD i 후보.
	 *
	 * Hysteresis: 다운그레이드 시(PrevLOD가 더 작은 경우) 5% 오버슈트를 요구해
	 * 경계선 부근 LOD 깜빡임을 방지한다. 업그레이드는 즉시.
	 */
	static int32 GetLODForDistance(float DistSq, int32 PrevLOD, const float (&Distances)[4]);

	static constexpr int32 MaxLOD = 3;

private:
	// 기본값: 3200, 6400, 12800 유닛 (32m, 64m, 128m)
	static float LODDistances[MaxLOD];
};
