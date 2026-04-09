#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HktTagTypes.h"
#include "Containers/Queue.h"
#include "HktTagSubsystem.generated.h"

class UHktTagNetworkComponent;

struct FHktTagNode
{
    uint32 ParentId = 0;
    FString TagString;
};

/**
 * [중앙 관리자]
 * - GameInstance Subsystem (게임 인스턴스/세션 단위 생존)
 * - 로컬 데이터 관리 + 네트워크 컴포넌트 제어
 * - PIE(Play In Editor) 멀티 프로세스 테스트 시 각 창마다 독립된 매니저를 가짐
 */
UCLASS()
class HKTASSET_API UHktTagSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    // GameInstance는 전역 싱글톤이 아니므로(PIE 멀티 등) 컨텍스트가 필요함
    static UHktTagSubsystem* Get(const UObject* WorldContextObject);

    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    // [API] 태그 ID 요청 (Thread-Safe)
    uint32 RequestTagId(const FString& TagString, bool bAllowCreate = true);

    // [API] 태그 이름 조회 (Thread-Safe)
    FString GetTagName(uint32 TagId) const;

    // [System] 네트워크로부터 태그 수신 (FHktTagEntry Hook에서 호출)
    void OnTagReceivedFromNetwork(const FHktTagEntry& NewEntry);

    // [New] 대기열에서 태그 꺼내기
    bool DequeuePendingTag(FString& OutTagString);

private:
    // --- Local Data (Thread-Safe) ---
    TArray<FHktTagNode> Nodes;
    TMap<uint32, uint32> LookupMap;
    mutable FRWLock RWLock;

    // --- Network Sync Queue ---
    // 워커 스레드 -> 게임 스레드 전송용
    TQueue<FString, EQueueMode::Mpsc> PendingNetworkSyncQueue;

    // ID 발급 카운터
    uint32 NextTagId = 1;
};
