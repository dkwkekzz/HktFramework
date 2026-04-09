// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "HktRuntimeCommands.generated.h"

/**
 * 로그인 요청 데이터를 담는 UObject.
 * HandleUICommand를 통해 전달됩니다.
 */
UCLASS(BlueprintType)
class HKTRUNTIME_API UHktLoginRequest : public UObject
{
	GENERATED_BODY()

public:
	UHktLoginRequest() {}

	/** 사용자 ID */
	UPROPERTY(BlueprintReadWrite, Category = "Login")
	FString UserID;

	/** 비밀번호 */
	UPROPERTY(BlueprintReadWrite, Category = "Login")
	FString Password;
};
