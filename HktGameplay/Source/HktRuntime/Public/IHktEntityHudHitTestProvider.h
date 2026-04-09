// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HktCoreDefs.h"
#include "IHktEntityHudHitTestProvider.generated.h"

UINTERFACE(MinimalAPI)
class UHktEntityHudHitTestProvider : public UInterface
{
	GENERATED_BODY()
};

/**
 * 엔티티 HUD 위젯 위의 커서 히트 테스트를 제공하는 인터페이스.
 * HUD에서 구현하여, SelectionPolicy가 3D 트레이스 실패 시 엔티티 HUD 클릭을 감지할 수 있게 합니다.
 */
class HKTRUNTIME_API IHktEntityHudHitTestProvider
{
	GENERATED_BODY()

public:
	/**
	 * 주어진 스크린 좌표가 엔티티 HUD 위에 있는지 검사합니다.
	 * @param ScreenPos  뷰포트 픽셀 좌표
	 * @param OutEntityId  히트된 엔티티 ID
	 * @return 엔티티 HUD 히트 시 true
	 */
	virtual bool GetEntityUnderScreenPosition(const FVector2D& ScreenPos, FHktEntityId& OutEntityId) const = 0;
};
