// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "Terrain/HktFixed32.h"
#include "Terrain/HktTerrainDataSource.h"

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
// NPC Spawner (Wave, GoblinCamp, TreeDrop, Terrain-bake Spawner 등)
// ============================================================================
//
// Terrain Spawner 통합 (TerrainSpawner.design.md §3-a, §4-a) — `FHktTerrainSpawnerSpec`
// 의 4-슬롯 평탄화 정수가 `FHktEvent::Param0~3` 으로 1:1 매핑된다. archetype 별 정확한
// 의미는 spawner story 본문이 자체 정의 — 본 별칭은 공통 컨벤션 헤더 (강제 분류 아님).
//
// 좌표는 `FHktTerrainSpawnerView::PosXRaw/PosYRaw/PosZRaw` (Q16.16 cm) 가
// `HktEventBuilder::SpawnerFromView` 에서 정수 cm 으로 FloorToInt 변환되어 Param0/Param1
// 에 들어간다. Story 는 cm 정수로 읽어 SpawnEntity 등에 그대로 전달 가능.
namespace SpawnerParams
{
	/** Param0: 스폰 위치 X (cm 정수) */
	inline const uint16 SpawnPosX = PropertyId::Param0;
	/** Param1: 스폰 위치 Y (cm 정수) */
	inline const uint16 SpawnPosY = PropertyId::Param1;
	/** Param2: archetype 별 의미 — 예: SlotHash 하위 32-bit, EntityTag NetIndex 등 */
	inline const uint16 SpawnerSlot0 = PropertyId::Param2;
	/** Param3: 스폰 위치 Z (cm 정수) — Natural 계열 자연 spawner 공용. 다른 archetype 은 자유. */
	inline const uint16 SpawnPosZ = PropertyId::Param3;
}

// ============================================================================
// Voxel Template Activation (I-0014 — voxel spawn 능력 인프라)
// ============================================================================
//
// 두 입구가 voxel 한 점에서 합류한다:
//   1. **자연 발생** — `FHktTerrainSystem::Process` 가 청크 로드 시 baked attribution 슬롯
//      (`SpawnTemplateAttribution`) 을 enumerate → voxel 한 점마다 *참조 template 의
//      StoryTag* 를 EventTag 로 dispatch.
//   2. **트리거** (Phase C — Quest / Cinematic / Encounter 등) — caller 가 임의 voxel
//      좌표에 대해 `HktEventBuilder::VoxelTemplateActivatedAt(...)` 로 동일 형식 event
//      를 직접 생성 → 동일 dispatch 경로 통과. attribution 슬롯 자체는 건드리지 않음
//      (read-only 모델 유지).
//
// 두 경로 모두 단일 빌더 (`VoxelTemplateActivatedAt`) 를 통과하므로 Param 슬롯 의미
// 와 SlotHash31 결정론 시드 (I-0017) 가 *형식적으로* 일치 — 호환성은 빌더 구현이 보장.
//
// SpawnerParams::* 와 슬롯 의미가 동일하다 — terrain story template (Oak_Spawn 등) 이
// 동일 컨벤션으로 좌표/시드를 읽는다.
//
//   - Param0: voxel 월드 X (cm 정수) — VoxelWorld * VoxelSizeCm + half
//   - Param1: voxel 월드 Y (cm 정수)
//   - Param2: SlotHash31 — voxel 좌표 한 곳에서 파생된 결정론 시드 (I-0017)
//   - Param3: voxel 월드 Z (cm 정수)
namespace VoxelTemplateParams
{
	inline const uint16 VoxelCmX     = PropertyId::Param0;
	inline const uint16 VoxelCmY     = PropertyId::Param1;
	inline const uint16 SlotHash31   = PropertyId::Param2;
	inline const uint16 VoxelCmZ     = PropertyId::Param3;
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

	/** NPC 스포너 이벤트 — Param0 = X, Param1 = Y, Param3 = Z (cm 정수) */
	inline FHktEvent Spawner(
		const FGameplayTag& EventTag,
		int32 SpawnPosX,
		int32 SpawnPosY,
		int32 SpawnPosZ = 0)
	{
		FHktEvent E;
		E.EventTag = EventTag;
		E.Param0   = SpawnPosX;
		E.Param1   = SpawnPosY;
		E.Param3   = SpawnPosZ;
		return E;
	}

