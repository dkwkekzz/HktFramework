// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktVoxelSelection — 선택/타겟 가능한 단일 복셀 식별자
 *
 * Selection/Target 시스템에서 Entity 외에 Voxel을 가리킬 때 사용한다.
 * HktRule 에 위치 — 정책(IHktUnitSelectionPolicy)과 인텐트(IHktIntentBuilder),
 * 그리고 히트 보정(IHktHitRefinementProvider, HktRuntime) 양쪽이 동일 타입을 공유.
 */
struct HKTRULE_API FHktVoxelSelection
{
	/** 유효한 voxel 정보 여부 */
	bool bValid = false;

	/** 월드 복셀 좌표 (FHktVoxelRaycastResult::VoxelCoord 와 동일) */
	FIntVector VoxelCoord = FIntVector::ZeroValue;

	/** 청크 좌표 — 후속 chunk-단위 조회용 */
	FIntVector ChunkCoord = FIntVector::ZeroValue;

	/** 복셀 중앙의 월드 위치 (UE 유닛). MoveTo 타겟 위치로 사용. */
	FVector WorldCenter = FVector::ZeroVector;

	/** 클릭된 면의 법선 — 시각 표시 방향 / 인접 voxel 계산용 */
	FVector HitNormal = FVector::ZeroVector;

	/** 블록 TypeID (HktTerrainType 참조) */
	uint16 TypeID = 0;

	/** 한 voxel 의 월드 크기 (UE 유닛). 시각 표시 박스 크기 계산용. 0 이면 미설정. */
	float VoxelSize = 0.f;
};
