// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "IHktUIView.h"
#include "IHktUIViewFactory.generated.h"

class UHktUIAnchorStrategy;

/**
 * CreateView / CreateStrategy 기능을 정의하는 인터페이스.
 * UHktTagDataAsset을 상속한 UI DataAsset이 이 인터페이스를 구현하여
 * 태그 기반 비동기 로드 후 뷰/전략 생성을 제공합니다.
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UHktUIViewFactory : public UInterface
{
	GENERATED_BODY()
};

class HKTUI_API IHktUIViewFactory
{
	GENERATED_BODY()

public:
	/** Factory Method: 구체적인 View 생성은 구현체에서 정의 */
	virtual TSharedPtr<IHktUIView> CreateView() const = 0;

	/** 전략 객체 생성 (구현체에서 DefaultAnchorStrategyClass 등 활용) */
	virtual UHktUIAnchorStrategy* CreateStrategy(UObject* Outer) const = 0;
};
