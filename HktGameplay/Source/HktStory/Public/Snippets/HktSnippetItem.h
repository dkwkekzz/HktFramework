// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"

/**
 * HktSnippetItem — 아이템 관련 Story 패턴 (장착 슬롯 디스패치, 스탯, 검증)
 *
 * 모든 함수는 FHktStoryBuilder&를 받아 반환하여 fluent chaining을 지원한다.
 * 내부 스크래치 레지스터는 FHktScopedReg로 자동 관리되므로 호출자 레지스터 충돌 없음.
 */
namespace HktSnippetItem
{
	/**
	 * Param1(슬롯 인덱스) → EquipSlot[N] 로드 디스패치 테이블
	 * 슬롯 인덱스 무효 또는 아이템 0이면 FailLabel로 점프.
	 */
	HKTSTORY_API FHktStoryBuilder& LoadItemFromSlot(
		FHktStoryBuilder& B,
		RegisterIndex DstReg,
		int32 FailLabel);

	/**
	 * Self의 EquipSlot[SlotIndexReg]에 ValueReg 저장
	 */
	HKTSTORY_API FHktStoryBuilder& SaveItemToEquipSlot(
		FHktStoryBuilder& B,
		RegisterIndex SlotIndexReg,
		RegisterIndex ValueReg);

	/**
	 * Self의 EquipSlot[SlotIndexReg] = 0 (클리어)
	 */
	HKTSTORY_API FHktStoryBuilder& ClearEquipSlot(
		FHktStoryBuilder& B,
		RegisterIndex SlotIndexReg);

	/**
	 * 아이템 스탯(AttackPower, Defense, Stance)을 캐릭터에 합산
	 * Stance는 아이템의 Stance 값을 캐릭터에 복사한다.
	 */
	HKTSTORY_API FHktStoryBuilder& ApplyItemStats(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex CharEntity);

	/**
	 * 아이템 스탯(AttackPower, Defense)을 캐릭터에서 차감
	 * Note: Stance 복원은 컨텍스트마다 다르므로 (다른 활성 아이템 검색 등) 포함하지 않는다.
	 */
	HKTSTORY_API FHktStoryBuilder& RemoveItemStats(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex CharEntity);

	/**
	 * 소유자 검증: Entity의 OwnerEntity == Self
	 * 불일치 시 FailLabel로 점프.
	 */
	HKTSTORY_API FHktStoryBuilder& ValidateOwnership(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		int32 FailLabel);

	/**
	 * 아이템 상태 검증: Entity의 ItemState == ExpectedState
	 * 불일치 시 FailLabel로 점프.
	 *
	 * @param ExpectedState 0=Ground, 1=InBag, 2=Active
	 */
	HKTSTORY_API FHktStoryBuilder& ValidateItemState(
		FHktStoryBuilder& B,
		RegisterIndex Entity,
		int32 ExpectedState,
		int32 FailLabel);

	/**
	 * Self의 EquipSlot0~8에서 빈 슬롯(값==0)을 찾아 DstReg에 슬롯 인덱스를 저장.
	 * 빈 슬롯이 없으면 FailLabel로 점프.
	 */
	HKTSTORY_API FHktStoryBuilder& FindEmptyEquipSlot(
		FHktStoryBuilder& B,
		RegisterIndex DstReg,
		int32 FailLabel);

	// ================================================================
	// 고수준 아이템 명령어
	// ================================================================

	/**
	 * 아이템 소유권 설정: OwnerEntity = NewOwner + 계정 OwnerUid 설정
	 */
	HKTSTORY_API FHktStoryBuilder& AssignOwnership(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex NewOwner);

	/**
	 * 아이템 소유권 해제: OwnerEntity = 0 + 계정 OwnerUid 해제
	 */
	HKTSTORY_API FHktStoryBuilder& ReleaseOwnership(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity);

	/**
	 * 아이템을 Active 상태로 전환하고 EquipIndex에 등록.
	 * ItemState = Active, EquipIndex 설정, EquipSlot[N] 저장, 스탯 적용.
	 */
	HKTSTORY_API FHktStoryBuilder& ActivateInSlot(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex SlotIndexReg,
		RegisterIndex CharEntity);

	/**
	 * Active 아이템을 InBag으로 전환.
	 * ItemState = InBag, EquipIndex = -1, 스탯 차감.
	 * Note: ClearEquipSlot은 호출 전에 별도로 수행해야 한다.
	 */
	HKTSTORY_API FHktStoryBuilder& DeactivateToBag(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex CharEntity);

