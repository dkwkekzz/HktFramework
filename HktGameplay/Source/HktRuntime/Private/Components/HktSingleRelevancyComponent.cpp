// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSingleRelevancyComponent.h"
#include "Terrain/HktTerrainDataSource.h"

UHktSingleRelevancyComponent::UHktSingleRelevancyComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    Simulator = CreateDeterminismSimulator(EHktLogSource::Server);
}

void UHktSingleRelevancyComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UHktSingleRelevancyComponent::RegisterPlayer(IHktWorldPlayer* Player, int32 GroupIndex)
{
    if (!Player) return;
    const int64 Uid = Player->GetPlayerUid();
    RegisteredPlayers.Add(Uid, Player);

    PlayerUids.AddUnique(Uid);
    CachedPlayers.AddUnique(Player);
}

void UHktSingleRelevancyComponent::UnregisterPlayer(int64 PlayerUid)
{
    int32 Index = PlayerUids.IndexOfByKey(PlayerUid);
    if (Index != INDEX_NONE)
    {
        PlayerUids.RemoveAt(Index);
        CachedPlayers.RemoveAt(Index);
    }

    RegisteredPlayers.Remove(PlayerUid);
}

void UHktSingleRelevancyComponent::UpdateRelevancy() 
{ 
    // 단일 그룹 컴포넌트는 그룹 재배치가 필요 없습니다.
}

IHktWorldPlayer* UHktSingleRelevancyComponent::GetWorldPlayer(int64 PlayerUid) const
{
    if (IHktWorldPlayer* const* Found = RegisteredPlayers.Find(PlayerUid)) 
    { 
        return *Found; 
    }
    return nullptr;
}

int32 UHktSingleRelevancyComponent::NumRelevancyGroup() const 
{ 
    return 1; 
}

IHktRelevancyGroup& UHktSingleRelevancyComponent::GetRelevancyGroup(int32 Index) 
{ 
    return *this; 
}

const IHktRelevancyGroup& UHktSingleRelevancyComponent::GetRelevancyGroup(int32 Index) const 
{ 
    return *this; 
}

int32 UHktSingleRelevancyComponent::GetRelevancyGroupIndex(int64 PlayerUid) const
{
    return 0;
}

void UHktSingleRelevancyComponent::SetTerrainConfig(const FHktTerrainGeneratorConfig& Config)
{
    if (Simulator) { Simulator->SetTerrainConfig(Config); }
}

void UHktSingleRelevancyComponent::SetTerrainSource(FTerrainSourceFactory Factory)
{
    if (!Simulator) { return; }
    if (Factory)
    {
        Simulator->SetTerrainSource(Factory());
    }
    else
    {
        // nullptr 팩토리 = 기본 소스로 복귀 (지형 비활성).
        Simulator->SetTerrainSource(nullptr);
    }
}
