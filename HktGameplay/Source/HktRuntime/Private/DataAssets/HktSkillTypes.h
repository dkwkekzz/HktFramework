// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktSkillTypes.generated.h"

UENUM(BlueprintType)
enum class EHktActionTargetType : uint8
{
	None        UMETA(DisplayName = "None"),
	Self        UMETA(DisplayName = "Self"),
	Ally        UMETA(DisplayName = "Ally"),
	Enemy       UMETA(DisplayName = "Enemy"),
	Location    UMETA(DisplayName = "Location"),
};

/**
 * FHktSkillEntry - 스킬 정의 (입력 바인딩과 무관한 순수 데이터)
 *
 * 캐릭터 기본 스킬, 아이템 스킬 등 모든 스킬의 슬롯 할당 단위.
 * SyncSlotBindingsFromWorldState에서 캐릭터 엔티티의 EquipSlot 프로퍼티를 통해 설정.
 */
USTRUCT(BlueprintType)
struct HKTRUNTIME_API FHktSkillEntry
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Skill")
	FGameplayTag EventTag;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Skill")
	EHktActionTargetType TargetType = EHktActionTargetType::None;

	bool IsTargetRequired() const
	{
		return TargetType != EHktActionTargetType::None
			&& TargetType != EHktActionTargetType::Self;
	}

	bool IsValid() const { return EventTag.IsValid(); }
};
