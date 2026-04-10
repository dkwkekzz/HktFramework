// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreEvents.h"
#include "HktCoreProperties.h"

/**
 * HktStoryEventParams — Story별 이벤트 파라미터 계약(Contract)
 *
 * FHktEvent::Param0/Param1은 범용 정수이므로 의미가 Story마다 다르다.
 * 이 헤더에서 Story별 별칭과 빌더를 정의하여
 * 생성측(Client/Server)과 소비측(Story VM)의 불일치를 구조적으로 방지한다.
 *
 * 규칙:
 * - Story 정의에서 LoadStore 시 이 별칭을 사용한다.
 * - 이벤트 생성 시 HktEventBuilder 헬퍼를 사용한다.
 * - Param0/Param1을 직접 대입하지 않는다.
 */

// ============================================================================
// Story.Event.Combat.UseSkill
// ============================================================================
namespace UseSkillParams
{
	/** Param0: 타겟 엔티티 오버라이드 (0이면 Event.TargetEntity 사용) */
	inline const uint16 TargetOverride = PropertyId::Param0;
	/** Param1: 장착 슬롯 인덱스 (LoadItemFromSlot에서 사용) */
	inline const uint16 EquipSlotIndex = PropertyId::Param1;
}

// ============================================================================
// NPC Spawner (Wave, GoblinCamp, TreeDrop 등)
// ============================================================================
namespace SpawnerParams
{
	/** Param0: 스폰 위치 X */
	inline const uint16 SpawnPosX = PropertyId::Param0;
	/** Param1: 스폰 위치 Y */
	inline const uint16 SpawnPosY = PropertyId::Param1;
}

// ============================================================================
// Story.Event.Item.Activate
// ============================================================================
namespace ItemActivateParams
{
	/** Param0: 장착 슬롯 인덱스 */
	inline const uint16 EquipIndex = PropertyId::Param0;
	/** Param1: 아이템 엔티티 (NewEntityStates 인덱스) */
	inline const uint16 ItemEntityIndex = PropertyId::Param1;
}

// ============================================================================
// Story.Event.Item.Trade
// ============================================================================
namespace ItemTradeParams
{
	/** Param0: 제안 아이템 EntityId */
	inline const uint16 OfferItem = PropertyId::Param0;
	/** Param1: 요청 아이템 EntityId */
	inline const uint16 RequestItem = PropertyId::Param1;
}

// ============================================================================
// Story.Event.Skill.Heal
// ============================================================================
namespace HealParams
{
	/** Param0: 회복량 (0이면 기본값 사용) */
	inline const uint16 HealAmount = PropertyId::Param0;
}

// ============================================================================
// Story.Voxel.* (Break, Shatter, Crumble, Crack)
// ============================================================================
namespace VoxelBreakParams
{
	/** Param0: 파괴된 복셀의 원래 TypeId */
	inline const uint16 TypeId = PropertyId::Param0;
}

// ============================================================================
// 이벤트 빌더 헬퍼 — Param 직접 접근 없이 이벤트 생성
// ============================================================================
namespace HktEventBuilder
{
	/** TargetDefault 이벤트 (슬롯 미선택 시) */
	inline FHktEvent TargetDefault(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity,
		FHktEntityId TargetEntity,
		FVector Location)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		E.TargetEntity = TargetEntity;
		E.Location     = Location;
		return E;
	}

	/** UseSkill 이벤트 (슬롯 선택 시) — Param1 = 슬롯 인덱스 */
	inline FHktEvent UseSkillFromSlot(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity,
		FHktEntityId TargetEntity,
		FVector Location,
		int32 SlotIndex)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		E.TargetEntity = TargetEntity;
		E.Location     = Location;
		E.Param1       = SlotIndex;
		return E;
	}

	/** 점프 이벤트 — SourceEntity만 필요 (타겟 없음) */
	inline FHktEvent Jump(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		return E;
	}

	/** NPC 스포너 이벤트 — Param0 = X, Param1 = Y */
	inline FHktEvent Spawner(
		const FGameplayTag& EventTag,
		int32 SpawnPosX,
		int32 SpawnPosY)
	{
		FHktEvent E;
		E.EventTag = EventTag;
		E.Param0   = SpawnPosX;
		E.Param1   = SpawnPosY;
		return E;
	}

	/** 방향 이동 이벤트 (ShoulderView WASD) — Location = 목표 위치 */
	inline FHktEvent MoveForward(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity,
		FVector TargetLocation)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		E.Location     = TargetLocation;
		return E;
	}

	/** 이동 정지 이벤트 (ShoulderView WASD 릴리즈) */
	inline FHktEvent MoveStop(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		return E;
	}

	/** 아이템 활성화 이벤트 — Param0 = 슬롯, Param1 = 엔티티 인덱스 */
	inline FHktEvent ItemActivate(
		const FGameplayTag& EventTag,
		FHktEntityId SourceEntity,
		int64 PlayerUid,
		int32 EquipIndex,
		int32 ItemEntityIndex)
	{
		FHktEvent E;
		E.EventTag     = EventTag;
		E.SourceEntity = SourceEntity;
		E.TargetEntity = InvalidEntityId;
		E.PlayerUid    = PlayerUid;
		E.Param0       = EquipIndex;
		E.Param1       = ItemEntityIndex;
		return E;
	}
}
