// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktTagDataAsset.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCharacterTemplate.generated.h"

class UTexture2D;

// ============================================================================
// UHktSpriteCharacterTemplate — 한 캐릭터의 모든 애니메이션 + 아틀라스
//
// 각 캐릭터는 유일한 애니메이션 세트를 가진다. 파츠(Body/Head/Weapon…)로 나눠
// 공유하던 기존 구조는 공유가 성립하지 않아 오버헤드만 컸다. 이 템플릿은
// "캐릭터당 하나의 TagDataAsset"이며, HktAsset 태그 파이프라인을 통해
// `IdentifierTag`(CharacterTag)로 비동기 로드된다.
//
// Animations 맵: AnimTag → FHktSpriteAnimation (그리드 + 프레임 리스트).
// Renderer는 매 프레임 FindAnimationOrFallback(AnimTag) 로 애니를 해석.
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktSpriteCharacterTemplate : public UHktTagDataAsset
{
	GENERATED_BODY()

public:
	/**
	 * 캐릭터 공통(폴백) 아틀라스. 애니메이션이 `FHktSpriteAnimation::Atlas`를 개별 지정한 경우
	 * 그쪽이 우선하고, 비워둔 애니만 이 필드를 사용한다.
	 * Python 일괄 파이프라인(단일 아틀라스)은 여기만 채우고, BuildSpriteAnim 증분 파이프라인은
	 * 애니별 아틀라스를 채운다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	TSoftObjectPtr<UTexture2D> Atlas;

	/** 캐릭터 공통(폴백) 셀 크기. 애니별 `AtlasCellSize`가 0일 때 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	FVector2f AtlasCellSize = FVector2f(64.f, 64.f);

	/** 1 픽셀이 월드에서 차지하는 단위 (cm/px). Crowd Renderer 쿼드 크기 결정. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite", meta=(ClampMin="0.1"))
	float PixelToWorld = 2.0f;

	/**
	 * AnimTag → Animation. 예: Anim.FullBody.Locomotion.Idle.
	 * 캐릭터당 보통 수~수십 개 애니이므로 TMap 룩업이면 충분.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	TMap<FGameplayTag, FHktSpriteAnimation> Animations;

	/**
	 * 매칭되는 AnimTag가 없을 때 사용할 폴백 애니의 태그.
	 * 기본값으로 Anim.FullBody.Locomotion.Idle을 권장.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	FGameplayTag DefaultAnimTag;

	/** 주어진 태그와 정확히 일치하는 애니를 반환. 없으면 nullptr. */
	const FHktSpriteAnimation* FindAnimation(const FGameplayTag& AnimTag) const;

	/** FindAnimation 실패 시 DefaultAnimTag → 맵의 첫 원소 순으로 폴백. */
	const FHktSpriteAnimation* FindAnimationOrFallback(const FGameplayTag& AnimTag) const;
};
