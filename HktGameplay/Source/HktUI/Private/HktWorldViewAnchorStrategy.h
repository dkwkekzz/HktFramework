// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktUIAnchorStrategy.h"
#include "HktCoreDefs.h"
#include "HktWorldViewAnchorStrategy.generated.h"

class APlayerController;

/**
 * 엔티티의 월드 위치를 스크린 좌표로 투영하는 전략.
 * IHktPresentableActor::GetHudAnchorWorldLocation() 결과를 SetAnchorWorldLocation() 으로 받아 갱신합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktWorldViewAnchorStrategy : public UHktUIAnchorStrategy
{
	GENERATED_BODY()

public:
	void SetTargetEntity(FHktEntityId InEntityId)
	{
		TargetEntityId = InEntityId;
	}

	/**
	 * 액터가 보고한 HUD 앵커 월드 위치(= 캡슐 머리/상단). 매 프레임 또는 카메라/위치 변경 시 갱신.
	 * IHktPresentableActor::GetHudAnchorWorldLocation() 결과를 그대로 전달한다.
	 */
	void SetAnchorWorldLocation(const FVector& InAnchorWorldLocation)
	{
		CachedAnchorWorldLocation = InAnchorWorldLocation;
		bHasWorldPosition = true;
	}

	/** 앵커(캡슐 머리) 기준으로 더해지는 3D 오프셋 (cm 단위). DataAsset 에서 설정. */
	void SetWorldOffset(const FVector& InWorldOffset) { WorldOffset = InWorldOffset; }

	/** 스크린 공간 오프셋 (투영+DPI보정 후 적용, Slate 좌표 단위) */
	void SetScreenOffset(const FVector2D& InOffset) { ScreenOffset = InOffset; }

	FHktEntityId GetTargetEntityId() const { return TargetEntityId; }
	FVector2D GetScreenOffset() const { return ScreenOffset; }

	virtual bool CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos) override;

private:
	/** 최종 HUD 월드 좌표 = AnchorWorldLocation + WorldOffset */
	FVector GetHudWorldLocation() const;

	FHktEntityId TargetEntityId = InvalidEntityId;
	FVector CachedAnchorWorldLocation = FVector::ZeroVector;
	FVector WorldOffset = FVector(0.f, 0.f, 20.f);      // 앵커 기준 3D 오프셋 (DataAsset 으로 조절)
	FVector2D ScreenOffset = FVector2D::ZeroVector;     // 스크린 공간 오프셋 (Slate 좌표)
	bool bHasWorldPosition = false;
};
