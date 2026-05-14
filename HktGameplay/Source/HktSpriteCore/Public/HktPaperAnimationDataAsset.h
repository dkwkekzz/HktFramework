// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktPaperCharacterTemplate.h"  // FHktPaperAnimDirKey / FHktPaperAnimMeta 재사용
#include "HktPaperAnimationDataAsset.generated.h"

class UPaperFlipbook;

// ============================================================================
// UHktPaperAnimationDataAsset — Paper2D 경로의 *애니메이션 전용* 데이터 자산.
//
// 기존 `UHktPaperCharacterTemplate` 의 깨끗한 재명명. "Character" 라는 명칭이
// 캐릭터 전용 의미를 강제하던 문제를 해소하고, Visual(=`UHktPaperActorVisualDataAsset`)
// 과 Animation 을 명확히 분리한다. 정적 객체(나무·바위 등)는 Visual 자산에 단일
// `UPaperSprite` 만 두고 본 Animation 자산은 비워둔다.
//
// 구조 / 의미는 기존 Template 과 동일:
//   - (AnimTag, DirIdx) → UPaperFlipbook 룩업 테이블 (`Flipbooks`)
//   - AnimTag → 메타(`FHktPaperAnimMeta`) (`Animations`)
//   - 미러 dir(W/SW/NW) 은 키 미생성 — 액터가 X-스케일 -1 로 미러.
//
// 비동기 로드 진입점은 `UHktPaperActorVisualDataAsset::IdentifierTag`. 본 자산은
// Visual 자산이 `AnimationAsset` 슬롯으로 하드 참조하므로 같은 비동기 배치에
// 함께 끌려온다.
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperAnimationDataAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	/** 1 픽셀이 월드에서 차지하는 단위 (cm/px). UPaperSprite::PixelsPerUnrealUnit = 1 / PixelToWorld. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.f;

	/** AnimTag 룩업 실패 시 폴백. 비어 있으면 Animations 의 첫 원소. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	FGameplayTag DefaultAnimTag;

	/** AnimTag → 메타. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TMap<FGameplayTag, FHktPaperAnimMeta> Animations;

	/**
	 * (AnimTag, DirIdx) → UPaperFlipbook. 미러 dir(W/SW/NW) 은 키 미생성.
	 * 하드 참조 — Visual 자산 비동기 로드 시 함께 끌려옴.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TMap<FHktPaperAnimDirKey, TObjectPtr<UPaperFlipbook>> Flipbooks;

	/** 정확히 일치하는 anim 메타 반환. 없으면 nullptr. */
	const FHktPaperAnimMeta* FindAnimation(const FGameplayTag& AnimTag) const;

	/** FindAnimation 실패 시 DefaultAnimTag → 맵의 첫 원소 순으로 폴백. */
	const FHktPaperAnimMeta* FindAnimationOrFallback(const FGameplayTag& AnimTag, FGameplayTag* OutResolvedTag = nullptr) const;
};