	/**
	 * 아이템을 Ground 상태로 전환하고 월드에 드랍.
	 * ItemState = Ground, 소유권 해제, EquipIndex 초기화, 위치 설정.
	 */
	HKTSTORY_API FHktStoryBuilder& DropToGround(
		FHktStoryBuilder& B,
		RegisterIndex ItemEntity,
		RegisterIndex PositionSourceEntity);

	/** 월드 아이템 생성 템플릿 */
	struct FHktGroundItemTemplate
	{
		int32 ItemId = 0;
	};

	/**
	 * 아이템을 월드(Ground 상태)에 생성.
	 * SpawnEntity + ItemState=Ground + ItemId + EquipIndex=-1 + 위치 설정.
	 * Spawned 레지스터에 새 아이템 엔티티가 저장된다.
	 *
	 * @param PosSourceEntity 위치를 복사할 엔티티 레지스터
	 */
	HKTSTORY_API FHktStoryBuilder& SpawnGroundItem(
		FHktStoryBuilder& B,
		const FGameplayTag& ItemClassTag,
		const FHktGroundItemTemplate& Template,
		RegisterIndex PosSourceEntity);

	/**
	 * 아이템을 월드(Ground 상태)에 생성 — 위치를 레지스터 블록으로 지정.
	 * Flow 스토리(Self 엔티티 없음)에서 사용. 이벤트 파라미터에서 위치를 읽은 후 호출.
	 *
	 * @param PosBase 위치 레지스터 블록 (PosBase, PosBase+1, PosBase+2 = X, Y, Z)
	 */
	HKTSTORY_API FHktStoryBuilder& SpawnGroundItemAtPos(
		FHktStoryBuilder& B,
		const FGameplayTag& ItemClassTag,
		const FHktGroundItemTemplate& Template,
		RegisterIndex PosBase);

	// ================================================================
	// 신 FHktVar API 오버로드 — PR-2 단계 2.
	// 본 모듈의 RegisterIndex 버전과 동일한 시맨틱이지만 FHktVar / FHktVarBlock 인자를 받는다.
	// PR-3 마이그레이션 시 위 RegisterIndex 버전이 제거된다.
	// ================================================================

	HKTSTORY_API FHktStoryBuilder& ApplyItemStats(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar CharEntity);

	HKTSTORY_API FHktStoryBuilder& RemoveItemStats(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar CharEntity);

	HKTSTORY_API FHktStoryBuilder& AssignOwnership(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar NewOwner);

	HKTSTORY_API FHktStoryBuilder& ReleaseOwnership(
		FHktStoryBuilder& B,
		FHktVar ItemEntity);

	HKTSTORY_API FHktStoryBuilder& DropToGround(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar PositionSourceEntity);

	HKTSTORY_API FHktStoryBuilder& SpawnGroundItemAtPos(
		FHktStoryBuilder& B,
		const FGameplayTag& ItemClassTag,
		const FHktGroundItemTemplate& Template,
		FHktVarBlock PosBlock);

	// ---- 슬롯 디스패치 / 검증 (FHktVar) ----

	HKTSTORY_API FHktStoryBuilder& LoadItemFromSlot(
		FHktStoryBuilder& B,
		FHktVar Dst,
		int32 FailLabel);

	HKTSTORY_API FHktStoryBuilder& SaveItemToEquipSlot(
		FHktStoryBuilder& B,
		FHktVar SlotIndex,
		FHktVar Value);

	HKTSTORY_API FHktStoryBuilder& ClearEquipSlot(
		FHktStoryBuilder& B,
		FHktVar SlotIndex);

	HKTSTORY_API FHktStoryBuilder& FindEmptyEquipSlot(
		FHktStoryBuilder& B,
		FHktVar Dst,
		int32 FailLabel);

	HKTSTORY_API FHktStoryBuilder& ValidateOwnership(
		FHktStoryBuilder& B,
		FHktVar Entity,
		int32 FailLabel);

	HKTSTORY_API FHktStoryBuilder& ValidateItemState(
		FHktStoryBuilder& B,
		FHktVar Entity,
		int32 ExpectedState,
		int32 FailLabel);

	HKTSTORY_API FHktStoryBuilder& ActivateInSlot(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar SlotIndex,
		FHktVar CharEntity);

	HKTSTORY_API FHktStoryBuilder& DeactivateToBag(
		FHktStoryBuilder& B,
		FHktVar ItemEntity,
		FHktVar CharEntity);
}
