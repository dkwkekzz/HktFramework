// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HktVoxelSelection.h"
#include "IHktHitRefinementProvider.generated.h"

UINTERFACE(MinimalAPI)
class UHktHitRefinementProvider : public UInterface
{
	GENERATED_BODY()
};

/**
 * 물리 트레이스의 coarse 히트(예: AABB 박스)를 정밀 위치로 보정하는 인터페이스.
 * 복셀 지형처럼 내부 공간 구조가 있는 액터가 구현하여,
 * SelectionPolicy가 정밀한 히트 위치를 얻을 수 있게 한다.
 */
class HKTRUNTIME_API IHktHitRefinementProvider
{
	GENERATED_BODY()

public:
	/**
	 * 물리 트레이스의 coarse 히트를 정밀 위치로 보정한다.
	 * @param TraceStart      월드 좌표 ray 시작점
	 * @param TraceDir        정규화된 ray 방향
	 * @param CoarseHit       원본 물리 트레이스 FHitResult
	 * @param OutRefinedHit   보정된 FHitResult (위치/법선 갱신)
	 * @return true = 유효한 정밀 히트 발견, false = ray 경로에 solid 없음 (파괴된 영역)
	 */
	virtual bool RefineHit(
		const FVector& TraceStart,
		const FVector& TraceDir,
		const FHitResult& CoarseHit,
		FHitResult& OutRefinedHit) const = 0;

	/**
	 * 트레이스가 단일 복셀에 적중했을 때 그 복셀 정보를 채워 반환한다.
	 * 기본 구현은 false (복셀이 아닌 일반 액터). 복셀 지형이 override.
	 *
	 * @param TraceStart    월드 좌표 ray 시작점
	 * @param TraceDir      정규화된 ray 방향
	 * @param OutVoxel      적중한 복셀 정보 (성공 시 bValid=true)
	 * @return true = solid voxel 발견
	 */
	virtual bool TryGetVoxelHit(
		const FVector& TraceStart,
		const FVector& TraceDir,
		FHktVoxelSelection& OutVoxel) const { OutVoxel = FHktVoxelSelection{}; return false; }
};
