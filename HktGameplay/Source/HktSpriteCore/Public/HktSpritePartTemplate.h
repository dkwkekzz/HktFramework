// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktTagDataAsset.h"
#include "HktSpriteTypes.h"
#include "HktSpritePartTemplate.generated.h"

class UTexture2D;
class UStaticMesh;
class UMaterialInterface;

// ============================================================================
// UHktSpritePartTemplate — 한 파츠 종류(Body/Head/...)의 액션 풀 + 아틀라스
// HktAsset 태그 파이프라인(UHktTagDataAsset)에 등록되어 `IdentifierTag`로 로드됨.
//
// 액션은 GameplayTag로 키잉된다 (예: Anim.FullBody.Locomotion.Idle). Generator가
// 아틀라스에서 PartTemplate을 빌드할 때, 각 액션의 `AnimTag` 필드를 직접 채워
// Processor가 별도의 매핑 테이블 없이 Tag → Action으로 바로 해석할 수 있게 한다.
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktSpritePartTemplate : public UHktTagDataAsset
{
	GENERATED_BODY()

public:
	/** 이 파츠가 채우는 슬롯 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	EHktSpritePartSlot PartSlot = EHktSpritePartSlot::Body;

	/** 파츠의 모든 프레임이 들어있는 아틀라스. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	TSoftObjectPtr<UTexture2D> Atlas;

	/** 단일 프레임 픽셀 크기 (아틀라스 셀 그리드). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	FVector2f AtlasCellSize = FVector2f(64.f, 64.f);

	/** 1 픽셀이 월드에서 차지하는 단위 (cm/px). Crowd Renderer 쿼드 크기 결정. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite", meta=(ClampMin="0.1"))
	float PixelToWorld = 2.0f;

	/**
	 * 이 파츠가 제공하는 모든 액션. 각 액션의 `AnimTag`로 조회한다.
	 * 파츠당 보통 수~십수 개 액션이므로 TArray + 선형 탐색이면 충분.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	TArray<FHktSpriteAction> Actions;

	/**
	 * 매칭되는 AnimTag가 없을 때 사용할 폴백 액션의 태그.
	 * 기본값으로 Anim.FullBody.Locomotion.Idle을 권장. 비워두면 Actions[0] 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	FGameplayTag DefaultAnimTag;

	/** 주어진 태그와 정확히 일치하는 액션을 반환. 없으면 nullptr. */
	const FHktSpriteAction* FindAction(const FGameplayTag& AnimTag) const;

	/** FindAction 실패 시 DefaultAnimTag → Actions[0] 순으로 폴백하는 조회. */
	const FHktSpriteAction* FindActionOrFallback(const FGameplayTag& AnimTag) const;
};
