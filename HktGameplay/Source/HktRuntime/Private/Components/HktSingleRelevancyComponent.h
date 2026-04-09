// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktCoreSimulator.h"
#include "HktRuntimeTypes.h"
#include "HktSingleRelevancyComponent.generated.h"

UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktSingleRelevancyComponent : public UActorComponent, public IHktRelevancyGraph, public IHktRelevancyGroup, public IHktAuthoritySimulator
{
    GENERATED_BODY()

public:
    UHktSingleRelevancyComponent();

    // IHktRelevancyGraph
    virtual void RegisterPlayer(IHktWorldPlayer* Player, int32 GroupIndex) override;
    virtual void UnregisterPlayer(int64 PlayerUid) override;
    virtual void UpdateRelevancy() override;
    virtual IHktWorldPlayer* GetWorldPlayer(int64 PlayerUid) const override;
    virtual int32 GetWorldPlayerCount() const override { return RegisteredPlayers.Num(); }
    virtual int32 NumRelevancyGroup() const override;
    virtual IHktRelevancyGroup& GetRelevancyGroup(int32 Index) override;
    virtual const IHktRelevancyGroup& GetRelevancyGroup(int32 Index) const override;
    virtual int32 GetRelevancyGroupIndex(int64 PlayerUid) const override;
    virtual int32 CalculateRelevancyGroupIndex(FVector PlayerPos) const override { return 0; }
    virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) override;

    // IHktAuthoritySimulator
    virtual void AdvanceFrame(const FHktSimulationEvent& InEvent) override { Simulator->AdvanceFrame(InEvent); }
    virtual const FHktWorldState& GetWorldState() const override { return Simulator->GetWorldState(); }
    virtual FHktPlayerState ExportPlayerState(int64 OwnerUid) const override { return Simulator->ExportPlayerState(OwnerUid); }

    // IHktRelevancyGroup
    virtual const TArray<int64>& GetPlayerUids() const override { return PlayerUids; }
    virtual const TArray<IHktWorldPlayer*>& GetCachedWorldPlayers() const override { return CachedPlayers; }
    virtual const IHktAuthoritySimulator& GetSimulator() const override { return *this; }
    virtual IHktAuthoritySimulator& GetSimulator() { return *this; }

protected:
    virtual void BeginPlay() override;

private:
    TUniquePtr<IHktDeterminismSimulator> Simulator;
    TMap<int64, IHktWorldPlayer*> RegisteredPlayers;
    TArray<int64> PlayerUids;
    TArray<IHktWorldPlayer*> CachedPlayers;
};
