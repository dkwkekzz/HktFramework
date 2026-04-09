// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldPlayerComponent.h"
#include "HktBagComponent.h"
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
            }
        }
    }
    
    bPlayerUidCached = true;
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

// ============================================================================
// Bag — 형제 BagComponent에 위임
// ============================================================================

UHktBagComponent* UHktWorldPlayerComponent::GetBagComponent() const
{
    if (!CachedBagComponent.IsValid())
    {
        if (AActor* Owner = GetOwner())
        {
            CachedBagComponent = Owner->FindComponentByClass<UHktBagComponent>();
        }
    }
    return CachedBagComponent.Get();
}

const FHktBagState& UHktWorldPlayerComponent::GetBagState() const
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        return Bag->GetServerBagState();
    }
    static FHktBagState Empty;
    return Empty;
}

bool UHktWorldPlayerComponent::StoreToBag(const FHktBagItem& InItem, int32& OutBagSlot)
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        return Bag->Server_StoreBagItem(InItem, OutBagSlot);
    }
    return false;
}

bool UHktWorldPlayerComponent::TakeFromBag(int32 BagSlot, FHktBagItem& OutItem)
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        return Bag->Server_RestoreFromBag(BagSlot, OutItem);
    }
    return false;
}

void UHktWorldPlayerComponent::RestoreBagFromRecord(const TArray<FHktBagItem>& InBagItems, int32 InCapacity)
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        Bag->Server_RestoreFromRecord(InBagItems, InCapacity);
    }
}

TArray<FHktBagItem> UHktWorldPlayerComponent::ExportBagForRecord() const
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        return Bag->Server_ExportForRecord();
    }
    return {};
}

void UHktWorldPlayerComponent::SendBagFullSync()
{
    if (UHktBagComponent* Bag = GetBagComponent())
    {
        Bag->Server_SendFullSync();
    }
}
