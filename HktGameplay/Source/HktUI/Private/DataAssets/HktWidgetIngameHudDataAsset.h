// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktTagDataAsset.h"
#include "IHktUIViewFactory.h"
#include "HktWidgetIngameHudDataAsset.generated.h"

class UHktUIAnchorStrategy;

/**
 * 인게임 뷰포트 HUD용 DataAsset.
 * CreateView()에서 SHktIngameHudWidget을 생성하여 반환합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktWidgetIngameHudDataAsset : public UHktTagDataAsset, public IHktUIViewFactory
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	TSubclassOf<UHktUIAnchorStrategy> DefaultAnchorStrategyClass;

	virtual TSharedPtr<IHktUIView> CreateView() const override;
	virtual UHktUIAnchorStrategy* CreateStrategy(UObject* Outer) const override;
};
