// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktUIAnchorStrategy.h"
#include "HktUIActorAnchorStrategy.generated.h"

class AActor;
class APlayerController;

/**
 * 특정 AActor를 추적하여 World -> Screen 투영으로 UI 위치를 결정합니다.
 * 체력바, 데미지 플로터 등 엔티티 HUD에 사용합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktUIActorAnchorStrategy : public UHktUIAnchorStrategy
{
	GENERATED_BODY()

public:
	void SetTargetActor(AActor* InActor, FVector InOffset)
	{
		TargetActor = InActor;
		WorldOffset = InOffset;
	}

	virtual bool CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos) override;

private:
	UPROPERTY()
	TWeakObjectPtr<AActor> TargetActor;

	FVector WorldOffset = FVector::ZeroVector;
};
