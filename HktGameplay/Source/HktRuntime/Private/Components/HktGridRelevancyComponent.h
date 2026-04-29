// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktCoreSimulator.h"
#include "HktRuntimeTypes.h"
#include "HktGridRelevancyComponent.generated.h"

class FHktRelevancyGroupImpl : public IHktRelevancyGroup, public IHktAuthoritySimulator
{
public:
    FHktRelevancyGroupImpl();

    // IHktAuthoritySimulator
    virtual void AdvanceFrame(const FHktSimulationEvent& InEvent) override { Simulator->AdvanceFrame(InEvent); }
    virtual const FHktWorldState& GetWorldState() const override { return Simulator->GetWorldState(); }
    virtual FHktPlayerState ExportPlayerState(int64 OwnerUid) const override { return Simulator->ExportPlayerState(OwnerUid); }

    // IHktRelevancyGroup
    virtual const TArray<int64>& GetPlayerUids() const override { return PlayerUids; }
    virtual const TArray<IHktWorldPlayer*>& GetCachedWorldPlayers() const override { return CachedPlayers; }
    virtual const IHktAuthoritySimulator& GetSimulator() const override { return *this; }
    virtual IHktAuthoritySimulator& GetSimulator() override { return *this; }

    void AddPlayer(int64 Uid, IHktWorldPlayer* Player);
    void RemovePlayer(int64 Uid);
    bool HasPlayer(int64 Uid) const;

    void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config);
    void SetTerrainSource(TUniquePtr<IHktTerrainDataSource> InSource);

private:
    TUniquePtr<IHktDeterminismSimulator> Simulator;
    TArray<int64> PlayerUids;
    TArray<IHktWorldPlayer*> CachedPlayers;
};

UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktGridRelevancyComponent : public UActorComponent, public IHktRelevancyGraph
{
    GENERATED_BODY()

public:
    UHktGridRelevancyComponent();

    virtual void RegisterPlayer(IHktWorldPlayer* Player, int32 GroupIndex) override;
    virtual void UnregisterPlayer(int64 PlayerUid) override;
    virtual void UpdateRelevancy() override;
    virtual IHktWorldPlayer* GetWorldPlayer(int64 PlayerUid) const override;
    virtual int32 GetWorldPlayerCount() const override { return RegisteredPlayers.Num(); }
    virtual int32 NumRelevancyGroup() const override;
    virtual IHktRelevancyGroup& GetRelevancyGroup(int32 Index) override;
    virtual const IHktRelevancyGroup& GetRelevancyGroup(int32 Index) const override;
    virtual int32 GetRelevancyGroupIndex(int64 PlayerUid) const override;
    virtual int32 CalculateRelevancyGroupIndex(FVector PlayerPos) const override;
    virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) override;
    virtual void SetTerrainSource(FTerrainSourceFactory Factory) override;

    FIntPoint LocationToCell(const FVector& Location) const;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Grid")
    float CellSize = 5000.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Grid")
    int32 NumInitialGroups = 1;

protected:
    virtual void BeginPlay() override;

private:
    TMap<int64, IHktWorldPlayer*> RegisteredPlayers;
    TArray<FHktRelevancyGroupImpl> Groups;
};
