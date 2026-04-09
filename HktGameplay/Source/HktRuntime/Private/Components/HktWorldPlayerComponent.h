// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktWorldPlayerComponent.generated.h"

class AHktInGamePlayerController;
class APlayerController;
class APlayerState;
class UHktBagComponent;

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

    // === Bag (형제 BagComponent에 위임) ===
    virtual const FHktBagState& GetBagState() const override;
    virtual bool StoreToBag(const FHktBagItem& InItem, int32& OutBagSlot) override;
    virtual bool TakeFromBag(int32 BagSlot, FHktBagItem& OutItem) override;
    virtual void RestoreBagFromRecord(const TArray<FHktBagItem>& InBagItems, int32 InCapacity = 20) override;
    virtual TArray<FHktBagItem> ExportBagForRecord() const override;
    virtual void SendBagFullSync() override;

protected:
    virtual void BeginPlay() override;

private:
    void UpdatePlayerUidFromPlayerState() const;
    UHktBagComponent* GetBagComponent() const;

    mutable int64 PlayerUid = 0;
    mutable bool bPlayerUidCached = false;
    mutable TWeakObjectPtr<UHktBagComponent> CachedBagComponent;
};
