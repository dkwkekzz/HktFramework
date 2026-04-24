// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

class UHktSpriteAnimMappingAsset;

// ============================================================================
// FHktSpriteAnimFragment — 엔터티 한 명의 스프라이트 애니메이션 런타임 상태
//
// MassEntity 스타일의 POD fragment. UObject 오버헤드 없이 TMap<EntityId, Fragment>
// 로 크라우드 규모(수백~수천 엔터티)에 대응.
//
// 상태 전이는 HktSpriteAnimProcessor 네임스페이스의 순수 함수들이 담당한다.
// ============================================================================

struct HKTSPRITECORE_API FHktSpriteAnimFragment
{
	// --- 태그 레이어 상태 ---
	/** 부모 레이어 태그 → 현재 재생 중 AnimTag. 예: Anim.FullBody → Anim.FullBody.Locomotion.Run. */
	TMap<FGameplayTag, FGameplayTag> AnimLayerTags;

	/** FullBody 태그 — UHktAnimInstance::AnimStateTag와 동일 의미(하위 호환). */
	FGameplayTag AnimStateTag;

	/** 가장 최근에 재생 시작한 태그(주로 Montage trigger). */
	FGameplayTag CurrentAnimTag;

	/** CurrentAnimTag 재생이 시작된 VM tick. CrowdRenderer가 프레임 커서 계산에 사용. */
	int64 CurrentAnimStartTick = 0;

	// --- 움직임 ---
	bool  bIsMoving   = false;
	bool  bIsFalling  = false;
	float MoveSpeed    = 0.f;
	float FallingSpeed = 0.f;

	// --- 전투 ---
	/** AttackSpeed/MotionPlayRate에서 파생된 전투 애니 재생 속도. */
	float AttackPlayRate = 1.f;
	float CPRatio        = 0.f;

	// --- Stance ---
	FGameplayTag StanceTag;

	// --- 델타 트래킹 ---
	/** 이전 프레임의 Anim.* 태그 스냅샷(변화 감지용). */
	FGameplayTagContainer PrevAnimTags;
};

// ============================================================================
// HktSpriteAnimProcessor
//
// 스프라이트 전용 애니메이션 의사결정 로직. 순수 C++ 네임스페이스 — UObject/vtable
// 없음, GC root 없음, per-entity UObject 없음.
//
// UHktAnimInstance(UAnimInstance 상속, 3D 스켈레탈 전용)가 담당하던
// "엔터티 상태 → 애니메이션 선택"을 HktSpriteCrowdRenderer용으로 재구현.
//
// 설계 원칙:
//  - 입력: UHktSpriteAnimMappingAsset(공유 템플릿) + FHktSpriteAnimFragment(엔터티 상태).
//  - 출력: (ActionId, PlayRate, AnimStartTick) — FHktSpriteEntityUpdate로 바로 전달.
//  - 상태 소유 없음. 모든 함수가 static. `FHktActorProcessor`와 네이밍 결을 맞춤.
//
// 태그 계층 우선순위(UHktAnimInstance와 동일):
//  1. Anim.Montage.*   — 최상위. 원샷 액션(공격 발동 등).
//  2. Anim.UpperBody.* — 상체 오버라이드 (공격/캐스트 지속).
//  3. Anim.FullBody.*  — 기본 상태(Locomotion/Idle/Death).
//  4. 없음             — UHktSpriteAnimMappingAsset::DefaultActionId.
// ============================================================================

namespace HktSpriteAnimProcessor
{
	/**
	 * Entity 태그 컨테이너에서 Anim.* 변화를 감지해 AnimLayerTags를 갱신한다.
	 * 추가된 태그는 ApplyAnimTag, 제거된 태그는 RemoveAnimTag로 반영.
	 */
	HKTSPRITECORE_API void SyncFromTagContainer(const UHktSpriteAnimMappingAsset* Mapping,
		FHktSpriteAnimFragment& Fragment, const FGameplayTagContainer& EntityTags, int64 CurrentTick);

	/** Stance 전환. ActionId 치환은 ResolveRenderOutputs 시점에 적용. */
	HKTSPRITECORE_API void SyncStance(FHktSpriteAnimFragment& Fragment, FGameplayTag NewStance);

	/** 단일 AnimTag 재생 (PendingAnimTriggers 소비용). CurrentAnimStartTick을 CurrentTick으로 설정. */
	HKTSPRITECORE_API void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag, int64 CurrentTick);

	/** AnimTag 제거 — AnimLayerTags에서 해당 레이어 엔트리 정리. */
	HKTSPRITECORE_API void RemoveAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag);

	/**
	 * 현재 상태로부터 CrowdRenderer에 전달할 ActionId/PlayRate/AnimStartTick을 결정.
	 *
	 * @param Mapping              매핑 테이블(null이면 DefaultActionId 상수로 대체).
	 * @param Fragment             엔터티 상태.
	 * @param FallbackAnimStartTick 서버 권위 AnimStartTick(SV.AnimStartTick). Montage/UpperBody가
	 *                              활성이 아닐 때 이 값을 사용 → 네트워크 동기 유지.
	 * @param OutActionId          최종 ActionId (PartTemplate.Actions 키).
	 * @param OutPlayRate          최종 PlayRate (bIsCombat이면 AttackPlayRate 반영).
	 * @param OutAnimStartTick     최종 AnimStartTick (프레임 커서 기준).
	 */
	HKTSPRITECORE_API void ResolveRenderOutputs(const UHktSpriteAnimMappingAsset* Mapping,
		const FHktSpriteAnimFragment& Fragment, int64 FallbackAnimStartTick,
		FName& OutActionId, float& OutPlayRate, int64& OutAnimStartTick);

	/** 특정 레이어(Anim.FullBody 등)의 현재 태그 조회. */
	HKTSPRITECORE_API FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag);
}
