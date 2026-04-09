// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktUIAnchorStrategy.h"
#include "HktViewportAnchorStrategy.generated.h"

/**
 * 뷰포트 고정 위치 전략.
 * 화면의 고정 좌표를 반환합니다. (기본값 0,0 → 좌측 상단)
 * Login HUD, Ingame viewport HUD 등 화면에 고정되는 UI에 사용합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktViewportAnchorStrategy : public UHktUIAnchorStrategy
{
	GENERATED_BODY()

public:
	void SetFixedPosition(FVector2D InPosition) { FixedPosition = InPosition; }

	virtual bool CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos) override
	{
		OutScreenPos = FixedPosition;
		return true;
	}

private:
	FVector2D FixedPosition = FVector2D::ZeroVector;
};
