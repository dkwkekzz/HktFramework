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
// FHktSpriteLocomotionMapping — Tag 없이 Movement Property로 추론하는 기본 액션
//
// 3D는 AnimBP의 BlendSpace가 bIsMoving/MoveSpeed/bIsFalling을 읽어 idle/walk/run
// 을 자동 선택했다. 스프라이트는 BlendSpace가 없으므로 Processor가 직접 추론한다.
//
// 태그 우선순위(Montage > UpperBody > FullBody) 어느 레이어에도 활성 태그가
// 없을 때 이 블록이 사용된다. Anim.FullBody.Jump 같은 명시 태그가 있으면
// 이 블록은 건너뛰고 기존 태그 매핑이 우선.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteLocomotionMapping
{
	GENERATED_BODY()

	/** true이면 tag가 없을 때 아래 필드로 ActionId 추론. false면 DefaultActionId만 사용. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	bool bEnabled = true;

	/** 정지 상태 기본 액션. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FName IdleActionId = TEXT("idle");

	/** bIsMoving && MoveSpeed < RunSpeedThreshold 일 때. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FName WalkActionId = TEXT("walk");

	/** bIsMoving && MoveSpeed >= RunSpeedThreshold 일 때. 비우면 항상 Walk. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FName RunActionId = TEXT("run");

	/** bIsFalling(공중) 일 때. 비우면 locomotion 추론 생략하고 다음 폴백으로. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	FName FallActionId = NAME_None;

	/** Walk↔Run 전환 속도 (cm/s). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim", meta = (ClampMin = "0.0"))
	float RunSpeedThreshold = 300.f;

	/**
	 * true이면 PlayRate를 MoveSpeed/ReferenceMoveSpeed로 스케일. 보폭과 재생 속도를
	 * 속도에 연동시켜 slow-walk/quick-walk 양쪽에서 자연스럽게 보이게 한다.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim")
	bool bScalePlayRateByMoveSpeed = false;

	/** bScalePlayRateByMoveSpeed=true일 때 PlayRate=1.0에 해당하는 기준 속도. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim",
		meta = (ClampMin = "1.0", EditCondition = "bScalePlayRateByMoveSpeed"))
	float ReferenceMoveSpeed = 200.f;

	/** PlayRate 스케일 범위 상/하한 (너무 느리거나 빠른 속도에서 안정화). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim",
		meta = (ClampMin = "0.01", EditCondition = "bScalePlayRateByMoveSpeed"))
	float MinPlayRate = 0.25f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|SpriteAnim",
		meta = (ClampMin = "0.01", EditCondition = "bScalePlayRateByMoveSpeed"))
	float MaxPlayRate = 3.0f;
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

	/** Tag 없이 Movement Property로 추론하는 idle/walk/run/fall 매핑. */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|SpriteAnim")
	FHktSpriteLocomotionMapping Locomotion;

	/** Locomotion 추론으로도 결정 못 할 때 사용하는 최종 폴백. */
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
