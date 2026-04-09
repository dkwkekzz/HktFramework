// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktLoginPlayerController.h"
#include "HktRuntimeLog.h"
#include "HktGameInstance.h"
#include "HktRuntimeCommands.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Components/HktLoginComponent.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/InputSettings.h"

AHktLoginPlayerController::AHktLoginPlayerController()
{
}

void AHktLoginPlayerController::BeginPlay()
{
	Super::BeginPlay();

	// 로그인 화면은 UI 전용 입력
	SetInputMode(FInputModeUIOnly());
	bShowMouseCursor = true;

	UE_LOG(LogHktRuntime, Log, TEXT("LoginPlayerController ready"));
}

// ============================================================================
// IHktPlayerInteractionInterface 구현
// ============================================================================

void AHktLoginPlayerController::ExecuteCommand(UObject* CommandData)
{
	if (!CommandData)
	{
		return;
	}

	// 로그인 명령 처리
	if (UHktLoginRequest* LoginRequest = Cast<UHktLoginRequest>(CommandData))
	{
		UHktLoginComponent* LoginComp = FindComponentByClass<UHktLoginComponent>();
		if (LoginComp)
		{
			LoginComp->Server_RequestLogin(LoginRequest->UserID, LoginRequest->Password);
		}
	}
}

bool AHktLoginPlayerController::GetWorldState(const FHktWorldState*& OutState) const
{
	OutState = nullptr;
	return false;
}

FOnHktWorldViewUpdated& AHktLoginPlayerController::OnWorldViewUpdated()
{
	return WorldViewUpdatedDelegate;
}

FOnHktWheelInput& AHktLoginPlayerController::OnWheelInput()
{
	return WheelInputDelegate;
}

FOnHktSubjectChanged& AHktLoginPlayerController::OnSubjectChanged()
{
	return SubjectChangedDelegate;
}

FOnHktTargetChanged& AHktLoginPlayerController::OnTargetChanged()
{
	return TargetChangedDelegate;
}

FOnHktIntentSubmitted& AHktLoginPlayerController::OnIntentSubmitted()
{
	return IntentSubmittedDelegate;
}
