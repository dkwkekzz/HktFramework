// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "GameplayTagContainer.h"
#include "HktSpriteAnimInstance.generated.h"

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
// 3D의 `LinkAnimClassLayers`는 AnimBP 클래스 자체를 교체했지만, 스프라이트에선
// PartTemplate의 Action 키만 바꿔주면 된다. 예) Stance=Sword → "attack_1"을
// "sword_attack_1"로 대체.
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
// FHktSpriteAnimState — 엔터티 한 명의 스프라이트 애니메이션 런타임 상태
//
// UHktAnimInstance는 상태를 자기 멤버에 직접 담았지만(1 UObject/엔터티),
// 스프라이트 크라우드는 HISM 기반이라 엔터티 수가 많을 수 있으므로
// 공용 UHktSpriteAnimInstance(템플릿) + 엔터티당 POD 상태 구조로 분리한다.
// ============================================================================

struct HKTSPRITECORE_API FHktSpriteAnimState
{
	// --- 태그 레이어 상태 ---
	/** 부모 레이어 태그 → 현재 재생 중 AnimTag. 예: Anim.FullBody → Anim.FullBody.Locomotion.Run. */
	TMap<FGameplayTag, FGameplayTag> AnimLayerTags;

	/** FullBody 태그(하위호환, UHktAnimInstance::AnimStateTag와 동일 의미). */
	FGameplayTag AnimStateTag;

	/** 가장 최근에 재생 시작한 태그(주로 Montage trigger). */
	FGameplayTag CurrentAnimTag;

	/** CurrentAnimTag 재생이 시작된 VM tick. CrowdRenderer가 프레임 커서 계산에 사용. */
	int64 CurrentAnimStartTick = 0;

	// --- 움직임 ---
	bool  bIsMoving  = false;
	bool  bIsFalling = false;
	float MoveSpeed    = 0.f;
	float FallingSpeed = 0.f;

	// --- 전투 ---
	/** AttackSpeed/MotionPlayRate에서 파생된 전투 애니 재생 속도. */
	float AttackPlayRate = 1.f;
	float CPRatio        = 0.f;

	// --- Stance ---
	FGameplayTag StanceTag;

	// --- 델타 트래킹 ---
	/** SyncFromTagContainer에서 이전 프레임 Anim.* 태그 스냅샷과 비교. */
	FGameplayTagContainer PrevAnimTags;
};

// ============================================================================
// UHktSpriteAnimInstance — 스프라이트 전용 AnimInstance
//
// UHktAnimInstance(UAnimInstance 상속, 3D 스켈레탈 전용)가 담당하던
// "엔터티 상태 → 애니메이션 선택" 의사결정을 HktSpriteCrowdRenderer용으로 재구현.
//
// 설계 차이:
//  - UAnimInstance/SkeletalMeshComponent 의존 없음(HISM Crowd 호환).
//  - Montage/Sequence/BlendSpace → PartTemplate의 ActionId(FName).
//  - 상태는 FHktSpriteAnimState로 외부화 → 템플릿 하나가 전체 크라우드를 처리.
//
// 태그 계층 우선순위(HktAnimInstance와 동일):
//  1. Anim.Montage.*   — 최상위. 원샷 액션(공격 발동 등).
//  2. Anim.UpperBody.* — 상체 오버라이드 (공격/캐스트 지속).
//  3. Anim.FullBody.*  — 기본 상태(Locomotion/Idle/Death).
//  4. 없음             — DefaultActionId.
// ============================================================================

UCLASS(BlueprintType, Blueprintable)
class HKTSPRITECORE_API UHktSpriteAnimInstance : public UObject
{
	GENERATED_BODY()

public:
	// ========== 매핑 테이블 (AnimBP처럼 클래스 기본값에서 설정) ==========

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

	// ========== 상태 갱신 API ==========

