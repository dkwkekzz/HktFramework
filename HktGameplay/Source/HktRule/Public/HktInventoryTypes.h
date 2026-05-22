// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"

// ============================================================================
// FHktInventoryItem — Player Inventory 내 아이템 스냅샷 (엔티티가 아닌 경량 데이터)
//
// I-0041 (Docs/intents/I-0041.md): *Player Inventory* (계정 단위 보관 공간).
// I-0040 의 Entity Bag (활성 슬롯) 과 혼동 금지 — Entity 활성 슬롯은
// `EquipIndex` 등 별도 프로퍼티 체계로 관리된다.
//
// Entity 의 프로퍼티를 스냅샷하여 보관. Player Inventory ↔ Entity 활성 슬롯 전환 시 사용.
// VM 시뮬레이션과 무관한 플레이어 (계정) 레벨 개념이므로 HktRule 에 위치.
// ============================================================================

struct HKTRULE_API FHktInventoryItem
{
	int32 InventorySlot = -1;                // Inventory 내 슬롯 위치
	int32 ItemId = 0;                  // 아이템 템플릿 ID
	int32 AttackPower = 0;
	int32 Defense = 0;
	int32 Stance = 0;
	int32 ItemSkillTag = 0;            // FGameplayTag NetIndex
	int32 SkillCPCost = 0;
	int32 SkillTargetRequired = 0;
	int32 RecoveryFrame = 0;
	int32 Equippable = 0;              // 장착 가능 여부 (0=불가, 1=가능)
	int32 EntitySpawnTag = 0;          // Entity.Item.* ClassTag NetIndex (엔티티 복원용)

	bool IsValid() const { return ItemId > 0; }

	FString ToString() const
	{
		return FString::Printf(TEXT("InventorySlot=%d ItemId=%d Atk=%d Def=%d"),
			InventorySlot, ItemId, AttackPower, Defense);
	}

	friend FArchive& operator<<(FArchive& Ar, FHktInventoryItem& I)
	{
		Ar << I.InventorySlot << I.ItemId << I.AttackPower << I.Defense << I.Stance;
		Ar << I.ItemSkillTag << I.SkillCPCost << I.SkillTargetRequired;
		Ar << I.RecoveryFrame << I.Equippable << I.EntitySpawnTag;
		return Ar;
	}

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
		Ar << *this;
		bOutSuccess = true;
		return true;
	}
};

template<>
struct TStructOpsTypeTraits<FHktInventoryItem> : public TStructOpsTypeTraitsBase2<FHktInventoryItem>
{
	enum { WithNetSerializer = true };
};

// ============================================================================
// FHktInventoryState — 플레이어 Inventory 전체 상태 (I-0041).
// ============================================================================

struct HKTRULE_API FHktInventoryState
{
	TArray<FHktInventoryItem> Items;
	int32 Capacity = 20;

	/** 빈 슬롯 탐색. 없으면 -1 반환. */
	int32 FindEmptySlot() const
	{
		TArray<bool> Occupied;
		Occupied.SetNumZeroed(Capacity);
		for (const FHktInventoryItem& Item : Items)
		{
			if (Item.InventorySlot >= 0 && Item.InventorySlot < Capacity)
			{
				Occupied[Item.InventorySlot] = true;
			}
		}
		for (int32 i = 0; i < Capacity; ++i)
		{
			if (!Occupied[i]) return i;
		}
		return -1;
	}

	/** 아이템 추가. 성공시 true. */
	bool AddItem(FHktInventoryItem InItem)
	{
		if (InItem.InventorySlot < 0)
		{
			InItem.InventorySlot = FindEmptySlot();
		}
		if (InItem.InventorySlot < 0 || InItem.InventorySlot >= Capacity) return false;
		Items.Add(MoveTemp(InItem));
		return true;
	}

	/** InventorySlot으로 아이템 제거. 제거된 아이템을 OutItem에 반환. */
	bool RemoveBySlot(int32 InventorySlot, FHktInventoryItem& OutItem)
	{
		for (int32 i = 0; i < Items.Num(); ++i)
		{
			if (Items[i].InventorySlot == InventorySlot)
			{
				OutItem = Items[i];
				Items.RemoveAt(i);
				return true;
			}
		}
		return false;
	}

	/** InventorySlot으로 아이템 조회. 없으면 nullptr. */
	const FHktInventoryItem* GetItem(int32 InventorySlot) const
	{
		for (const FHktInventoryItem& Item : Items)
		{
			if (Item.InventorySlot == InventorySlot) return &Item;
		}
		return nullptr;
	}

	bool IsFull() const { return Items.Num() >= Capacity; }
	int32 GetItemCount() const { return Items.Num(); }

	friend FArchive& operator<<(FArchive& Ar, FHktInventoryState& S)
	{
		Ar << S.Items << S.Capacity;
		return Ar;
	}

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
		bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<256>(Ar, Items, Map);
		Ar << Capacity;
		return bOutSuccess;
	}
};

template<>
struct TStructOpsTypeTraits<FHktInventoryState> : public TStructOpsTypeTraitsBase2<FHktInventoryState>
{
	enum { WithNetSerializer = true };
};

// ============================================================================
// EHktInventoryOp / FHktInventoryDelta — Inventory 변경 알림 (S2C, I-0041).
// ============================================================================

enum class EHktInventoryOp : uint8
{
	Added    = 0,    // 아이템이 Inventory 에 추가됨
	Removed  = 1,    // 아이템이 Inventory 에서 제거됨
	FullSync = 2,    // 전체 Inventory 상태 동기화 (로그인/그룹 이동)
};

struct HKTRULE_API FHktInventoryDelta
{
	EHktInventoryOp Op = EHktInventoryOp::Added;
	FHktInventoryItem Item;                  // Added/Removed 대상
	FHktInventoryState FullState;            // FullSync 시 전체 상태

	friend FArchive& operator<<(FArchive& Ar, FHktInventoryDelta& D)
	{
		uint8 OpByte = static_cast<uint8>(D.Op);
		Ar << OpByte;
		if (Ar.IsLoading()) D.Op = static_cast<EHktInventoryOp>(OpByte);

		if (D.Op == EHktInventoryOp::FullSync)
		{
			Ar << D.FullState;
		}
		else
		{
			Ar << D.Item;
		}
		return Ar;
	}

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
		uint8 OpByte = static_cast<uint8>(Op);
		Ar << OpByte;
		if (Ar.IsLoading()) Op = static_cast<EHktInventoryOp>(OpByte);

		if (Op == EHktInventoryOp::FullSync)
		{
			return FullState.NetSerialize(Ar, Map, bOutSuccess);
		}
		else
		{
			return Item.NetSerialize(Ar, Map, bOutSuccess);
		}
	}
};

template<>
struct TStructOpsTypeTraits<FHktInventoryDelta> : public TStructOpsTypeTraitsBase2<FHktInventoryDelta>
{
	enum { WithNetSerializer = true };
};
