// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "HktUIAnchorStrategy.generated.h"

/**
 * UI 요소의 화면 위치를 결정하는 전략 (Strategy 패턴).
 * 뷰포트 고정, 액터 추적, 월드 좌표 추적 등 서브클래스로 확장합니다.
 */
UCLASS(Abstract, BlueprintType)
class HKTUI_API UHktUIAnchorStrategy : public UObject
{
	GENERATED_BODY()

public:
	/**
	 * 현재 프레임의 화면 좌표를 계산합니다.
	 * @param WorldContext 월드/컨텍스트 (예: UWorld 서브시스템, UObject* 등)
	 * @param OutScreenPos 정규화된 화면 좌표 (0~1, 좌상단 기준)
	 * @return true면 화면 안, false면 화면 밖 또는 실패
	 */
	virtual bool CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos) { return false; }
};
