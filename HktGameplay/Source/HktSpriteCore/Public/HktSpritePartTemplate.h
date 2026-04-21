// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTagDataAsset.h"
#include "HktSpriteTypes.h"
#include "HktSpritePartTemplate.generated.h"

class UTexture2D;
class UStaticMesh;
class UMaterialInterface;

// ============================================================================
// UHktSpritePartTemplate — 한 파츠 종류(Body/Head/...)의 액션 풀 + 아틀라스
// HktAsset 태그 파이프라인(UHktTagDataAsset)에 등록되어 `IdentifierTag`로 로드됨.
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

	/** 이 파츠가 제공하는 모든 액션. 키: ActionId ("idle","walk","attack_1"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="HKT|Sprite")
	TMap<FName, FHktSpriteAction> Actions;

	/** 해당 액션을 찾아 반환. 없으면 nullptr. */
	const FHktSpriteAction* FindAction(FName ActionId) const;
};
