// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktPaperCharacterTemplate.generated.h"

class UPaperFlipbook;

// ============================================================================
// UHktPaperCharacterTemplate — [DEPRECATED] Paper2D 경로의 구(舊) 캐릭터 데이터.
//
// ⚠ DEPRECATED: 신규 `UHktPaperAnimationDataAsset` 으로 대체. 명칭이 캐릭터
//    의미를 강제해 정적 객체(나무·바위 등)에 어울리지 않는다. 신규 자산 작성
//    시에는 Visual(`UHktPaperActorVisualDataAsset`) + Animation
//    (`UHktPaperAnimationDataAsset`) + Static Sprite 의 3-슬롯 구조를 사용한다.
//    기존 자산과 그 직렬화 데이터는 그대로 유지되며 본 클래스/구조체는
//    호환을 위해 보존된다.
//
// FHktPaperAnimDirKey / FHktPaperAnimMeta 는 신규 `UHktPaperAnimationDataAsset`
// 에서도 재사용한다 — 별도 deprecation 없이 본 헤더에 그대로 둔다.
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

// 신규 자산 작성 시에는 UHktPaperAnimationDataAsset 을 사용한다. 본 클래스는
// 기존 직렬화 자산 호환을 위해 그대로 유지된다 (deprecation marker 없음 — UHT
// 의 `Deprecated` UCLASS 플래그는 `UDEPRECATED_` 클래스 rename 을 요구해 자산
// 호환을 깨므로 사용하지 않는다).
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
