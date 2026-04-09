// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"

// ============================================================================
// FHktBagItem — 가방 내 아이템 스냅샷 (엔티티가 아닌 경량 데이터)
//
// Entity의 프로퍼티를 스냅샷하여 보관. Bag ↔ Entity 전환 시 사용.
// Bag은 VM 시뮬레이션과 무관한 플레이어 레벨 개념이므로 HktRule에 위치.
// ============================================================================

struct HKTRULE_API FHktBagItem
{
	int32 BagSlot = -1;                // 가방 내 슬롯 위치
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
		return FString::Printf(TEXT("BagSlot=%d ItemId=%d Atk=%d Def=%d"),
			BagSlot, ItemId, AttackPower, Defense);
	}

	friend FArchive& operator<<(FArchive& Ar, FHktBagItem& I)
	{
		Ar << I.BagSlot << I.ItemId << I.AttackPower << I.Defense << I.Stance;
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
struct TStructOpsTypeTraits<FHktBagItem> : public TStructOpsTypeTraitsBase2<FHktBagItem>
{
	enum { WithNetSerializer = true };
};

// ============================================================================
// FHktBagState — 플레이어 가방 전체 상태
// ============================================================================

struct HKTRULE_API FHktBagState
{
	TArray<FHktBagItem> Items;
	int32 Capacity = 20;

	/** 빈 슬롯 탐색. 없으면 -1 반환. */
	int32 FindEmptySlot() const
	{
		TArray<bool> Occupied;
		Occupied.SetNumZeroed(Capacity);
		for (const FHktBagItem& Item : Items)
		{
			if (Item.BagSlot >= 0 && Item.BagSlot < Capacity)
			{
				Occupied[Item.BagSlot] = true;
			}
		}
		for (int32 i = 0; i < Capacity; ++i)
		{
			if (!Occupied[i]) return i;
		}
		return -1;
	}

	/** 아이템 추가. 성공시 true. */
	bool AddItem(FHktBagItem InItem)
	{
		if (InItem.BagSlot < 0)
		{
			InItem.BagSlot = FindEmptySlot();
		}
		if (InItem.BagSlot < 0 || InItem.BagSlot >= Capacity) return false;
		Items.Add(MoveTemp(InItem));
		return true;
	}

	/** BagSlot으로 아이템 제거. 제거된 아이템을 OutItem에 반환. */
	bool RemoveBySlot(int32 BagSlot, FHktBagItem& OutItem)
	{
		for (int32 i = 0; i < Items.Num(); ++i)
		{
			if (Items[i].BagSlot == BagSlot)
			{
				OutItem = Items[i];
				Items.RemoveAt(i);
				return true;
			}
		}
		return false;
	}

	/** BagSlot으로 아이템 조회. 없으면 nullptr. */
	const FHktBagItem* GetItem(int32 BagSlot) const
	{
		for (const FHktBagItem& Item : Items)
		{
			if (Item.BagSlot == BagSlot) return &Item;
		}
		return nullptr;
	}

	bool IsFull() const { return Items.Num() >= Capacity; }
	int32 GetItemCount() const { return Items.Num(); }

	friend FArchive& operator<<(FArchive& Ar, FHktBagState& S)
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
struct TStructOpsTypeTraits<FHktBagState> : public TStructOpsTypeTraitsBase2<FHktBagState>
{
	enum { WithNetSerializer = true };
};

// ============================================================================
// EHktBagOp / FHktBagDelta — 가방 변경 알림 (S2C)
// ============================================================================

enum class EHktBagOp : uint8
{
	Added    = 0,    // 아이템이 가방에 추가됨
	Removed  = 1,    // 아이템이 가방에서 제거됨
	FullSync = 2,    // 전체 가방 상태 동기화 (로그인/그룹 이동)
};

struct HKTRULE_API FHktBagDelta
{
	EHktBagOp Op = EHktBagOp::Added;
	FHktBagItem Item;                  // Added/Removed 대상
	FHktBagState FullState;            // FullSync 시 전체 상태

	friend FArchive& operator<<(FArchive& Ar, FHktBagDelta& D)
	{
		uint8 OpByte = static_cast<uint8>(D.Op);
		Ar << OpByte;
		if (Ar.IsLoading()) D.Op = static_cast<EHktBagOp>(OpByte);

		if (D.Op == EHktBagOp::FullSync)
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
		if (Ar.IsLoading()) Op = static_cast<EHktBagOp>(OpByte);

		if (Op == EHktBagOp::FullSync)
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
struct TStructOpsTypeTraits<FHktBagDelta> : public TStructOpsTypeTraitsBase2<FHktBagDelta>
{
	enum { WithNetSerializer = true };
};
