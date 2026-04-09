#include "HktTagSubsystem.h"
#include "Net/UnrealNetwork.h"
#include "Engine/Engine.h"

// ============================================================================
// UHktTagSubsystem
// ============================================================================

UHktTagSubsystem* UHktTagSubsystem::Get(const UObject* WorldContextObject)
{
    if (UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull))
    {
        if (UGameInstance* GameInstance = World->GetGameInstance())
        {
            return GameInstance->GetSubsystem<UHktTagSubsystem>();
        }
    }
    return nullptr;
}

void UHktTagSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

    // 0번 더미 노드
    Nodes.AddDefaulted();

    // [변경] 틱 처리는 HktTagNetworkComponent::TickComponent()에서 수행
    // Subsystem 틱 등록 제거됨
}

void UHktTagSubsystem::Deinitialize()
{
    // [변경] 틱 등록이 없으므로 제거 코드도 불필요
    Super::Deinitialize();
}

// [제거됨] RegisterNetworkComponent/UnregisterNetworkComponent
// Component가 틱에서 직접 Subsystem을 가져와 DequeuePendingTag()를 호출하므로
// Subsystem에서 Component를 추적할 필요가 없음

uint32 UHktTagSubsystem::RequestTagId(const FString& TagString, bool bAllowCreate)
{
    if (TagString.IsEmpty()) return 0;
    uint32 Hash = GetTypeHash(TagString);

    // 1. Read Lock (Fast Path)
    {
        FRWScopeLock ReadLock(RWLock, SLT_ReadOnly);
        if (const uint32* FoundId = LookupMap.Find(Hash))
        {
            return *FoundId;
        }
    }

    if (!bAllowCreate) return 0;

    // 2. Write Lock (Creation Path)
    {
        FRWScopeLock WriteLock(RWLock, SLT_Write);

        // Double Check
        if (const uint32* FoundId = LookupMap.Find(Hash))
        {
            return *FoundId;
        }

        uint32 NewId = NextTagId++;
        
        // 노드 생성
        FHktTagNode NewNode;
        NewNode.TagString = TagString;
        if (Nodes.Num() <= (int32)NewId) Nodes.SetNum(NewId + 1);
        Nodes[NewId] = NewNode;
        LookupMap.Add(Hash, NewId);

        // [중요] 네트워크 큐잉
        // 서버 권한이 있는 경우에만 전파 대기열에 추가
        // (여기서 WorldContext를 구하기 어려우면 무조건 넣고 Tick에서 필터링하거나,
        //  Subsystem은 World가 없으므로 Component 등록 여부로 판단)
        PendingNetworkSyncQueue.Enqueue(TagString);

        return NewId;
    }
}

FString UHktTagSubsystem::GetTagName(uint32 TagId) const
{
    FRWScopeLock ReadLock(RWLock, SLT_ReadOnly);
    if (Nodes.IsValidIndex(TagId))
    {
        return Nodes[TagId].TagString;
    }
    return TEXT("None");
}

void UHktTagSubsystem::OnTagReceivedFromNetwork(const FHktTagEntry& NewEntry)
{
    // 클라이언트: 서버로부터 받은 ID 강제 주입
    FRWScopeLock WriteLock(RWLock, SLT_Write);
    
    uint32 Hash = GetTypeHash(NewEntry.TagString);
    if (!LookupMap.Contains(Hash))
    {
        FHktTagNode NewNode;
        NewNode.TagString = NewEntry.TagString;
        
        if (Nodes.Num() <= (int32)NewEntry.TagId) Nodes.SetNum(NewEntry.TagId + 1);
        
        Nodes[NewEntry.TagId] = NewNode;
        LookupMap.Add(Hash, NewEntry.TagId);
        
        // ID 카운터 동기화
        if (NextTagId <= NewEntry.TagId) NextTagId = NewEntry.TagId + 1;
    }
}

bool UHktTagSubsystem::DequeuePendingTag(FString& OutTagString)
{
    return PendingNetworkSyncQueue.Dequeue(OutTagString);
}