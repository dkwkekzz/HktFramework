// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "HktPaperActorVisualDataAsset.generated.h"

class UHktPaperAnimationDataAsset;     // 신규 애니메이션 자산
class UPaperSprite;                    // 정적 객체 스프라이트

/**
 * Paper2D 경로 전용 비주얼 등록 자산.
 *
 * `UHktActorVisualDataAsset` 가 들고 있는 `ActorClass` (= `AHktSpritePaperActor`)
 * 위에 두 가지 컨텐츠 슬롯을 얹는다:
 *
 *   1. `AnimationAsset` — 동적 객체(캐릭터·몹). (AnimTag, DirIdx)→Flipbook 룩업.
 *   2. `StaticSprite`   — 정적 객체(나무·바위 등). 단일 `UPaperSprite` 1장.
 *
 * 두 슬롯의 우선순위: `AnimationAsset` ≻ `StaticSprite`.
 * 즉, AnimationAsset 이 채워져 있으면 동적 경로, 아니면 정적 경로로 fallback.
 *
 * 본 자산이 `UHktAssetSubsystem::LoadAssetAsync(VisualTag)` 의 진입점이며,
 * Animation 의 하드 참조를 통해 모든 Flipbook/Sprite/Atlas 를 같은 비동기 배치에
 * 끌어온다.
 *
 * 등록 컨벤션:
 *   - 캐릭터:   `IdentifierTag = PaperSprite.Character.{Name}`
 *   - 정적 객체: `IdentifierTag = PaperSprite.Prop.{Category}.{Name}`
 *                  (예: `PaperSprite.Prop.Tree.Oak`)
 *   - `ActorClass = AHktSpritePaperActor::StaticClass()`
 */
UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperActorVisualDataAsset : public UHktActorVisualDataAsset
{
	GENERATED_BODY()

public:
	/**
	 * 동적 객체(캐릭터·몹)의 애니메이션 데이터.
	 * 비어 있으면 정적 경로로 폴백. 채워져 있으면 동적 경로를 우선한다.
	 * 하드 참조 — 본 자산 비동기 로드 시 모든 Flipbook 이 함께 끌려옴.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TObjectPtr<UHktPaperAnimationDataAsset> AnimationAsset;

	/**
	 * 정적 객체용 단일 스프라이트.
	 * `AnimationAsset` 가 비어 있고 본 슬롯이 채워져 있으면 액터는 `SetSprite` 로
	 * 일회성 바인딩 후 매 프레임 빌보드 회전만 갱신한다.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TSoftObjectPtr<UPaperSprite> StaticSprite;

	/**
	 * 정적 경로에서 사용되는 픽셀→월드 변환(cm/px). 동적 경로에서는
	 * `AnimationAsset->PixelToWorld` 가 우선.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|PaperSprite", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.f;
};
