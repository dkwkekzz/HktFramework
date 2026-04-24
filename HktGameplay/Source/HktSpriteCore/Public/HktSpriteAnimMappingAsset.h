// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktSpriteAnimMappingAsset.generated.h"

// ============================================================================
// FHktSpriteAnimMappingEntry — Anim 태그 → ActionId 매핑
//
// UHktAnimInstance는 태그에 대해 Montage/Sequence/BlendSpace를 지정했으나,
// 스프라이트는 PartTemplate.Actions 맵의 ActionId(FName) 하나만 사용한다.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAnimMappingEntry
{
	GENERATED_BODY()

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FGameplayTag AnimTag;

	/** PartTemplate.Actions 키. e.g. "idle", "walk", "attack_1". */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FName ActionId = NAME_None;

	/** true이면 재생 속도에 AttackPlayRate를 곱한다 (공격/스킬 액션 계열). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	bool bIsCombat = false;
};

// ============================================================================
// FHktSpriteStanceMapping — Stance별 ActionId 치환 규약
//
// 3D의 LinkAnimClassLayers는 AnimBP 클래스 자체를 교체했지만, 스프라이트에선
// PartTemplate의 Action 키만 바꿔주면 된다. 예) Stance=Sword → "attack_1" →
// "sword_attack_1".
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteStanceMapping
{
	GENERATED_BODY()

	/** ActionId 치환 테이블. key=기본 ActionId, value=해당 Stance에서 사용할 ActionId. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	TMap<FName, FName> ActionIdOverrides;
};

// ============================================================================
// UHktSpriteAnimMappingAsset
//
// 스프라이트 anim 의사결정에 필요한 "매핑 테이블"만 담은 경량 DataAsset.
// (AnimBP가 담당하던 역할 중 매핑 테이블에 해당하는 부분만 분리)
//
// - 크라우드 전체가 1개의 인스턴스를 공유 (AHktSpriteCrowdHost 멤버).
// - 순수 데이터 컨테이너. 상태/로직 없음 — 로직은 HktSpriteAnimProcessor,
//   엔터티 상태는 FHktSpriteAnimFragment가 보유.
// - Generator는 RegisterMapping API로 런타임에 항목을 추가/갱신할 수 있다.
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktSpriteAnimMappingAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, Category = "HKT|SpriteAnim")
	TArray<FHktSpriteAnimMappingEntry> AnimMappings;

	/** Stance Tag → 해당 Stance에서 적용할 ActionId 오버라이드. */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|SpriteAnim")
	TMap<FGameplayTag, FHktSpriteStanceMapping> StanceMappings;

	/** 어떤 애니 태그도 활성 상태가 아닐 때 사용할 기본 ActionId. */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|SpriteAnim")
	FName DefaultActionId = TEXT("idle");

	/** true이면 매핑에 없는 태그에 대해 tag leaf를 소문자로 변환해 ActionId로 사용(기존 동작 호환). */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|SpriteAnim")
	bool bUseTagLeafFallback = true;

	// ========== 조회 ==========

	const FHktSpriteAnimMappingEntry* FindMapping(const FGameplayTag& Tag) const
	{
		if (!Tag.IsValid()) return nullptr;
		for (const FHktSpriteAnimMappingEntry& Entry : AnimMappings)
		{
			if (Entry.AnimTag.MatchesTagExact(Tag))
			{
				return &Entry;
			}
		}
		return nullptr;
	}

	// ========== 동적 매핑 등록 (Generator 연동) ==========

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteAnim")
	void RegisterMapping(FGameplayTag AnimTag, FName ActionId, bool bIsCombat = false);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteAnim")
	void UnregisterMapping(FGameplayTag AnimTag);

	UFUNCTION(BlueprintPure, Category = "HKT|SpriteAnim")
	bool HasMapping(FGameplayTag AnimTag) const { return FindMapping(AnimTag) != nullptr; }
};
