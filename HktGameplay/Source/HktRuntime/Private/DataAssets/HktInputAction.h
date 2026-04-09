// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// DEPRECATED: UHktInputAction은 더 이상 사용하지 않습니다.
// 스킬 데이터는 FHktSkillEntry(HktSkillTypes.h)로 이동되었으며,
// 입력 바인딩은 순수 UInputAction을 사용합니다.
// 기존 DataAsset 호환을 위해 클래스 자체는 유지합니다.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "InputAction.h"
#include "DataAssets/HktSkillTypes.h"
#include "HktInputAction.generated.h"

class UTexture2D;

UCLASS(BlueprintType)
class HKTRUNTIME_API UHktInputAction : public UInputAction
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Action")
	FText ActionName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Action")
	TObjectPtr<UTexture2D> Icon;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Action")
	FGameplayTag EventTag;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Action")
	EHktActionTargetType TargetType = EHktActionTargetType::None;
};
