// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktTagDataAsset.h"
#include "IHktUIViewFactory.h"
#include "HktWidgetLoginHudDataAsset.generated.h"

class UTexture2D;
class UHktUIAnchorStrategy;

/**
 * 로그인 HUD용 DataAsset 예시.
 * CreateView()에서 Slate 위젯을 생성할 때 사용하는 리소스를 정의합니다.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktWidgetLoginHudDataAsset : public UHktTagDataAsset, public IHktUIViewFactory
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	TSubclassOf<UHktUIAnchorStrategy> DefaultAnchorStrategyClass;

	UPROPERTY(EditAnywhere, Category = "Hkt|Login")
	TObjectPtr<UTexture2D> LoginBackgroundTexture;

	virtual TSharedPtr<IHktUIView> CreateView() const override;
	virtual UHktUIAnchorStrategy* CreateStrategy(UObject* Outer) const override;
};
