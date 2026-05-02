// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktPaperCharacterTemplate.generated.h"

class UPaperFlipbook;

// ============================================================================
// UHktPaperCharacterTemplate — Paper2D 경로 전용 캐릭터 데이터.
//
// HISM/Niagara 경로의 `UHktSpriteCharacterTemplate` 와는 별개. 본 템플릿은
// (AnimTag, DirIdx) → UPaperFlipbook 룩업 테이블을 들고 있으며, 런타임 액터
// (`AHktSpritePaperActor`, PR-2) 가 매 프레임 `Flipbooks.Find({...})` 한다.
//
// 비동기 로드 진입점은 `UHktPaperActorVisualDataAsset::IdentifierTag`(예:
// `PaperSprite.Character.Knight`) — 이 비주얼 자산이 본 템플릿을 하드 참조로
// 끌어오므로 `UHktAssetSubsystem::LoadAssetAsync(VisualTag)` 한 번에 모든
// Flipbook/Sprite/Atlas 가 함께 로드된다.
//
// 미러 dir(W/SW/NW) 은 키를 만들지 않는다 — 액터가 X-스케일로 처리.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktPaperAnimDirKey
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|PaperSprite")
	FGameplayTag AnimTag;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|PaperSprite")
	uint8 DirIdx = 0;

	bool operator==(const FHktPaperAnimDirKey& Other) const
	{
		return AnimTag == Other.AnimTag && DirIdx == Other.DirIdx;
	}
};

FORCEINLINE uint32 GetTypeHash(const FHktPaperAnimDirKey& Key)
{
	return HashCombine(GetTypeHash(Key.AnimTag), GetTypeHash(Key.DirIdx));
}

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktPaperAnimMeta
{
	GENERATED_BODY()

	/** 1 / 5 / 8 — 기존 양자화 규약 (HktSpriteFrameResolver 와 동일). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	int32 NumDirections = 8;

	/** 한 프레임 지속(ms). Flipbook FramesPerSecond = 1000 / FrameDurationMs. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite", meta = (ClampMin = "1.0"))
	float FrameDurationMs = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	bool bLooping = true;

	/** W/SW/NW 방향이 키를 안 들고 있을 때 액터가 X-스케일로 미러할지 여부. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	bool bMirrorWestFromEast = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	FVector2f Scale = FVector2f(1.f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	FLinearColor Tint = FLinearColor::White;
};

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperCharacterTemplate : public UDataAsset
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
	 * (AnimTag, DirIdx) → UPaperFlipbook. 미러 dir(W/SW/NW) 은 키 미생성 —
	 * 액터가 동측(E/SE/NE) Flipbook 을 X-스케일 -1 로 미러.
	 *
	 * 하드 참조 (TObjectPtr) — 비주얼 자산 로드 시 함께 끌려와야 매 프레임 룩업이
	 * 동기적으로 가능. 다중 캐릭터 메모리 압박 시 PR-3 에서 TSoftObjectPtr 마이그레이션.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TMap<FHktPaperAnimDirKey, TObjectPtr<UPaperFlipbook>> Flipbooks;

	/** 정확히 일치하는 anim 메타 반환. 없으면 nullptr. */
	const FHktPaperAnimMeta* FindAnimation(const FGameplayTag& AnimTag) const;

	/** FindAnimation 실패 시 DefaultAnimTag → 맵의 첫 원소 순으로 폴백. */
	const FHktPaperAnimMeta* FindAnimationOrFallback(const FGameplayTag& AnimTag, FGameplayTag* OutResolvedTag = nullptr) const;
};
