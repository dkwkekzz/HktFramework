// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldPlayerComponent.h"
#include "HktPlayerInventoryComponent.h"
#include "Actors/HktInGamePlayerController.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerState.h"

UHktWorldPlayerComponent::UHktWorldPlayerComponent()
{ 
    PrimaryComponentTick.bCanEverTick = false; 
}

void UHktWorldPlayerComponent::BeginPlay()
{
    Super::BeginPlay();
    
    // PlayerState가 이미 존재할 수 있으므로 초기 UID 계산 시도
    UpdatePlayerUidFromPlayerState();
}

int64 UHktWorldPlayerComponent::GetPlayerUid() const
{
    if (!bPlayerUidCached)
    {
        UpdatePlayerUidFromPlayerState();
    }
    return PlayerUid;
}

void UHktWorldPlayerComponent::UpdatePlayerUidFromPlayerState() const
{
    if (bPlayerUidCached)
    {
        return;
    }

    PlayerUid = 0;

    if (APlayerController* PC = Cast<APlayerController>(GetOwner()))
    {
        if (APlayerState* PS = PC->GetPlayerState<APlayerState>())
        {
            FUniqueNetIdRepl UniqueId = PS->GetUniqueId();
            if (UniqueId.IsValid())
            {
                PlayerUid = GetTypeHash(UniqueId->ToString());
                // UniqueId가 유효하고 Uid 계산이 완료된 경우에만 캐시 확정.
                // PlayerState가 없거나 UniqueId가 아직 미설정인 경우 캐시를 열어두어
                // OnRep_PlayerState / 서버 재확인 시 재시도할 수 있도록 한다.
                bPlayerUidCached = true;
            }
        }
    }
}

bool UHktWorldPlayerComponent::IsInitialized() const
{
    return PlayerUid != 0;
}

void UHktWorldPlayerComponent::InvalidatePlayerUidCache()
{
    bPlayerUidCached = false;
    PlayerUid = 0;
}

FGameplayTag UHktWorldPlayerComponent::GetSpawnStoryTag() const
{
    if (const AHktIngamePlayerController* PC = Cast<AHktIngamePlayerController>(GetOwner()))
    {
        return PC->GetPlayerSpawnStoryTag();
    }
    return FGameplayTag();
}

FGameplayTag UHktWorldPlayerComponent::GetTargetDefaultStoryTag() const
{
    if (const AHktIngamePlayerController* PC = Cast<AHktIngamePlayerController>(GetOwner()))
    {
        return PC->GetTargetDefaultStoryTag();
    }
    return FGameplayTag();
}

// ============================================================================
// Inventory — 형제 PlayerInventoryComponent 에 위임
// ============================================================================

UHktPlayerInventoryComponent* UHktWorldPlayerComponent::GetInventoryComponent() const
{
    if (!CachedInventoryComponent.IsValid())
    {
        if (AActor* Owner = GetOwner())
        {
            CachedInventoryComponent = Owner->FindComponentByClass<UHktPlayerInventoryComponent>();
        }
    }
    return CachedInventoryComponent.Get();
}

const FHktInventoryState& UHktWorldPlayerComponent::GetInventoryState() const
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        return Inventory->GetServerInventoryState();
    }
    static FHktInventoryState Empty;
    return Empty;
}

bool UHktWorldPlayerComponent::StoreToInventory(const FHktInventoryItem& InItem, int32& OutInventorySlot)
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        return Inventory->Server_StoreInventoryItem(InItem, OutInventorySlot);
    }
    return false;
}

bool UHktWorldPlayerComponent::TakeFromInventory(int32 InventorySlot, FHktInventoryItem& OutItem)
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        return Inventory->Server_RestoreFromInventory(InventorySlot, OutItem);
    }
    return false;
}

void UHktWorldPlayerComponent::RestoreInventoryFromRecord(const TArray<FHktInventoryItem>& InInventoryItems, int32 InCapacity)
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        Inventory->Server_RestoreFromRecord(InInventoryItems, InCapacity);
    }
}

TArray<FHktInventoryItem> UHktWorldPlayerComponent::ExportInventoryForRecord() const
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        return Inventory->Server_ExportForRecord();
    }
    return {};
}

void UHktWorldPlayerComponent::SendInventoryFullSync()
{
    if (UHktPlayerInventoryComponent* Inventory = GetInventoryComponent())
    {
        Inventory->Server_SendFullSync();
    }
}
