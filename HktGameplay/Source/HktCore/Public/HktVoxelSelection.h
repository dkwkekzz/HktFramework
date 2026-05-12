// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktVoxelSelection — 선택/타겟 가능한 단일 복셀 식별자
 *
 * Selection/Target 시스템에서 Entity 외에 Voxel 을 가리킬 때 사용한다.
 * HktCore 에 위치 — 결정론적 좌표(FIntVector) + 위치/노멀(FVector) + TypeID 의
 * 순수 POD 이므로 Story/Rule/Runtime/Presentation/UI 모두 공유 가능.
 * (FHktEvent 가 이미 동일한 FVector/FHktEntityId 를 HktCore 에서 사용.)
 *
 * Story VM 이 voxel 을 타겟으로 다루려면 이 타입을 직접 참조하거나, 필요한
 * 필드만 FHktEvent 의 Param/Location 으로 풀어서 전달한다 — HktCore 순수성 유지.
 */
struct FHktVoxelSelection
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
