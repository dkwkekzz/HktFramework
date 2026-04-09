// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktUIAnchorStrategy.h"
#include "HktCoreDefs.h"
#include "HktWorldViewAnchorStrategy.generated.h"

class APlayerController;

/**
 * 엔티티의 월드 위치를 스크린 좌표로 투영하는 전략.
 * PresentationState의 Location으로부터 SetWorldPosition()을 통해 위치를 갱신합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktWorldViewAnchorStrategy : public UHktUIAnchorStrategy
{
	GENERATED_BODY()

public:
	void SetTargetEntity(FHktEntityId InEntityId, float InHeadClearance = 20.f)
	{
		TargetEntityId = InEntityId;
		HeadClearance = InHeadClearance;
	}

	/** RenderLocation(지면 보정 완료 위치) + CapsuleHalfHeight로 머리 위치를 갱신 */
	void SetWorldPosition(const FVector& InRenderLocation, float InCapsuleHalfHeight)
	{
		CachedRenderLocation = InRenderLocation;
		CapsuleHalfHeight = InCapsuleHalfHeight;
		bHasWorldPosition = true;
	}

	/** 스크린 공간 오프셋 (투영+DPI보정 후 적용, Slate 좌표 단위) */
	void SetScreenOffset(const FVector2D& InOffset) { ScreenOffset = InOffset; }

	FHktEntityId GetTargetEntityId() const { return TargetEntityId; }
	FVector2D GetScreenOffset() const { return ScreenOffset; }

	virtual bool CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos) override;

private:
	/** 머리 위 최종 월드 좌표 계산: RenderLocation + (0, 0, CapsuleHalfHeight + HeadClearance) */
	FVector GetHeadWorldLocation() const;

	FHktEntityId TargetEntityId = InvalidEntityId;
	FVector CachedRenderLocation = FVector::ZeroVector;
	float CapsuleHalfHeight = 90.f;
	float HeadClearance = 20.f;                         // 머리 위 여백
	FVector2D ScreenOffset = FVector2D::ZeroVector;     // 스크린 공간 오프셋 (Slate 좌표)
	bool bHasWorldPosition = false;
};
