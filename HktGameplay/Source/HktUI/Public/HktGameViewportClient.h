// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "CommonGameViewportClient.h"
#include "HktGameViewportClient.generated.h"

/**
 * CommonUI 입력 라우팅이 정상 동작하도록 UCommonGameViewportClient를 상속받은 뷰포트 클라이언트.
 * Config/DefaultEngine.ini의 GameViewportClientClassName으로 지정된다.
 */
UCLASS()
class HKTUI_API UHktGameViewportClient : public UCommonGameViewportClient
{
	GENERATED_BODY()
};
