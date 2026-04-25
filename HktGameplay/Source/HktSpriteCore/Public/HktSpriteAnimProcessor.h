// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

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

	/** 가장 최근에 재생 시작한 태그(주로 Montage trigger). 디버그/조회용. */
	FGameplayTag CurrentAnimTag;

	// 주: AnimStartTick은 서버 VM이 PropertyId::AnimStartTick 으로 권위 기록 →
	//     SV.AnimStartTick으로 전달되므로 클라 Fragment에는 별도로 저장하지 않는다.

	// --- 움직임 ---
	bool  bIsMoving   = false;
	bool  bIsFalling  = false;
	float MoveSpeed    = 0.f;
	float FallingSpeed = 0.f;

	// --- 전투 ---
	/** AttackSpeed/MotionPlayRate에서 파생된 전투 애니 재생 속도. */
	float AttackPlayRate = 1.f;
	float CPRatio        = 0.f;

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
// 설계 원칙:
//  - 입력: FHktSpriteAnimFragment(엔터티 상태) 만.
//  - 출력: (AnimTag, PlayRate). 실제 Animation 해석은 Renderer가 CharacterTemplate의
//    FindAnimationOrFallback(Tag)로 처리하므로 Processor는 CharacterTemplate을 모른다.
//  - 태그 중간 매핑 테이블 없음. Generator가 CharacterTemplate을 만들 때 각 애니의
//    AnimTag를 Animations 맵 키로 직접 채운다.
//
// 태그 계층 우선순위(UHktAnimInstance와 동일):
//  1. Anim.Montage.*   — 최상위. 원샷 액션(공격 발동 등).
//  2. Anim.UpperBody.* — 상체 오버라이드 (공격/캐스트 지속).
//  3. Anim.FullBody.*  — 기본 상태(Locomotion/Idle/Death).
//  4. 없음             — Movement 상태로 Anim.FullBody.Locomotion.{Idle,Walk,Run,Fall}
//                          합성 폴백.
// ============================================================================

namespace HktSpriteAnimProcessor
{
	// --- Locomotion 튜닝 상수 ---
	// Walk↔Run 전환 임계는 콘솔 변수 `hkt.Sprite.Loco.RunSpeedThreshold`로 런타임 조정.
	// 나머지 상수는 Processor 로컬 constexpr로 유지 — 필요 시 UPROPERTY나 CVar로 승격.
	constexpr float kReferenceMoveSpeed  = 200.f; // cm/s — PlayRate=1.0 기준
	constexpr float kMinLocoPlayRate     = 0.25f;
	constexpr float kMaxLocoPlayRate     = 3.0f;
	constexpr bool  kScalePlayRateBySpeed = false;

	/**
	 * Entity 태그 컨테이너에서 Anim.* 변화를 감지해 AnimLayerTags를 갱신한다.
	 * 추가된 태그는 ApplyAnimTag, 제거된 태그는 RemoveAnimTag로 반영.
	 */
	HKTSPRITECORE_API void SyncFromTagContainer(FHktSpriteAnimFragment& Fragment,
		const FGameplayTagContainer& EntityTags);

	/** 단일 AnimTag 재생 (PendingAnimTriggers 소비용). AnimLayerTags에 layer 매핑만 갱신. */
	HKTSPRITECORE_API void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag);

	/** AnimTag 제거 — AnimLayerTags에서 해당 레이어 엔트리 정리. */
	HKTSPRITECORE_API void RemoveAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag);

	/**
	 * 현재 상태로부터 Renderer에 전달할 AnimTag/PlayRate를 결정.
	 *
	 * AnimStartTick은 클라에서 계산하지 않는다 — 서버 VM이 anim 변화 시점에
	 * PropertyId::AnimStartTick 을 권위 기록하므로 호출자(CrowdHost)가 SV.AnimStartTick
	 * 을 그대로 Renderer에 전달한다.
	 *
	 * @param Fragment    엔터티 상태.
	 * @param OutAnimTag  최종 AnimTag (PartTemplate의 FindAction 키).
	 * @param OutPlayRate Montage/UpperBody이면 AttackPlayRate, Locomotion이면
	 *                    선택적 MoveSpeed 스케일, 그 외 1.0.
	 */
	HKTSPRITECORE_API void ResolveRenderOutputs(const FHktSpriteAnimFragment& Fragment,
		FGameplayTag& OutAnimTag, float& OutPlayRate);

	/** 특정 레이어(Anim.FullBody 등)의 현재 태그 조회. */
	HKTSPRITECORE_API FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag);
}
