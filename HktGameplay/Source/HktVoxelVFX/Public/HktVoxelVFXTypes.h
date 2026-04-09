// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// VM → VFX 이벤트 타입
//
// VM이 발행하는 이벤트를 VFX 디스패처가 소비.
// 이 구조체들은 VM의 결정론적 이벤트를 UE5 시각 연출로 변환하기 위한
// 매개 데이터이다. 게임 로직 판단은 포함하지 않는다.
// ============================================================================

/** 타격 이벤트 — VM이 타격 판정 완료 후 발행 */
struct FHktVoxelHitEvent
{
	FVector Location = FVector::ZeroVector;        // 타격 위치
	FVector HitDirection = FVector::ForwardVector; // 타격 방향
	int32 HitType = 0;                            // 0=Normal, 1=Critical, 2=Kill
	int32 SourceEntityId = -1;
	int32 TargetEntityId = -1;
	uint16 TargetSkinTypeID = 0;                   // 파편 색상 결정용
	uint8  TargetPaletteIndex = 0;
	float  Damage = 0.0f;
};

/** 복셀 파괴 이벤트 — 월드 복셀이 파괴될 때 */
struct FHktVoxelDestroyEvent
{
	FVector Location = FVector::ZeroVector;
	FIntVector ChunkCoord = FIntVector::ZeroValue;
	uint16 LocalIndex = 0;
	uint16 DestroyedTypeID = 0;
	uint8  DestroyedPaletteIndex = 0;
	int32  FragmentCount = 8;                      // 파편 수 (스킨 등급에 비례)
};

/** 엔티티 사망 이벤트 */
struct FHktVoxelDeathEvent
{
	FVector Location = FVector::ZeroVector;
	int32 EntityId = -1;
	uint16 SkinTypeID = 0;
	uint8  PaletteIndex = 0;
	int32  FragmentCount = 16;
};
