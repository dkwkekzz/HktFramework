// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktTagDataAsset.h"
#include "IHktUIViewFactory.h"
#include "HktWidgetEntityHudDataAsset.generated.h"

class UHktUIAnchorStrategy;

/**
 * 엔티티 HUD용 DataAsset.
 * CreateView()에서 SHktEntityHudWidget을 생성하여 반환합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktWidgetEntityHudDataAsset : public UHktTagDataAsset, public IHktUIViewFactory
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	TSubclassOf<UHktUIAnchorStrategy> DefaultAnchorStrategyClass;

	/** 머리 위 여백 (CapsuleHalfHeight 위에 추가). 0이면 IngameHUD 기본값 사용. */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI|Offset")
	float HeadClearance = 0.f;

	/** 스크린 공간 오프셋 (투영+DPI보정 후 적용, Slate 좌표 단위). 위치 미세 조정용. */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI|Offset")
	FVector2D ScreenOffset = FVector2D::ZeroVector;

	virtual TSharedPtr<IHktUIView> CreateView() const override;
	virtual UHktUIAnchorStrategy* CreateStrategy(UObject* Outer) const override;
};
