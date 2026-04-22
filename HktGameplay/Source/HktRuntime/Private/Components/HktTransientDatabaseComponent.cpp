// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTransientDatabaseComponent.h"
#include "HktRuntimeLog.h"
#include "HktCoreEventLog.h"
#include "GameplayTagContainer.h"
#include "HktRuntimeTags.h"
#include "Settings/HktRuntimeGlobalSetting.h"

UHktTransientDatabaseComponent::UHktTransientDatabaseComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    DefaultVisualTag = HktGameplayTags::Visual_Character_Default;
    DefaultFlowTag = HktGameplayTags::Flow_Character_Default;
}

// ============================================================================
// IHktWorldDatabase 구현
// ============================================================================

void UHktTransientDatabaseComponent::LoadPlayerRecordAsync(int64 InPlayerUid, const FGameplayTag& InSpawnStoryTag, TFunction<void(const FHktPlayerRecord&)> InCallback)
{
    // 메모리에서 레코드 찾기
    if (FHktPlayerRecord* Cached = TransientRecords.Find(InPlayerUid))
    {
        InCallback(*Cached);
        return;
    }

    // 레코드가 없으면 새로 생성
    FHktPlayerRecord& NewRecord = TransientRecords.Add(InPlayerUid);
    NewRecord.PlayerUid = InPlayerUid;
    NewRecord.CreatedTime = FDateTime::UtcNow();
    NewRecord.LastLoginTime = NewRecord.CreatedTime;

    // 신규 플레이어 레코드에 월드 진입 이벤트 추가
    // PC가 지정한 Spawn Story Tag가 없으면 기본값(Story.State.Player.InWorld) 사용
    const FGameplayTag EnterTag = InSpawnStoryTag.IsValid()
        ? InSpawnStoryTag
        : HktGameplayTags::Story_PlayerInWorld;

    FHktEvent EnterWorldEvent;
    EnterWorldEvent.EventTag = EnterTag;
    EnterWorldEvent.SourceEntity = static_cast<FHktEntityId>(InPlayerUid); // 임시, 플로우에서 실제 엔티티 생성
    EnterWorldEvent.TargetEntity = InvalidEntityId;
    EnterWorldEvent.Location = GetDefault<UHktRuntimeGlobalSetting>()->ComputeDefaultSpawnLocation();
    EnterWorldEvent.PlayerUid = InPlayerUid;
    NewRecord.ActiveEvents.Add(EnterWorldEvent);

    InCallback(NewRecord);
}

void UHktTransientDatabaseComponent::SavePlayerRecordAsync(int64 InPlayerUid, FHktPlayerState&& InState, TArray<FHktBagItem>&& InBagItems)
{
    // 기존 레코드 로드 또는 새로 생성
    FHktPlayerRecord* ExistingRecord = TransientRecords.Find(InPlayerUid);

    if (ExistingRecord)
    {
        // 기존 레코드 업데이트: ActiveEvents와 EntityStates만 이동
        ExistingRecord->ActiveEvents = MoveTemp(InState.ActiveEvents);
        ExistingRecord->EntityStates = MoveTemp(InState.OwnedEntities);
        ExistingRecord->BagItems = MoveTemp(InBagItems);
        // LastLoginTime, CreatedTime, LastPosition은 유지
    }
    else
    {
        // 신규 레코드 생성
        FHktPlayerRecord NewRecord;
        NewRecord.PlayerUid = InPlayerUid;
        NewRecord.CreatedTime = FDateTime::UtcNow();
        NewRecord.LastLoginTime = NewRecord.CreatedTime;
        NewRecord.LastPosition = FVector::ZeroVector;
        NewRecord.ActiveEvents = MoveTemp(InState.ActiveEvents);
        NewRecord.EntityStates = MoveTemp(InState.OwnedEntities);
        NewRecord.BagItems = MoveTemp(InBagItems);

        TransientRecords.Add(InPlayerUid, MoveTemp(NewRecord));
    }
    
    HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Verbose, EHktLogSource::Server, FString::Printf(TEXT("[TransientDatabase] Saved player record in memory: PlayerUid=%lld"), InPlayerUid));
}

const FHktPlayerRecord* UHktTransientDatabaseComponent::GetCachedPlayerRecord(int64 InPlayerUid) const
{
    return TransientRecords.Find(InPlayerUid);
}