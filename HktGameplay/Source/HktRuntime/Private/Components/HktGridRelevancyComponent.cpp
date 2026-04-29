// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktGridRelevancyComponent.h"
#include "Terrain/HktTerrainDataSource.h"

FHktRelevancyGroupImpl::FHktRelevancyGroupImpl()
{
    Simulator = CreateDeterminismSimulator(EHktLogSource::Server);
}

void FHktRelevancyGroupImpl::AddPlayer(int64 Uid, IHktWorldPlayer* Player)
{
    PlayerUids.AddUnique(Uid);
    CachedPlayers.AddUnique(Player);
}

void FHktRelevancyGroupImpl::RemovePlayer(int64 Uid)
{
    int32 Index = PlayerUids.IndexOfByKey(Uid);
    if (Index != INDEX_NONE)
    {
        PlayerUids.RemoveAt(Index);
        CachedPlayers.RemoveAt(Index);
    }
}

bool FHktRelevancyGroupImpl::HasPlayer(int64 Uid) const
{
    return PlayerUids.Contains(Uid);
}

void FHktRelevancyGroupImpl::SetTerrainConfig(const FHktTerrainGeneratorConfig& Config)
{
    if (Simulator) { Simulator->SetTerrainConfig(Config); }
}

void FHktRelevancyGroupImpl::SetTerrainSource(TUniquePtr<IHktTerrainDataSource> InSource)
{
    if (Simulator) { Simulator->SetTerrainSource(MoveTemp(InSource)); }
}

UHktGridRelevancyComponent::UHktGridRelevancyComponent() { PrimaryComponentTick.bCanEverTick = false; }

void UHktGridRelevancyComponent::BeginPlay()
{
    Super::BeginPlay();
    Groups.SetNum(FMath::Max(NumInitialGroups, 1));
}

void UHktGridRelevancyComponent::RegisterPlayer(IHktWorldPlayer* Player, int32 GroupIndex)
{
    if (!Player) return;
    const int64 Uid = Player->GetPlayerUid();
    RegisteredPlayers.Add(Uid, Player);
    if (Groups.IsValidIndex(GroupIndex)) { Groups[GroupIndex].AddPlayer(Uid, Player); }
}

void UHktGridRelevancyComponent::UnregisterPlayer(int64 PlayerUid)
{
    for (FHktRelevancyGroupImpl& Group : Groups) { Group.RemovePlayer(PlayerUid); }
    RegisteredPlayers.Remove(PlayerUid);
}

void UHktGridRelevancyComponent::UpdateRelevancy() { /* TODO: 셀 변경에 따른 그룹 재배치 */ }

IHktWorldPlayer* UHktGridRelevancyComponent::GetWorldPlayer(int64 PlayerUid) const
{
    if (IHktWorldPlayer* const* Found = RegisteredPlayers.Find(PlayerUid)) { return *Found; }
    return nullptr;
}

int32 UHktGridRelevancyComponent::NumRelevancyGroup() const { return Groups.Num(); }

IHktRelevancyGroup& UHktGridRelevancyComponent::GetRelevancyGroup(int32 Index) { return Groups[Index]; }

const IHktRelevancyGroup& UHktGridRelevancyComponent::GetRelevancyGroup(int32 Index) const { return Groups[Index]; }

FIntPoint UHktGridRelevancyComponent::LocationToCell(const FVector& Location) const
{
    return FIntPoint(FMath::FloorToInt(Location.X / CellSize), FMath::FloorToInt(Location.Y / CellSize));
}

int32 UHktGridRelevancyComponent::GetRelevancyGroupIndex(int64 PlayerUid) const
{
    for (int32 Index = 0; Index < Groups.Num(); ++Index)
    {
        if (Groups[Index].HasPlayer(PlayerUid))
        {
            return Index;
        }
    }
    return 0;
}

int32 UHktGridRelevancyComponent::CalculateRelevancyGroupIndex(FVector PlayerPos) const
{
    return 0;
}

void UHktGridRelevancyComponent::SetTerrainConfig(const FHktTerrainGeneratorConfig& Config)
{
    for (FHktRelevancyGroupImpl& Group : Groups)
    {
        Group.SetTerrainConfig(Config);
    }
}

void UHktGridRelevancyComponent::SetTerrainSource(FTerrainSourceFactory Factory)
{
    // 그룹별 시뮬레이터는 각자 lifetime 의 데이터 소스를 보유해야 한다 — 팩토리를 그룹마다 호출해
    // 동일 정책의 새 인스턴스를 분배. 팩토리 nullptr 이면 모든 그룹의 소스를 해제(지형 비활성).
    for (FHktRelevancyGroupImpl& Group : Groups)
    {
        Group.SetTerrainSource(Factory ? Factory() : TUniquePtr<IHktTerrainDataSource>());
    }
}
