// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktLoginHUD.h"
#include "HktUIElement.h"
#include "Widgets/SHktLoginHudWidget.h"
#include "HktUITags.h"
#include "GameFramework/PlayerController.h"

void AHktLoginHUD::BeginPlay()
{
	Super::BeginPlay();

	APlayerController* PC = GetOwningPlayerController();
	if (!PC) return;

	// UI 전용 입력 모드 설정
	PC->SetInputMode(FInputModeUIOnly());
	PC->bShowMouseCursor = true;

	// 위젯 태그 설정 (기본값 없으면 Widget.LoginHud)
	if (!LoginWidgetTag.IsValid())
	{
		LoginWidgetTag = HktGameplayTags::Widget_LoginHud;
	}

	// 로그인 위젯 비동기 로드 및 생성
	LoadAndCreateWidget(LoginWidgetTag, [PC](UHktUIElement* Element)
	{
		if (Element && Element->View.IsValid())
		{
			// Slate 위젯에 PC 전달
			TSharedRef<SWidget> SlateWidget = Element->View->GetSlateWidget();
			TSharedPtr<SHktLoginHudWidget> LoginWidget = StaticCastSharedRef<SHktLoginHudWidget>(SlateWidget);
			if (LoginWidget.IsValid())
			{
				LoginWidget->SetOwningPlayerController(PC);
			}
		}
	});
}
