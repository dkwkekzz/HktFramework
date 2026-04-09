// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktHUD.h"
#include "HktLoginHUD.generated.h"

/**
 * 로그인 맵 전용 HUD.
 * BeginPlay 시 LoginHud 위젯을 로드합니다.
 * LoginComponent는 PlayerController에 BP에서 부착합니다.
 * GameMode의 HUDClass에 설정하여 사용합니다.
 */
UCLASS()
class HKTUI_API AHktLoginHUD : public AHktHUD
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;

protected:
	/** 로그인 위젯의 GameplayTag (기본값: Widget.LoginHud) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FGameplayTag LoginWidgetTag;
};