	/**
	 * Entity 태그 컨테이너에서 Anim.* 변화를 감지해 AnimLayerTags를 갱신한다.
	 * 새로 추가된 태그는 ApplyAnimTag, 제거된 태그는 RemoveAnimTag로 반영.
	 */
	void SyncFromTagContainer(FHktSpriteAnimState& State, const FGameplayTagContainer& EntityTags, int64 CurrentTick) const;

	/** Stance 전환. 실제 ActionId 치환은 ResolveRenderOutputs 시점에 적용. */
	void SyncStance(FHktSpriteAnimState& State, FGameplayTag NewStance) const;

	/** 단일 AnimTag 재생 적용 (PendingAnimTriggers 소비용). CurrentAnimStartTick을 CurrentTick으로 설정. */
	void ApplyAnimTag(FHktSpriteAnimState& State, const FGameplayTag& AnimTag, int64 CurrentTick) const;

	/** AnimTag 제거 — AnimLayerTags에서 해당 레이어 엔트리 정리. */
	void RemoveAnimTag(FHktSpriteAnimState& State, const FGameplayTag& AnimTag) const;

	// ========== 결과 해석 ==========

	/**
	 * 현재 상태로부터 CrowdRenderer에 전달할 ActionId/PlayRate/AnimStartTick을 결정.
	 *
	 * @param State               엔터티 상태.
	 * @param FallbackAnimStartTick 서버 권위 AnimStartTick(SV.AnimStartTick). Montage 트리거가 활성이
	 *                              아닐 때 이 값을 반환한다.
	 * @param OutActionId         최종 ActionId (PartTemplate.Actions 키).
	 * @param OutPlayRate         최종 PlayRate (bIsCombat이면 AttackPlayRate 반영).
	 * @param OutAnimStartTick    최종 AnimStartTick (프레임 커서 기준).
	 */
	void ResolveRenderOutputs(const FHktSpriteAnimState& State, int64 FallbackAnimStartTick,
		FName& OutActionId, float& OutPlayRate, int64& OutAnimStartTick) const;

	// ========== 동적 매핑 등록 (Generator 연동) ==========

	/** 런타임에 매핑 추가/갱신. 이미 존재하면 덮어쓴다. */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteAnim")
	void RegisterAnimMapping(FGameplayTag AnimTag, FName ActionId, bool bIsCombat = false);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteAnim")
	void UnregisterAnimMapping(FGameplayTag AnimTag);

	UFUNCTION(BlueprintPure, Category = "HKT|SpriteAnim")
	bool HasAnimMapping(FGameplayTag AnimTag) const;

	/** 특정 레이어(Anim.FullBody 등)의 현재 태그 조회. */
	static FGameplayTag GetAnimLayerTag(const FHktSpriteAnimState& State, const FGameplayTag& LayerTag);

private:
	/** Anim.FullBody.Locomotion.Run → Anim.FullBody 형태로 2단 depth까지만 자름. */
	static FGameplayTag ExtractLayerParent(const FGameplayTag& AnimTag);

	const FHktSpriteAnimMappingEntry* FindMapping(const FGameplayTag& Tag) const;

	/**
	 * AnimLayerTags에서 우선순위(Montage > UpperBody > FullBody)로 활성 매핑 선택.
	 * 매핑이 없지만 태그는 있을 경우 bUseTagLeafFallback이 true면 leaf-name FName으로 대체.
	 */
	void SelectActiveMapping(const FHktSpriteAnimState& State, FName& OutActionId, bool& bOutIsCombat,
		FGameplayTag& OutActiveLayer) const;

	/** Stance 치환 적용. Stance 맵에 해당 ActionId 오버라이드가 있으면 바뀐 FName 반환. */
	FName ApplyStanceOverride(FName BaseActionId, const FGameplayTag& StanceTag) const;

	/** 태그 leaf를 소문자로 변환해 FName으로 반환. e.g. "Anim.FullBody.Locomotion.Run" → "run". */
	static FName TagLeafToActionId(const FGameplayTag& Tag);
};
