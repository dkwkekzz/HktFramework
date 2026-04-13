// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
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
};