	/**
	 * Terrain spawner view 로 NPC 스포너 이벤트 생성 (TerrainSpawner.design.md §7).
	 *
	 * `FHktTerrainSpawnerView::PosXRaw/PosYRaw/PosZRaw` (Q16.16 cm) → 정수 cm 변환 후
	 *   - `Event.Param0/1` = cm 정수 (SpawnerParams::SpawnPosX/Y 컨벤션)
	 *   - `Event.Param3` = Z cm 정수 (SpawnerParams::SpawnPosZ — Natural 계열 자연 spawner 공용)
	 *   - `Event.Location` = FVector cm (시뮬레이션 시스템이 청크 사전 로드에 사용)
	 *   - `Event.Param2` = view 의 archetype 별 슬롯 (예: Oak LineageId)
	 *   - `Event.EventTag` = view.StoryTag (FHktDefaultServerRule 의 RuntimeEvent dispatch
	 *     경로와 동일 — VMBuildSystem 이 StoryTag 로 Program 조회)
	 *
	 * EventId 는 호출자가 별도 시퀀스로 부여한다 (Insights 전용, VM 동작 영향 없음).
	 */
	inline FHktEvent SpawnerFromView(const FHktTerrainSpawnerView& View)
	{
		FHktEvent E;
		E.EventTag = View.StoryTag;
		E.Param0   = FHktFixed32::FromRaw(View.PosXRaw).FloorToInt();
		E.Param1   = FHktFixed32::FromRaw(View.PosYRaw).FloorToInt();
		E.Param2   = View.Param2;
		// Natural 계열 spawner 는 Z 를 Param3 에 싣는다 — View.Param3 가 0(미사용) 인 경우에 한해
		// PosZRaw 를 cm 정수로 변환해 채운다. archetype 이 Param3 를 명시적으로 사용하면 그대로 둔다.
		E.Param3   = (View.Param3 != 0) ? View.Param3 : FHktFixed32::FromRaw(View.PosZRaw).FloorToInt();
		E.Location = FVector(
			FHktFixed32::FromRaw(View.PosXRaw).ToDouble(),
			FHktFixed32::FromRaw(View.PosYRaw).ToDouble(),
			FHktFixed32::FromRaw(View.PosZRaw).ToDouble());
		return E;
	}

	/**
	 * Voxel 좌표 → SlotHash31 결정론 시드 (I-0017 — 시드 = voxel 좌표 한 곳).
	 *
	 * 자연 발생 (`FHktTerrainProvider::GetChunkVoxelAttribution`) 과 트리거 경로
	 * (`VoxelTemplateActivatedAt`) 모두 본 함수를 통과해 동일 시드를 산출 — 두 입구가
	 * voxel 한 점에서 합류해도 결정론이 유지된다.
	 */
	inline uint32 ComputeVoxelSlotHash31(int32 VoxelWorldX, int32 VoxelWorldY, int32 VoxelWorldZ)
	{
		const uint32 H = ::GetTypeHash(FIntVector(VoxelWorldX, VoxelWorldY, VoxelWorldZ));
		return H & 0x7FFFFFFFu;
	}

	/**
	 * Voxel template activation 이벤트 — 좌표 직접 입력 (I-0014 Phase C 트리거 채널).
	 *
	 * 자연 발생/트리거 양쪽 모두의 단일 빌더. EventTag 가 *템플릿 자체의 StoryTag* —
	 * VMBuildSystem 이 직접 program 조회.
	 *
	 * 트리거 caller (Quest opcode · GameMode 트리거 · Encounter 시스템 등) 가 임의
	 * voxel 한 점에 template 을 활성화하고 싶을 때 직접 호출. attribution 슬롯은
	 * 갱신하지 않으며, event 한 발만 emit — read-only attribution 모델 유지.
	 *
	 * Param 매핑은 `VoxelTemplateParams::` 참조.
	 *
	 * @param TemplateStoryTag  발화할 terrain story template tag (예: `Story.Flow.Spawner.Natural.Oak`).
	 * @param VoxelWorldX/Y/Z   대상 voxel 의 월드 voxel 좌표 (정수).
	 * @param VoxelSizeCm       생성기 Config 의 VoxelSizeCm (cm 변환에 사용).
	 */
	inline FHktEvent VoxelTemplateActivatedAt(
		const FGameplayTag& TemplateStoryTag,
		int32 VoxelWorldX, int32 VoxelWorldY, int32 VoxelWorldZ,
		float VoxelSizeCm)
	{
		// voxel 중심 cm — `FHktTerrainSystem::VoxelToCm` 과 동일 공식.
		const float Half = VoxelSizeCm * 0.5f;
		const int32 CmX = FMath::RoundToInt(VoxelWorldX * VoxelSizeCm + Half);
		const int32 CmY = FMath::RoundToInt(VoxelWorldY * VoxelSizeCm + Half);
		const int32 CmZ = FMath::RoundToInt(VoxelWorldZ * VoxelSizeCm + Half);
		const uint32 SlotHash31 = ComputeVoxelSlotHash31(VoxelWorldX, VoxelWorldY, VoxelWorldZ);

		FHktEvent E;
		E.EventTag = TemplateStoryTag;
		E.Param0   = CmX;
		E.Param1   = CmY;
		E.Param2   = static_cast<int32>(SlotHash31);
		E.Param3   = CmZ;
		E.Location = FVector(static_cast<double>(CmX), static_cast<double>(CmY), static_cast<double>(CmZ));
		return E;
	}

	/**
	 * Voxel template activation 이벤트 — 자연 발생 view 어댑터.
	 *
	 * `FHktTerrainSystem::Process` 가 청크 로드 시 baked attribution 한 점마다 호출.
	 * 내부적으로 `VoxelTemplateActivatedAt` 에 위임 — 트리거 경로와 *동일 빌더* 통과를
	 * 코드 형식상 보장 (I-0014 Phase C 검증).
	 */
	inline FHktEvent VoxelTemplateActivated(const FHktVoxelAttributionView& View, float VoxelSizeCm)
	{
		return VoxelTemplateActivatedAt(View.StoryTag,
			View.VoxelWorldX, View.VoxelWorldY, View.VoxelWorldZ, VoxelSizeCm);
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
