// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Components/HktLoginComponent.h"
#include "HktRuntimeLog.h"
#include "HktCoreEventLog.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"

UHktLoginComponent::UHktLoginComponent()
{
	SetIsReplicatedByDefault(true);
}

bool UHktLoginComponent::Server_RequestLogin_Validate(const FString& ID, const FString& PW)
{
	return !ID.IsEmpty() && !PW.IsEmpty();
}

void UHktLoginComponent::Server_RequestLogin_Implementation(const FString& ID, const FString& PW)
{
	// 서버에서 로그인 검증 (TODO: 실제 웹 API/DB 연동)
	// 현재는 목(mock): 유효한 ID면 성공
	const bool bSuccess = !ID.IsEmpty();
	const FString Token = bSuccess ? (TEXT("MockToken_") + ID) : FString();
	const FString UserID = bSuccess ? ID : FString();

	Client_ReceiveLoginResult(bSuccess, Token, UserID);
}

void UHktLoginComponent::Client_ReceiveLoginResult_Implementation(bool bSuccess, const FString& Token, const FString& InUserID)
{
	if (bSuccess)
	{
		OnLoginSuccess(Token, InUserID);
	}
	else
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Warning, EHktLogSource::Client, TEXT("HktLoginComponent: Login failed (server rejected)"));
	}
}

void UHktLoginComponent::OnLoginSuccess(const FString& Token, const FString& InUserID)
{
	APlayerController* PC = Cast<APlayerController>(GetOwner());
	if (!PC)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Error, EHktLogSource::Client, TEXT("HktLoginComponent: Owner is not a PlayerController"));
		return;
	}

	// 로그인 정보를 컴포넌트에 저장
	ClientUserSessionToken = Token;
	ClientUserID = InUserID;

	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	if (!Settings || Settings->InGameMap.IsNull())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Error, EHktLogSource::Client, TEXT("HktLoginComponent: InGameMap is not set in Hkt Runtime Settings"));
		return;
	}

	const TSoftObjectPtr<UWorld>& Level = Settings->InGameMap;
	HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("HktLoginComponent: Login success, opening level '%s'"), *Level.GetLongPackageName()));
	UGameplayStatics::OpenLevelBySoftObjectPtr(PC, Level);
}
