#pragma once

#include "CoreMinimal.h"
#include "Net/Serialization/FastArraySerializer.h"
#include "HktTagTypes.generated.h"

// 전방 선언
struct FHktTagContainer;
class UHktTagSubsystem;

/**
 * [네트워크 전송용 태그 항목]
 * - FastArraySerializerItem 상속
 */
USTRUCT()
struct FHktTagEntry : public FFastArraySerializerItem
{
    GENERATED_BODY()

    UPROPERTY()
    uint32 TagId = 0;

    UPROPERTY()
    FString TagString;

    FHktTagEntry() {}
    FHktTagEntry(uint32 InId, const FString& InString) : TagId(InId), TagString(InString) {}

    // 변경 사항 발생 시 호출되는 훅
    void PreReplicatedRemove(const FHktTagContainer& InArraySerializer);
    void PostReplicatedAdd(const FHktTagContainer& InArraySerializer);
    void PostReplicatedChange(const FHktTagContainer& InArraySerializer);
};

/**
 * [태그 컨테이너]
 * - 컴포넌트가 멤버로 가질 데이터 구조
 */
USTRUCT()
struct FHktTagContainer : public FFastArraySerializer
{
    GENERATED_BODY()

    UPROPERTY()
    TArray<FHktTagEntry> Items;

    // 데이터를 수신했을 때 로직을 처리할 매니저 (NotReplicated)
    UPROPERTY(NotReplicated)
    TObjectPtr<UHktTagSubsystem> OwnerManager = nullptr;

    bool NetDeltaSerialize(FNetDeltaSerializeInfo& DeltaParms)
    {
        return FFastArraySerializer::FastArrayDeltaSerialize<FHktTagEntry, FHktTagContainer>(Items, DeltaParms, *this);
    }
};

template<>
struct TStructOpsTypeTraits<FHktTagContainer> : public TStructOpsTypeTraitsBase2<FHktTagContainer>
{
    enum { WithNetDeltaSerializer = true };
};