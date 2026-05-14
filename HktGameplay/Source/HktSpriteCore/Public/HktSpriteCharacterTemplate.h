// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktTagDataAsset.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCharacterTemplate.generated.h"

class UTexture2D;

// ============================================================================
// UHktSpriteCharacterTemplate — [DEPRECATED] HISM/Niagara 경로의 구(舊)
// Visual+Animation 통합 자산.
//
// ⚠ DEPRECATED: 신규 작업은 Visual 과 Animation 을 분리한 다음 자산을 사용:
//    - `UHktHISMSpriteVisualAsset`             (Visual 진입 — Atlas/PixelToWorld + 옵션 Animation)
//    - `UHktHISMSpriteAnimationDataAsset`      (동적 애니메이션 — Animations TMap)
//
//    정적 객체(나무·바위 등) 는 Visual 자산만 두고 AnimationAsset 슬롯을 비워둔다.
//
//    본 클래스는 기존 직렬화 자산 호환을 위해 그대로 유지되며 Crowd/Niagara
//    Renderer 는 본 자산도 계속 소비한다. UCLASS `Deprecated` 플래그는 자산
//    호환을 깨므로 사용하지 않는다.
//
// 기존 동작:
//   각 캐릭터당 하나의 TagDataAsset. `IdentifierTag`(CharacterTag)로 비동기 로드.
//   Animations 맵: AnimTag → FHktSpriteAnimation (그리드 + 프레임 리스트).
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

	virtual EHktRenderCategory GetRenderCategory() const override { return EHktRenderCategory::MassEntity; }
};
