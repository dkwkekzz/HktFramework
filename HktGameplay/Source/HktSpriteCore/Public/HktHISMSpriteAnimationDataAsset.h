// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.h"  // FHktSpriteAnimation 재사용
#include "HktHISMSpriteAnimationDataAsset.generated.h"

class UTexture2D;

// ============================================================================
// UHktHISMSpriteAnimationDataAsset — HISM/Niagara 경로의 *애니메이션 전용* 자산.
//
// Visual 자산(`UHktHISMSpriteVisualAsset`) 과 Animation 을 분리한 자산. "Character"
// 의미가 정적 객체(나무·바위 등) 와 어울리지 않던 문제 해소. Visual 이 본 자산을
// `AnimationAsset` 슬롯으로 하드 참조한다.
//
// 본 자산은 `UHktTagDataAsset` 을 상속하지 않으며 `UHktAssetSubsystem` 의
// IdentifierTag 로 직접 로드되지 않는다 — Visual 자산을 통해 끌려온다.
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktHISMSpriteAnimationDataAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	/**
	 * AnimTag → Animation. 예: Anim.FullBody.Locomotion.Idle.
	 * Visual 자산의 Atlas/AtlasCellSize 가 폴백으로 동작 — Animation 자체가 Atlas
	 * 를 비워두면 Visual 폴백을 사용한다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite")
	TMap<FGameplayTag, FHktSpriteAnimation> Animations;

	/** 매칭되는 AnimTag 가 없을 때 사용할 폴백 애니의 태그. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite")
	FGameplayTag DefaultAnimTag;

	/** 주어진 태그와 정확히 일치하는 애니를 반환. 없으면 nullptr. */
	const FHktSpriteAnimation* FindAnimation(const FGameplayTag& AnimTag) const;

	/** FindAnimation 실패 시 DefaultAnimTag → 맵의 첫 원소 순으로 폴백. */
	const FHktSpriteAnimation* FindAnimationOrFallback(const FGameplayTag& AnimTag) const;
};
