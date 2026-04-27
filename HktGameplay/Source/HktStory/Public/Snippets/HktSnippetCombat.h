// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"

/**
 * HktSnippetCombat — 전투 관련 Story 패턴 (쿨타임, 자원 회복)
 *
 * 모든 함수는 FHktStoryBuilder&를 받아 반환하여 fluent chaining을 지원한다.
 * 내부 스크래치 레지스터는 FHktScopedReg로 자동 관리되므로 호출자 레지스터 충돌 없음.
 */
namespace HktSnippetCombat
{
	/** 기준 RecoveryFrame — MotionPlayRate 100 (1.0x) 에 대응하는 표준 후딜레이 */
	inline constexpr int32 ReferenceRecovery = 30;

	/**
	 * 쿨타임 검증 (공속 기반)
	 * GetWorldTime → NextActionFrame 비교 → FailLabel 점프
	 */
	HKTSTORY_API FHktStoryBuilder& CooldownCheck(
		FHktStoryBuilder& B,
		int32 FailLabel);

	/**
	 * 쿨타임 갱신 (상수 RecoveryFrame) + 모션별 애니메이션 속도 산출
	 * NextActionFrame = CurrentFrame + (RecoveryFrame * 100 / AttackSpeed)
	 * MotionPlayRate  = ReferenceRecovery * AttackSpeed / RecoveryFrame
	 */
	HKTSTORY_API FHktStoryBuilder& CooldownUpdateConst(
		FHktStoryBuilder& B,
		int32 RecoveryFrame);

	/**
	 * 쿨타임 갱신 (엔티티에서 RecoveryFrame 읽기) + 모션별 애니메이션 속도 산출
	 * NextActionFrame = CurrentFrame + (ItemEntity.RecoveryFrame * 100 / AttackSpeed)
	 * MotionPlayRate  = ReferenceRecovery * AttackSpeed / ItemEntity.RecoveryFrame
	 *
	 * @param ItemEntity 레지스터 — RecoveryFrame을 읽을 아이템 엔티티
	 */
	HKTSTORY_API FHktStoryBuilder& CooldownUpdateFromEntity(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity);

	/** 신 FHktVar API 오버로드 — PR-3 마이그레이션 시 위 RegisterIndex 버전을 대체할 예정 */
	HKTSTORY_API FHktStoryBuilder& CooldownUpdateFromEntity(
		FHktStoryBuilder& B,
		FHktVar ItemEntity);

	/**
	 * 자원 회복 + Max 클램프
	 * CurrentProp += Amount, MaxProp 초과 시 클램프
	 */
	HKTSTORY_API FHktStoryBuilder& ResourceGainClamped(
		FHktStoryBuilder& B,
		uint16 CurrentProp,
		uint16 MaxProp,
		int32 Amount);

	// ========== 애니메이션 제어 ==========

	/**
	 * 트리거 애니메이션 (일회성 재생, fire-and-forget)
	 * AddTag만 수행. 프레젠테이션 레이어가 한 번 재생 후 자동 정리.
	 *
	 * @param AnimTag 재생할 애니메이션 태그
	 */
	HKTSTORY_API FHktStoryBuilder& AnimTrigger(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		const FGameplayTag& AnimTag);
	HKTSTORY_API FHktStoryBuilder& AnimTrigger(
		FHktStoryBuilder& B,
		FHktVar Entity,
		const FGameplayTag& AnimTag);

	/**
	 * 루프 애니메이션 시작 (태그 추가)
	 * AddTag로 루프 상태를 활성화. AnimLoopStop으로 해제할 때까지 유지된다.
	 */
	HKTSTORY_API FHktStoryBuilder& AnimLoopStart(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		const FGameplayTag& AnimTag);
	HKTSTORY_API FHktStoryBuilder& AnimLoopStart(
		FHktStoryBuilder& B,
		FHktVar Entity,
		const FGameplayTag& AnimTag);

	/**
	 * 루프 애니메이션 정지 (태그 제거)
	 */
	HKTSTORY_API FHktStoryBuilder& AnimLoopStop(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		const FGameplayTag& AnimTag);
	HKTSTORY_API FHktStoryBuilder& AnimLoopStop(
		FHktStoryBuilder& B,
		FHktVar Entity,
		const FGameplayTag& AnimTag);

	/**
	 * 사망 판정 — Health <= 0 이면 DeadTag 부여
	 * IfPropertyLe + AddTag + EndIf 조합.
	 *
	 * @param Entity 사망 여부를 검사할 엔티티 레지스터
	 * @param DeadTag 사망 시 부여할 태그 (예: "State.Dead")
	 */
	HKTSTORY_API FHktStoryBuilder& CheckDeath(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		const FGameplayTag& DeadTag);
	HKTSTORY_API FHktStoryBuilder& CheckDeath(
		FHktStoryBuilder& B,
		FHktVar Entity,
		const FGameplayTag& DeadTag);
}
