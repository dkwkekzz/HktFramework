// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPlayerInventoryComponent.h"
#include "HktCoreProperties.h"
#include "HktCoreEventLog.h"
#include "HktRuntimeLog.h"

UHktPlayerInventoryComponent::UHktPlayerInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

// ============================================================================
// 서버 전용 API
// ============================================================================

bool UHktPlayerInventoryComponent::Server_StoreFromEntity(
	const FHktWorldState& WS, FHktEntityId ItemEntity, int32& OutInventorySlot)
{
	if (!WS.IsValidEntity(ItemEntity))
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(TEXT("PlayerInventoryComponent::StoreFromEntity — invalid entity %d"), ItemEntity));
		return false;
	}

	if (ServerInventoryState.IsFull())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, TEXT("PlayerInventoryComponent::StoreFromEntity — inventory is full"));
		return false;
	}

	// 엔티티 프로퍼티를 FHktInventoryItem으로 스냅샷
	FHktInventoryItem InventoryItem;
	InventoryItem.ItemId              = WS.GetProperty(ItemEntity, PropertyId::ItemId);
	InventoryItem.AttackPower         = WS.GetProperty(ItemEntity, PropertyId::AttackPower);
	InventoryItem.Defense             = WS.GetProperty(ItemEntity, PropertyId::Defense);
	InventoryItem.Stance              = WS.GetProperty(ItemEntity, PropertyId::Stance);
	InventoryItem.ItemSkillTag        = WS.GetProperty(ItemEntity, PropertyId::ItemSkillTag);
	InventoryItem.SkillCPCost         = WS.GetProperty(ItemEntity, PropertyId::SkillCPCost);
	InventoryItem.SkillTargetRequired = WS.GetProperty(ItemEntity, PropertyId::SkillTargetRequired);
	InventoryItem.RecoveryFrame       = WS.GetProperty(ItemEntity, PropertyId::RecoveryFrame);
	InventoryItem.Equippable          = WS.GetProperty(ItemEntity, PropertyId::Equippable);
	InventoryItem.EntitySpawnTag      = WS.GetProperty(ItemEntity, PropertyId::EntitySpawnTag);

	if (!InventoryItem.IsValid())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(TEXT("PlayerInventoryComponent::StoreFromEntity — item %d has invalid ItemId"), ItemEntity));
		return false;
	}

	// 빈 슬롯 할당
	InventoryItem.InventorySlot = ServerInventoryState.FindEmptySlot();
	if (InventoryItem.InventorySlot < 0)
	{
		return false;
	}

	OutInventorySlot = InventoryItem.InventorySlot;
	ServerInventoryState.Items.Add(InventoryItem);

	HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("InventoryStore: Entity=%d → InventorySlot=%d ItemId=%d"),
			ItemEntity, InventoryItem.InventorySlot, InventoryItem.ItemId));

	// 소유자 클라이언트에 알림
	Server_SendDelta(EHktInventoryOp::Added, InventoryItem);

	return true;
}

bool UHktPlayerInventoryComponent::Server_StoreInventoryItem(const FHktInventoryItem& InItem, int32& OutInventorySlot)
{
	if (ServerInventoryState.IsFull())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, TEXT("PlayerInventoryComponent::StoreInventoryItem — inventory is full"));
		return false;
	}

	if (!InItem.IsValid())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, TEXT("PlayerInventoryComponent::StoreInventoryItem — invalid item"));
		return false;
	}

	FHktInventoryItem ItemCopy = InItem;
	ItemCopy.InventorySlot = ServerInventoryState.FindEmptySlot();
	if (ItemCopy.InventorySlot < 0)
	{
		return false;
	}

	OutInventorySlot = ItemCopy.InventorySlot;
	ServerInventoryState.Items.Add(ItemCopy);

	HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("InventoryStoreItem: InventorySlot=%d ItemId=%d"),
			ItemCopy.InventorySlot, ItemCopy.ItemId));

	Server_SendDelta(EHktInventoryOp::Added, ItemCopy);
	return true;
}

bool UHktPlayerInventoryComponent::Server_RestoreFromInventory(int32 InventorySlot, FHktInventoryItem& OutItem)
{
	if (!ServerInventoryState.RemoveBySlot(InventorySlot, OutItem))
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(TEXT("PlayerInventoryComponent::RestoreFromInventory — InventorySlot=%d not found"), InventorySlot));
		return false;
	}

	HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("InventoryRestore: InventorySlot=%d ItemId=%d"),
			InventorySlot, OutItem.ItemId));

	// 소유자 클라이언트에 알림
	Server_SendDelta(EHktInventoryOp::Removed, OutItem);

	return true;
}


void UHktPlayerInventoryComponent::Server_RestoreFromRecord(const TArray<FHktInventoryItem>& InInventoryItems, int32 InCapacity)
{
	ServerInventoryState.Items = InInventoryItems;
	ServerInventoryState.Capacity = InCapacity;

	HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("InventoryRestoreFromRecord: %d items, capacity=%d"),
			InInventoryItems.Num(), InCapacity));
}

void UHktPlayerInventoryComponent::Server_SendFullSync()
{
	FHktInventoryDelta Delta;
	Delta.Op = EHktInventoryOp::FullSync;
	Delta.FullState = ServerInventoryState;

	Client_ReceiveInventoryUpdate(FHktRuntimeInventoryUpdate(MoveTemp(Delta)));

	HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("InventoryFullSync: %d items"), ServerInventoryState.GetItemCount()));
}

void UHktPlayerInventoryComponent::Server_SendDelta(EHktInventoryOp Op, const FHktInventoryItem& Item)
{
	FHktInventoryDelta Delta;
	Delta.Op = Op;
	Delta.Item = Item;

	Client_ReceiveInventoryUpdate(FHktRuntimeInventoryUpdate(MoveTemp(Delta)));
}

// ============================================================================
// S2C RPC — 클라이언트측 처리
// ============================================================================

void UHktPlayerInventoryComponent::Client_ReceiveInventoryUpdate_Implementation(const FHktRuntimeInventoryUpdate& Update)
{
	const FHktInventoryDelta& Delta = Update.Value;

	switch (Delta.Op)
	{
	case EHktInventoryOp::FullSync:
		LocalInventoryState = Delta.FullState;
		HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("InventoryFullSync received: %d items"), LocalInventoryState.GetItemCount()));
		break;

	case EHktInventoryOp::Added:
		LocalInventoryState.AddItem(Delta.Item);
		HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("InventoryAdded: InventorySlot=%d ItemId=%d"), Delta.Item.InventorySlot, Delta.Item.ItemId));
		break;

	case EHktInventoryOp::Removed:
		{
			FHktInventoryItem Removed;
			LocalInventoryState.RemoveBySlot(Delta.Item.InventorySlot, Removed);
			HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("InventoryRemoved: InventorySlot=%d ItemId=%d"), Delta.Item.InventorySlot, Delta.Item.ItemId));
		}
		break;
	}

	InventoryChangedDelegate.Broadcast(Delta);
}
