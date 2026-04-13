// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class FHktVoxelRenderCache;

/**
 * FHktVoxelRaycastResult — DDA 복셀 레이캐스트 결과
 */
struct HKTVOXELCORE_API FHktVoxelRaycastResult
{
	bool bHit = false;
	FIntVector VoxelCoord = FIntVector::ZeroValue;   // 히트된 복셀의 월드 복셀 좌표
	FIntVector ChunkCoord = FIntVector::ZeroValue;   // 히트된 복셀이 속한 청크 좌표
	FVector HitLocation = FVector::ZeroVector;       // 월드 좌표 히트 포인트 (복셀 면 위)
	FVector HitNormal = FVector::ZeroVector;         // 축 정렬 면 법선
	uint16 HitTypeID = 0;                            // 히트된 복셀의 TypeID
	float Distance = 0.f;                            // ray 시작점에서 히트까지 거리
};

/**
 * FHktVoxelRaycast — Amanatides & Woo DDA 복셀 레이캐스트 유틸리티
 *
 * FHktVoxelRenderCache의 복셀 데이터를 직접 읽어 ray-voxel 교차 검사를 수행한다.
 * 청크 경계를 자연스럽게 넘으며, 미로드 청크는 빈 공간으로 처리한다.
 */
class HKTVOXELCORE_API FHktVoxelRaycast
{
public:
	/**
	 * DDA 복셀 트레이스 — RenderCache의 복셀 그리드를 래이마칭한다.
	 *
	 * @param Cache         복셀 데이터를 보유한 렌더 캐시
	 * @param RayOrigin     월드 좌표 ray 시작점 (UE 유닛)
	 * @param RayDir        정규화된 ray 방향
	 * @param VoxelSize     복셀 1개의 월드 크기 (UE 유닛)
	 * @param MaxDistance    최대 트레이스 거리 (UE 유닛). 0이면 기본값 (2청크 분량) 사용
	 * @return              레이캐스트 결과
	 */
	static FHktVoxelRaycastResult Trace(
		const FHktVoxelRenderCache& Cache,
		const FVector& RayOrigin,
		const FVector& RayDir,
		float VoxelSize,
		float MaxDistance = 0.f);

private:
	/** 음수 좌표를 올바르게 처리하는 정수 나눗셈 (FHktTerrainState::FloorDiv와 동일) */
	static int32 FloorDiv(int32 A, int32 B);

	/** 음수 좌표를 올바르게 처리하는 나머지 (항상 0 이상) */
	static int32 FloorMod(int32 A, int32 B);
};
