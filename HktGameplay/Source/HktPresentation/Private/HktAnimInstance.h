// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "GameplayTagContainer.h"
#include "HktAnimInstance.generated.h"

class UAnimMontage;
class UAnimSequence;
class UBlendSpace;

/**
 * 애니메이션 태그 → 에셋 매핑 엔트리
 * 하나의 태그에 대해 Montage/Sequence/BlendSpace 중 설정된 에셋을 자동 재생
 */
USTRUCT(BlueprintType)
struct FHktAnimMappingEntry
{
	GENERATED_BODY()

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Animation")
	FGameplayTag AnimTag;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Animation")
	TObjectPtr<UAnimMontage> Montage;

	/** 몽타주의 특정 섹션에서 시작 (None이면 처음부터 재생) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Animation")
	FName StartSection = NAME_None;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Animation")
	TObjectPtr<UAnimSequence> Sequence;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Animation")
	TObjectPtr<UBlendSpace> BlendSpace;
};

/**
 * UHktAnimInstance
 *
 * Entity의 TagContainer에서 Anim.* 태그를 읽어 애니메이션을 자동 재생.
 * Story에서 애니메이션 명령을 직접 내리지 않고, 상태 태그만 추가/제거하면
 * AnimInstance가 태그 변화를 감지하여 적절한 애니메이션을 재생한다.
 *
 * 태그 계층 기반 애니메이션 관리:
 * - Anim.FullBody.*  → Locomotion (Property 참조, 그래프 노드에서 처리)
 * - Anim.UpperBody.* → DefaultSlot (몽타주/시퀀스 실행)
 * - Anim.Montage.*   → DefaultSlot (원샷 몽타주 실행)
 *
 * 매핑 테이블은 AnimBP 클래스 기본값에서 직접 설정합니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	// ========== 런타임 상태 (Renderer에서 갱신) ==========

	/** 부모 태그별 애니메이션 상태 (부모 태그 → AnimTag 매핑) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	TMap<FGameplayTag, FGameplayTag> AnimLayerTags;

	/** FullBody 애니메이션 상태 태그 (하위호환) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	FGameplayTag AnimStateTag;

	/** 이동 중 여부 */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	bool bIsMoving = false;

	/** 점프 중 여부 (IsGrounded == 0에서 파생) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	bool bIsJumping = false;

	/** 이동 속도 (cm/s) — VelX/VelY에서 계산 */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	float MoveSpeed = 0.0f;

	/** 현재 Stance Tag */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	FGameplayTag StanceTag;

	/** 공격/스킬 몽타주 재생 속도 (AttackSpeed / 100) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	float AttackPlayRate = 1.0f;

	/** 현재 CP 비율 (0~1) — UI에서 사용 */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	float CPRatio = 0.0f;

	/** 현재 활성 블렌드스페이스 */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	TObjectPtr<UBlendSpace> ActiveBlendSpace;

	/** 블렌드스페이스 입력 파라미터 X (Speed 등) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	float BlendSpaceX = 0.0f;

	/** 블렌드스페이스 입력 파라미터 Y (Direction 등) */
	UPROPERTY(BlueprintReadOnly, Category = "HKT|Animation")
	float BlendSpaceY = 0.0f;

	// ========== 매핑 테이블 (AnimBP 클래스 기본값에서 설정) ==========

	/** 애니메이션 태그 → 에셋 매핑 (Montage/Sequence/BlendSpace 중 설정된 것을 자동 재생) */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|Animation")
	TArray<FHktAnimMappingEntry> AnimMappings;

	/** Stance Tag → Stance AnimBP 클래스 매핑 (AnimBP 기본값에서 설정) */
	UPROPERTY(EditDefaultsOnly, Category = "HKT|Stance")
	TMap<FGameplayTag, TSubclassOf<UAnimInstance>> StanceAnimClassMap;

	// ========== UAnimInstance Override ==========

	virtual void NativeInitializeAnimation() override;

	// ========== 제어 API ==========

	/**
	 * Entity의 TagContainer를 받아 Anim.* 태그 변화를 감지하고 애니메이션을 갱신.
	 * 새로 추가된 Anim 태그 → 해당 애니메이션 재생
	 * 제거된 Anim 태그 → 해당 애니메이션 중지
	 */
	void SyncFromTagContainer(const FGameplayTagContainer& EntityTags);

	/**
	 * Stance 변경 시 AnimBP 레이어를 교체.
	 * StanceAnimClassMap에서 해당 Stance Tag의 AnimClass를 찾아 LinkAnimClassLayers 호출.
	 */
	void SyncStance(FGameplayTag NewStanceTag);

	/** 특정 부모 태그의 애니메이션 상태 태그 조회 */
	UFUNCTION(BlueprintPure, Category = "HKT|Animation")
	FGameplayTag GetAnimLayerTag(const FGameplayTag& LayerTag) const;

	/** 몽타주가 재생 중인지 */
	UFUNCTION(BlueprintPure, Category = "HKT|Animation")
	bool IsPlayingMontageAnim() const;

	// ========== 동적 매핑 등록 API (Generator 연동) ==========

	/**
	 * 런타임에 AnimMapping 엔트리를 동적 등록.
	 * AnimBP 리컴파일 불필요 — Generator가 생성한 에셋을 즉시 매핑.
	 * 이미 존재하는 태그에 대한 매핑은 덮어씁니다.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Animation")
	void RegisterAnimMapping(FGameplayTag AnimTag, UAnimMontage* Montage = nullptr, FName StartSection = NAME_None, UAnimSequence* Sequence = nullptr, UBlendSpace* InBlendSpace = nullptr);

	/** 동적 등록된 매핑 해제 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Animation")
	void UnregisterAnimMapping(FGameplayTag AnimTag);

	/** 특정 태그에 매핑이 있는지 */
	UFUNCTION(BlueprintPure, Category = "HKT|Animation")
	bool HasAnimMapping(FGameplayTag AnimTag) const;

	/** 일회성 애니메이션 트리거 재생 (PlayAnim 이벤트에서 호출) */
	void ApplyAnimTag(const FGameplayTag& AnimTag);

private:
	void RemoveAnimTag(const FGameplayTag& AnimTag);

	/** 몽타주 종료 콜백 — AnimEnd 이벤트를 PresentationSubsystem에 전달 */
	UFUNCTION()
	void OnMontageEnd(UAnimMontage* Montage, bool bInterrupted);

	static FGameplayTag ExtractLayerParent(const FGameplayTag& AnimTag);
	const FHktAnimMappingEntry* FindMapping(const FGameplayTag& Tag) const;

	/** 이전 프레임의 Anim 태그 (변화 감지용) */
	FGameplayTagContainer PrevAnimTags;

	/** 재생 중인 몽타주 → AnimTag 역매핑 (종료 콜백에서 태그 조회용) */
	TMap<TObjectPtr<UAnimMontage>, FGameplayTag> ActiveMontageTagMap;

	/** 현재 링크된 Stance AnimBP 클래스 (중복 Link 방지) */
	TSubclassOf<UAnimInstance> CurrentLinkedStanceClass;
};
