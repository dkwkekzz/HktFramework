// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktWorldPlayerComponent.generated.h"

class AHktInGamePlayerController;
class APlayerController;
class APlayerState;
class UHktPlayerInventoryComponent;

UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktWorldPlayerComponent : public UActorComponent, public IHktWorldPlayer
{
    GENERATED_BODY()

public:
    UHktWorldPlayerComponent();

    virtual int64 GetPlayerUid() const override;
    virtual AActor* GetOwnerActor() const override { return GetOwner(); }
    virtual bool IsInitialized() const override;
    virtual void InvalidatePlayerUidCache() override;

    virtual FGameplayTag GetSpawnStoryTag() const override;
    virtual FGameplayTag GetTargetDefaultStoryTag() const override;

    // === Inventory (형제 PlayerInventoryComponent 에 위임) ===
    virtual const FHktInventoryState& GetInventoryState() const override;
    virtual bool StoreToInventory(const FHktInventoryItem& InItem, int32& OutInventorySlot) override;
    virtual bool TakeFromInventory(int32 InventorySlot, FHktInventoryItem& OutItem) override;
    virtual void RestoreInventoryFromRecord(const TArray<FHktInventoryItem>& InInventoryItems, int32 InCapacity = 20) override;
    virtual TArray<FHktInventoryItem> ExportInventoryForRecord() const override;
    virtual void SendInventoryFullSync() override;

protected:
    virtual void BeginPlay() override;

private:
    void UpdatePlayerUidFromPlayerState() const;
    UHktPlayerInventoryComponent* GetInventoryComponent() const;

    mutable int64 PlayerUid = 0;
    mutable bool bPlayerUidCached = false;
    mutable TWeakObjectPtr<UHktPlayerInventoryComponent> CachedInventoryComponent;
};
